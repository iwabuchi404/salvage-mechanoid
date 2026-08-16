import { ActionCost, ActionKind } from './Action';

/**
 * 行動種別ごとの既定コスト。
 *
 * 現行の実効挙動と一致する値を初期値とする:
 * - 移動: ゲームエネルギー1消費、時間1
 * - 攻撃: ゲームエネルギー2消費、時間1
 * - 方向転換: ゲームエネルギー消費なし、時間1
 * - アイテム使用: ゲームエネルギー消費なし、時間1
 * - スキル使用: ゲームエネルギー消費なし（実コストは Skill 定義側が持つ）、時間1
 * - インタラクション: 現行は自動発火のため timeCost 0
 * - 待機: ゲームエネルギー消費なし、時間1
 *
 * BU-3 段階2: この時点では誰も参照しない純データ。段階3以降で ActionExecutor が参照する。
 */
export const DEFAULT_ACTION_COSTS: Readonly<Record<ActionKind, ActionCost>> = Object.freeze({
  move: { timeCost: 1, energyCost: 1 },
  turn: { timeCost: 1, energyCost: 0 },
  attack: { timeCost: 1, energyCost: 2 },
  use_item: { timeCost: 1, energyCost: 0 },
  use_skill: { timeCost: 1, energyCost: 0 }, // 実コストは Skill 定義側が持つ
  interact: { timeCost: 0, energyCost: 0 }, // 現行は自動発火のため 0
  wait: { timeCost: 1, energyCost: 0 },
});

/**
 * 行動種別から既定コストを取得する。
 *
 * スキルなど、個別の定義がコストを上書きする場合は
 * ActionExecutor 側でその定義を優先する。この関数は既定値のフォールバック。
 */
export function getActionCost(kind: ActionKind): ActionCost {
  return DEFAULT_ACTION_COSTS[kind];
}
