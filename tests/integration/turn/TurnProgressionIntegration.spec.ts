import { createPinia, setActivePinia } from 'pinia';
import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { TileMap } from '@/engine/world/TileMap';
import { TileType, Direction } from '@/engine/types';
import { Player } from '@/engine/entity/Player';
import { EnergyComponent } from '@/engine/entity/components/Energy';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { MovementComponent } from '@/engine/entity/components/Movement';
import { TurnScheduler } from '@/engine/turn/TurnScheduler';
import { TurnSystem } from '@/engine/turn/TurnSystem';
import { createMoveAction } from '@/engine/turn/ActionExecutor';
import { InputSystem } from '@/engine/input/InputSystem';

/**
 * 結合テスト I-1〜I-3: ターン進行・入力・行動実行の連鎖
 *
 * docs/TESTING_STRATEGY.md §8 段階2:
 * - I-1: 固定マップ + TurnScheduler + InputSystem。1入力でターンが 1 だけ進む
 * - I-2: 30 手連続入力してもループが停止せず、エラーが出ない
 * - I-3: 移動失敗の直後でも次の入力が受け付けられる
 *
 * 実 ActionExecutor、固定 TileMap、TurnSystem、InputSystem を結線して検証する。
 * I-3 はキーボードイベント → InputSystem.requestPlayerMove → scheduler の実経路を通す。
 */
describe('結合テスト I-1〜I-3: ターン進行・入力・行動実行の連鎖', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let scheduler: TurnScheduler;
  let turnSystem: TurnSystem;
  let input: InputSystem;
  let player: Player;
  let assetsLoadSpy: jest.SpyInstance;

  beforeEach(async () => {
    setActivePinia(createPinia());
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    assetsLoadSpy = jest.spyOn(PIXI.Assets, 'load').mockResolvedValue(PIXI.Texture.EMPTY as any);

    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    Engine.instance.registerSystem('event', events);
    Engine.instance.registerSystem('entity', entities);

    const engine = Engine.instance;
    await entities.initialize(engine);

    // 固定 TileMap を構築（全タイル通行可能）
    const map = new TileMap(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.setTileAt(x, y, 0, TileType.TILE, true);
      }
    }
    const worldSystem = new WorldSystem(map);
    Engine.instance.registerSystem('world', worldSystem);
    await worldSystem.initialize(engine);

    // プレイヤーを作成して登録
    player = new Player(
      'player',
      { x: 5, y: 5, z: 0 },
      {
        maxHp: 100,
        hp: 100,
        maxEnergy: 200,
        energy: 200,
        defense: 5,
        attackPower: 15,
        viewRadius: 4,
        level: 1,
      }
    );
    await player.initialize();
    entities.registerEntity(player);

    // TurnScheduler は内部で実 ActionExecutor を生成する
    scheduler = new TurnScheduler();
    scheduler.initialize(Engine.instance);

    // TurnSystem を登録し scheduler を注入（二重登録で二重進行しないか検出）
    turnSystem = new TurnSystem();
    await turnSystem.initialize(engine);
    turnSystem.setScheduler(scheduler);
    Engine.instance.registerSystem('turn', turnSystem);

    // InputSystem を実初期化（keyboard listener + player_input_requested listener）
    input = new InputSystem();
    input.setScheduler(scheduler);
    await input.initialize(engine);
    Engine.instance.registerSystem('input', input);
  });

  afterEach(() => {
    scheduler.stop();
    input.destroy();
    Engine.instance.reset();
    assetsLoadSpy.mockRestore();
    jest.restoreAllMocks();
  });

  /** プレイヤー入力待ち状態になるまで待つ（poll 方式） */
  async function waitForInputReady(timeoutMs = 1000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (scheduler.isWaitingForPlayerInput() && input.isInputEnabled()) return;
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  /** ターン番号が期待値になるまで待つ */
  async function waitForTurnNumber(expected: number, timeoutMs = 1000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (scheduler.getTurnNumber() === expected && scheduler.isWaitingForPlayerInput()) {
        const movement = player.getComponent<MovementComponent>('movement');
        if (movement) movement.update(300);
        return;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  /** キーボードイベントを dispatch して InputSystem 経由で移動を要求する */
  function dispatchKey(key: string): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  /**
   * I-1: プレイヤー1回の入力で turnNumber がちょうど 1 だけ進む
   *
   * 防ぐ不具合 #6: TurnSystem と TurnScheduler の二重動作。
   * TurnSystem を登録してもターン進行が二重にならないことを検証する。
   */
  it('I-1: プレイヤー1回の入力で turnNumber がちょうど 1 だけ進む', async () => {
    const turnStarted = jest.fn();
    events.on('turn_started', turnStarted);

    scheduler.start();
    await waitForInputReady();
    expect(scheduler.getTurnNumber()).toBe(0);

    // 実 move action を投入
    scheduler.submitPlayerAction(createMoveAction('player', 'right'));
    await waitForTurnNumber(1);

    expect(scheduler.getTurnNumber()).toBe(1);
    expect(turnStarted).toHaveBeenCalledTimes(1);
    expect(turnStarted).toHaveBeenCalledWith({ turn: 1 });
    expect(turnSystem.getTurnNumber()).toBe(1);
  });

  /**
   * I-2: 30手連続入力してもループが停止せず、エラーが出ない
   */
  it('I-2: 30手連続入力してもループが停止せずエラーが出ない', async () => {
    jest.setTimeout(30000);
    const errorSpy = jest.spyOn(console, 'error');
    const directions: Direction[] = ['up', 'down', 'left', 'right'];

    scheduler.start();
    await waitForInputReady();

    for (let i = 0; i < 30; i++) {
      scheduler.submitPlayerAction(createMoveAction('player', directions[i % 4]));
      await waitForTurnNumber(i + 1);
    }

    expect(scheduler.isRunning()).toBe(true);
    expect(scheduler.getTurnNumber()).toBe(30);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  /**
   * I-3: キーボード入力による移動失敗の直後でも次のキー入力が受け付けられる
   *
   * 防ぐ不具合 #7: 移動失敗で入力デッドロック。
   * 実 InputSystem のキーボードイベント経路（keydown → handleKeyPress → requestPlayerMove →
   * scheduler.submitPlayerAction）を通して、移動失敗後に再びキー入力が受け付けられることを検証する。
   *
   * エネルギー不足で移動を失敗させ、その後キーボード入力で移動できることを確認する。
   */
  it('I-3: キーボード入力による移動失敗後でも次のキー入力が受け付けられる', async () => {
    const energy = player.getComponent<EnergyComponent>('energy')!;
    const transform = player.getComponent<TransformComponent>('transform')!;
    const initialX = transform.position.x;

    scheduler.start();
    await waitForInputReady();

    // InputSystem が入力待ち状態にあることを確認
    expect(input.isInputEnabled()).toBe(true);
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);

    // エネルギーを 0 にして移動を失敗させる
    energy.consume(energy.currentEnergy);
    expect(energy.currentEnergy).toBe(0);

    // キーボードイベントを dispatch（InputSystem → requestPlayerMove → scheduler）
    dispatchKey('ArrowRight');
    // 失敗時はターンが進まないので、入力待ちに戻るまで待つ
    await waitForInputReady();

    // 失敗した action はターンを進めないため turnNumber は 0 のまま
    expect(scheduler.getTurnNumber()).toBe(0);

    // 失敗後も InputSystem が入力待ちに復帰している（デッドロックしていない）
    // player_input_requested が再発行されて input.waitingForInput が true に戻る
    expect(input.isInputEnabled()).toBe(true);
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);
    expect(scheduler.canAct('player')).toBe(true);

    // エネルギーを回復してから再度キーボード入力で移動
    energy.restore(10);
    dispatchKey('ArrowRight');
    await waitForTurnNumber(1);

    // 今度は移動が成功し、ターンが進んだことを確認
    expect(transform.position.x).toBe(initialX + 1);
    expect(scheduler.getTurnNumber()).toBe(1);
  });

  /**
   * I-3 補足: 実キーボード入力で移動成功後も次のキー入力が受け付けられる
   */
  it('I-3 補足: 実キーボード入力で移動成功後も次の入力が受け付けられる', async () => {
    const transform = player.getComponent<TransformComponent>('transform')!;
    const initialX = transform.position.x;

    scheduler.start();
    await waitForInputReady();

    // キーボードイベントで移動
    dispatchKey('ArrowRight');
    await waitForTurnNumber(1);

    // プレイヤーが実際に移動したことを確認
    expect(transform.position.x).toBe(initialX + 1);
    expect(scheduler.getTurnNumber()).toBe(1);

    // 次の入力も受け付ける
    expect(input.isInputEnabled()).toBe(true);

    // 2回目のキーボード入力で移動
    dispatchKey('ArrowDown');
    await waitForTurnNumber(2);
    expect(scheduler.getTurnNumber()).toBe(2);
  });
});
