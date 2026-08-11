import { Enemy } from '../Enemy';
import { TransformComponent } from '../components/Transform';
import { MovementComponent } from '../components/Movement';
import { Vector3 } from '../../types';
import { EnemyBehaviorStrategy } from './EnemyBehaviorStrategy';
import { EnemyActionContext } from './EnemyActionContext';
import { getDirectionToTarget } from './EnemyAIUtils';
import { moveTowardsPlayer } from './EnemyMovementHelper';

/**
 * 警戒行動
 *
 * プレイヤーが感知範囲内に入ったら追跡し、範囲外の場合はプレイヤーの方向を向くだけ。
 */
export class GuardBehavior implements EnemyBehaviorStrategy {
  private readonly detectionRange: number;

  constructor(detectionRange = 8) {
    this.detectionRange = detectionRange;
  }

  async act(enemy: Enemy, context: EnemyActionContext): Promise<void> {
    const playerPosition = context.getPlayerPosition();
    if (!playerPosition) return;

    const transform = enemy.getComponent<TransformComponent>('transform');
    const movement = enemy.getComponent<MovementComponent>('movement');
    if (!transform || !movement) return;

    const currentPos = transform.position;
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - currentPos.x, 2) + Math.pow(playerPosition.y - currentPos.y, 2)
    );

    if (distance < this.detectionRange) {
      await moveTowardsPlayer(enemy, playerPosition, context);
    } else {
      // 範囲外でもプレイヤーの方向を向く
      const direction = getDirectionToTarget(currentPos, playerPosition);
      if (direction) {
        enemy.setDirection(direction);
      }
    }
  }
}
