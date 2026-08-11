import { Enemy } from '../Enemy';
import { MovementComponent } from '../components/Movement';
import { TransformComponent } from '../components/Transform';
import { Vector3 } from '../../types';
import { EnemyActionContext } from './EnemyActionContext';
import {
  getDirectionFromPositions,
  getDirectionToTarget,
  getRandomDirection,
  waitForMovement,
  waitForAttack,
} from './EnemyAIUtils';

/**
 * Enemy AI の移動ヘルパー
 *
 * 複数の Behavior で共通する移動処理（プレイヤー追跡・ランダム移動）を集約する。
 */

/**
 * プレイヤーに向かって移動する（A* パスファインディングを使用）
 * 隣接時は攻撃要求を発行する
 * @param enemy 行動主体
 * @param playerPosition プレイヤー位置
 * @param context ActionContext
 */
export async function moveTowardsPlayer(
  enemy: Enemy,
  playerPosition: Vector3,
  context: EnemyActionContext
): Promise<void> {
  const transform = enemy.getComponent<TransformComponent>('transform');
  const movement = enemy.getComponent<MovementComponent>('movement');
  if (!transform || !movement) return;

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

  // 隣接している場合は攻撃（移動しない）
  if (distance <= 1) {
    const direction = getDirectionToTarget(intCurrentPos, intPlayerPos);
    if (direction) {
      enemy.setDirection(direction);
    }
    context.requestAttack(enemy.id, 'player');
    await waitForAttack();
    return;
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
      enemy.setDirection(direction);
      const moved = movement.moveInDirection(direction);
      if (moved) {
        await waitForMovement(movement);
      }
    }
  } else {
    // パスが見つからない場合、単純な方向計算で移動を試みる
    const direction = getDirectionToTarget(intCurrentPos, intPlayerPos);
    if (direction) {
      enemy.setDirection(direction);
      const moved = movement.moveInDirection(direction);
      if (moved) {
        await waitForMovement(movement);
      } else {
        await moveRandomly(enemy, movement);
      }
    }
  }
}

/**
 * ランダムに移動する
 * @param enemy 行動主体
 * @param movement MovementComponent
 */
export async function moveRandomly(enemy: Enemy, movement: MovementComponent): Promise<void> {
  const randomDirection = getRandomDirection();
  enemy.setDirection(randomDirection);
  const moved = movement.moveInDirection(randomDirection);
  if (moved) {
    await waitForMovement(movement);
  }
}
