import { Enemy } from '../Enemy';
import { TransformComponent } from '../components/Transform';
import { EnemyBehaviorStrategy } from './EnemyBehaviorStrategy';
import { EnemyActionContext } from './EnemyActionContext';
import { getDirectionToTarget } from './EnemyAIUtils';

/**
 * 静止行動
 * 移動せず、プレイヤーの方向を向くだけ
 */
export class StaticBehavior implements EnemyBehaviorStrategy {
  async act(enemy: Enemy, context: EnemyActionContext): Promise<void> {
    const playerPosition = context.getPlayerPosition();
    if (!playerPosition) return;

    const transform = enemy.getComponent<TransformComponent>('transform');
    if (!transform) return;

    const direction = getDirectionToTarget(transform.position, playerPosition);
    if (direction) {
      enemy.setDirection(direction);
    }
  }
}
