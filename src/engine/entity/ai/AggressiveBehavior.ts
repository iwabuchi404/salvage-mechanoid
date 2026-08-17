import { Enemy } from '../Enemy';
import { EnemyBehaviorStrategy } from './EnemyBehaviorStrategy';
import { EnemyActionContext } from './EnemyActionContext';
import { Action } from '../../turn/Action';
import { getActionCost } from '../../turn/ActionCostTable';
import { decideMoveTowardsPlayer } from './EnemyMovementHelper';

/**
 * 積極的行動
 *
 * 常にプレイヤーを追跡する。距離に関わらず移動を試みる。
 *
 * BU-3 段階6: act() から decideAction() へ変更。
 * 副作用を実行せず、Action を返す。
 */
export class AggressiveBehavior implements EnemyBehaviorStrategy {
  async decideAction(enemy: Enemy, context: EnemyActionContext): Promise<Action | null> {
    const playerPosition = context.getPlayerPosition();
    if (!playerPosition) return null;

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
}
