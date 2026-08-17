import { createPinia, setActivePinia } from 'pinia';
import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { Game } from '@/game/Game';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { useGameStore } from '@/stores/gameStore';
import { useGameViewStateStore } from '@/stores/gameViewStateStore';
import { useUIPanelStore } from '@/stores/uiPanelStore';

// SoundManager をモック（jsdom では AudioBuffer が未定義のため）
jest.mock('@/common/SoundManager', () => ({
  SoundManager: {
    getInstance: () => ({
      loadSounds: jest.fn(),
      stopBGM: jest.fn(),
      playBGM: jest.fn(),
      playSE: jest.fn(),
      setVolume: jest.fn(),
      stopAllSounds: jest.fn(),
    }),
  },
}));

/**
 * 結合テスト I-7: Game.reset() → 再初期化で状態が初期値へ戻り、リスナーが残らない
 *
 * docs/TESTING_STRATEGY.md §8 段階2:
 * - I-7: Game.reset() → 再初期化で状態が初期値へ戻り、リスナーが残らない
 *
 * 防ぐ不具合 #5: gameStore 往復で攻撃力が累積
 * 防ぐ不具合: パネル残存
 * 防ぐ不具合: 旧リスナーが残って二重発火
 */
describe('結合テスト I-7: Game.reset() で状態が初期値へ戻り、リスナーが残らない', () => {
  let game: Game;
  let assetsLoadSpy: jest.SpyInstance;
  let mockCanvas: HTMLCanvasElement;
  let appInitSpy: jest.SpyInstance;
  let appDestroySpy: jest.SpyInstance;

  beforeEach(() => {
    setActivePinia(createPinia());
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    assetsLoadSpy = jest.spyOn(PIXI.Assets, 'load').mockResolvedValue(PIXI.Texture.EMPTY as any);

    appInitSpy = jest
      .spyOn(PIXI.Application.prototype, 'init')
      .mockImplementation(async function (this: any) {
        Object.defineProperty(this, 'canvas', {
          value: document.createElement('canvas'),
          writable: true,
          configurable: true,
        });
        this.stage = new PIXI.Container();
        this.renderer = {
          resize: jest.fn(),
          destroy: jest.fn(),
        };
      });
    appDestroySpy = jest.spyOn(PIXI.Application.prototype, 'destroy').mockImplementation();

    mockCanvas = document.createElement('div') as unknown as HTMLCanvasElement;

    Engine.instance.reset();
    game = new Game();
  });

  afterEach(() => {
    Engine.instance.reset();
    assetsLoadSpy.mockRestore();
    appInitSpy.mockRestore();
    appDestroySpy.mockRestore();
    jest.restoreAllMocks();
  });

  /**
   * I-7: 再初期化で viewStore が初期値に戻る
   *
   * 状態を非初期値に変更してから再初期化し、
   * 新しい初期値で上書きされることを検証する。
   */
  it('I-7: 再初期化で viewStore が新しい値で上書きされる', async () => {
    const viewStore = useGameViewStateStore();

    await game.initialize(mockCanvas);

    // 初期化後の HP を記録
    const initialHp = viewStore.player.hp;
    expect(initialHp).toBeGreaterThan(0);

    // 状態を非初期値に変更（ダメージを受けた状態をシミュレート）
    viewStore.setPlayer({ ...viewStore.player, hp: 1 });
    expect(viewStore.player.hp).toBe(1);

    // 再初期化（reset → initialize）
    await game.initialize(mockCanvas);

    // 再初期化後は新しい HP で上書きされている（1 ではない）
    expect(viewStore.player.hp).not.toBe(1);
    expect(viewStore.player.hp).toBeGreaterThan(0);
  });

  /**
   * I-7: 再初期化でパネルが残存しない
   *
   * Game.reset() が uiPanelStore.closeAll() を呼ぶことで、
   * パネルスタックが空になることを検証する。
   */
  it('I-7: 再初期化でパネルスタックが空になる', async () => {
    const panelStore = useUIPanelStore();

    await game.initialize(mockCanvas);

    // パネルを開く
    panelStore.open('item_list');
    panelStore.open('action_menu');
    expect(panelStore.stack.length).toBeGreaterThan(0);

    // 再初期化（Game.reset() → initialize）
    await game.initialize(mockCanvas);

    // パネルスタックが空になっていることを検証
    expect(panelStore.stack).toHaveLength(0);
    expect(panelStore.inputBlocked).toBe(false);
  });

  /**
   * I-7: 再初期化でエンティティが累積しない
   */
  it('I-7: 再初期化でエンティティが累積しない', async () => {
    await game.initialize(mockCanvas);

    const entitySystemAfterFirst = Engine.instance.getSystem<EntitySystem>('entity')!;
    const countAfterFirst = entitySystemAfterFirst.getEntityCount();
    expect(countAfterFirst).toBeGreaterThan(0);

    await game.initialize(mockCanvas);

    const entitySystemAfterSecond = Engine.instance.getSystem<EntitySystem>('entity')!;
    const countAfterSecond = entitySystemAfterSecond.getEntityCount();

    // 新しい EntitySystem のエンティティ数が初回と同等（プレイヤー+エンティティ）
    expect(countAfterSecond).toBeGreaterThan(0);
    // 旧 EntitySystem は破棄されている
    expect(entitySystemAfterFirst.getEntityCount()).toBe(0);
  });

  /**
   * I-7: 再初期化で旧 EventSystem のリスナーが発火しない
   *
   * Engine.reset() は旧 System の destroy() を呼ぶため、
   * 旧 EventSystem に登録されたリスナーは破棄される。
   * 再初期化後に旧 EventSystem へイベントを発火しても、
   * 旧リスナーが呼ばれないことを検証する。
   *
   * インスタンスが分離されているだけでは不十分。
   * 旧 EventSystem の destroy() がリスナーを実際に解除していることを証明する。
   */
  it('I-7: 再初期化で旧 EventSystem のリスナーが発火しない', async () => {
    await game.initialize(mockCanvas);

    const oldEventSystem = Engine.instance.getSystem<EventSystem>('event')!;
    const oldListener = jest.fn();
    oldEventSystem.on('test_event', oldListener);

    // リスナーが登録されていることを確認
    oldEventSystem.emit('test_event', { value: 0 });
    expect(oldListener).toHaveBeenCalledTimes(1);
    oldListener.mockClear();

    // 再初期化（Engine.reset() で旧 EventSystem は destroy される）
    await game.initialize(mockCanvas);

    const newEventSystem = Engine.instance.getSystem<EventSystem>('event')!;

    // 新しい EventSystem は別インスタンス
    expect(newEventSystem).not.toBe(oldEventSystem);

    // 旧 EventSystem へイベントを発火してもリスナーが呼ばれないことを確認
    // destroy() がリスナーを実際に解除していなければ、ここで発火する
    oldEventSystem.emit('test_event', { value: 1 });
    expect(oldListener).not.toHaveBeenCalled();
  });

  /**
   * I-7: 再初期化で gameStore の HP が最大値に戻る
   *
   * gameStore.player.status.hp が createPlayer() で maxHp に戻ることを検証する。
   * 状態を非初期値に変更してから再初期化する。
   */
  it('I-7: 再初期化で gameStore の HP が最大値に戻る', async () => {
    const gameStore = useGameStore();

    await game.initialize(mockCanvas);

    // HP を減らす（ダメージを受けた状態をシミュレート）
    const maxHp = gameStore.player.status.maxHp;
    gameStore.player.status.hp = 1;
    expect(gameStore.player.status.hp).toBe(1);

    // 再初期化
    await game.initialize(mockCanvas);

    // HP が maxHp に戻っていることを検証
    expect(gameStore.player.status.hp).toBe(maxHp);
  });
});
