import { Enemy } from '../Enemy';
import { TransformComponent } from '../components/Transform';
import { Vector3, Direction } from '../../types';
import { EnemyActionContext } from './EnemyActionContext';
import {
  getDirectionFromPositions,
  getDirectionToTarget,
  getRandomDirection,
} from './EnemyAIUtils';

/**
 * Enemy AI の移動ヘルパー
 *
 * BU-3 段階6: 副作用を実行せず、移動方向・攻撃可否を返す純粋関数へ変更。
 * 実際の移動・攻撃実行は ActionExecutor が行う。
 */

/**
 * プレイヤーに向かう行動を決定する（A* パスファインディングを使用）
 * 隣接時は攻撃、それ以外は移動
 * @param enemy 行動主体
 * @param playerPosition プレイヤー位置
 * @param context ActionContext
 * @returns 移動方向 or null（移動不可時）
 */
export function decideMoveTowardsPlayer(
  enemy: Enemy,
  playerPosition: Vector3,
  context: EnemyActionContext
): { direction: Direction; attack: boolean } | null {
  const transform = enemy.getComponent<TransformComponent>('transform');
  if (!transform) return null;

  const currentPos = transform.position;

  // 整数座標で計算
  const intCurrentPos = {
    x: Math.round(currentPos.x),
    y: Math.round(currentPos.y),
    z: Math.round(currentPos.z),
  };
  const intPlayerPos = {
    x: Math.round(playerPosition.x),
    y: Math.round(playerPosition.y),
    z: Math.round(playerPosition.z),
  };

  const distance = context.getDistance(intCurrentPos, intPlayerPos);

  // 隣接している場合は攻撃
  if (distance <= 1) {
    const direction = getDirectionToTarget(intCurrentPos, intPlayerPos);
    if (direction) {
      return { direction, attack: true };
    }
    return null;
  }

  // プレイヤーの隣接マスをゴールとして探索
  const adjacentPositions = [
    { x: intPlayerPos.x - 1, y: intPlayerPos.y, z: intPlayerPos.z },
    { x: intPlayerPos.x + 1, y: intPlayerPos.y, z: intPlayerPos.z },
    { x: intPlayerPos.x, y: intPlayerPos.y - 1, z: intPlayerPos.z },
    { x: intPlayerPos.x, y: intPlayerPos.y + 1, z: intPlayerPos.z },
  ];

  let bestPath: Vector3[] = [];
  let bestDistance = Infinity;

  for (const adjPos of adjacentPositions) {
    const path = context.findPath(intCurrentPos, adjPos, 20, enemy.id);
    if (path.length > 1 && path.length < bestDistance) {
      bestPath = path;
      bestDistance = path.length;
    }
  }

  if (bestPath.length > 1) {
    const nextStep = bestPath[1];
    const direction = getDirectionFromPositions(intCurrentPos, nextStep);
    if (direction) {
      return { direction, attack: false };
    }
  }

  // パスが見つからない場合、単純な方向計算で移動を試みる
  const direction = getDirectionToTarget(intCurrentPos, intPlayerPos);
  if (direction) {
    return { direction, attack: false };
  }

  // ランダム移動へフォールバック
  return { direction: getRandomDirection(), attack: false };
}
