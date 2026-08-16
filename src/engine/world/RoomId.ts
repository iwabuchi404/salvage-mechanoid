import { Room } from '../types';

/**
 * Room を一意に識別する ID の型。
 *
 * 不透明 ID（座標由来ではない）。`"room:<n>"` 形式の文字列で、
 * 生成時に採番される。座標変更に強く、FOV の tileKey("x,y") との衝突がない。
 *
 * 生成器が同じシードで同じ順序で Room を生成する限り、
 * 同じシードでは同じ ID が採番される（決定論的）。
 *
 * P1-fix: RoomId は「フロアローカル」な ID である。
 * 生成器インスタンスがフロアごとに new されるため、
 * フロア1もフロア2も room:0 から採番される。
 * フロアを跨いで一意に識別する必要がある場合は
 * RoomKey（floor + RoomId の複合キー）を使用すること。
 */
export type RoomId = string & { readonly __roomBrand: unique symbol };

/**
 * RoomId のプレフィックス。tileKey("x,y") との区別に使用する。
 */
const ROOM_ID_PREFIX = 'room:';

/**
 * フロアを跨いで Room を一意に識別する複合キー。
 *
 * P1-fix: RoomId はフロアローカルであるため、フロアを跨いで
 * Room の状態（ロック状態、スキャン結果等）を Map のキーにする場合は
 * この複合キーを使用する。
 *
 * 形式: "F<floor>:room:<n>"（例: "F1:room:0", "F2:room:0"）
 */
export type RoomKey = string & { readonly __roomKeyBrand: unique symbol };

/**
 * RoomId を採番するジェネレータ。
 * 生成器インスタンスごとに1つ作成し、Room 生成時に next() で採番する。
 * 同じ生成順序なら同じ ID になるため、決定論的生成を維持する。
 *
 * 注意: 採番はフロアローカルである。生成器がフロアごとに new されるため、
 * 異なるフロアの Room に同じ RoomId が割り当てられる可能性がある。
 * フロアを跨いで一意に識別する場合は RoomKey（makeRoomKey）を使用すること。
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

/**
 * フロア番号と RoomId から、フロアを跨いで一意な RoomKey を生成する。
 *
 * R7-1（Room ロック状態）や R7-2（スキャン結果）など、
 * フロアを跨いで Room の状態を保持する Map のキーとして使用する。
 *
 * @param floor フロア番号
 * @param roomId フロアローカルな RoomId
 * @returns 複合キー "F<floor>:room:<n>"
 */
export function makeRoomKey(floor: number, roomId: RoomId): RoomKey {
  return `F${floor}:${roomId}` as RoomKey;
}

/**
 * 値が RoomKey 形式（"F<floor>:room:<n>" 文字列）かを判定する。
 * 型ガードとして利用できる。
 */
export function isRoomKey(value: unknown): value is RoomKey {
  if (typeof value !== 'string') return false;
  return /^F\d+:room:/.test(value);
}
