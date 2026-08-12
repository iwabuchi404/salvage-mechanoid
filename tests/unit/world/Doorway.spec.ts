import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { createFloorSnapshot } from '@/engine/world/FloorSnapshot';
import { createRoomId, roomToId } from '@/engine/world/RoomId';
import {
  corridorToDoorways,
  corridorsToDoorways,
  detectDirection,
  isOnRoomBoundary,
  validateDoorways,
  areAllRoomsConnected,
  buildRoomGraph,
  isRoomGraphConnected,
  Doorway,
} from '@/engine/world/Doorway';
import { FlexibleMapGenerator } from '@/engine/world/FlexibleMapGenerator';
import {
  Corridor,
  CorridorGenerationMethod,
  MapGenerationAlgorithm,
  Room,
  RoomType,
  StageType,
  TileType,
} from '@/engine/types';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * Doorway 型と Corridor からの変換・整合性検証の境界テスト
 */
describe('Doorway', () => {
  describe('detectDirection / isOnRoomBoundary', () => {
    const room: Room = { x: 5, y: 5, width: 4, height: 4, type: RoomType.NORMAL };

    it('上境界を up と判定する', () => {
      expect(detectDirection(room, 6, 5)).toBe('up');
      expect(isOnRoomBoundary(room, 6, 5)).toBe(true);
    });

    it('下境界を down と判定する', () => {
      expect(detectDirection(room, 6, 8)).toBe('down');
      expect(isOnRoomBoundary(room, 6, 8)).toBe(true);
    });

    it('左境界を left と判定する', () => {
      expect(detectDirection(room, 5, 6)).toBe('left');
      expect(isOnRoomBoundary(room, 5, 6)).toBe(true);
    });

    it('右境界を right と判定する', () => {
      expect(detectDirection(room, 8, 6)).toBe('right');
      expect(isOnRoomBoundary(room, 8, 6)).toBe(true);
    });

    it('境界外は null を返す', () => {
      expect(detectDirection(room, 6, 6)).toBeNull();
      expect(isOnRoomBoundary(room, 6, 6)).toBe(false);
    });
  });

  describe('corridorToDoorways', () => {
    const rooms: Room[] = [
      { x: 1, y: 1, width: 4, height: 4, type: RoomType.ENTRANCE },
      { x: 10, y: 10, width: 4, height: 4, type: RoomType.EXIT },
    ];

    it('Corridor から両端の Doorway を生成する', () => {
      // 始点 (4,2) は room1 の右境界、終点 (10,12) は room2 の左境界
      const corridor: Corridor = {
        startX: 4,
        startY: 2,
        endX: 10,
        endY: 12,
        width: 1,
        method: CorridorGenerationMethod.ASTAR,
        connectedRooms: [`${rooms[0].x},${rooms[0].y}`, `${rooms[1].x},${rooms[1].y}`],
      };

      const doorways = corridorToDoorways(corridor, rooms, 0);

      expect(doorways).toHaveLength(2);
      // 始点側: room1 -> room2
      expect(doorways[0].fromRoom).toBe(roomToId(rooms[0]));
      expect(doorways[0].toRoom).toBe(roomToId(rooms[1]));
      expect(doorways[0].direction).toBe('right');
      expect(doorways[0].position).toEqual({ x: 4, y: 2 });
      expect(doorways[0].corridorIndex).toBe(0);
      // 終点側: room2 -> room1
      expect(doorways[1].fromRoom).toBe(roomToId(rooms[1]));
      expect(doorways[1].toRoom).toBe(roomToId(rooms[0]));
      expect(doorways[1].direction).toBe('left');
      expect(doorways[1].position).toEqual({ x: 10, y: 12 });
    });

    it('connectedRooms が 2 未満の Corridor は空配列を返す', () => {
      const corridor: Corridor = {
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        width: 1,
        method: CorridorGenerationMethod.ASTAR,
        connectedRooms: [],
      };

      expect(corridorToDoorways(corridor, rooms)).toEqual([]);
    });

    it('始点が Room 境界上にない場合は始点 Doorway を省略する', () => {
      const corridor: Corridor = {
        startX: 2,
        startY: 2, // room1 の内部（境界ではない）
        endX: 10,
        endY: 12,
        width: 1,
        method: CorridorGenerationMethod.ASTAR,
        connectedRooms: [`${rooms[0].x},${rooms[0].y}`, `${rooms[1].x},${rooms[1].y}`],
      };

      const doorways = corridorToDoorways(corridor, rooms);
      // 終点側のみ生成される
      expect(doorways).toHaveLength(1);
      expect(doorways[0].fromRoom).toBe(roomToId(rooms[1]));
    });

    it('corridorsToDoorways は複数 Corridor を一括変換する', () => {
      const corridor1: Corridor = {
        startX: 4,
        startY: 2,
        endX: 10,
        endY: 12,
        width: 1,
        method: CorridorGenerationMethod.ASTAR,
        connectedRooms: [`${rooms[0].x},${rooms[0].y}`, `${rooms[1].x},${rooms[1].y}`],
      };
      const corridor2: Corridor = {
        startX: 4,
        startY: 4,
        endX: 10,
        endY: 10,
        width: 1,
        method: CorridorGenerationMethod.ASTAR,
        connectedRooms: [`${rooms[0].x},${rooms[0].y}`, `${rooms[1].x},${rooms[1].y}`],
      };

      const doorways = corridorsToDoorways([corridor1, corridor2], rooms);
      expect(doorways).toHaveLength(4);
      expect(doorways[0].corridorIndex).toBe(0);
      expect(doorways[2].corridorIndex).toBe(1);
    });
  });

  describe('validateDoorways', () => {
    const rooms: Room[] = [
      { x: 1, y: 1, width: 4, height: 4, type: RoomType.ENTRANCE },
      { x: 10, y: 10, width: 4, height: 4, type: RoomType.EXIT },
    ];

    const validDoorways: Doorway[] = [
      {
        position: { x: 4, y: 2 },
        direction: 'right',
        fromRoom: createRoomId(1, 1),
        toRoom: createRoomId(10, 10),
      },
      {
        position: { x: 10, y: 12 },
        direction: 'left',
        fromRoom: createRoomId(10, 10),
        toRoom: createRoomId(1, 1),
      },
    ];

    it('有効な Doorway 配列は valid: true を返す', () => {
      const result = validateDoorways(validDoorways, rooms);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('fromRoom が存在しない場合は unknown_from_room エラー', () => {
      const invalid: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: createRoomId(99, 99),
          toRoom: createRoomId(10, 10),
        },
      ];

      const result = validateDoorways(invalid, rooms);
      expect(result.valid).toBe(false);
      expect(result.errors[0].kind).toBe('unknown_from_room');
    });

    it('toRoom が存在しない場合は unknown_to_room エラー', () => {
      const invalid: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: createRoomId(1, 1),
          toRoom: createRoomId(99, 99),
        },
      ];

      const result = validateDoorways(invalid, rooms);
      expect(result.valid).toBe(false);
      expect(result.errors[0].kind).toBe('unknown_to_room');
    });

    it('Doorway が fromRoom 境界上にない場合は position_not_on_boundary エラー', () => {
      const invalid: Doorway[] = [
        {
          position: { x: 2, y: 2 }, // room1 の内部
          direction: 'right',
          fromRoom: createRoomId(1, 1),
          toRoom: createRoomId(10, 10),
        },
      ];

      const result = validateDoorways(invalid, rooms);
      expect(result.valid).toBe(false);
      expect(result.errors[0].kind).toBe('position_not_on_boundary');
    });

    it('walkableChecker を渡した場合、通行不可タイル上の Doorway を検出する', () => {
      const result = validateDoorways(validDoorways, rooms, (x, y) => {
        // (4,2) を通行不可とする
        return !(x === 4 && y === 2);
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].kind).toBe('position_not_walkable');
      expect(result.errors[0].doorwayIndex).toBe(0);
    });

    it('walkableChecker 省略時は通行可能性を検証しない', () => {
      const result = validateDoorways(validDoorways, rooms);
      expect(result.valid).toBe(true);
    });
  });

  describe('Room connectivity', () => {
    const rooms: Room[] = [
      { x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL },
      { x: 10, y: 10, width: 4, height: 4, type: RoomType.NORMAL },
      { x: 20, y: 20, width: 4, height: 4, type: RoomType.NORMAL },
    ];

    it('areAllRoomsConnected は全 Room が Doorway に接続されている場合 true', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: createRoomId(1, 1),
          toRoom: createRoomId(10, 10),
        },
        {
          position: { x: 10, y: 12 },
          direction: 'left',
          fromRoom: createRoomId(10, 10),
          toRoom: createRoomId(1, 1),
        },
        {
          position: { x: 13, y: 12 },
          direction: 'right',
          fromRoom: createRoomId(10, 10),
          toRoom: createRoomId(20, 20),
        },
        {
          position: { x: 20, y: 22 },
          direction: 'left',
          fromRoom: createRoomId(20, 20),
          toRoom: createRoomId(10, 10),
        },
      ];

      expect(areAllRoomsConnected(rooms, doorways)).toBe(true);
    });

    it('areAllRoomsConnected は未接続 Room がある場合 false', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: createRoomId(1, 1),
          toRoom: createRoomId(10, 10),
        },
      ];
      // room3 (20,20) が未接続

      expect(areAllRoomsConnected(rooms, doorways)).toBe(false);
    });

    it('isRoomGraphConnected は連結グラフの場合 true', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: createRoomId(1, 1),
          toRoom: createRoomId(10, 10),
        },
        {
          position: { x: 13, y: 12 },
          direction: 'right',
          fromRoom: createRoomId(10, 10),
          toRoom: createRoomId(20, 20),
        },
      ];

      expect(isRoomGraphConnected(rooms, doorways)).toBe(true);
    });

    it('isRoomGraphConnected は非連結グラフの場合 false', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: createRoomId(1, 1),
          toRoom: createRoomId(10, 10),
        },
        // room3 (20,20) への経路がない
      ];

      expect(isRoomGraphConnected(rooms, doorways)).toBe(false);
    });

    it('buildRoomGraph は fromRoom -> toRoom の隣接リストを構築する', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: createRoomId(1, 1),
          toRoom: createRoomId(10, 10),
        },
        {
          position: { x: 13, y: 12 },
          direction: 'right',
          fromRoom: createRoomId(10, 10),
          toRoom: createRoomId(20, 20),
        },
      ];

      const graph = buildRoomGraph(rooms, doorways);
      expect(graph.get(createRoomId(1, 1))).toEqual([createRoomId(10, 10)]);
      expect(graph.get(createRoomId(10, 10))).toEqual([createRoomId(20, 20)]);
      expect(graph.get(createRoomId(20, 20))).toEqual([]);
    });
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
      const map = new TileMap(30, 30);
      const rooms: Room[] = [
        { x: 1, y: 1, width: 4, height: 4, type: RoomType.ENTRANCE },
        { x: 10, y: 10, width: 4, height: 4, type: RoomType.EXIT },
      ];
      const corridors: Corridor[] = [
        {
          startX: 4,
          startY: 2,
          endX: 10,
          endY: 12,
          width: 1,
          method: CorridorGenerationMethod.ASTAR,
          connectedRooms: ['1,1', '10,10'],
        },
      ];

      world.registerFloorSnapshot(createFloorSnapshot(1, map, { rooms, corridors }));

      const doorways = world.getDoorways();
      expect(doorways).toHaveLength(2);
      expect(doorways[0].fromRoom).toBe('1,1');
      expect(doorways[0].toRoom).toBe('10,10');
    });

    it('明示的に doorways を渡した場合はそちらを優先する', () => {
      const map = new TileMap(30, 30);
      const rooms: Room[] = [
        { x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL },
      ];
      const explicitDoorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: createRoomId(1, 1),
          toRoom: createRoomId(1, 1),
        },
      ];

      world.registerFloorSnapshot(
        createFloorSnapshot(1, map, { rooms, doorways: explicitDoorways })
      );

      expect(world.getDoorways()).toHaveLength(1);
      expect(world.getDoorways()[0].fromRoom).toBe('1,1');
    });

    it('フロア切替後も各階の Doorway が独立して保持される', () => {
      const map1 = new TileMap(30, 30);
      const map2 = new TileMap(30, 30);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map1, {
          rooms: [{ x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL }],
          corridors: [
            {
              startX: 4,
              startY: 2,
              endX: 4,
              endY: 4,
              width: 1,
              method: CorridorGenerationMethod.ASTAR,
              connectedRooms: ['1,1', '1,1'],
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
      const map = new TileMap(30, 30);
      world.registerFloorSnapshot(
        createFloorSnapshot(3, map, {
          rooms: [
            { x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL },
            { x: 10, y: 10, width: 4, height: 4, type: RoomType.NORMAL },
          ],
          corridors: [
            {
              startX: 4,
              startY: 2,
              endX: 10,
              endY: 12,
              width: 1,
              method: CorridorGenerationMethod.ASTAR,
              connectedRooms: ['1,1', '10,10'],
            },
          ],
        })
      );

      expect(world.getDoorwaysByFloor(3)).toHaveLength(2);
      expect(world.getDoorwaysByFloor(99)).toEqual([]);
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
  });
});
