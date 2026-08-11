import { Enemy } from '../Enemy';
import { TransformComponent } from '../components/Transform';
import { MovementComponent } from '../components/Movement';
import { Vector3 } from '../../types';
import { EnemyBehaviorStrategy } from './EnemyBehaviorStrategy';
import { EnemyActionContext } from './EnemyActionContext';
import { getDirectionToTarget, waitForMovement } from './EnemyAIUtils';
import { moveRandomly } from './EnemyMovementHelper';

/**
 * 巡回行動
 *
 * 巡回ルートに沿って移動し、ルートの端で折り返す。
 * 巡回ルートがない場合はランダム移動へフォールバックする。
 *
 * 巡回インデックス・折返し方向の状態は本クラスが所有する。
 */
export class PatrolBehavior implements EnemyBehaviorStrategy {
  private readonly patrolRoute: Vector3[] | undefined;
  private patrolIndex = 0;
  private patrolDirection = 1;

  constructor(patrolRoute: Vector3[] | undefined) {
    this.patrolRoute = patrolRoute;
  }

  async act(enemy: Enemy, context: EnemyActionContext): Promise<void> {
    // R3 以前と同様、プレイヤーが存在しない間は行動しない
    if (!context.getPlayerPosition()) return;

    const transform = enemy.getComponent<TransformComponent>('transform');
    const movement = enemy.getComponent<MovementComponent>('movement');
    if (!transform || !movement) return;

    // パトロールルートがない場合はランダム移動
    if (!this.patrolRoute || this.patrolRoute.length === 0) {
      await moveRandomly(enemy, movement);
      return;
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
    } else {
      // 目標地点に向かって移動
      const direction = getDirectionToTarget(currentPos, targetPos);
      if (direction) {
        enemy.setDirection(direction);
        movement.moveInDirection(direction);
        await waitForMovement(movement);
      }
    }
  }
}
