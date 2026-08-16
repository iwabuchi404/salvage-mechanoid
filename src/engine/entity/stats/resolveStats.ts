import { StatKey, StatModifier, EffectiveStats } from './StatTypes';

/**
 * 基礎値と修飾子から実効ステータスを導出する（純粋関数）。
 *
 * 適用順序: 基礎値 → add をすべて加算 → multiply をすべて乗算 → 切り捨て
 * 順序を固定することで、修飾子の登録順に結果が依存しないようにする。
 */
export function resolveStats(
  base: EffectiveStats,
  modifiers: readonly StatModifier[]
): EffectiveStats {
  const result = { ...base } as Record<StatKey, number>;

  // 1. add をすべて加算
  for (const mod of modifiers) {
    if (mod.op === 'add') {
      result[mod.stat] += mod.value;
    }
  }

  // 2. multiply をすべて乗算
  for (const mod of modifiers) {
    if (mod.op === 'multiply') {
      result[mod.stat] *= mod.value;
    }
  }

  // 3. 切り捨て
  for (const key of Object.keys(result) as StatKey[]) {
    result[key] = Math.floor(result[key]);
  }

  return Object.freeze(result);
}
