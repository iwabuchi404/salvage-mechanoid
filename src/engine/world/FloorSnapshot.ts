import { Room, Corridor, TacticalElement } from '../types';
import { TileMap } from './TileMap';

/**
 * フロア番号を識別する型
 * 1以上の整数。将来的に永続 ID へ拡張できるよう、branded 型として扱う。
 */
export type FloorNumber = number;

/**
 * 1フロア分の不変データをまとめた値。
 *
 * WorldSystem はフロアごとに TileMap・Room・Corridor・TacticalElement を
 * 単一の FloorSnapshot として同一世代で保持する。
 * これにより、複数の Map へ分散していたフロア構成データを
 * 1単位で登録・参照・破棄できる。
 */
export interface FloorSnapshot {
  /** フロア番号（1始まり） */
  readonly floor: FloorNumber;
  /** タイルマップ */
  readonly tileMap: TileMap;
  /** 部屋の配列 */
  readonly rooms: readonly Room[];
  /** 通路の配列 */
  readonly corridors: readonly Corridor[];
  /** 戦術的要素の配列 */
  readonly tacticalElements: readonly TacticalElement[];
}

/**
 * FloorSnapshot を構築するヘルパ。
 * 部屋・通路・戦術的要素は省略可能で、未指定の場合は空配列になる。
 */
export function createFloorSnapshot(
  floor: FloorNumber,
  tileMap: TileMap,
  partial: {
    rooms?: readonly Room[];
    corridors?: readonly Corridor[];
    tacticalElements?: readonly TacticalElement[];
  } = {}
): FloorSnapshot {
  return {
    floor,
    tileMap,
    rooms: partial.rooms ? [...partial.rooms] : [],
    corridors: partial.corridors ? [...partial.corridors] : [],
    tacticalElements: partial.tacticalElements ? [...partial.tacticalElements] : [],
  };
}
