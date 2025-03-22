import { TileType, Vector3 } from '../types';

/**
 * タイルインターフェース - マップを構成する基本ユニット
 */
export interface Tile {
  /**
   * タイルのタイプ
   */
  type: TileType;

  /**
   * タイルの位置
   */
  position: Vector3;

  /**
   * 通行可能かどうか
   */
  walkable: boolean;

  /**
   * 追加のプロパティ
   */
  properties?: { [key: string]: any };

  /**
   * グラフィック関連のデータ（実装依存）
   */
  sprite?: any;

  /**
   * タイルの重ねがけ用オーバーレイ（実装依存）
   */
  overlay?: any;
}

/**
 * 基本的なタイルを作成する関数
 * @param type タイルのタイプ
 * @param x X座標
 * @param y Y座標
 * @param z Z座標（レイヤー）
 * @param walkable 通行可能かどうか
 * @param properties 追加のプロパティ
 * @returns 新しいタイル
 */
export function createTile(
  type: TileType,
  x: number,
  y: number,
  z = 0,
  walkable = false,
  properties: { [key: string]: any } = {}
): Tile {
  return {
    type,
    position: { x, y, z },
    walkable,
    properties: { ...properties },
  };
}
