import { EnemyBehavior, Vector3 } from '../../types';
import { EnemyBehaviorStrategy } from './EnemyBehaviorStrategy';
import { StaticBehavior } from './StaticBehavior';
import { PatrolBehavior } from './PatrolBehavior';
import { GuardBehavior } from './GuardBehavior';
import { AggressiveBehavior } from './AggressiveBehavior';

/**
 * EnemyBehavior から対応する Strategy インスタンスを生成するファクトリ
 *
 * 新しい Behavior を追加する場合は、ここへマッピングを追加する。
 * Enemy.ts の act() switch 文は変更不要。
 */
export class EnemyBehaviorStrategyFactory {
  /**
   * EnemyBehavior に対応する Strategy を生成する
   * @param behavior 行動パターン
   * @param patrolRoute 巡回ルート（PATROL のみ使用）
   * @returns Strategy インスタンス
   */
  static create(behavior: EnemyBehavior, patrolRoute?: Vector3[]): EnemyBehaviorStrategy {
    switch (behavior) {
      case EnemyBehavior.STATIC:
        return new StaticBehavior();
      case EnemyBehavior.PATROL:
        return new PatrolBehavior(patrolRoute);
      case EnemyBehavior.GUARD:
        return new GuardBehavior();
      case EnemyBehavior.AGGRESSIVE:
        return new AggressiveBehavior();
      default:
        // 未知の Behavior は STATIC 相当（何もしない）
        return new StaticBehavior();
    }
  }
}
