import { createPinia, setActivePinia } from 'pinia';
import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { Game } from '@/game/Game';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { FloorManager } from '@/engine/world/FloorManager';
import { RendererSystem } from '@/engine/graphics/RendererSystem';
import { TileMap } from '@/engine/world/TileMap';
import {
  EventName,
  Room,
  Corridor,
  TacticalElement,
  PlacedObstacle,
  PlacedItem,
  PlacedEnemy,
} from '@/engine/types';
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

    assetsLoadSpy = jest.spyOn(PIXI.Assets, 'load').mockResolvedValue(PIXI.Texture.EMPTY as any);

    // PIXI.Application.init をモック（jsdom では CanvasRenderer が使えないため）
    // init 後に必要なプロパティ（canvas, stage, renderer）を設定する
    appInitSpy = jest
      .spyOn(PIXI.Application.prototype, 'init')
      .mockImplementation(async function (this: any) {
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

    // 初期化後の EntitySystem を取得
    const entitySystemAfterFirst = Engine.instance.getSystem<EntitySystem>('entity')!;
    const entityCountAfterFirstInit = entitySystemAfterFirst.getEntityCount();
    expect(entityCountAfterFirstInit).toBeGreaterThan(0);

    // 初期化後のエンティティIDを記録
    const firstInitEntityIds = new Set(entitySystemAfterFirst.getEntities().map((e) => e.id));

    // 再初期化（reset → initialize で新しい EntitySystem が登録される）
    await game.initialize(mockCanvas);

    // 再初期化後は新しい EntitySystem インスタンスが登録されるため、再取得する
    const entitySystemAfterSecond = Engine.instance.getSystem<EntitySystem>('entity')!;
    expect(entitySystemAfterSecond).not.toBe(entitySystemAfterFirst);

    // 旧 EntitySystem は Engine.reset() 内で destroy() が呼ばれるため、
    // エンティティが破棄されて空になっていることを検証
    expect(entitySystemAfterFirst.getEntityCount()).toBe(0);

    const entityCountAfterSecondInit = entitySystemAfterSecond.getEntityCount();
    // エンティティ数が初回と同等（プレイヤー+リソースのみで累積しない）
    expect(entityCountAfterSecondInit).toBeGreaterThan(0);

    // 古いエンティティIDが新しいシステムに漏れ出していないことを確認
    // 注: プレイヤーIDは固定（'player'）のため一致する可能性があるが、
    // リソースエンティティのIDは毎回異なるため、古いIDが新しいシステムに
    // 引き継がれていないことを確認する
    const secondInitEntityIds = new Set(entitySystemAfterSecond.getEntities().map((e) => e.id));
    // プレイヤー以外の古いエンティティIDが新しいシステムに存在しないことを確認
    const oldResourceIds = [...firstInitEntityIds].filter((id) => id !== 'player');
    const leakedIds = oldResourceIds.filter((id) => secondInitEntityIds.has(id));
    expect(leakedIds).toHaveLength(0);
  });

  it('再初期化でイベントリスナーが二重登録されない（イベントが重複発火しない）', async () => {
    const onGameOver = jest.fn();
    game.setOnGameOver(onGameOver);
    await game.initialize(mockCanvas);

    const eventSystemAfterFirst = Engine.instance.getSystem<EventSystem>('event')!;
    const listenerCountAfterFirstInit = eventSystemAfterFirst.getListenerCount(EventName.GAME_OVER);
    expect(listenerCountAfterFirstInit).toBeGreaterThan(0);

    await game.initialize(mockCanvas);

    const eventSystemAfterSecond = Engine.instance.getSystem<EventSystem>('event')!;
    expect(eventSystemAfterSecond).not.toBe(eventSystemAfterFirst);
    expect(eventSystemAfterFirst.getListenerCount(EventName.GAME_OVER)).toBe(0);

    const listenerCountAfterSecondInit = eventSystemAfterSecond.getListenerCount(
      EventName.GAME_OVER
    );
    expect(listenerCountAfterSecondInit).toBe(listenerCountAfterFirstInit);

    eventSystemAfterFirst.emit(EventName.GAME_OVER, { score: 10 });
    expect(onGameOver).not.toHaveBeenCalled();

    eventSystemAfterSecond.emit(EventName.GAME_OVER, { score: 20 });
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(onGameOver).toHaveBeenCalledWith(20);
  });

  it('再初期化で古い RendererSystem が破棄される（Pixi Application が破棄される）', async () => {
    await game.initialize(mockCanvas);

    // 初期化後の RendererSystem を取得
    const rendererAfterFirst = Engine.instance.getSystem<any>('renderer')!;
    const appAfterFirst = rendererAfterFirst.getApp();
    expect(appAfterFirst).toBeDefined();

    // 再初期化
    await game.initialize(mockCanvas);

    // 再初期化後は新しい RendererSystem インスタンスが登録される
    const rendererAfterSecond = Engine.instance.getSystem<any>('renderer')!;
    expect(rendererAfterSecond).not.toBe(rendererAfterFirst);

    // 古い Pixi Application は破棄されている（app.destroy が呼ばれる）
    // 注: Engine.reset() → RendererSystem.destroy() → app.destroy(true) の順で呼ばれる
    // appAfterFirst は破棄済みなので getApp() は null を返すはず
    expect(rendererAfterFirst.getApp()).toBeNull();
  });

  it('再初期化で InputSystem の DOM リスナーが解除される', async () => {
    await game.initialize(mockCanvas);

    // 初期化後の InputSystem を取得
    const inputAfterFirst = Engine.instance.getSystem<any>('input')!;
    expect(inputAfterFirst).toBeDefined();

    // window に keydown リスナーが登録されていることを確認
    // （jsdom では addEventListener の呼び出しを直接確認できないため、
    //  InputSystem の destroy が呼ばれたことを検証する）
    const destroySpy = jest.spyOn(inputAfterFirst, 'destroy');

    // 再初期化
    await game.initialize(mockCanvas);

    // Engine.reset() で古い InputSystem の destroy() が呼ばれる
    expect(destroySpy).toHaveBeenCalled();

    // 再初期化後は新しい InputSystem インスタンスが登録される
    const inputAfterSecond = Engine.instance.getSystem<any>('input')!;
    expect(inputAfterSecond).not.toBe(inputAfterFirst);
  });

  it('再初期化で window の removeItem リスナーが解除される', async () => {
    await game.initialize(mockCanvas);

    // removeItem イベントを発行して、リスナーが登録されていることを確認
    const removeItemSpy = jest.spyOn(window, 'removeEventListener');

    // 再初期化
    await game.initialize(mockCanvas);

    // reset 時に window.removeEventListener('removeItem', ...) が呼ばれる
    expect(removeItemSpy).toHaveBeenCalledWith('removeItem', expect.any(Function));

    removeItemSpy.mockRestore();
  });

  it('リスタート時に前回の Entity や状態を残さない', async () => {
    await game.initialize(mockCanvas);

    // 初期化後の EntitySystem を取得
    const entitySystemAfterFirst = Engine.instance.getSystem<EntitySystem>('entity')!;
    const initialEntityCount = entitySystemAfterFirst.getEntityCount();
    expect(initialEntityCount).toBeGreaterThan(0); // プレイヤー+リソース

    // 初期化後のエンティティIDを記録
    const firstInitEntityIds = new Set(entitySystemAfterFirst.getEntities().map((e) => e.id));

    // 再初期化（リスタート）
    await game.initialize(mockCanvas);

    // 再初期化後は新しい EntitySystem インスタンスが登録されるため、再取得する
    const entitySystemAfterSecond = Engine.instance.getSystem<EntitySystem>('entity')!;
    expect(entitySystemAfterSecond).not.toBe(entitySystemAfterFirst);

    // 新しいシステムにはエンティティが存在する（プレイヤー+リソース）
    const restartedEntityCount = entitySystemAfterSecond.getEntityCount();
    expect(restartedEntityCount).toBeGreaterThan(0);

    // 古いエンティティIDが新しいシステムに漏れ出していないことを確認
    const secondInitEntityIds = new Set(entitySystemAfterSecond.getEntities().map((e) => e.id));
    const oldResourceIds = [...firstInitEntityIds].filter((id) => id !== 'player');
    const leakedIds = oldResourceIds.filter((id) => secondInitEntityIds.has(id));
    expect(leakedIds).toHaveLength(0);
  });

  it('getCurrentFloor() が初期値 1 を返す', async () => {
    await game.initialize(mockCanvas);

    expect(game.getCurrentFloor()).toBe(1);
  });

  it('floor_changed は新フロアが同じ WorldSystem に登録された後で発行される', async () => {
    await game.initialize(mockCanvas);

    const worldSystem = Engine.instance.getSystem<WorldSystem>('world')!;
    const eventSystem = Engine.instance.getSystem<EventSystem>('event')!;
    const floor1Rooms = worldSystem.getRoomsByFloor(1);
    const observations: Array<{ floor: number; roomCount: number }> = [];
    eventSystem.on('floor_changed', () => {
      observations.push({
        floor: worldSystem.getCurrentFloor(),
        roomCount: worldSystem.getRooms().length,
      });
    });

    const floorManager = (game as unknown as { floorManager: FloorManager }).floorManager;
    await floorManager.moveToNextFloor();

    expect(Engine.instance.getSystem<WorldSystem>('world')).toBe(worldSystem);
    expect(worldSystem.getCurrentFloor()).toBe(2);
    expect(worldSystem.getRooms()).not.toHaveLength(0);
    expect(worldSystem.getRoomsByFloor(1)).toEqual(floor1Rooms);
    expect(observations).toEqual([{ floor: 2, roomCount: worldSystem.getRooms().length }]);
  });

  it('本番のフロア生成経路が失敗しても Game・World・Entity の旧状態を完全に保持する', async () => {
    await game.initialize(mockCanvas);

    const gameState = game as unknown as {
      floorManager: FloorManager;
      tileMap: TileMap;
      currentRooms: Room[];
      currentCorridors: Corridor[];
      currentTacticalElements: TacticalElement[];
      placedObstacles: PlacedObstacle[];
      placedItems: PlacedItem[];
      placedEnemies: PlacedEnemy[];
      resourceSystem: unknown;
      buildEventObjects: (...args: unknown[]) => Promise<unknown[]>;
    };
    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity')!;
    const worldSystem = Engine.instance.getSystem<WorldSystem>('world')!;
    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer')!;
    const eventSystem = Engine.instance.getSystem<EventSystem>('event')!;

    const oldEntities = entitySystem.getEntities();
    const oldTileMap = gameState.tileMap;
    const oldRooms = gameState.currentRooms;
    const oldCorridors = gameState.currentCorridors;
    const oldTacticalElements = gameState.currentTacticalElements;
    const oldObstacles = gameState.placedObstacles;
    const oldItems = gameState.placedItems;
    const oldEnemies = gameState.placedEnemies;
    const oldResourceSystem = gameState.resourceSystem;
    const oldWorldMap = worldSystem.getTileMap();
    const oldVisibilityListenerCount = eventSystem.getListenerCount('entity_visibility_changed');
    const oldLayerSizes = {
      characters: rendererSystem.getLayer('characters')!.children.length,
      objects: rendererSystem.getLayer('objects')!.children.length,
    };
    const floorChanged = jest.fn();
    const floorGenerated = jest.fn();
    eventSystem.on('floor_changed', floorChanged);
    eventSystem.on('floor_generated', floorGenerated);

    // マップと通常リソースの構築後、イベントオブジェクト構築で失敗させる。
    // 生成途中の Entity は初期化済みだが EntitySystem には未登録の状態になる。
    jest
      .spyOn(gameState, 'buildEventObjects')
      .mockRejectedValueOnce(new Error('staged event object generation failed'));

    const result = await gameState.floorManager.moveToNextFloor();

    expect(result).toBe(false);
    expect(game.getCurrentFloor()).toBe(1);
    expect(worldSystem.getCurrentFloor()).toBe(1);
    expect(worldSystem.getTileMap()).toBe(oldWorldMap);
    expect(entitySystem.getEntities()).toEqual(oldEntities);
    expect(gameState.tileMap).toBe(oldTileMap);
    expect(gameState.currentRooms).toBe(oldRooms);
    expect(gameState.currentCorridors).toBe(oldCorridors);
    expect(gameState.currentTacticalElements).toBe(oldTacticalElements);
    expect(gameState.placedObstacles).toBe(oldObstacles);
    expect(gameState.placedItems).toBe(oldItems);
    expect(gameState.placedEnemies).toBe(oldEnemies);
    expect(gameState.resourceSystem).toBe(oldResourceSystem);
    expect(rendererSystem.getLayer('characters')!.children).toHaveLength(oldLayerSizes.characters);
    expect(rendererSystem.getLayer('objects')!.children).toHaveLength(oldLayerSizes.objects);
    expect(eventSystem.getListenerCount('entity_visibility_changed')).toBe(
      oldVisibilityListenerCount
    );
    expect(floorChanged).not.toHaveBeenCalled();
    expect(floorGenerated).not.toHaveBeenCalled();
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

  it('initialize() で event_object タグを持つ Entity が 1 体以上生成される（ポータル・チャージャー）', async () => {
    await game.initialize(mockCanvas);

    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity')!;
    const eventObjects = entitySystem.getEntitiesByTag('event_object');

    // ポータル1つ + チャージャー2-3個 が生成されるはず
    expect(eventObjects.length).toBeGreaterThanOrEqual(1);
  });

  it('initialize() で portal タグを持つ Entity が生成される', async () => {
    await game.initialize(mockCanvas);

    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity')!;
    const portals = entitySystem.getEntitiesByTag('portal');

    expect(portals.length).toBeGreaterThanOrEqual(1);
  });
});
