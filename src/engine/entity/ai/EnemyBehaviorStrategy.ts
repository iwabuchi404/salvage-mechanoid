import { Enemy } from '../Enemy';
import { EnemyActionContext } from './EnemyActionContext';
import { Action } from '../../turn/Action';

/**
 * Enemy の行動パターンをカプセル化する Strategy インターフェース
 *
 * BU-3 段階6: act() から decideAction() へ変更。
 * Strategy は副作用を実行せず、Action を返す。
 * 実行は ActionExecutor が行う。
 *
 * 新しい Behavior を追加する場合はこのインターフェースを実装し、
 * EnemyBehaviorStrategyFactory へ登録する。
 * Enemy.ts の switch 文を変更する必要はない。
 */
export interface EnemyBehaviorStrategy {
  /**
   * 敵のターン行動を決定する
   * @param enemy 行動主体の Enemy
   * @param context World 照会・Entity 照会の境界
   * @returns 実行する Action、行動しない場合は null
   */
  decideAction(enemy: Enemy, context: EnemyActionContext): Promise<Action | null>;
}
