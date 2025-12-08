import { Component } from '../Component';
import { Entity } from '../Entity';

/**
 * インタラクション可能コンポーネント
 * エンティティがプレイヤーと相互作用できるようにする
 */
export class InteractableComponent implements Component {
  type = 'interactable';
  entity: Entity | null = null;

  // インタラクション時のコールバック
  private onInteract: (playerId: string) => void;

  // インタラクション済みフラグ
  private interacted = false;

  // 一度だけ使用可能か
  private oneTimeUse: boolean;

  // 使用回数制限（オプション）
  private maxUses: number;
  private currentUses = 0;

  /**
   * コンストラクタ
   * @param onInteract インタラクション時のコールバック
   * @param oneTimeUse 一度だけ使用可能か（デフォルト: false）
   * @param maxUses 最大使用回数（デフォルト: 無制限）
   */
  constructor(onInteract: (playerId: string) => void, oneTimeUse = false, maxUses = Infinity) {
    this.onInteract = onInteract;
    this.oneTimeUse = oneTimeUse;
    this.maxUses = maxUses;
  }

  /**
   * コンポーネントの初期化
   */
  async initialize(): Promise<void> {
    console.log(`InteractableComponent initialized for entity: ${this.entity?.id}`);
  }

  /**
   * 毎フレームの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // インタラクションコンポーネントは特に更新処理が不要
  }

  /**
   * インタラクションを実行
   * @param playerId プレイヤーID
   * @returns インタラクションが成功したかどうか
   */
  interact(playerId: string): boolean {
    // 一度だけ使用可能で既に使用済みの場合
    if (this.oneTimeUse && this.interacted) {
      console.log('This interactable has already been used');
      return false;
    }

    // 使用回数制限に達している場合
    if (this.currentUses >= this.maxUses) {
      console.log('This interactable has reached its maximum uses');
      return false;
    }

    // インタラクションを実行
    try {
      this.onInteract(playerId);
      this.interacted = true;
      this.currentUses++;
      console.log(
        `Interaction successful for entity: ${this.entity?.id} (uses: ${this.currentUses}/${this.maxUses})`
      );
      return true;
    } catch (error) {
      console.error('Error during interaction:', error);
      return false;
    }
  }

  /**
   * インタラクション済みかどうか
   * @returns インタラクション済みならtrue
   */
  isInteracted(): boolean {
    return this.interacted;
  }

  /**
   * 使用可能かどうか
   * @returns 使用可能ならtrue
   */
  canInteract(): boolean {
    if (this.oneTimeUse && this.interacted) {
      return false;
    }
    if (this.currentUses >= this.maxUses) {
      return false;
    }
    return true;
  }

  /**
   * 残り使用回数を取得
   * @returns 残り使用回数
   */
  getRemainingUses(): number {
    return this.maxUses - this.currentUses;
  }

  /**
   * リセット（再度使用可能にする）
   */
  reset(): void {
    this.interacted = false;
    this.currentUses = 0;
    console.log(`Interactable reset for entity: ${this.entity?.id}`);
  }
}
