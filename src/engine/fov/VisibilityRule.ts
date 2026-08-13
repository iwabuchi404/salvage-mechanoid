import { Entity } from '../entity/Entity';
import { TransformComponent } from '../entity/components/Transform';

/**
 * Entity の可視性判定を純粋関数として切り出したモジュール。
 *
 * FOVSystem が計算した可視タイル集合と Entity の位置から、
 * Enemy / Item / EventObject 共通の可視性規則を適用する。
 *
 * 本モジュールは EventSystem への emit を行わず、
 * 「どの Entity が可視か」の判定だけを担当する。
 */

/**
 * Entity がプレイヤー自身かを判定する。
 * プレイヤーは常に可視として扱うため、可視性計算から除外する。
 */
export function isPlayerEntity(entity: Entity): boolean {
  return entity.hasTag('player');
}

/**
 * Entity のタイル座標を取得する。
 * Transform を持たない場合は null を返す。
 */
export function getEntityTilePosition(entity: Entity): { x: number; y: number } | null {
  const transform = entity.getComponent<TransformComponent>('transform');
  if (!transform) return null;
  const pos = transform.position;
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}

/**
 * Entity が可視タイル集合に入っているかを判定する。
 *
 * 現行仕様（FOVSystem.updateVisibility と同等）:
 * - Entity の現在位置、および上下左右1マスの隣接タイルのいずれかが
 *   可視タイル集合に含まれていれば可視とみなす。
 * - 隣接マス考慮は移動中の位置ずれ許容のため残す。
 *
 * この規則は Enemy / Item / EventObject すべてに共通して適用する。
 */
export function isEntityVisible(
  entity: Entity,
  visibleTiles: ReadonlySet<string>,
  keyFn: (x: number, y: number) => string = defaultTileKey
): boolean {
  if (isPlayerEntity(entity)) return true;

  const pos = getEntityTilePosition(entity);
  if (!pos) return false;

  const checkPositions = [
    { x: pos.x, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x, y: pos.y + 1 },
  ];

  for (const p of checkPositions) {
    if (visibleTiles.has(keyFn(p.x, p.y))) {
      return true;
    }
  }
  return false;
}

function defaultTileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * 前回の可視状態と今回の可視状態を比較し、変化した Entity の ID と
 * 新しい可視状態のリストを返す。
 *
 * 変化していない Entity への再送を防ぐために使用する。
 */
export function diffEntityVisibility(
  entities: readonly Entity[],
  visibleTiles: ReadonlySet<string>,
  previousVisibility: ReadonlyMap<string, boolean>,
  keyFn: (x: number, y: number) => string = defaultTileKey
): Array<{ entityId: string; inFOV: boolean }> {
  const changes: Array<{ entityId: string; inFOV: boolean }> = [];

  for (const entity of entities) {
    if (isPlayerEntity(entity)) continue;

    const inFOV = isEntityVisible(entity, visibleTiles, keyFn);
    const previous = previousVisibility.get(entity.id);

    if (previous !== inFOV) {
      changes.push({ entityId: entity.id, inFOV });
    }
  }

  return changes;
}

/**
 * タイルの可視性差分を計算する。
 *
 * 前回の可視タイル集合と今回の可視タイル集合を比較し、
 * 可視状態が変化したタイルのリストを返す。
 *
 * explored 状態の差分は呼び出し側で管理する（本関数は visible の差分のみ）。
 */
export function diffTileVisibility(
  currentVisible: ReadonlySet<string>,
  previousVisible: ReadonlySet<string>
): Array<{ x: number; y: number; visible: boolean }> {
  const changes: Array<{ x: number; y: number; visible: boolean }> = [];

  for (const key of currentVisible) {
    if (!previousVisible.has(key)) {
      const pos = parseTileKey(key);
      if (pos) changes.push({ x: pos.x, y: pos.y, visible: true });
    }
  }

  for (const key of previousVisible) {
    if (!currentVisible.has(key)) {
      const pos = parseTileKey(key);
      if (pos) changes.push({ x: pos.x, y: pos.y, visible: false });
    }
  }

  return changes;
}

function parseTileKey(key: string): { x: number; y: number } | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}
