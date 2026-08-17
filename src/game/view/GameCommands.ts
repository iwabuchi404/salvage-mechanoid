import { Direction } from '../../engine/types';

/**
 * BU-4 段階5: UI からエンジンへの操作インターフェース
 *
 * 設計 docs/design/UI_BOUNDARY_DESIGN.md §4.2
 *
 * UI は EventSystem を直接触らず、このインターフェース経由で操作する。
 * Game がこのインターフェースを実装する。
 */
export interface GameCommands {
  /** プレイヤーを移動 */
  movePlayer(direction: Direction): void;
  /** プレイヤーの方向を転換 */
  turnPlayer(direction: Direction): void;
  /** 攻撃 */
  attack(): Promise<void>;
  /** アイテムを使用 */
  useItem(itemId: string): boolean;
  /** スキルを使用 */
  useSkill(skillId: string): boolean;
  /** インベントリアイテムを使用 */
  useInventoryItem(itemId: string): boolean;
  /** ターンを終了 */
  endTurn(): void;
  /** 選択をクリア */
  clearSelection(): void;
  /** ゲーム入力の有効/無効を切り替え */
  setInputBlocked(blocked: boolean): void;
}
