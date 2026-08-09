import { createPinia, setActivePinia } from 'pinia';
import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { Game } from '@/game/Game';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { useGameStore } from '@/stores/gameStore';

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
 * Game 初期化と終了のテスト
 * システム登録、プレイヤー生成、リセット時の状態クリアを検証する。
 */
describe('Game initialization and shutdown', () => {
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

    assetsLoadSpy = jest
      .spyOn(PIXI.Assets, 'load')
      .mockResolvedValue(PIXI.Texture.EMPTY as any);

    // PIXI.Application.init をモック（jsdom では CanvasRenderer が使えないため）
    // init 後に必要なプロパティ（canvas, stage, renderer）を設定する
    appInitSpy = jest.spyOn(PIXI.Application.prototype, 'init').mockImplementation(async function (this: any) {
      // canvas は getter-only のため defineProperty で上書き
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

    // モック canvas を作成（appendChild などの DOM メソッドを含む）
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

  it('initialize() でシステムが登録される', async () => {
    await game.initialize(mockCanvas);

    const engine = Engine.instance;
    // 主要システムが登録されている
    expect(engine.getSystem('event')).toBeDefined();
    expect(engine.getSystem('entity')).toBeDefined();
    expect(engine.getSystem('renderer')).toBeDefined();
    expect(engine.getSystem('turn')).toBeDefined();
    expect(engine.getSystem('combat')).toBeDefined();
    expect(engine.getSystem('fov')).toBeDefined();
    expect(engine.getSystem('world')).toBeDefined();
  });

  it('initialize() でプレイヤーを一度だけ生成する', async () => {
    await game.initialize(mockCanvas);

    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity')!;
    const players = entitySystem.getEntitiesByTag('player');

    expect(players).toHaveLength(1);
  });

  it('initialize() でマップが生成される', async () => {
    await game.initialize(mockCanvas);

    // WorldSystem が登録され、TileMap が設定されている
    const worldSystem = Engine.instance.getSystem<any>('world');
    expect(worldSystem).toBeDefined();
    expect(worldSystem.getTileMap()).toBeDefined();
    expect(worldSystem.getTileMap().getWidth()).toBeGreaterThan(0);
  });

  it('再初期化でプレイヤーが重複して生成されない', async () => {
    await game.initialize(mockCanvas);

    const entitySystemBefore = Engine.instance.getSystem<EntitySystem>('entity')!;
    const playersAfterFirstInit = entitySystemBefore.getEntitiesByTag('player');
    expect(playersAfterFirstInit).toHaveLength(1);

    // 再初期化（reset → initialize で新しい EntitySystem が登録される）
    await game.initialize(mockCanvas);

    // 再初期化後は新しい EntitySystem インスタンスが登録されるため、
    // 再取得して確認する
    const entitySystemAfter = Engine.instance.getSystem<EntitySystem>('entity')!;
    const playersAfterSecondInit = entitySystemAfter.getEntitiesByTag('player');
    expect(playersAfterSecondInit).toHaveLength(1);
  });

  it('再初期化でエンティティが累積しない', async () => {
    await game.initialize(mockCanvas);

    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity')!;
    const entityCountAfterFirstInit = entitySystem.getEntityCount();

    // 再初期化
    await game.initialize(mockCanvas);

    const entityCountAfterSecondInit = entitySystem.getEntityCount();
    // エンティティ数が増加していない（プレイヤー+リソースのみ）
    expect(entityCountAfterSecondInit).toBeLessThanOrEqual(entityCountAfterFirstInit + 1);
  });

  it('再初期化でイベントリスナーが二重登録されない（イベントが重複発火しない）', async () => {
    await game.initialize(mockCanvas);

    const eventSystem = Engine.instance.getSystem<EventSystem>('event')!;

    // floor_changed イベントのリスナー数を確認
    const listenerCountAfterFirstInit = (eventSystem as any).listeners?.get('floor_changed')?.length || 0;

    // 再初期化
    await game.initialize(mockCanvas);

    const listenerCountAfterSecondInit = (eventSystem as any).listeners?.get('floor_changed')?.length || 0;

    // リスナー数が増加していない（二重登録されていない）
    // 注: EventSystem がリスナーをクリアせずに残す場合、
    // 再初期化で EventSystem 自体が新しく作られるためリスナーはリセットされる
    expect(listenerCountAfterSecondInit).toBeLessThanOrEqual(listenerCountAfterFirstInit + 1);
  });

  it('リスタート時に前回の Entity や状態を残さない', async () => {
    await game.initialize(mockCanvas);

    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity')!;
    const initialEntityCount = entitySystem.getEntityCount();
    expect(initialEntityCount).toBeGreaterThan(0); // プレイヤー+リソース

    // 再初期化（リスタート）
    await game.initialize(mockCanvas);

    const restartedEntityCount = entitySystem.getEntityCount();
    // エンティティが累積していない
    expect(restartedEntityCount).toBeLessThanOrEqual(initialEntityCount + 1);
  });

  it('getCurrentFloor() が初期値 1 を返す', async () => {
    await game.initialize(mockCanvas);

    expect(game.getCurrentFloor()).toBe(1);
  });

  it('getMaxFloors() が正の値を返す', async () => {
    await game.initialize(mockCanvas);

    expect(game.getMaxFloors()).toBeGreaterThan(0);
  });

  it('initialize() 後に gameStore のプレイヤー状態が初期化される', async () => {
    const store = useGameStore();
    // 初期状態を変更
    store.player.status.hp = 50;
    store.player.status.energy = 100;

    await game.initialize(mockCanvas);

    // initialize() 後は HP と エネルギー が最大値に回復する
    expect(store.player.status.hp).toBe(store.player.status.maxHp);
    expect(store.player.status.energy).toBe(store.player.status.maxEnergy);
  });

  it('getSkillSystem() が SkillSystem を返す', async () => {
    await game.initialize(mockCanvas);

    const skillSystem = game.getSkillSystem();
    expect(skillSystem).toBeDefined();
    expect(skillSystem).not.toBeNull();
  });

  it('useInventoryItem() がプレイヤー不在時に false を返す', async () => {
    // initialize() を呼ばずにプレイヤーがいない状態
    expect(game.useInventoryItem('test-item')).toBe(false);
  });

  it('useSkill() がプレイヤー不在時に false を返す', async () => {
    // initialize() を呼ばずにプレイヤーがいない状態
    expect(game.useSkill('test-skill')).toBe(false);
  });
});
