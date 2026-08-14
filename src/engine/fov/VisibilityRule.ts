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
 * Entity の現在タイルが可視タイル集合に含まれている場合だけ可視とみなす。
 * 隣接タイルを代理に使うと、壁自体が可視なときに壁の背後にいる Entity まで
 * 可視になるため、移動補間中も丸めた現在位置だけを判定する。
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

  return visibleTiles.has(keyFn(pos.x, pos.y));
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
