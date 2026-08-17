import { Component } from '../Component';
import { Entity } from '../Entity';
import { StatsComponent } from './Stats';
import { Action } from '../../turn/Action';

/**
 * 自律行動または入力によって行動する Entity が持つコンポーネント。
 *
 * BU-3 段階4: C3 の BlockingComponent / VisionBlockingComponent と同じパターンで、
 * 行動可能性を Component として宣言する。
 *
 * BU-3 P0-2 修正: speed（スケジューラ用・100系）と moveSpeed（アニメーション用・2〜6系）を分離。
 * - actionSpeed: 1 tick あたりに蓄積するスケジューラエネルギー。100 で標準（1ターン1回行動）。
 * - moveSpeed は StatsComponent / EnemyStatProfile が持ち、アニメーション速度として使われる。
 *
 * inputControlled が true のアクターは入力待ち対象（プレイヤー）。
 * false のアクターは decideAction() で自律行動する（敵）。
 */
export class ActorComponent implements Component {
  type = 'actor';
  entity: Entity | null = null;

  /**
   * 行動速度（スケジューラ用・100系）。
   * 1 tick あたりに蓄積するスケジューラエネルギー。
   * 100 で標準（1ターン1回行動）、200 で2倍速、50 で半速。
   *
   * BU-3 P0-2: moveSpeed（アニメーション用・2〜6系）とは別物。
   */
  private _actionSpeed: number;

  /** 蓄積済みのスケジューラエネルギー（案Bで TurnScheduler が使う） */
  private _schedulerEnergy = 0;

  /** 入力待ちが必要か（プレイヤーは true、AI は false） */
  readonly inputControlled: boolean;

  /** 行動決定関数（AI の場合。プレイヤーは null で、入力経由で行動を受け取る） */
  private decideActionFn: (() => Promise<Action | null>) | null = null;

  constructor(options: {
    actionSpeed?: number;
    inputControlled: boolean;
    decideAction?: () => Promise<Action | null>;
  }) {
    this._actionSpeed = options.actionSpeed ?? 100; // 既定値（標準速度）
    this.inputControlled = options.inputControlled;
    this.decideActionFn = options.decideAction ?? null;
  }

  initialize(): void {
    // StatsComponent があれば actionSpeed をそこから同期する
    this.syncActionSpeedFromStats();
  }

  update(_deltaTime: number): void {
    // ActorComponent はターン駆動のため毎フレーム更新不要
  }

  /**
   * 行動速度（スケジューラ用・100系）。
   * 1 tick あたりに蓄積するスケジューラエネルギー。
   */
  get speed(): number {
    return this._actionSpeed;
  }

  set speed(value: number) {
    this._actionSpeed = value;
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
   * プレイヤーの場合は null を返し、入力経由で行動を受け取る。
   */
  async decideAction(): Promise<Action | null> {
    if (this.decideActionFn) {
      return this.decideActionFn();
    }
    return null;
  }

  /**
   * StatsComponent から行動速度を同期する。
   *
   * BU-3 P0-2: StatsComponent.moveSpeed（2〜6系・アニメーション用）を
   * そのまま actionSpeed（100系・スケジューラ用）へ使うと単位系が不一致になる。
   * そのため moveSpeed を 100 系へスケールして設定する。
   *
   * 変換式: actionSpeed = moveSpeed * 25
   *   - SCOUT (moveSpeed 6) → actionSpeed 150（1.5倍速）
   *   - SOLDIER (moveSpeed 4) → actionSpeed 100（標準）
   *   - HEAVY (moveSpeed 2) → actionSpeed 50（半速・2 tick に1回行動）
   *   - Player (moveSpeed 4) → actionSpeed 100（標準）
   */
  syncActionSpeedFromStats(): void {
    if (!this.entity) return;
    const stats = this.entity.getComponent<StatsComponent>('stats');
    if (stats) {
      // P2 対策: actionSpeed の下限を 1 でクランプする。
      // moveSpeed が 0 以下（鈍足デバフ等）の場合でも、
      // 完全に行動できなくなるのを防ぐ。TurnScheduler 側でも
      // 同期スピン対策（MAX_IDLE_TICKS + 空await）を入れているが、
      // ここでも下限を保証する。
      this._actionSpeed = Math.max(1, stats.getValue('moveSpeed') * 25);
    }
  }
}
