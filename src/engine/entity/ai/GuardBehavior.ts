import { Enemy } from '../Enemy';
import { TransformComponent } from '../components/Transform';
import { EnemyBehaviorStrategy } from './EnemyBehaviorStrategy';
import { EnemyActionContext } from './EnemyActionContext';
import { Action } from '../../turn/Action';
import { getActionCost } from '../../turn/ActionCostTable';
import { getDirectionToTarget } from './EnemyAIUtils';
import { decideMoveTowardsPlayer } from './EnemyMovementHelper';

/**
 * 警戒行動
 *
 * プレイヤーが感知範囲内に入ったら追跡し、範囲外の場合はプレイヤーの方向を向くだけ。
 *
 * BU-3 段階6: act() から decideAction() へ変更。Action を返す。
 */
export class GuardBehavior implements EnemyBehaviorStrategy {
  private readonly detectionRange: number;

  constructor(detectionRange = 8) {
    this.detectionRange = detectionRange;
  }

  async decideAction(enemy: Enemy, context: EnemyActionContext): Promise<Action | null> {
    const playerPosition = context.getPlayerPosition();
    if (!playerPosition) return null;

    const transform = enemy.getComponent<TransformComponent>('transform');
    if (!transform) return null;

    const currentPos = transform.position;
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - currentPos.x, 2) + Math.pow(playerPosition.y - currentPos.y, 2)
    );

    if (distance < this.detectionRange) {
      // 追跡: moveTowardsPlayer と同じロジックで Action を生成
      const decision = decideMoveTowardsPlayer(enemy, playerPosition, context);
      if (!decision) return null;

      if (decision.attack) {
        return {
          kind: 'attack',
          actorId: enemy.id,
          cost: getActionCost('attack'),
          params: { direction: decision.direction },
        };
      }

      return {
        kind: 'move',
        actorId: enemy.id,
        cost: getActionCost('move'),
        params: { direction: decision.direction },
      };
    }

    // 範囲外でもプレイヤーの方向を向く（turn action）
    const direction = getDirectionToTarget(currentPos, playerPosition);
    if (direction) {
      return {
        kind: 'turn',
        actorId: enemy.id,
        cost: getActionCost('turn'),
        params: { direction },
      };
    }
    return null;
  }
}
