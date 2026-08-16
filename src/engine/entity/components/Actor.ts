import { Component } from '../Component';
import { Entity } from '../Entity';
import { Engine } from '../../Engine';
import { EventSystem } from '../../events/EventSystem';
import { StatsComponent } from './Stats';
import { Action } from '../../turn/Action';

/**
 * 自律行動または入力によって行動する Entity が持つコンポーネント。
 *
 * BU-3 段階4: C3 の BlockingComponent / VisionBlockingComponent と同じパターンで、
 * 行動可能性を Component として宣言する。
 *
 * speed は StatsComponent の moveSpeed から読む（BU-2 の修飾子だけで表現できる）。
 * この時点では全員同じ既定値にして挙動を変えない（段階7で速度差を有効化）。
 *
 * inputControlled が true のアクターは入力待ち対象（プレイヤー）。
 * false のアクターは decideAction() で自律行動する（敵）。
 */
export class ActorComponent implements Component {
  type = 'actor';
  entity: Entity | null = null;

  private _speed: number;
  /** 蓄積済みのスケジューラエネルギー（段階5で TurnScheduler が使う） */
  private _schedulerEnergy = 0;
  /** 入力待ちが必要か（プレイヤーは true、AI は false） */
  readonly inputControlled: boolean;
  /** 行動決定関数（AI の場合。プレイヤーは null で、入力経由で行動を受け取る） */
  private decideActionFn: (() => Promise<Action | null>) | null = null;

  constructor(options: {
    speed?: number;
    inputControlled: boolean;
    decideAction?: () => Promise<Action | null>;
  }) {
    this._speed = options.speed ?? 100; // 既定値（段階7まで全員同じ）
    this.inputControlled = options.inputControlled;
    this.decideActionFn = options.decideAction ?? null;
  }

  initialize(): void {
    // StatsComponent があれば speed をそこから同期する
    this.syncSpeedFromStats();
  }

  update(_deltaTime: number): void {
    // ActorComponent はターン駆動のため毎フレーム更新不要
  }

  /** 行動速度。1 tick あたりに蓄積するスケジューラエネルギー */
  get speed(): number {
    return this._speed;
  }

  set speed(value: number) {
    this._speed = value;
  }

  /** 蓄積済みのスケジューラエネルギー */
  get schedulerEnergy(): number {
    return this._schedulerEnergy;
  }

  set schedulerEnergy(value: number) {
    this._schedulerEnergy = value;
  }

  /** スケジューラエネルギーを加算する */
  addSchedulerEnergy(amount: number): void {
    this._schedulerEnergy += amount;
  }

  /** スケジューラエネルギーを消費する */
  consumeSchedulerEnergy(amount: number): void {
    this._schedulerEnergy -= amount;
  }

  /**
   * 次の行動を決める。
   * AI の場合は decideActionFn を呼ぶ。
   * プレイヤーの場合は null を返し、入力経由で行動を受け取る（段階5の TurnScheduler が管理）。
   */
  async decideAction(): Promise<Action | null> {
    if (this.decideActionFn) {
      return this.decideActionFn();
    }
    return null;
  }

  /**
   * StatsComponent の moveSpeed から speed を同期する。
   * 装備変更で moveSpeed が変わった場合に呼ぶ。
   */
  syncSpeedFromStats(): void {
    if (!this.entity) return;
    const stats = this.entity.getComponent<StatsComponent>('stats');
    if (stats) {
      // 段階4時点では全員同じ既定値を維持するため、
      // StatsComponent の moveSpeed は参照するが、
      // 段階7で有効化するまでは既定値を優先する
      // （moveSpeed はアニメーション速度と混同されるため）
      // TODO 段階7: this._speed = stats.getValue('moveSpeed');
    }
  }
}
