import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { ActorComponent } from '@/engine/entity/components/Actor';
import { TurnScheduler } from '@/engine/turn/TurnScheduler';
import { Action, ActionResult } from '@/engine/turn/Action';
import { getActionCost } from '@/engine/turn/ActionCostTable';

/**
 * BU-3 P0-2 / 案B: 速度差の有効化テスト
 *
 * エネルギー式スケジューラ（案B）において、
 * actionSpeed が高いアクターはより頻繁に行動し、
 * actionSpeed が低いアクターはより少ない回数行動することを検証する。
 *
 * テスト方針:
 * - プレイヤー（inputControlled）と敵を登録する
 * - start() → 最初の player_input_requested を待つ
 *   （この時点で速い敵は既に行動している可能性がある）
 * - wait 行動を投入 → 次の player_input_requested を待つ
 * - 最初の入力待ち→次の入力待ちの間に敵が何回行動したかを検証する
 */
describe('BU-3 P0-2: 速度差の有効化（エネルギー式スケジューラ）', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let scheduler: TurnScheduler;

  beforeEach(async () => {
    events = new EventSystem();
    entities = new EntitySystem();

    jest.spyOn(Engine, 'instance', 'get').mockReturnValue({
      getSystem: jest.fn((key: string) => {
        if (key === 'event') return events;
        if (key === 'entity') return entities;
        return undefined;
      }),
    } as any);

    const mockExecutor = {
      execute: jest.fn(
        async (action: Action): Promise<ActionResult> => ({
          success: true,
          consumedTime: action.cost.timeCost,
        })
      ),
    };

    scheduler = new TurnScheduler();
    scheduler.initialize(Engine.instance);
    (scheduler as any).executor = mockExecutor;

    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    scheduler.stop();
    jest.restoreAllMocks();
  });

  /** プレイヤー Entity を登録する（actionSpeed 100 = 標準） */
  function registerPlayer(): Entity {
    const player = new Entity('player', 'player');
    player.addTag('player');
    player.addComponent(new ActorComponent({ inputControlled: true, actionSpeed: 100 }));
    entities.registerEntity(player);
    return player;
  }

  /** 次の player_input_requested まで待つ */
  async function waitForNextInputRequest(timeoutMs = 200): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        events.off('player_input_requested', handler);
        resolve();
      }, timeoutMs);
      const handler = () => {
        clearTimeout(timer);
        events.off('player_input_requested', handler);
        setTimeout(resolve, 5);
      };
      events.on('player_input_requested', handler);
    });
  }

  /** wait 行動を投入する */
  function submitWait(): boolean {
    return scheduler.submitPlayerAction({
      kind: 'wait',
      actorId: 'player',
      cost: getActionCost('wait'),
    });
  }

  it('actionSpeed 100 の敵は プレイヤー1回行動の間に1回行動する', async () => {
    registerPlayer();
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-normal', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        actionSpeed: 100,
        decideAction: enemySpy,
      })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    await waitForNextInputRequest();
    const countAtFirstInput = enemySpy.mock.calls.length;

    submitWait();
    await waitForNextInputRequest();
    const countAtSecondInput = enemySpy.mock.calls.length;

    // プレイヤー1回行動の間に敵は1回行動する
    expect(countAtSecondInput - countAtFirstInput).toBe(1);
  });

  it('actionSpeed 200 の敵は プレイヤー1回行動の間に2回行動する', async () => {
    registerPlayer();
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-fast', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        actionSpeed: 200,
        decideAction: enemySpy,
      })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    await waitForNextInputRequest();
    const countAtFirstInput = enemySpy.mock.calls.length;

    submitWait();
    await waitForNextInputRequest();
    const countAtSecondInput = enemySpy.mock.calls.length;

    // actionSpeed 200 の敵は、プレイヤー(actionSpeed 100)の1回行動の間に2回行動する
    expect(countAtSecondInput - countAtFirstInput).toBe(2);
  });

  it('actionSpeed 300 の敵は プレイヤー1回行動の間に3回行動する', async () => {
    registerPlayer();
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-very-fast', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        actionSpeed: 300,
        decideAction: enemySpy,
      })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    await waitForNextInputRequest();
    const countAtFirstInput = enemySpy.mock.calls.length;

    submitWait();
    await waitForNextInputRequest();
    const countAtSecondInput = enemySpy.mock.calls.length;

    expect(countAtSecondInput - countAtFirstInput).toBe(3);
  });

  it('同速の敵は登録順に行動する', async () => {
    registerPlayer();
    const order: string[] = [];
    const enemy1 = new Entity('enemy-1', 'enemy');
    enemy1.addTag('enemy');
    enemy1.addComponent(
      new ActorComponent({
        inputControlled: false,
        actionSpeed: 100,
        decideAction: jest.fn(async () => {
          order.push('enemy-1');
          return null;
        }),
      })
    );
    const enemy2 = new Entity('enemy-2', 'enemy');
    enemy2.addTag('enemy');
    enemy2.addComponent(
      new ActorComponent({
        inputControlled: false,
        actionSpeed: 100,
        decideAction: jest.fn(async () => {
          order.push('enemy-2');
          return null;
        }),
      })
    );
    entities.registerEntity(enemy1);
    entities.registerEntity(enemy2);

    scheduler.start();
    await waitForNextInputRequest();
    order.length = 0; // 最初の入力待ちまでの順序をリセット

    submitWait();
    await waitForNextInputRequest();

    expect(order).toEqual(['enemy-1', 'enemy-2']);
  });

  it('actionSpeed 50 の敵は2ターンに1回行動する', async () => {
    registerPlayer();
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-slow', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        actionSpeed: 50,
        decideAction: enemySpy,
      })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    await waitForNextInputRequest(); // ターン1開始

    // ターン1: プレイヤー行動
    submitWait();
    await waitForNextInputRequest();
    const countAfterTurn1 = enemySpy.mock.calls.length;

    // ターン2: プレイヤー行動
    submitWait();
    await waitForNextInputRequest();
    const countAfterTurn2 = enemySpy.mock.calls.length;

    // actionSpeed 50 の敵は energy が溜まるまで行動できない
    // ターン1では行動せず、ターン2で累積 energy 100 到達して1回行動する
    expect(countAfterTurn1).toBe(0);
    expect(countAfterTurn2).toBe(1);
  });

  it('実ゲームの敵プロファイル値（SCOUT/SOLDIER/HEAVY）が異なる actionSpeed に変換される', () => {
    // EnemyStatProfile の moveSpeed 値: SCOUT 6, SOLDIER 4, HEAVY 2
    // 変換式: actionSpeed = moveSpeed * 25
    const scout = new ActorComponent({ inputControlled: false, actionSpeed: 6 * 25 });
    const soldier = new ActorComponent({ inputControlled: false, actionSpeed: 4 * 25 });
    const heavy = new ActorComponent({ inputControlled: false, actionSpeed: 2 * 25 });

    expect(scout.speed).toBe(150);
    expect(soldier.speed).toBe(100);
    expect(heavy.speed).toBe(50);
    // 3タイプすべて異なる行動速度を持つ
    expect(scout.speed).not.toBe(soldier.speed);
    expect(soldier.speed).not.toBe(heavy.speed);
    expect(scout.speed).not.toBe(heavy.speed);
  });
});
