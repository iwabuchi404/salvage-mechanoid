import { Enemy } from '../Enemy';
import { EnemyActionContext } from './EnemyActionContext';

/**
 * Enemy の行動パターンをカプセル化する Strategy インターフェース
 *
 * 新しい Behavior を追加する場合はこのインターフェースを実装し、
 * EnemyBehaviorStrategyFactory へ登録する。
 * Enemy.ts の switch 文を変更する必要はない。
 */
export interface EnemyBehaviorStrategy {
  /**
   * 敵のターン行動を実行する
   * @param enemy 行動主体の Enemy
   * @param context World 照会・Entity 照会・攻撃要求の境界
   */
  act(enemy: Enemy, context: EnemyActionContext): Promise<void>;
}
