import { Enemy } from '../Enemy';
import { EnemyBehaviorStrategy } from './EnemyBehaviorStrategy';
import { EnemyActionContext } from './EnemyActionContext';
import { moveTowardsPlayer } from './EnemyMovementHelper';

/**
 * 積極的行動
 *
 * 常にプレイヤーを追跡する。距離に関わらず移動を試みる。
 */
export class AggressiveBehavior implements EnemyBehaviorStrategy {
  async act(enemy: Enemy, context: EnemyActionContext): Promise<void> {
    const playerPosition = context.getPlayerPosition();
    if (!playerPosition) return;

    await moveTowardsPlayer(enemy, playerPosition, context);
  }
}
