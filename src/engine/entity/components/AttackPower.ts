import { Component } from '../Component';
import { Entity } from '../Entity';

/**
 * 攻撃力コンポーネント
 *
 * P1-fix: C2 の instanceof 依存を解消する
 *
 * CombatSystem が Player / Enemy の具象クラスへ instanceof で
 * 分岐する代わりに、このコンポーネントを通じて攻撃力を取得する。
 * C3 の「種別判定を1箇所に」の方針と揃い、ボス追加時も
 * CombatSystem を触らずに済む。
 */
export class AttackPowerComponent implements Component {
  type = 'attack_power';
  entity: Entity | null = null;

  private _baseAttackPower: number;

  /**
   * @param baseAttackPower 基本攻撃力
   */
  constructor(baseAttackPower: number) {
    this._baseAttackPower = baseAttackPower;
  }

  initialize(): void {
    // 初期化処理なし
  }

  update(): void {
    // 攻撃力コンポーネントは状態を持たないため更新処理なし
  }

  /** 基本攻撃力を取得 */
  get baseAttackPower(): number {
    return this._baseAttackPower;
  }

  /** 基本攻撃力を設定 */
  set baseAttackPower(value: number) {
    this._baseAttackPower = value;
  }
}
