import { Engine } from './Engine';

/**
 * システムのインターフェース
 * すべてのエンジンシステムはこのインターフェースを実装する必要がある
 */
export interface System {
  /**
   * システムを初期化する
   * @param engine エンジンのインスタンス
   */
  initialize(engine: Engine): Promise<void>;

  /**
   * 各フレームでシステムを更新する
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void;

  /**
   * システムを破棄し、リソースを解放する
   */
  destroy?(): void;
}
