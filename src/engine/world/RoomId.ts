import { Room } from '../types';

/**
 * Room を一意に識別する ID の型。
 *
 * 不透明 ID（座標由来ではない）。`"room:<n>"` 形式の文字列で、
 * 生成時に採番される。座標変更に強く、FOV の tileKey("x,y") との衝突がない。
 *
 * 生成器が同じシードで同じ順序で Room を生成する限り、
 * 同じシードでは同じ ID が採番される（決定論的）。
 */
export type RoomId = string & { readonly __roomBrand: unique symbol };

/**
 * RoomId のプレフィックス。tileKey("x,y") との区別に使用する。
 */
const ROOM_ID_PREFIX = 'room:';

/**
 * RoomId を採番するジェネレータ。
 * 生成器インスタンスごとに1つ作成し、Room 生成時に next() で採番する。
 * 同じ生成順序なら同じ ID になるため、決定論的生成を維持する。
 */
export class RoomIdGenerator {
  private counter = 0;

  /** 次の RoomId を採番する */
  next(): RoomId {
    return `${ROOM_ID_PREFIX}${this.counter++}` as RoomId;
  }

  /** 現在の採番数を取得する（テスト用） */
  get count(): number {
    return this.counter;
  }
}

/**
 * Room から RoomId を取得する。
 * Room.id は生成時に採番済みであることを前提とする。
 * 座標から ID を導出しない。
 */
export function roomToId(room: Pick<Room, 'id'>): RoomId {
  if (!room.id) {
    throw new Error('Room has no id. RoomId must be assigned at generation time.');
  }
  return room.id as RoomId;
}

/**
 * 値が RoomId 形式（"room:<n>" 文字列）かを判定する。
 * 型ガードとして利用できる。tileKey("x,y") とは区別される。
 */
export function isRoomId(value: unknown): value is RoomId {
  if (typeof value !== 'string') return false;
  return value.startsWith(ROOM_ID_PREFIX);
}
