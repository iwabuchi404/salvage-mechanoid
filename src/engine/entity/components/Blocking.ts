import { Component } from '../Component';
import { Entity } from '../Entity';

/**
 * 衝突判定コンポーネント
 *
 * C3: Entity 種別の判定規則を 1 つにする
 *
 * このコンポーネントを持つ Entity は WorldSystem の衝突判定対象になる。
 * 旧ロジックでは WorldSystem.isPositionOccupied() が
 * `hasTag('item')` / `hasTag('event_object')` / `hasTag('portal')` /
 * `hasTag('charger')` のハードコードで除外対象を判定していた。
 * 本コンポーネントにより、衝突する Entity のみが明示的に宣言を行い、
 * WorldSystem はコンポーネントの有無だけを見る形へ変更する。
 *
 * 将来 Room ロック用のドア・バリアを追加する際も、
 * このコンポーネントを付与するだけで WorldSystem の変更なしで
 * 衝突対象にできる。
 */
export class BlockingComponent implements Component {
  type = 'blocking';
  entity: Entity | null = null;

  initialize(): void {
    // 特に初期化処理は不要
  }

  update(): void {
    // 衝突判定コンポーネントは状態を持たないため更新処理なし
  }
}
