import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { FlexibleMapGenerator } from '@/engine/world/FlexibleMapGenerator';
import { BSPGenerator } from '@/engine/world/generators/BSPGenerator';
import {
  Corridor,
  CorridorGenerationMethod,
  MapGenerationAlgorithm,
  Room,
  RoomType,
  StageType,
  TileType,
} from '@/engine/types';
import { RoomGenerationConfig, RoomGenerationResult } from '@/engine/world/MapGeneratorInterface';

/**
 * Room データと接続のテスト
 * 生成結果から WorldSystem まで Room 構造が保持されることを検証する。
 */
describe('Room data and connections', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let world: WorldSystem;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    Engine.instance.registerSystem('event', events);
    Engine.instance.registerSystem('entity', entities);

    const engine = Engine.instance;
    await entities.initialize(engine);
  });

  afterEach(() => {
    Engine.instance.reset();
    jest.restoreAllMocks();
  });

  const createRoomConfig = (
    overrides: Partial<RoomGenerationConfig> = {}
  ): RoomGenerationConfig => ({
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
    ...overrides,
  });

  describe('BSPGenerator', () => {
    it('部屋の範囲、種別、中心座標を保持する', () => {
      const generator = new BSPGenerator(50, 50, 12345);
      const result = generator.generate(createRoomConfig());

      expect(result.rooms.length).toBeGreaterThan(0);

      for (const room of result.rooms) {
        // 範囲の検証
        expect(room.x).toBeGreaterThanOrEqual(0);
        expect(room.y).toBeGreaterThanOrEqual(0);
        expect(room.width).toBeGreaterThanOrEqual(4);
        expect(room.height).toBeGreaterThanOrEqual(4);
        expect(room.x + room.width).toBeLessThanOrEqual(50);
        expect(room.y + room.height).toBeLessThanOrEqual(50);

        // 種別の検証
        expect(Object.values(RoomType)).toContain(room.type);

        // 中心座標の検証
        const centerX = room.x + Math.floor(room.width / 2);
        const centerY = room.y + Math.floor(room.height / 2);
        expect(centerX).toBeGreaterThanOrEqual(room.x);
        expect(centerX).toBeLessThan(room.x + room.width);
        expect(centerY).toBeGreaterThanOrEqual(room.y);
        expect(centerY).toBeLessThan(room.y + room.height);
      }
    });

    it('入口と出口を部屋に関連付ける', () => {
      const generator = new BSPGenerator(50, 50, 12345);
      const result = generator.generate(createRoomConfig());

      const entranceRooms = result.rooms.filter((r) => r.type === RoomType.ENTRANCE);
      const exitRooms = result.rooms.filter((r) => r.type === RoomType.EXIT);

      expect(entranceRooms.length).toBe(1);
      expect(exitRooms.length).toBe(1);
      expect(entranceRooms[0]).not.toBe(exitRooms[0]);
    });

    it('入口・出口の部屋がマップ境界内に配置される', () => {
      const generator = new BSPGenerator(50, 50, 12345);
      const result = generator.generate(createRoomConfig());

      const entrance = result.rooms.find((r) => r.type === RoomType.ENTRANCE)!;
      const exit = result.rooms.find((r) => r.type === RoomType.EXIT)!;

      // 入口・出口ともにマップ内に完全に含まれる
      expect(entrance.x).toBeGreaterThanOrEqual(0);
      expect(entrance.y).toBeGreaterThanOrEqual(0);
      expect(entrance.x + entrance.width).toBeLessThanOrEqual(50);
      expect(entrance.y + entrance.height).toBeLessThanOrEqual(50);

      expect(exit.x).toBeGreaterThanOrEqual(0);
      expect(exit.y).toBeGreaterThanOrEqual(0);
      expect(exit.x + exit.width).toBeLessThanOrEqual(50);
      expect(exit.y + exit.height).toBeLessThanOrEqual(50);
    });

    it('入口・出口の部屋が通行可能タイルとしてマップに描画される', async () => {
      const mapGen = new FlexibleMapGenerator(50, 50);
      const result = await mapGen.generateMap(4, 8, StageType.CLASSIC);

      const entrance = result.rooms.find((r) => r.type === RoomType.ENTRANCE);
      const exit = result.rooms.find((r) => r.type === RoomType.EXIT);

      expect(entrance).toBeDefined();
      expect(exit).toBeDefined();

      // 入口の部屋の中心タイルが通行可能（GRASS）である
      if (entrance) {
        const cx = entrance.x + Math.floor(entrance.width / 2);
        const cy = entrance.y + Math.floor(entrance.height / 2);
        expect(result.map[cy][cx]).not.toBe(0); // EMPTY(0) でない = 通行可能
      }

      // 出口の部屋の中心タイルが通行可能（GRASS）である
      if (exit) {
        const cx = exit.x + Math.floor(exit.width / 2);
        const cy = exit.y + Math.floor(exit.height / 2);
        expect(result.map[cy][cx]).not.toBe(0); // EMPTY(0) でない = 通行可能
      }
    });

    it('入口・出口の部屋が通路で接続されている', async () => {
      const mapGen = new FlexibleMapGenerator(50, 50);
      const result = await mapGen.generate({
        width: 50,
        height: 50,
        stageType: StageType.CLASSIC,
        algorithm: MapGenerationAlgorithm.BSP,
        roomConfig: createRoomConfig(),
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
      });

      const entrance = result.rooms.find((r) => r.type === RoomType.ENTRANCE)!;
      const exit = result.rooms.find((r) => r.type === RoomType.EXIT)!;

      // 入口と出口の部屋ID（x,y 形式）
      const entranceId = `${entrance.x},${entrance.y}`;
      const exitId = `${exit.x},${exit.y}`;

      // 通路の connectedRooms に入口または出口のIDが含まれているか、
      // または通路の始点/終点が入口・出口の部屋境界内にあるか
      const entranceConnected = result.corridors.some((c) => {
        const inEntrance = (px: number, py: number) =>
          px >= entrance.x &&
          px < entrance.x + entrance.width &&
          py >= entrance.y &&
          py < entrance.y + entrance.height;
        return (
          c.connectedRooms.includes(entranceId) ||
          inEntrance(c.startX, c.startY) ||
          inEntrance(c.endX, c.endY)
        );
      });

      const exitConnected = result.corridors.some((c) => {
        const inExit = (px: number, py: number) =>
          px >= exit.x && px < exit.x + exit.width && py >= exit.y && py < exit.y + exit.height;
        return (
          c.connectedRooms.includes(exitId) || inExit(c.startX, c.startY) || inExit(c.endX, c.endY)
        );
      });

      expect(entranceConnected).toBe(true);
      expect(exitConnected).toBe(true);
    });

    it('部屋同士が不正に重複しない', () => {
      const generator = new BSPGenerator(50, 50, 12345);
      const result = generator.generate(createRoomConfig());

      const rooms = result.rooms;
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          const r1 = rooms[i];
          const r2 = rooms[j];
          // 重複チェック（margin=1）
          const overlaps = !(
            r1.x + r1.width + 1 <= r2.x ||
            r2.x + r2.width + 1 <= r1.x ||
            r1.y + r1.height + 1 <= r2.y ||
            r2.y + r2.height + 1 <= r1.y
          );
          expect(overlaps).toBe(false);
        }
      }
    });

    it('部屋がマップ外へ配置されない', () => {
      const generator = new BSPGenerator(50, 50, 12345);
      const result = generator.generate(createRoomConfig());

      for (const room of result.rooms) {
        expect(room.x).toBeGreaterThanOrEqual(0);
        expect(room.y).toBeGreaterThanOrEqual(0);
        expect(room.x + room.width).toBeLessThanOrEqual(50);
        expect(room.y + room.height).toBeLessThanOrEqual(50);
      }
    });

    it('生成結果に seed を保持する', () => {
      const generator = new BSPGenerator(50, 50, 42);
      const result = generator.generate(createRoomConfig());

      expect(result.metadata.seed).toBe(42);
    });

    it('Room の customData に seed を保持する', () => {
      const generator = new BSPGenerator(50, 50, 99);
      const result = generator.generate(createRoomConfig());

      for (const room of result.rooms) {
        expect(room.customData?.seed).toBe(99);
      }
    });

    it('同一 seed で Room 構造を再現できる', () => {
      const config = createRoomConfig();
      const gen1 = new BSPGenerator(50, 50, 12345);
      const result1 = gen1.generate(config);

      const gen2 = new BSPGenerator(50, 50, 12345);
      const result2 = gen2.generate(config);

      expect(result2.rooms.length).toBe(result1.rooms.length);
      for (let i = 0; i < result1.rooms.length; i++) {
        expect(result2.rooms[i].x).toBe(result1.rooms[i].x);
        expect(result2.rooms[i].y).toBe(result1.rooms[i].y);
        expect(result2.rooms[i].width).toBe(result1.rooms[i].width);
        expect(result2.rooms[i].height).toBe(result1.rooms[i].height);
        expect(result2.rooms[i].type).toBe(result1.rooms[i].type);
      }
    });

    it('異なる seed で異なる Room 構造を生成する', () => {
      const config = createRoomConfig();
      const gen1 = new BSPGenerator(50, 50, 111);
      const result1 = gen1.generate(config);

      const gen2 = new BSPGenerator(50, 50, 222);
      const result2 = gen2.generate(config);

      // 部屋数または位置のいずれかが異なる
      const structureDiffers =
        result1.rooms.length !== result2.rooms.length ||
        result1.rooms.some(
          (r, i) =>
            !result2.rooms[i] ||
            r.x !== result2.rooms[i].x ||
            r.y !== result2.rooms[i].y ||
            r.width !== result2.rooms[i].width ||
            r.height !== result2.rooms[i].height
        );
      expect(structureDiffers).toBe(true);
    });

    it('getSeed と setSeed でシードを管理できる', () => {
      const generator = new BSPGenerator(50, 50, 100);
      expect(generator.getSeed()).toBe(100);

      generator.setSeed(200);
      expect(generator.getSeed()).toBe(200);
    });
  });

  describe('FlexibleMapGenerator', () => {
    it('生成結果から rooms と corridors を取得できる', async () => {
      const generator = new FlexibleMapGenerator(50, 50);
      const result = await generator.generateMap(4, 8, StageType.CLASSIC);

      expect(result.rooms.length).toBeGreaterThan(0);
      expect(result.map).toBeDefined();
      expect(result.map.length).toBe(50);
    });

    it('通路が部屋を接続する', async () => {
      const generator = new FlexibleMapGenerator(50, 50);
      const result = await generator.generate({
        width: 50,
        height: 50,
        stageType: StageType.CLASSIC,
        algorithm: MapGenerationAlgorithm.BSP,
        roomConfig: createRoomConfig(),
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
      });

      // 通路が生成されている
      expect(result.corridors.length).toBeGreaterThan(0);

      // 各通路の connectedRooms が設定されている
      for (const corridor of result.corridors) {
        expect(corridor.connectedRooms).toBeDefined();
        expect(corridor.connectedRooms.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('必須 Room が孤立しない（通路で接続される）', async () => {
      const generator = new FlexibleMapGenerator(50, 50);
      const result = await generator.generate({
        width: 50,
        height: 50,
        stageType: StageType.CLASSIC,
        algorithm: MapGenerationAlgorithm.BSP,
        roomConfig: createRoomConfig(),
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
      });

      const rooms = result.rooms;
      const corridors = result.corridors;

      // 各部屋が少なくとも1つの通路に接続されているか確認
      // 部屋IDは "x,y" 形式
      const connectedRoomIds = new Set<string>();
      for (const corridor of corridors) {
        for (const roomId of corridor.connectedRooms) {
          connectedRoomIds.add(roomId);
        }
      }

      // すべての部屋が接続されているか確認
      for (const room of rooms) {
        const roomId = `${room.x},${room.y}`;
        // 通路の connectedRooms に含まれているか、
        // または通路の始点/終点が部屋の範囲内にあるか
        const isDirectlyConnected = connectedRoomIds.has(roomId);
        const isNearCorridor = corridors.some((c) => {
          // 通路の始点または終点が部屋の範囲内または境界にあるか
          const inRoom = (px: number, py: number) =>
            px >= room.x - 1 &&
            px <= room.x + room.width + 1 &&
            py >= room.y - 1 &&
            py <= room.y + room.height + 1;
          return inRoom(c.startX, c.startY) || inRoom(c.endX, c.endY);
        });

        expect(isDirectlyConnected || isNearCorridor).toBe(true);
      }
    });

    it('通路がマップ外へ配置されない', async () => {
      const generator = new FlexibleMapGenerator(50, 50);
      const result = await generator.generate({
        width: 50,
        height: 50,
        stageType: StageType.CLASSIC,
        algorithm: MapGenerationAlgorithm.BSP,
        roomConfig: createRoomConfig(),
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
      });

      for (const corridor of result.corridors) {
        expect(corridor.startX).toBeGreaterThanOrEqual(0);
        expect(corridor.startY).toBeGreaterThanOrEqual(0);
        expect(corridor.startX).toBeLessThan(50);
        expect(corridor.startY).toBeLessThan(50);
        expect(corridor.endX).toBeGreaterThanOrEqual(0);
        expect(corridor.endY).toBeGreaterThanOrEqual(0);
        expect(corridor.endX).toBeLessThan(50);
        expect(corridor.endY).toBeLessThan(50);
      }
    });

    it('通路の幅が正の値を持つ', async () => {
      const generator = new FlexibleMapGenerator(50, 50);
      const result = await generator.generate({
        width: 50,
        height: 50,
        stageType: StageType.CLASSIC,
        algorithm: MapGenerationAlgorithm.BSP,
        roomConfig: createRoomConfig(),
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
      });

      for (const corridor of result.corridors) {
        expect(corridor.width).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('WorldSystem floor map storage', () => {
    it('フロア切替後に各階の TileMap を独立して保持する', async () => {
      const map = new TileMap(10, 10);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          map.setTileAt(x, y, 0, TileType.TILE, true);
        }
      }
      world = new WorldSystem(map);
      Engine.instance.registerSystem('world', world);
      await world.initialize(Engine.instance);

      // 新しいフロアを生成して切り替え
      await world.changeFloor(2);

      // フロア2は generateNewFloor で 50x50 のマップが生成される
      expect(world.getTileMap()).toBeDefined();
      expect(world.getTileMap()!.getWidth()).toBe(50);
      expect(world.getTileMap()!.getHeight()).toBe(50);

      // フロア3も別途生成される
      await world.changeFloor(3);
      expect(world.getTileMap()!.getWidth()).toBe(50);

      // フロア2に戻ってから floor2 のマップ参照を記録
      await world.changeFloor(2);
      const floor2MapBefore = world.getTileMap();

      // フロア3に移動してから再度フロア2に戻る
      await world.changeFloor(3);
      await world.changeFloor(2);

      // 同一参照が保持されている（再生成されていない）
      expect(world.getTileMap()).toBe(floor2MapBefore);
    });

    it('フロア切替後に各階の Room 情報を独立して保持する', async () => {
      const map = new TileMap(10, 10);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          map.setTileAt(x, y, 0, TileType.TILE, true);
        }
      }
      world = new WorldSystem(map);
      Engine.instance.registerSystem('world', world);
      await world.initialize(Engine.instance);

      // フロア2を生成
      await world.changeFloor(2);
      const floor2Rooms = world.getRooms();
      expect(floor2Rooms.length).toBeGreaterThan(0);

      // 各 Room の ID（x,y 形式）を記録
      const floor2RoomIds = floor2Rooms.map((r) => `${r.x},${r.y}`);

      // フロア3を生成
      await world.changeFloor(3);
      const floor3Rooms = world.getRooms();
      expect(floor3Rooms.length).toBeGreaterThan(0);

      // フロア2とフロア3で Room 構造が異なる（内容ベースで比較）
      const floor3RoomIds = floor3Rooms.map((r) => `${r.x},${r.y}`);
      expect(floor3RoomIds).not.toEqual(floor2RoomIds);

      // 独立性検証: floor2 の Room 配列を変更しても floor3 に影響しない
      const floor2RoomsRef = world.getRooms();
      // floor3 に切り替えてから floor3 の Room を取得
      await world.changeFloor(3);
      const floor3RoomsRef = world.getRooms();
      // floor2 の Room 配列を破壊的に変更
      floor2RoomsRef.push({ x: 999, y: 999, width: 1, height: 1 } as any);
      // floor3 の Room 配列は影響を受けないことを検証
      expect(floor3RoomsRef.length).toBe(floor3Rooms.length);
      expect(floor3RoomsRef.some((r) => r.x === 999 && r.y === 999)).toBe(false);

      // フロア2に戻っても元の Room 内容が保持されている（値で比較）
      await world.changeFloor(2);
      const floor2RoomIdsAfter = world.getRooms().map((r) => `${r.x},${r.y}`);
      expect(floor2RoomIdsAfter).toEqual(floor2RoomIds);
    });

    it('フロア切替後に各階の Corridor 情報を独立して保持する', async () => {
      const map = new TileMap(10, 10);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          map.setTileAt(x, y, 0, TileType.TILE, true);
        }
      }
      world = new WorldSystem(map);
      Engine.instance.registerSystem('world', world);
      await world.initialize(Engine.instance);

      // フロア2を生成
      await world.changeFloor(2);
      const floor2CorridorIds = world
        .getCorridors()
        .map((c) => `${c.startX},${c.startY}->${c.endX},${c.endY}`);
      expect(floor2CorridorIds.length).toBeGreaterThan(0);

      // フロア3を生成
      await world.changeFloor(3);
      expect(world.getCorridors().length).toBeGreaterThan(0);

      // フロア2に戻っても同じ Corridor 内容が保持されている（値で比較）
      await world.changeFloor(3);
      await world.changeFloor(2);
      const floor2CorridorIdsAfter = world
        .getCorridors()
        .map((c) => `${c.startX},${c.startY}->${c.endX},${c.endY}`);
      expect(floor2CorridorIdsAfter).toEqual(floor2CorridorIds);
    });

    it('setRooms/setCorridors で明示的に Room 情報を設定できる', () => {
      const map = new TileMap(10, 10);
      world = new WorldSystem(map);

      const testRooms: Room[] = [
        { x: 1, y: 1, width: 5, height: 5, type: RoomType.ENTRANCE },
        { x: 10, y: 10, width: 6, height: 6, type: RoomType.EXIT },
      ];
      const testCorridors: Corridor[] = [
        {
          startX: 5,
          startY: 3,
          endX: 10,
          endY: 13,
          width: 1,
          method: 'astar' as any,
          connectedRooms: ['1,1', '10,10'],
        },
      ];

      world.setRooms(1, testRooms);
      world.setCorridors(1, testCorridors);

      // getter はコピーを返すため、値で比較する
      expect(world.getRooms()).toEqual(testRooms);
      expect(world.getCorridors()).toEqual(testCorridors);
      expect(world.getRoomsByFloor(1)).toEqual(testRooms);
      expect(world.getCorridorsByFloor(1)).toEqual(testCorridors);
    });

    it('getter は内部配列のコピーを返す（疎結合）', () => {
      const map = new TileMap(10, 10);
      world = new WorldSystem(map);

      const testRooms: Room[] = [{ x: 1, y: 1, width: 5, height: 5, type: RoomType.ENTRANCE }];
      world.setRooms(1, testRooms);

      // getter の戻り値を変更しても内部配列に影響しない
      const rooms1 = world.getRooms();
      rooms1.push({ x: 99, y: 99, width: 1, height: 1, type: RoomType.NORMAL });

      const rooms2 = world.getRooms();
      expect(rooms2).toHaveLength(1);
      expect(rooms2).toEqual(testRooms);
    });

    it('registerFloor は入力配列をコピーし、空配列で再登録すると古い情報を消す', () => {
      const map = new TileMap(10, 10);
      world = new WorldSystem(map);

      const rooms: Room[] = [{ x: 1, y: 1, width: 5, height: 5, type: RoomType.ENTRANCE }];
      const corridors: Corridor[] = [
        {
          startX: 5,
          startY: 3,
          endX: 8,
          endY: 3,
          width: 1,
          method: 'astar' as any,
          connectedRooms: ['1,1', '8,1'],
        },
      ];

      world.registerFloor(1, map, rooms, corridors);
      rooms.push({ x: 8, y: 1, width: 2, height: 2, type: RoomType.EXIT });
      corridors.length = 0;

      expect(world.getRooms()).toHaveLength(1);
      expect(world.getCorridors()).toHaveLength(1);

      world.registerFloor(1, map, [], []);

      expect(world.getRooms()).toEqual([]);
      expect(world.getCorridors()).toEqual([]);
    });
  });
});
