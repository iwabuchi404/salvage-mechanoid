import { Component } from '../Component';
import { Entity } from '../Entity';

/**
 * 視線遮蔽コンポーネント
 *
 * P2-fix: FOVSystem.isBlocking() の entity as any を解消する
 * P1-fix: D1 のインデックス化と同時に isBlocking の全走査を解消する
 *
 * このコンポーネントを持つ Entity は FOVSystem の視線遮蔽判定対象になる。
 * 旧ロジックでは FOVSystem.isBlocking() が
 * hasTag('obstacle') + (entity as any).blocksVision() で判定していた。
 * 本コンポーネントにより、視線を遮る Entity が明示的に宣言を行い、
 * FOVSystem はコンポーネントの有無 + フラグだけを見る形へ変更する。
 *
 * BlockingComponent と対称的なパターン（C3 と同じ設計）。
 */
export class VisionBlockingComponent implements Component {
  type = 'vision_blocking';
  entity: Entity | null = null;

  private _blocksVision: boolean;

  /**
   * @param blocksVision 視線を遮るかどうか
   */
  constructor(blocksVision: boolean) {
    this._blocksVision = blocksVision;
  }

  initialize(): void {
    // 初期化処理なし
  }

  update(): void {
    // 状態を持たないため更新処理なし
  }

  /** 視線を遮るかどうか */
  get blocksVision(): boolean {
    return this._blocksVision;
  }

  /** 視線遮蔽フラグを設定 */
  set blocksVision(value: boolean) {
    this._blocksVision = value;
  }
}
