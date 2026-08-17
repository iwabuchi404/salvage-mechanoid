import { Enemy } from '../Enemy';
import { TransformComponent } from '../components/Transform';
import { Vector3 } from '../../types';
import { EnemyBehaviorStrategy } from './EnemyBehaviorStrategy';
import { EnemyActionContext } from './EnemyActionContext';
import { Action } from '../../turn/Action';
import { getActionCost } from '../../turn/ActionCostTable';
import { getDirectionToTarget, getRandomDirection } from './EnemyAIUtils';

/**
 * 巡回行動
 *
 * 巡回ルートに沿って移動し、ルートの端で折り返す。
 * 巡回ルートがない場合はランダム移動へフォールバックする。
 *
 * 巡回インデックス・折返し方向の状態は本クラスが所有する。
 *
 * BU-3 段階6: act() から decideAction() へ変更。Action を返す。
 */
export class PatrolBehavior implements EnemyBehaviorStrategy {
  private readonly patrolRoute: Vector3[] | undefined;
  private patrolIndex = 0;
  private patrolDirection = 1;

  constructor(patrolRoute: Vector3[] | undefined) {
    this.patrolRoute = patrolRoute;
  }

  async decideAction(enemy: Enemy, context: EnemyActionContext): Promise<Action | null> {
    // プレイヤーが存在しない間は行動しない
    if (!context.getPlayerPosition()) return null;

    const transform = enemy.getComponent<TransformComponent>('transform');
    if (!transform) return null;

    // パトロールルートがない場合はランダム移動
    if (!this.patrolRoute || this.patrolRoute.length === 0) {
      return {
        kind: 'move',
        actorId: enemy.id,
        cost: getActionCost('move'),
        params: { direction: getRandomDirection() },
      };
    }

    const currentPos = transform.position;
    const targetPos = this.patrolRoute[this.patrolIndex];

    // 目標地点に到達したか確認
    const distance = Math.abs(currentPos.x - targetPos.x) + Math.abs(currentPos.y - targetPos.y);
    if (distance < 0.5) {
      // 次の地点へ
      this.patrolIndex += this.patrolDirection;

      // 巡回ルートの端に到達したら折り返す
      if (this.patrolIndex >= this.patrolRoute.length) {
        this.patrolIndex = this.patrolRoute.length - 2;
        this.patrolDirection = -1;
      } else if (this.patrolIndex < 0) {
        this.patrolIndex = 1;
        this.patrolDirection = 1;
      }
      // 到達時はインデックス更新のみで移動しない（旧 act() と同じ挙動）
      return null;
    }

    // 目標地点に向かって移動
    const direction = getDirectionToTarget(currentPos, targetPos);
    if (direction) {
      return {
        kind: 'move',
        actorId: enemy.id,
        cost: getActionCost('move'),
        params: { direction },
      };
    }
    return null;
  }
}
