import { Component } from '../Component';
import { Entity } from '../Entity';
import { Engine } from '../../Engine';
import { EventSystem } from '../../events/EventSystem';
import { EntitySystem } from '../EntitySystem';

/**
 * ヘルスコンポーネント - エンティティのHP管理
 */
export class HealthComponent implements Component {
  /**
   * コンポーネントのタイプ
   */
  type = 'health';

  /**
   * このコンポーネントを所有するエンティティ
   */
  entity: Entity | null = null;

  /**
   * 現在のHP
   */
  private _currentHp: number;

  /**
   * 最大HP
   */
  private _maxHp: number;

  /**
   * ダメージ時の無敵時間（ミリ秒）
   */
  private _invincibilityTime: number;

  /**
   * 現在の無敵時間の残り（ミリ秒）
   */
  private _currentInvincibilityTime = 0;

  /**
   * 防御力（整数値、ダメージから減算される）
   */
  private _defense = 0;

  /**
   * HP回復速度（1秒あたりの回復量）
   */
  private _regenerationRate = 0;

  /**
   * HPが0になった時に破壊されるかどうか
   */
  private _destroyOnDeath = true;

  /**
   * コンストラクタ
   * @param maxHp 最大HP
   * @param currentHp 現在のHP（デフォルトは最大HP）
   * @param invincibilityTime ダメージ時の無敵時間（ミリ秒）
   * @param defense 防御力（整数値、ダメージから減算される）
   * @param regenerationRate HP回復速度（1秒あたりの回復量）
   * @param destroyOnDeath HPが0になった時に破壊されるかどうか
   */
  constructor(
    maxHp: number,
    currentHp: number = maxHp,
    invincibilityTime = 0,
    defense = 0,
    regenerationRate = 0,
    destroyOnDeath = true
  ) {
    this._maxHp = Math.max(1, maxHp);
    this._currentHp = Math.min(Math.max(0, currentHp), this._maxHp);
    this._invincibilityTime = Math.max(0, invincibilityTime);
    this._defense = Math.max(0, defense);
    this._regenerationRate = Math.max(0, regenerationRate);
    this._destroyOnDeath = destroyOnDeath;
  }

  /**
   * コンポーネントの初期化
   */
  initialize(): void {
    // 必要に応じて初期化処理を追加
  }

  /**
   * 毎フレームの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // 無敵時間の更新
    if (this._currentInvincibilityTime > 0) {
      this._currentInvincibilityTime = Math.max(0, this._currentInvincibilityTime - deltaTime);
    }

    // HP自動回復
    if (this._regenerationRate > 0 && this._currentHp < this._maxHp) {
      const regenerationAmount = (this._regenerationRate * deltaTime) / 1000;
      this.heal(regenerationAmount);
    }
  }

  /**
   * 現在のHPを取得
   */
  get currentHp(): number {
    return this._currentHp;
  }

  /**
   * 最大HPを取得
   */
  get maxHp(): number {
    return this._maxHp;
  }

  /**
   * HPパーセントを取得（0.0〜1.0）
   */
  get hpPercentage(): number {
    return this._currentHp / this._maxHp;
  }

  /**
   * 無敵状態かどうかを取得
   */
  get isInvincible(): boolean {
    return this._currentInvincibilityTime > 0;
  }

  /**
   * 生存しているかどうかを取得
   */
  get isAlive(): boolean {
    return this._currentHp > 0;
  }

  /**
   * 防御力を取得
   */
  get defense(): number {
    return this._defense;
  }

  /**
   * 防御力を設定
   */
  set defense(value: number) {
    this._defense = Math.max(0, value);
  }

  /**
   * HP回復速度を取得
   */
  get regenerationRate(): number {
    return this._regenerationRate;
  }

  /**
   * HP回復速度を設定
   */
  set regenerationRate(value: number) {
    this._regenerationRate = Math.max(0, value);
  }

  /**
   * 最大HPを設定
   * 現在のHPは変更されません（最大HPを超える場合は最大HPに調整）
   */
  setMaxHp(value: number): void {
    this._maxHp = Math.max(1, value);

    // 現在のHPが最大HPを超えないように調整
    this._currentHp = Math.min(this._currentHp, this._maxHp);

    // イベント発行
    this.emitHealthChangedEvent();
  }

  /**
   * ダメージを受ける
   * @param amount ダメージ量
   * @param ignoreDefense 防御力を無視するかどうか
   * @param ignoreInvincibility 無敵時間を無視するかどうか
   * @returns 実際に与えられたダメージ量
   */
  takeDamage(amount: number, ignoreDefense = false, ignoreInvincibility = false): number {
    // 無敵時間中の場合、ダメージを無効化
    if (this.isInvincible && !ignoreInvincibility) {
      return 0;
    }

    // 整数ベースの防御力計算（攻撃力 - 防御力、最低1ダメージ）
    let actualDamage = amount;
    if (!ignoreDefense) {
      actualDamage = Math.max(1, amount - this._defense);
    }

    // HPを減少（整数値を保証）
    const prevHp = this._currentHp;
    this._currentHp = Math.max(0, this._currentHp - actualDamage);

    // 無敵時間を設定
    this._currentInvincibilityTime = this._invincibilityTime;

    // イベント発行
    this.emitHealthChangedEvent();
    this.emitDamagedEvent(actualDamage);

    // HPが0になった場合の処理
    if (this._currentHp <= 0 && prevHp > 0) {
      this.emitDeathEvent();

      // エンティティを破壊
      if (this._destroyOnDeath && this.entity) {
        const entitySystem = Engine.instance.getSystem<EntitySystem>('entity');
        if (entitySystem) {
          entitySystem.removeEntity(this.entity.id);
        }
      }
    }

    return actualDamage;
  }

  /**
   * HPを回復
   * @param amount 回復量
   * @returns 実際に回復した量
   */
  heal(amount: number): number {
    if (amount <= 0 || !this.isAlive) {
      return 0;
    }

    const prevHp = this._currentHp;
    this._currentHp = Math.min(this._currentHp + amount, this._maxHp);

    const actualHeal = this._currentHp - prevHp;

    if (actualHeal > 0) {
      this.emitHealthChangedEvent();
      this.emitHealedEvent(actualHeal);
    }

    return actualHeal;
  }

  /**
   * HPを完全回復
   */
  fullHeal(): number {
    return this.heal(this._maxHp);
  }

  /**
   * HP変更イベントを発行
   */
  private emitHealthChangedEvent(): void {
    if (!this.entity) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('health_changed', {
        entityId: this.entity.id,
        currentHp: this._currentHp,
        maxHp: this._maxHp,
        percentage: this.hpPercentage,
      });
    }
  }

  /**
   * ダメージ受けたイベントを発行
   */
  private emitDamagedEvent(amount: number): void {
    if (!this.entity) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('entity_damaged', {
        entityId: this.entity.id,
        damage: amount,
        currentHp: this._currentHp,
        maxHp: this._maxHp,
      });
    }
  }

  /**
   * 回復イベントを発行
   */
  private emitHealedEvent(amount: number): void {
    if (!this.entity) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('entity_healed', {
        entityId: this.entity.id,
        heal: amount,
        currentHp: this._currentHp,
        maxHp: this._maxHp,
      });
    }
  }

  /**
   * 死亡イベントを発行
   */
  private emitDeathEvent(): void {
    if (!this.entity) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('entity_died', {
        entityId: this.entity.id,
      });
    }
  }
}
