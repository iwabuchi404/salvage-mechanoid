import { Entity } from './Entity';

/**
 * コンポーネントインターフェース
 * すべてのコンポーネントはこのインターフェースを実装する
 */
export interface Component {
  /**
   * コンポーネントのタイプ（一意の識別子）
   */
  type: string;

  /**
   * このコンポーネントを所有するエンティティへの参照
   */
  entity: Entity | null;

  /**
   * コンポーネントの初期化メソッド
   * エンティティに追加された時に呼び出される
   */
  initialize(): void;

  /**
   * 毎フレームの更新メソッド
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void;
}
