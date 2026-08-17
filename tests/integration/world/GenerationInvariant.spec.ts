import { FlexibleMapGenerator } from '@/engine/world/FlexibleMapGenerator';
import { TacticalMapGenerator } from '@/engine/world/TacticalMapGenerator';
import { TileMap } from '@/engine/world/TileMap';
import {
  corridorsToDoorways,
  validateDoorways,
  isRoomGraphConnected,
} from '@/engine/world/Doorway';
import {
  MapGenerationAlgorithm,
  RoomType,
  StageType,
  TileType,
  GenerationConfig,
  MapGenerationResult,
} from '@/engine/types';

/**
 * 生成不変条件テスト G-1〜G-4
 *
 * docs/TESTING_STRATEGY.md §8 段階3:
 * 生成器はランダム性が本質のため固定できない。
 * 代わりに N 回生成して不変条件を検証する。
 *
 * - G-1: 全 StageType で生成し、床タイルが 1 枚以上ある
 * - G-2: 生成マップから資源を配置し、event_object（ポータル）が 1 体以上
 * - G-3: 全 Room が Doorway 経由で連結している
 * - G-4: Doorway が通行可能タイル上にある
 */
describe('生成不変条件テスト G-1〜G-4', () => {
  /** 標準的な生成設定を作成するヘルパ */
  function makeConfig(stageType: StageType, width = 50, height = 50): GenerationConfig {
    return {
      width,
      height,
      stageType,
      algorithm: MapGenerationAlgorithm.BSP,
      roomConfig: {
        minSize: 4,
        maxSize: 8,
        density: 0.7,
        connectivity: 0.8,
        roomTypes: [
          RoomType.NORMAL,
          RoomType.BOSS,
          RoomType.TREASURE,
          RoomType.ENTRANCE,
          RoomType.EXIT,
        ],
      },
      corridorConfig: {
        method: 'astar' as any,
        width: 1,
        minWidth: 1,
        maxWidth: 3,
        redundancy: 0.4,
        allowDiagonal: false,
      },
      featureConfig: {
        method: 'basic',
        density: 0.05,
        rules: [],
        themeFeatures: [],
        globalRules: [],
      },
      postProcessing: {
        ensureConnectivity: true,
        balanceFeatures: true,
        optimizePerformance: false,
      },
    };
  }

  /** 通行可能タイル数をカウントするヘルパ */
  function countWalkableTiles(result: MapGenerationResult): number {
    const tileMap = buildTileMap(result);
    let count = 0;
    for (let y = 0; y < result.map.length; y++) {
      for (let x = 0; x < result.map[y].length; x++) {
        if (tileMap.isWalkable(x, y, 0)) count++;
      }
    }
    return count;
  }

  /** TileMap を構築して通行可能性を判定できるようにする */
  function buildTileMap(result: MapGenerationResult): TileMap {
    const tileMap = new TileMap(result.map[0].length, result.map.length);
    tileMap.importMapData(result.map);
    return tileMap;
  }

  // テストの実行回数（§13 未決事項: 10回で十分か）
  const N = 10;

  /**
   * G-1: 全 StageType で生成し、床タイルが 1 枚以上ある
   *
   * 防ぐ不具合 #1: ポータル未生成（'floor' 比較が常に false）
   * 床タイルが0枚の場合、ポータルも生成されない。
   */
  describe('G-1: 床タイルが1枚以上存在する', () => {
    const stageTypes = [
      { name: 'CLASSIC', type: StageType.CLASSIC, generator: 'flexible' },
      { name: 'ENERGY_MANAGEMENT', type: StageType.ENERGY_MANAGEMENT, generator: 'flexible' },
      { name: 'TACTICAL_COMBAT', type: StageType.TACTICAL_COMBAT, generator: 'tactical' },
    ];

    for (const { name, type, generator } of stageTypes) {
      it(`${name}: ${N}回生成して毎回床タイルが1枚以上ある`, async () => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();

        for (let i = 0; i < N; i++) {
          const gen =
            generator === 'tactical'
              ? new TacticalMapGenerator(50, 50)
              : new FlexibleMapGenerator(50, 50);
          const result = await gen.generate(makeConfig(type));
          const walkableCount = countWalkableTiles(result);
          expect(walkableCount).toBeGreaterThan(0);
        }

        jest.restoreAllMocks();
      });
    }
  });

  // G-2 は PortalGenerationIntegration.spec.ts で実 Game 経路を検証する

  /**
   * G-3: 全 Room が Doorway 経由で連結している
   *
   * 防ぐ不具合: 生成器の退行。
   * ensureConnectivity により連結性が保証されていることを検証する。
   */
  describe('G-3: 全 Room が Doorway 経由で連結している', () => {
    it(`CLASSIC: ${N}回生成して毎回 Room グラフが連結`, async () => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();

      for (let i = 0; i < N; i++) {
        const gen = new FlexibleMapGenerator(50, 50);
        const result = await gen.generate(makeConfig(StageType.CLASSIC));
        const doorways = corridorsToDoorways(result.corridors, result.rooms);
        const connected = isRoomGraphConnected(result.rooms, doorways);
        expect(connected).toBe(true);
      }

      jest.restoreAllMocks();
    });

    it(`TACTICAL_COMBAT: ${N}回生成して毎回 Room グラフが連結`, async () => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();

      for (let i = 0; i < N; i++) {
        const gen = new TacticalMapGenerator(50, 50);
        const result = await gen.generate(makeConfig(StageType.TACTICAL_COMBAT));
        const doorways = corridorsToDoorways(result.corridors, result.rooms);
        const connected = isRoomGraphConnected(result.rooms, doorways);
        expect(connected).toBe(true);
      }

      jest.restoreAllMocks();
    });
  });

  /**
   * G-4: Doorway が通行可能タイル上にある
   *
   * 防ぐ不具合: 生成器の退行。
   * Doorway が壁や通行不可タイル上にあると、プレイヤーが移動できない。
   * validateDoorways() の validationResult.valid が true であることを検証する。
   * position_not_walkable エラーが発生してはならない。
   */
  describe('G-4: Doorway が通行可能タイル上にある', () => {
    it(`CLASSIC: ${N}回生成して Doorway がすべて通行可能タイル上にある`, async () => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();

      for (let i = 0; i < N; i++) {
        const gen = new FlexibleMapGenerator(50, 50);
        const result = await gen.generate(makeConfig(StageType.CLASSIC));
        const tileMap = buildTileMap(result);
        const doorways = corridorsToDoorways(result.corridors, result.rooms);
        const validationResult = validateDoorways(doorways, result.rooms, (x, y) =>
          tileMap.isWalkable(x, y, 0)
        );

        // position_not_walkable エラーがあってはならない
        const notWalkableErrors = validationResult.errors.filter(
          (e) => e.kind === 'position_not_walkable'
        );
        expect(notWalkableErrors).toEqual([]);
      }

      jest.restoreAllMocks();
    });

    it(`TACTICAL_COMBAT: ${N}回生成して Doorway がすべて通行可能タイル上にある`, async () => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();

      for (let i = 0; i < N; i++) {
        const gen = new TacticalMapGenerator(50, 50);
        const result = await gen.generate(makeConfig(StageType.TACTICAL_COMBAT));
        const tileMap = buildTileMap(result);
        const doorways = corridorsToDoorways(result.corridors, result.rooms);
        const validationResult = validateDoorways(doorways, result.rooms, (x, y) =>
          tileMap.isWalkable(x, y, 0)
        );

        // position_not_walkable エラーがあってはならない
        const notWalkableErrors = validationResult.errors.filter(
          (e) => e.kind === 'position_not_walkable'
        );
        expect(notWalkableErrors).toEqual([]);
      }

      jest.restoreAllMocks();
    });
  });
});
