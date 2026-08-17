import { Direction } from '../../engine/types';

/**
 * BU-4: Game ↔ UI 境界の再設計 — ビューモデル型
 *
 * ドメインオブジェクト（Entity, Player, Enemy など）を含まない、
 * 表示専用の読み取り専用型。
 * Game がドメイン状態をこの形へ投影し、UI はこれを購読する。
 *
 * 設計 docs/design/UI_BOUNDARY_DESIGN.md §4.1
 */

/** プレイヤーの表示用ステータス */
export interface PlayerViewState {
  readonly hp: number;
  readonly maxHp: number;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly level: number;
  readonly direction: Direction;
  readonly position: { x: number; y: number };
}

/** 選択対象の表示用情報（判別可能ユニオン） */
export type SelectionViewState =
  | {
      readonly kind: 'tile';
      readonly name: string;
      readonly position: { x: number; y: number };
      readonly effect: string;
    }
  | {
      readonly kind: 'enemy';
      readonly name: string;
      readonly position: { x: number; y: number };
      readonly hp: number;
      readonly maxHp: number;
    }
  | {
      readonly kind: 'player';
      readonly name: string;
      readonly position: { x: number; y: number };
    }
  | {
      readonly kind: 'object';
      readonly name: string;
      readonly position: { x: number; y: number };
    };

/** 進行状況の表示用情報 */
export interface ProgressViewState {
  readonly floor: number;
  readonly maxFloors: number;
  readonly turn: number;
  readonly isPlayerTurn: boolean;
}

/** UI が読む全体状態 */
export interface GameViewState {
  readonly player: PlayerViewState;
  readonly progress: ProgressViewState;
  readonly selection: SelectionViewState | null;
}
