import { Vector3, Direction } from '../../types';
import { MovementComponent } from '../components/Movement';

/**
 * Enemy AI の共有ユーティリティ
 *
 * 方向計算・移動待ち・攻撃待ちなど、複数の Behavior で共通利用する純粋関数と
 * タイムアウト処理を集約する。
 */

/**
 * 2つの位置から方向を取得する（dx, dy の符号で判定）
 * @param from 開始位置
 * @param to 目標位置
 * @returns 方向、同じ位置の場合は null
 */
export function getDirectionFromPositions(from: Vector3, to: Vector3): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx > 0) return 'right';
  if (dx < 0) return 'left';
  if (dy > 0) return 'down';
  if (dy < 0) return 'up';

  return null;
}

/**
 * ターゲットへの方向を取得する（距離が最も大きい軸を優先）
 * @param from 開始位置
 * @param to 目標位置
 * @returns 方向、同じ位置の場合は null
 */
export function getDirectionToTarget(from: Vector3, to: Vector3): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else if (Math.abs(dy) > 0) {
    return dy > 0 ? 'down' : 'up';
  }

  return null;
}

/**
 * 移動完了を待つ（最大500ms でタイムアウト）
 * @param movement MovementComponent
 */
export function waitForMovement(movement: MovementComponent): Promise<void> {
  const maxWaitTime = 500;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkMovement = () => {
      const elapsed = Date.now() - startTime;

      if (!movement.isMoving) {
        resolve();
      } else if (elapsed > maxWaitTime) {
        resolve();
      } else {
        setTimeout(checkMovement, 16);
      }
    };
    setTimeout(checkMovement, 16);
  });
}

/**
 * 攻撃処理の完了を待つ（200ms 固定）
 */
export function waitForAttack(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
}

/**
 * ランダム方向を取得する
 * @returns ランダムな方向
 */
export function getRandomDirection(): Direction {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  return directions[Math.floor(Math.random() * directions.length)];
}
