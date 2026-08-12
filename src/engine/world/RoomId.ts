import { Room } from '../types';

/**
 * Room を一意に識別する ID の型。
 *
 * 現在の実装ではフロア内で一意な `"${x},${y}"` 形式の文字列。
 * Room の左上座標は生成後に不変のため、生成時固定 ID として安定する。
 * Room ロック状態など、Room に紐づく追加状態のキーとして使用できる。
 *
 * 将来的にフロア番号を含む永続 ID へ移行する場合でも、
 * この型を経由すれば呼び出し側の変更を局所化できる。
 */
export type RoomId = string & { readonly __roomBrand: unique symbol };

/**
 * Room の左上座標から RoomId を生成する。
 * 同一フロア内で座標が同じ Room は同じ ID になる。
 */
export function createRoomId(x: number, y: number): RoomId {
  return `${x},${y}` as RoomId;
}

/**
 * Room から RoomId を生成する。
 */
export function roomToId(room: Pick<Room, 'x' | 'y'>): RoomId {
  return createRoomId(room.x, room.y);
}

/**
 * 値が RoomId 形式（"x,y" 文字列）かを判定する。
 * 型ガードとして利用できる。
 */
export function isRoomId(value: unknown): value is RoomId {
  if (typeof value !== 'string') return false;
  const parts = value.split(',');
  if (parts.length !== 2) return false;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0;
}

/**
 * RoomId を座標へ戻す。
 */
export function roomIdToCoords(id: RoomId): { x: number; y: number } {
  const [x, y] = id.split(',').map(Number);
  return { x, y };
}
