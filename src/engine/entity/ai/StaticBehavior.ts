import { Enemy } from '../Enemy';
import { TransformComponent } from '../components/Transform';
import { EnemyBehaviorStrategy } from './EnemyBehaviorStrategy';
import { EnemyActionContext } from './EnemyActionContext';
import { Action } from '../../turn/Action';
import { getActionCost } from '../../turn/ActionCostTable';
import { getDirectionToTarget } from './EnemyAIUtils';

/**
 * 静止行動
 * 移動せず、プレイヤーの方向を向くだけ
 *
 * BU-3 段階6: act() から decideAction() へ変更。Action を返す。
 */
export class StaticBehavior implements EnemyBehaviorStrategy {
  async decideAction(enemy: Enemy, context: EnemyActionContext): Promise<Action | null> {
    const playerPosition = context.getPlayerPosition();
    if (!playerPosition) return null;

    const transform = enemy.getComponent<TransformComponent>('transform');
    if (!transform) return null;

    const direction = getDirectionToTarget(transform.position, playerPosition);
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
