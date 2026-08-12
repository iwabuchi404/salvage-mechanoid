import { Corridor, Direction, Room } from '../types';
import { RoomId, roomToId, createRoomId } from './RoomId';

/**
 * Doorway - Room 間の接続を表現する値。
 *
 * Corridor の両端点を、座標・向き・接続元 Room・接続先 Room で表現したもの。
 * 1 本の Corridor から最大 2 つの Doorway が生成される（始点側・終点側）。
 *
 * Doorway は Room ロックやスキャンなど、Room 間の通行制御を行う
 * 今後の機能追加の基礎となる境界。
 */
export interface Doorway {
  /** Room 境界上の接続座標 */
  readonly position: { x: number; y: number };
  /** 接続元 Room から見た出口の方向 */
  readonly direction: Direction;
  /** 接続元 Room の ID */
  readonly fromRoom: RoomId;
  /** 接続先 Room の ID */
  readonly toRoom: RoomId;
  /** 元となった Corridor の参照（同定用、オプション） */
  readonly corridorIndex?: number;
}

/**
 * Doorway 整合性検証の結果。
 */
export interface DoorwayValidationResult {
  /** 検証を通過したか */
  readonly valid: boolean;
  /** 違反の詳細 */
  readonly errors: readonly DoorwayValidationError[];
}

export interface DoorwayValidationError {
  readonly doorwayIndex: number;
  readonly kind: DoorwayErrorKind;
  readonly message: string;
}

export type DoorwayErrorKind =
  | 'unknown_from_room' // fromRoom が rooms に存在しない
  | 'unknown_to_room' // toRoom が rooms に存在しない
  | 'position_not_on_boundary' // Doorway が fromRoom の境界上にない
  | 'position_not_walkable'; // Doorway が通行可能タイル上にない

/**
 * Room 境界上の座標と方向から Direction を推定する。
 * 複数の境界に同時に接する角の場合は、最初に一致した方向を返す。
 */
export function detectDirection(room: Pick<Room, 'x' | 'y' | 'width' | 'height'>, x: number, y: number): Direction | null {
  const onTop = y === room.y;
  const onBottom = y === room.y + room.height - 1;
  const onLeft = x === room.x;
  const onRight = x === room.x + room.width - 1;

  if (onTop) return 'up';
  if (onBottom) return 'down';
  if (onLeft) return 'left';
  if (onRight) return 'right';
  return null;
}

/**
 * Corridor から Doorway の配列へ変換する。
 *
 * Corridor の connectedRooms は [fromRoomId, toRoomId] を想定する。
 * 始点は fromRoom 側、終点は toRoom 側の Doorway として扱う。
 * connectedRooms の要素数が 2 未満の場合は空配列を返す。
 *
 * @param corridor 変換元の Corridor
 * @param rooms Room の配列（RoomId 解決に使用）
 * @param corridorIndex 元 Corridor のインデックス（同定用、オプション）
 */
export function corridorToDoorways(
  corridor: Corridor,
  rooms: readonly Room[],
  corridorIndex?: number
): Doorway[] {
  if (corridor.connectedRooms.length < 2) return [];

  const fromRoomId = corridor.connectedRooms[0] as RoomId;
  const toRoomId = corridor.connectedRooms[1] as RoomId;

  const fromRoom = rooms.find((r) => roomToId(r) === fromRoomId);
  const toRoom = rooms.find((r) => roomToId(r) === toRoomId);

  const doorways: Doorway[] = [];

  // 始点側 Doorway: fromRoom -> toRoom
  if (fromRoom) {
    const direction = detectDirection(fromRoom, corridor.startX, corridor.startY);
    if (direction) {
      doorways.push({
        position: { x: corridor.startX, y: corridor.startY },
        direction,
        fromRoom: fromRoomId,
        toRoom: toRoomId,
        corridorIndex,
      });
    }
  }

  // 終点側 Doorway: toRoom -> fromRoom
  if (toRoom) {
    const direction = detectDirection(toRoom, corridor.endX, corridor.endY);
    if (direction) {
      doorways.push({
        position: { x: corridor.endX, y: corridor.endY },
        direction,
        fromRoom: toRoomId,
        toRoom: fromRoomId,
        corridorIndex,
      });
    }
  }

  return doorways;
}

/**
 * 複数の Corridor から Doorway の配列へ一括変換する。
 */
export function corridorsToDoorways(corridors: readonly Corridor[], rooms: readonly Room[]): Doorway[] {
  const result: Doorway[] = [];
  for (let i = 0; i < corridors.length; i++) {
    result.push(...corridorToDoorways(corridors[i], rooms, i));
  }
  return result;
}

/**
 * Doorway が Room の境界上にあるかを判定する。
 */
export function isOnRoomBoundary(room: Pick<Room, 'x' | 'y' | 'width' | 'height'>, x: number, y: number): boolean {
  return detectDirection(room, x, y) !== null;
}

/**
 * Doorway の整合性を検証する。
 *
 * 検証項目:
 * - fromRoom / toRoom が rooms に存在する
 * - Doorway が fromRoom の境界上にある
 * - Doorway が通行可能タイル上にある（walkableChecker を指定した場合のみ）
 *
 * @param doorways 検証対象の Doorway 配列
 * @param rooms Room の配列
 * @param walkableChecker 座標が通行可能かを返す関数（省略時は通行可能性を検証しない）
 */
export function validateDoorways(
  doorways: readonly Doorway[],
  rooms: readonly Room[],
  walkableChecker?: (x: number, y: number) => boolean
): DoorwayValidationResult {
  const errors: DoorwayValidationError[] = [];
  const roomById = new Map<RoomId, Room>();
  for (const room of rooms) {
    roomById.set(roomToId(room), room);
  }

  doorways.forEach((doorway, index) => {
    const fromRoom = roomById.get(doorway.fromRoom);
    if (!fromRoom) {
      errors.push({
        doorwayIndex: index,
        kind: 'unknown_from_room',
        message: `Doorway ${index}: fromRoom "${doorway.fromRoom}" not found in rooms`,
      });
      return;
    }

    const toRoom = roomById.get(doorway.toRoom);
    if (!toRoom) {
      errors.push({
        doorwayIndex: index,
        kind: 'unknown_to_room',
        message: `Doorway ${index}: toRoom "${doorway.toRoom}" not found in rooms`,
      });
      // fromRoom 境界チェックは継続
    }

    if (!isOnRoomBoundary(fromRoom, doorway.position.x, doorway.position.y)) {
      errors.push({
        doorwayIndex: index,
        kind: 'position_not_on_boundary',
        message: `Doorway ${index}: position (${doorway.position.x},${doorway.position.y}) is not on fromRoom "${doorway.fromRoom}" boundary`,
      });
    }

    if (walkableChecker && !walkableChecker(doorway.position.x, doorway.position.y)) {
      errors.push({
        doorwayIndex: index,
        kind: 'position_not_walkable',
        message: `Doorway ${index}: position (${doorway.position.x},${doorway.position.y}) is not walkable`,
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * 必須 Room が Doorway 経由で孤立していないかを検証する。
 *
 * 「必須 Room」とは、rooms のうち少なくとも1つの Doorway が
 * fromRoom または toRoom として参照している Room。
 * 全ての Room が少なくとも1つの Doorway に接続されていることを確認する。
 *
 * @param rooms Room の配列
 * @param doorways Doorway の配列
 * @returns 孤立していない場合は true
 */
export function areAllRoomsConnected(rooms: readonly Room[], doorways: readonly Doorway[]): boolean {
  if (rooms.length === 0) return true;

  const connectedRoomIds = new Set<RoomId>();
  for (const doorway of doorways) {
    connectedRoomIds.add(doorway.fromRoom);
    connectedRoomIds.add(doorway.toRoom);
  }

  return rooms.every((room) => connectedRoomIds.has(roomToId(room)));
}

/**
 * Room 接続グラフを構築する。
 * RoomId -> 接続先 RoomId の配列。
 */
export function buildRoomGraph(rooms: readonly Room[], doorways: readonly Doorway[]): Map<RoomId, RoomId[]> {
  const graph = new Map<RoomId, RoomId[]>();
  for (const room of rooms) {
    graph.set(roomToId(room), []);
  }
  for (const doorway of doorways) {
    const neighbors = graph.get(doorway.fromRoom);
    if (neighbors && !neighbors.includes(doorway.toRoom)) {
      neighbors.push(doorway.toRoom);
    }
  }
  return graph;
}

/**
 * Room 接続グラフが全 Room 到達可能（連結）かを判定する。
 * BFS で先頭 Room から全 Room へ到達できるかを確認する。
 */
export function isRoomGraphConnected(rooms: readonly Room[], doorways: readonly Doorway[]): boolean {
  if (rooms.length === 0) return true;

  const graph = buildRoomGraph(rooms, doorways);
  const startId = roomToId(rooms[0]);
  const visited = new Set<RoomId>([startId]);
  const queue: RoomId[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.get(current) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return visited.size === rooms.length;
}

// createRoomId を再エクスポートして Doorway 構築の利便性を高める
export { createRoomId };
