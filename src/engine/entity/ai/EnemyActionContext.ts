import { Vector3 } from '../../types';

/**
 * Enemy AI が外部システムへアクセスするための境界
 *
 * Strategy が Engine.instance を直接参照せず、World 照会・Entity 照会・
 * 攻撃要求をこのインターフェース経由で行う。
 */
export interface EnemyActionContext {
  /**
   * プレイヤーの現在位置を取得する
   * @returns プレイヤー位置、プレイヤー不在時は null
   */
  getPlayerPosition(): Vector3 | null;

  /**
   * A* パスファインディングで経路を探索する
   * @param from 開始位置
   * @param to 目標位置
   * @param maxSteps 最大探索ステップ
   * @param excludeEntityId 経路探索から除外する Entity の ID
   * @returns 経路の座標配列（先頭は開始位置）
   */
  findPath(from: Vector3, to: Vector3, maxSteps?: number, excludeEntityId?: string): Vector3[];

  /**
   * 2点間のタイル距離を取得する
   * @param from 開始位置
   * @param to 目標位置
   * @returns 距離
   */
  getDistance(from: Vector3, to: Vector3): number;

  /**
   * 攻撃要求を発行する
   * @param enemyId 攻撃元の Enemy ID
   * @param targetId 攻撃対象の ID
   */
  requestAttack(enemyId: string, targetId: string): void;
}
