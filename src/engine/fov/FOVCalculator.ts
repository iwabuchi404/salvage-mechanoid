import { Direction } from '../types';

/**
 * FOV 計算を副作用なしの純粋関数として切り出したモジュール。
 *
 * 計算に必要なマップ情報は `FOVBoundsQuery` と `FOVObstacleQuery` 経由で
 * 外部から注入する。本モジュールは WorldSystem や EntitySystem を直接参照せず、
 * PIXI や Engine への依存も持たない。
 *
 * これにより、視界アルゴリズムの単体テストをシステム初期化なしで実行できる。
 */

/** 座標がマップ範囲内かを判定するクエリ */
export interface FOVBoundsQuery {
  isInBounds(x: number, y: number): boolean;
}

/** 指定座標が視線を遮るかを判定するクエリ */
export interface FOVObstacleQuery {
  isBlocking(x: number, y: number): boolean;
}

/** FOV 計算の入力 */
export interface FOVCalcInput {
  /** 中心座標（プレイヤー位置） */
  cx: number;
  cy: number;
  /** プレイヤーの向き */
  direction: Direction;
  /** 範囲判定 */
  bounds: FOVBoundsQuery;
  /** 遮蔽判定 */
  obstacle: FOVObstacleQuery;
  /**
   * 視野形状（省略時は既定の DEFAULT_VIEW_PROFILE）。
   * R7-2 スキャン拡張時に半径だけ差し替えられる。
   */
  viewProfile?: ViewProfile;
}

/**
 * 視野形状を表す純粋な値。
 * frontRadius はプレイヤーの向いている方向の視野半径、
 * sideRadius はそれ以外の方向の視野半径。
 */
export interface ViewProfile {
  frontRadius: number;
  sideRadius: number;
}

/**
 * 既定の視野形状。
 * 現行の固定値（正面4 / 側面3）と同じ値。
 */
export const DEFAULT_VIEW_PROFILE: ViewProfile = {
  frontRadius: 4,
  sideRadius: 3,
};

/** FOV 計算の結果 */
export interface FOVCalcResult {
  /** 可視タイルの座標キー集合（"x,y" 形式） */
  readonly visibleTiles: ReadonlySet<string>;
}

/**
 * タイル座標から文字列キーを生成する。
 * FOVSystem 内部の Set と同じ形式を前提とする。
 */
export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** タイルキーから座標へ戻す。不正な形式の場合は null を返す。 */
export function keyToTile(key: string): { x: number; y: number } | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

/**
 * プレイヤーの視野を計算する。
 *
 * 方向に応じた視野範囲と Bresenham ベースの視線判定を組み合わせ、
 * 最終的に可視となるタイルの座標キー集合を返す。
 *
 * 視野半径は `input.viewProfile` で外部から与えられ、
 * 省略時は `DEFAULT_VIEW_PROFILE`（正面4 / 側面3）を使用する。
 *
 * 副作用を持たず、入力と出力だけから成る。
 */
export function computeFOV(input: FOVCalcInput): FOVCalcResult {
  const { cx, cy, direction, bounds, obstacle } = input;
  const { frontRadius, sideRadius } = input.viewProfile ?? DEFAULT_VIEW_PROFILE;
  const visibleTiles = new Set<string>();

  // プレイヤー位置は常に可視
  visibleTiles.add(tileKey(cx, cy));

  const maxRadius = Math.max(frontRadius, sideRadius);

  for (let dy = -maxRadius; dy <= maxRadius; dy++) {
    for (let dx = -maxRadius; dx <= maxRadius; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;

      const tileDirection = getDirectionFromDelta(dx, dy);
      const isFront = isFrontDirection(direction, tileDirection);
      const effectiveRadius = isFront ? frontRadius : sideRadius;

      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > effectiveRadius) continue;

      if (!bounds.isInBounds(tx, ty)) continue;

      if (hasLineOfSight(cx, cy, tx, ty, obstacle)) {
        visibleTiles.add(tileKey(tx, ty));
      }
    }
  }

  return { visibleTiles };
}

/**
 * デルタ座標から8方向のいずれかを取得する。
 * 中心 (0,0) の場合は 'center' を返す。
 */
export function getDirectionFromDelta(dx: number, dy: number): string {
  if (dx === 0 && dy === 0) return 'center';
  if (dx === 0) return dy < 0 ? 'up' : 'down';
  if (dy === 0) return dx < 0 ? 'left' : 'right';
  if (Math.abs(dx) === Math.abs(dy)) {
    if (dx < 0 && dy < 0) return 'up-left';
    if (dx > 0 && dy < 0) return 'up-right';
    if (dx < 0 && dy > 0) return 'down-left';
    return 'down-right';
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}

/**
 * プレイヤーの向きに対してタイル方向が正面（視野半径が広い方向）かを判定する。
 */
export function isFrontDirection(playerDirection: Direction, tileDirection: string): boolean {
  if (tileDirection === 'center') return true;

  switch (playerDirection) {
    case 'up':
      return tileDirection === 'up' || tileDirection === 'up-left' || tileDirection === 'up-right';
    case 'down':
      return (
        tileDirection === 'down' || tileDirection === 'down-left' || tileDirection === 'down-right'
      );
    case 'left':
      return (
        tileDirection === 'left' || tileDirection === 'up-left' || tileDirection === 'down-left'
      );
    case 'right':
      return (
        tileDirection === 'right' || tileDirection === 'up-right' || tileDirection === 'down-right'
      );
    default:
      return false;
  }
}

/**
 * 2点間の視線が通るかを Bresenham のラインアルゴリズムで判定する。
 *
 * 開始地点の遮蔽は無視し、目標地点に到達できれば可視とする。
 * 経路上の遮蔽タイルが1つでもあれば視線は遮られる。
 */
export function hasLineOfSight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  obstacle: FOVObstacleQuery
): boolean {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  const maxSteps = dx + dy + 1;

  for (let step = 0; step < maxSteps; step++) {
    if (x === x1 && y === y1) {
      return true;
    }

    if (!(x === x0 && y === y0) && obstacle.isBlocking(x, y)) {
      return false;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return false;
}
