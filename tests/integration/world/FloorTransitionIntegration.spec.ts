import { createPinia, setActivePinia } from 'pinia';
import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { HealthComponent } from '@/engine/entity/components/Health';
import { EnergyComponent } from '@/engine/entity/components/Energy';
import { Player } from '@/engine/entity/Player';
import { FloorManager } from '@/engine/world/FloorManager';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { TileMap } from '@/engine/world/TileMap';
import { TileType } from '@/engine/types';

/**
 * 結合テスト I-4: フロア遷移の往復と HP/エネルギー保持
 *
 * docs/TESTING_STRATEGY.md §8 段階2:
 * - I-4: 固定マップ 2 フロアを登録し、遷移で HP 保持・エネルギー +20
 *
 * 既存の FloorManager.spec.ts は単一遷移のみ検証している。
 * ここでは「2フロアを固定で登録 → 往復遷移 → HP保持・エネルギー+20」を検証する。
 */
describe('結合テスト I-4: フロア遷移の往復と HP/エネルギー保持', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let floorManager: FloorManager;
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

    // WorldSystem を登録
    const map = new TileMap(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.setTileAt(x, y, 0, TileType.TILE, true);
      }
    }
    const worldSystem = new WorldSystem(map);
    Engine.instance.registerSystem('world', worldSystem);
    await worldSystem.initialize(engine);

    floorManager = new FloorManager(engine, 10);

    // 固定マップを返す generation handler
    floorManager.setFloorGenerationHandler(async ({ floor }) => {
      const ws = Engine.instance.getSystem<WorldSystem>('world');
      if (ws) {
        const testMap = new TileMap(10, 10);
        for (let y = 0; y < 10; y++) {
          for (let x = 0; x < 10; x++) {
            testMap.setTileAt(x, y, 0, TileType.TILE, true);
          }
        }
        ws.registerFloor(floor, testMap, [], []);
      }
    });
  });

  afterEach(() => {
    Engine.instance.reset();
    assetsLoadSpy.mockRestore();
    jest.restoreAllMocks();
  });

  /**
   * I-4: 2フロア遷移の往復で HP 保持・エネルギー +20
   *
   * 防ぐ不具合: R0 の契約（フロア遷移で HP は保持、エネルギーは +20 回復）。
   * 往復遷移で状態が壊れないことを検証する。
   */
  it('I-4: 1→2→1 と往復遷移しても HP 保持・エネルギー +20 が毎回適用される', async () => {
    const health = player.getComponent<HealthComponent>('health')!;
    const energy = player.getComponent<EnergyComponent>('energy')!;

    // 初期状態: HP=100, Energy=200
    health.takeDamage(30, true, true); // HP = 70
    energy.consume(80); // Energy = 120

    const hpAfterDamage = health.currentHp; // 70

    // 1 → 2 へ遷移
    await floorManager.moveToNextFloor();
    expect(player.getComponent<HealthComponent>('health')!.currentHp).toBe(hpAfterDamage);
    expect(player.getComponent<EnergyComponent>('energy')!.currentEnergy).toBe(140); // 120 + 20

    // 2 → 1 へ戻る
    await floorManager.moveToPreviousFloor();
    expect(player.getComponent<HealthComponent>('health')!.currentHp).toBe(hpAfterDamage);
    expect(player.getComponent<EnergyComponent>('energy')!.currentEnergy).toBe(160); // 140 + 20
  });

  /**
   * I-4 補足: 連続で複数フロアを降りてもエネルギー回復が累積する
   */
  it('I-4 補足: 1→2→3 と連続遷移でエネルギーが毎回 +20 回復する', async () => {
    const energy = player.getComponent<EnergyComponent>('energy')!;
    energy.consume(100); // Energy = 100

    await floorManager.moveToNextFloor(); // → 2
    expect(player.getComponent<EnergyComponent>('energy')!.currentEnergy).toBe(120);

    await floorManager.moveToNextFloor(); // → 3
    expect(player.getComponent<EnergyComponent>('energy')!.currentEnergy).toBe(140);
  });
});
