import { Entity } from '../entity/Entity';
import { EntitySystem } from '../entity/EntitySystem';

/**
 * Entity 種別の判定規則を 1 箇所に集約するユーティリティ。
 *
 * C3: Entity 種別の判定規則を 1 つにする
 *
 * 旧ロジックでは `entityId.startsWith('player')` のように
 * ID 文字列プレフィックスで種別判定していた箇所が複数存在した。
 * 本モジュールはタグベースの判定を単一の純粋関数として提供し、
 * ID 命名規約への依存を除去する。
 */

/**
 * Entity がプレイヤーかを判定する（Entity インスタンス版）
 */
export function isPlayerEntity(entity: Entity): boolean {
  return entity.hasTag('player');
}

/**
 * Entity が敵かを判定する（Entity インスタンス版）
 */
export function isEnemyEntity(entity: Entity): boolean {
  return entity.hasTag('enemy');
}

/**
 * entityId からプレイヤーかを判定する（EntitySystem 経由）
 *
 * イベントハンドラなど entityId しか手元にない場面で利用する。
 * Entity が解決できない場合は false を返す。
 */
export function isPlayerEntityId(entityId: string, entitySystem: EntitySystem | null): boolean {
  if (!entitySystem) return false;
  const entity = entitySystem.getEntity(entityId);
  return entity ? isPlayerEntity(entity) : false;
}

/**
 * entityId から敵かを判定する（EntitySystem 経由）
 */
export function isEnemyEntityId(entityId: string, entitySystem: EntitySystem | null): boolean {
  if (!entitySystem) return false;
  const entity = entitySystem.getEntity(entityId);
  return entity ? isEnemyEntity(entity) : false;
}
