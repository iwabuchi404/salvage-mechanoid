import { RoomIdGenerator, roomToId } from '@/engine/world/RoomId';
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
import {
  Corridor,
  CorridorGenerationMethod,
  Room,
  RoomType,
} from '@/engine/types';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * Doorway 純粋関数の単体テスト
 *
 * WorldSystem 結線・生成器統合テストは tests/integration/world/DoorwayIntegration.spec.ts へ分離済み。
 */
describe('Doorway', () => {
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

  describe('detectDirection / isOnRoomBoundary', () => {
    const gen = new RoomIdGenerator();
    const room = makeRoom(gen, 5, 5, 4, 4);

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
    const gen = new RoomIdGenerator();
    const rooms: Room[] = [
      makeRoom(gen, 1, 1, 4, 4, RoomType.ENTRANCE),
      makeRoom(gen, 10, 10, 4, 4, RoomType.EXIT),
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
        connectedRooms: [rooms[0].id, rooms[1].id],
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
        connectedRooms: [rooms[0].id, rooms[1].id],
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
        connectedRooms: [rooms[0].id, rooms[1].id],
      };
      const corridor2: Corridor = {
        startX: 4,
        startY: 4,
        endX: 10,
        endY: 10,
        width: 1,
        method: CorridorGenerationMethod.ASTAR,
        connectedRooms: [rooms[0].id, rooms[1].id],
      };

      const doorways = corridorsToDoorways([corridor1, corridor2], rooms);
      expect(doorways).toHaveLength(4);
      expect(doorways[0].corridorIndex).toBe(0);
      expect(doorways[2].corridorIndex).toBe(1);
    });
  });

  describe('validateDoorways', () => {
    const gen = new RoomIdGenerator();
    const rooms: Room[] = [
      makeRoom(gen, 1, 1, 4, 4, RoomType.ENTRANCE),
      makeRoom(gen, 10, 10, 4, 4, RoomType.EXIT),
    ];

    const validDoorways: Doorway[] = [
      {
        position: { x: 4, y: 2 },
        direction: 'right',
        fromRoom: rooms[0].id as any,
        toRoom: rooms[1].id as any,
      },
      {
        position: { x: 10, y: 12 },
        direction: 'left',
        fromRoom: rooms[1].id as any,
        toRoom: rooms[0].id as any,
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
          fromRoom: 'room:999' as any,
          toRoom: rooms[1].id as any,
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
          fromRoom: rooms[0].id as any,
          toRoom: 'room:999' as any,
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
          fromRoom: rooms[0].id as any,
          toRoom: rooms[1].id as any,
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
    const gen = new RoomIdGenerator();
    const rooms: Room[] = [
      makeRoom(gen, 1, 1, 4, 4),
      makeRoom(gen, 10, 10, 4, 4),
      makeRoom(gen, 20, 20, 4, 4),
    ];

    it('areAllRoomsConnected は全 Room が Doorway に接続されている場合 true', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: rooms[0].id as any,
          toRoom: rooms[1].id as any,
        },
        {
          position: { x: 10, y: 12 },
          direction: 'left',
          fromRoom: rooms[1].id as any,
          toRoom: rooms[0].id as any,
        },
        {
          position: { x: 13, y: 12 },
          direction: 'right',
          fromRoom: rooms[1].id as any,
          toRoom: rooms[2].id as any,
        },
        {
          position: { x: 20, y: 22 },
          direction: 'left',
          fromRoom: rooms[2].id as any,
          toRoom: rooms[1].id as any,
        },
      ];

      expect(areAllRoomsConnected(rooms, doorways)).toBe(true);
    });

    it('areAllRoomsConnected は未接続 Room がある場合 false', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: rooms[0].id as any,
          toRoom: rooms[1].id as any,
        },
      ];
      // room3 が未接続

      expect(areAllRoomsConnected(rooms, doorways)).toBe(false);
    });

    it('isRoomGraphConnected は連結グラフの場合 true', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: rooms[0].id as any,
          toRoom: rooms[1].id as any,
        },
        {
          position: { x: 13, y: 12 },
          direction: 'right',
          fromRoom: rooms[1].id as any,
          toRoom: rooms[2].id as any,
        },
      ];

      expect(isRoomGraphConnected(rooms, doorways)).toBe(true);
    });

    it('isRoomGraphConnected は非連結グラフの場合 false', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: rooms[0].id as any,
          toRoom: rooms[1].id as any,
        },
        // room3 への経路がない
      ];

      expect(isRoomGraphConnected(rooms, doorways)).toBe(false);
    });

    it('buildRoomGraph は fromRoom -> toRoom の隣接リストを構築する', () => {
      const doorways: Doorway[] = [
        {
          position: { x: 4, y: 2 },
          direction: 'right',
          fromRoom: rooms[0].id as any,
          toRoom: rooms[1].id as any,
        },
        {
          position: { x: 13, y: 12 },
          direction: 'right',
          fromRoom: rooms[1].id as any,
          toRoom: rooms[2].id as any,
        },
      ];

      const graph = buildRoomGraph(rooms, doorways);
      expect(graph.get(rooms[0].id as any)).toEqual([rooms[1].id as any]);
      expect(graph.get(rooms[1].id as any)).toEqual([rooms[2].id as any]);
      expect(graph.get(rooms[2].id as any)).toEqual([]);
    });
  });
});
