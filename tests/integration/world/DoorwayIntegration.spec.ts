import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { createFloorSnapshot } from '@/engine/world/FloorSnapshot';
import { RoomIdGenerator } from '@/engine/world/RoomId';
import {
  corridorsToDoorways,
  validateDoorways,
  isRoomGraphConnected,
  Doorway,
} from '@/engine/world/Doorway';
import { FlexibleMapGenerator } from '@/engine/world/FlexibleMapGenerator';
import { TacticalMapGenerator } from '@/engine/world/TacticalMapGenerator';
import {
  Corridor,
  CorridorGenerationMethod,
  MapGenerationAlgorithm,
  Room,
  RoomType,
  StageType,
  TileType,
} from '@/engine/types';

/* eslint-disable @typescript-eslint/no-non-assertion */

/**
 * Doorway 結合テスト — WorldSystem と実生成器を結線した Doorway 整合性検証
 *
 * 単体テスト（純粋関数）は tests/unit/world/Doorway.spec.ts に分離済み。
 */
describe('Doorway integration', () => {
  /** テスト用 Room を作成するヘルパ（ID を自動採番） */
  const makeRoom = (
    gen: RoomIdGenerator,
    x: number,
    y: number,
    width: number,
    height: number,
    type: RoomType = RoomType.NORMAL
  ): Room => ({
    id: gen.next() as string,
    x,
    y,
    width,
    height,
    type,
  });

  describe('WorldSystem Doorway integration', () => {
    let events: EventSystem;
    let entities: EntitySystem;
    let world: WorldSystem;

    beforeEach(async () => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();

      Engine.instance.reset();
      events = new EventSystem();
      entities = new EntitySystem();
      Engine.instance.registerSystem('event', events);
      Engine.instance.registerSystem('entity', entities);
      await entities.initialize(Engine.instance);

      const map = new TileMap(10, 10);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          map.setTileAt(x, y, 0, TileType.TILE, true);
        }
      }
      world = new WorldSystem(map);
      Engine.instance.registerSystem('world', world);
      await world.initialize(Engine.instance);
    });

    afterEach(() => {
      Engine.instance.reset();
      jest.restoreAllMocks();
    });

    it('registerFloorSnapshot は corridors から Doorway を自動導出する', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(30, 30);
      const rooms: Room[] = [
        makeRoom(gen, 1, 1, 4, 4, RoomType.ENTRANCE),
        makeRoom(gen, 10, 10, 4, 4, RoomType.EXIT),
      ];
      const corridors: Corridor[] = [
        {
          startX: 4,
          startY: 2,
          endX: 10,
          endY: 12,
          width: 1,
          method: CorridorGenerationMethod.ASTAR,
          connectedRooms: [rooms[0].id, rooms[1].id],
        },
      ];

      world.registerFloorSnapshot(createFloorSnapshot(1, map, { rooms, corridors }));

      const doorways = world.getDoorways();
      expect(doorways).toHaveLength(2);
      expect(doorways[0].fromRoom).toBe(rooms[0].id);
      expect(doorways[0].toRoom).toBe(rooms[1].id);
    });

    it('明示的に doorways を渡した場合はそちらを優先する', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(30, 30);
      const rooms: Room[] = [makeRoom(gen, 1, 1, 4, 4)];
      const explicitDoorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: rooms[0].id as any,
          toRoom: rooms[0].id as any,
        },
      ];

      world.registerFloorSnapshot(
        createFloorSnapshot(1, map, { rooms, doorways: explicitDoorways })
      );

      expect(world.getDoorways()).toHaveLength(1);
      expect(world.getDoorways()[0].fromRoom).toBe(rooms[0].id);
    });

    it('フロア切替後も各階の Doorway が独立して保持される', () => {
      const gen = new RoomIdGenerator();
      const map1 = new TileMap(30, 30);
      const map2 = new TileMap(30, 30);
      const room = makeRoom(gen, 1, 1, 4, 4);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map1, {
          rooms: [room],
          corridors: [
            {
              startX: 4,
              startY: 2,
              endX: 4,
              endY: 4,
              width: 1,
              method: CorridorGenerationMethod.ASTAR,
              connectedRooms: [room.id, room.id],
            },
          ],
        })
      );
      world.registerFloorSnapshot(createFloorSnapshot(2, map2));

      world.setCurrentFloor(1);
      expect(world.getDoorways().length).toBeGreaterThan(0);

      world.setCurrentFloor(2);
      expect(world.getDoorways()).toEqual([]);

      world.setCurrentFloor(1);
      expect(world.getDoorways().length).toBeGreaterThan(0);
    });

    it('getDoorwaysByFloor は指定フロアの Doorway を返す', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(30, 30);
      const rooms = [makeRoom(gen, 1, 1, 4, 4), makeRoom(gen, 10, 10, 4, 4)];
      world.registerFloorSnapshot(
        createFloorSnapshot(3, map, {
          rooms,
          corridors: [
            {
              startX: 4,
              startY: 2,
              endX: 10,
              endY: 12,
              width: 1,
              method: CorridorGenerationMethod.ASTAR,
              connectedRooms: [rooms[0].id, rooms[1].id],
            },
          ],
        })
      );

      expect(world.getDoorwaysByFloor(3)).toHaveLength(2);
      expect(world.getDoorwaysByFloor(99)).toEqual([]);
    });

    it('registerFloorSnapshot は不正な Doorway に対して警告を出力する（B3）', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(30, 30);
      const rooms = [makeRoom(gen, 1, 1, 4, 4), makeRoom(gen, 10, 10, 4, 4)];

      // fromRoom が存在しない不正な Doorway を明示的に渡す
      const invalidDoorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: 'room:999' as any,
          toRoom: rooms[1].id as any,
        },
      ];

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      world.registerFloorSnapshot(
        createFloorSnapshot(1, map, { rooms, doorways: invalidDoorways })
      );

      // 警告が出力される
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Doorway validation error'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown_from_room'));

      warnSpy.mockRestore();
    });

    it('registerFloorSnapshot は有効な Doorway に対して警告を出力しない（B3）', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(30, 30);
      // 全タイルを通行可能に設定
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) {
          map.setTileAt(x, y, 0, TileType.TILE, true);
        }
      }
      const rooms = [makeRoom(gen, 1, 1, 4, 4), makeRoom(gen, 10, 10, 4, 4)];
      const corridors: Corridor[] = [
        {
          startX: 4,
          startY: 2,
          endX: 10,
          endY: 12,
          width: 1,
          method: CorridorGenerationMethod.ASTAR,
          connectedRooms: [rooms[0].id, rooms[1].id],
        },
      ];

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      world.registerFloorSnapshot(createFloorSnapshot(1, map, { rooms, corridors }));

      // Doorway 検証エラーの警告は出力されない
      const validationWarnings = warnSpy.mock.calls.filter((call) =>
        String(call[0]).includes('Doorway validation error')
      );
      expect(validationWarnings).toHaveLength(0);

      warnSpy.mockRestore();
    });
  });

  describe('generated map Doorway consistency', () => {
    it('FlexibleMapGenerator の生成結果から Doorway を導出し整合性を検証できる', async () => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();

      const generator = new FlexibleMapGenerator(50, 50);
      const result = await generator.generate({
        width: 50,
        height: 50,
        stageType: StageType.CLASSIC,
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
      });

      // TileMap を構築して通行可能性を判定できるようにする
      const tileMap = new TileMap(50, 50);
      tileMap.importMapData(result.map);

      const doorways = corridorsToDoorways(result.corridors, result.rooms);

      // Doorway が1件以上生成される
      expect(doorways.length).toBeGreaterThan(0);

      // 整合性検証: 全 Doorway が fromRoom 境界上にある
      const validationResult = validateDoorways(doorways, result.rooms, (x, y) =>
        tileMap.isWalkable(x, y, 0)
      );

      // 生成されたマップでは、Doorway が通行可能タイル上にあることを期待する。
      // 境界上にない Doorway は corridorsToDoorways で既に除外されているため、
      // unknown_room エラーは発生しないはず。
      const criticalErrors = validationResult.errors.filter(
        (e) => e.kind === 'unknown_from_room' || e.kind === 'unknown_to_room'
      );
      expect(criticalErrors).toEqual([]);

      // 全 Room が Doorway 経由で接続されているか（緩い判定）
      // ※ corridorsToDoorways は境界上の接続点のみ Doorway 化するため、
      //    全 Room が Doorway に現れない場合もある。ここでは連結性のみ確認。
      const connected = isRoomGraphConnected(result.rooms, doorways);
      // 連結性は ensureConnectivity により保証されていることを期待
      expect(connected).toBe(true);

      jest.restoreAllMocks();
    });

    it('TacticalMapGenerator の生成結果から Doorway を導出し整合性を検証できる', async () => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();

      const generator = new TacticalMapGenerator(50, 50);
      const result = await generator.generate({
        width: 50,
        height: 50,
        stageType: StageType.TACTICAL_COMBAT,
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
      });

      // TileMap を構築して通行可能性を判定できるようにする
      const tileMap = new TileMap(50, 50);
      tileMap.importMapData(result.map);

      const doorways = corridorsToDoorways(result.corridors, result.rooms);

      // Doorway が1件以上生成される
      expect(doorways.length).toBeGreaterThan(0);

      // 整合性検証: 全 Doorway が fromRoom 境界上にある
      const validationResult = validateDoorways(doorways, result.rooms, (x, y) =>
        tileMap.isWalkable(x, y, 0)
      );

      // 生成されたマップでは、Doorway が通行可能タイル上にあることを期待する。
      const criticalErrors = validationResult.errors.filter(
        (e) => e.kind === 'unknown_from_room' || e.kind === 'unknown_to_room'
      );
      expect(criticalErrors).toEqual([]);

      // 全 Room が Doorway 経由で接続されているか（緩い判定）
      const connected = isRoomGraphConnected(result.rooms, doorways);
      // 連結性は ensureConnectivity により保証されていることを期待
      expect(connected).toBe(true);

      jest.restoreAllMocks();
    });
  });

  describe('P2-fix: doorways===0 の警告', () => {
    it('rooms と corridors があるのに doorways が0件の場合は警告を出力する', async () => {
      jest.spyOn(console, 'log').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const events = new EventSystem();
      const entities = new EntitySystem();
      Engine.instance.reset();
      Engine.instance.registerSystem('event', events);
      Engine.instance.registerSystem('entity', entities);
      await entities.initialize(Engine.instance);

      const map = new TileMap(20, 20);
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          map.setTileAt(x, y, 0, TileType.TILE, true);
        }
      }
      const world = new WorldSystem(map);
      Engine.instance.registerSystem('world', world);
      await world.initialize(Engine.instance);

      // rooms と corridors はあるが、corridorsToDoorways で0件になるケース
      // （corridor が room 境界に接していない場合）
      const gen = new RoomIdGenerator();
      const rooms: Room[] = [
        { id: gen.next() as string, x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL },
        { id: gen.next() as string, x: 10, y: 10, width: 4, height: 4, type: RoomType.NORMAL },
      ];
      // 遠すぎる corridor（room 境界に接しない）
      const corridors: Corridor[] = [
        {
          startX: 5,
          startY: 5,
          endX: 7,
          endY: 5,
          width: 1,
          method: 'astar' as CorridorGenerationMethod,
          connectedRooms: [],
        },
      ];

      world.registerFloorSnapshot(createFloorSnapshot(1, map, { rooms, corridors }));

      // doorways が0件の警告が出力されている
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('but 0 doorways were derived'));

      Engine.instance.reset();
      jest.restoreAllMocks();
    });
  });
});
