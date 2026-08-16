import { Direction, Vector3 } from '../types';

/**
 * 行動の種別。
 *
 * BU-3 段階2: 行動をイベント名ではなく値として表現する。
 * 新しい行動を追加する場合はこの union へ項目を足すだけでよく、
 * TurnScheduler / TurnSystem の変更は不要（拡張性の契約）。
 */
export type ActionKind =
  | 'move'
  | 'turn' // 方向転換
  | 'attack'
  | 'use_item'
  | 'use_skill'
  | 'interact'
  | 'wait';

/**
 * 行動のコスト。
 *
 * timeCost が 0 の行動はスケジューラの行動権を消費せず、
 * 同じアクターが連続して行動できる（自由行動）。
 * 現行の挙動を維持する場合、移動・攻撃・方向転換はすべて timeCost 1。
 *
 * energyCost はゲーム内リソースとしてのエネルギー（HUD に表示される値）。
 * スケジューラの schedulerEnergy とは別物。
 */
export interface ActionCost {
  /** 行動に要する時間単位。0 なら行動権を消費しない */
  readonly timeCost: number;
  /** 消費ゲームエネルギー（スケジューラエネルギーとは別物） */
  readonly energyCost: number;
}

/**
 * 行動。
 *
 * 行動の実行に必要な情報をすべて持つ値オブジェクト。
 * ActionExecutor はこの値を受け取って実行する。
 */
export interface Action {
  readonly kind: ActionKind;
  readonly actorId: string;
  readonly cost: ActionCost;
  readonly params?: {
    direction?: Direction;
    targetId?: string;
    targetPosition?: Vector3;
    itemId?: string;
    skillId?: string;
  };
}

/**
 * 行動の実行結果。
 *
 * success が false の場合、consumedTime は 0 にするのが基本。
 * ただしスケジューラの無限ループ防止のため、失敗時も最低 1 時間単位を
 * 消費させるポリシーをとる場合は consumedTime >= 1 を返す（段階5で実装）。
 */
export interface ActionResult {
  readonly success: boolean;
  /** 実際に消費した時間単位（失敗時は基本 0） */
  readonly consumedTime: number;
  readonly reason?: string;
}
