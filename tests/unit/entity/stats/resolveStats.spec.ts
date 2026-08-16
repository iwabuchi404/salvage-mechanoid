import { resolveStats } from '@/engine/entity/stats/resolveStats';
import { EffectiveStats, StatModifier } from '@/engine/entity/stats/StatTypes';

/**
 * BU-2 段階1: resolveStats の純粋関数テスト
 *
 * 適用順序、multiply の可換性、切り捨て、修飾子ゼロ件を検証する。
 */
describe('BU-2 段階1: resolveStats', () => {
  const base: EffectiveStats = {
    maxHp: 100,
    maxEnergy: 200,
    defense: 5,
    attackPower: 15,
    viewRadius: 4,
    moveSpeed: 4,
    carryCapacity: 10,
    level: 1,
  };

  it('修飾子ゼロ件の場合は基礎値をそのまま返す', () => {
    const result = resolveStats(base, []);
    expect(result).toEqual(base);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('add 修飾子を加算する', () => {
    const modifiers: StatModifier[] = [
      { stat: 'maxHp', op: 'add', value: 50, sourceId: 'parts:torso' },
      { stat: 'defense', op: 'add', value: 3, sourceId: 'parts:torso' },
    ];
    const result = resolveStats(base, modifiers);
    expect(result.maxHp).toBe(150);
    expect(result.defense).toBe(8);
  });

  it('multiply 修飾子を乗算する', () => {
    const modifiers: StatModifier[] = [
      { stat: 'attackPower', op: 'multiply', value: 1.5, sourceId: 'buff:rage' },
    ];
    const result = resolveStats(base, modifiers);
    expect(result.attackPower).toBe(22); // Math.floor(15 * 1.5) = 22
  });

  it('add → multiply の順序で適用される', () => {
    const modifiers: StatModifier[] = [
      { stat: 'maxHp', op: 'add', value: 100, sourceId: 'parts:torso' },
      { stat: 'maxHp', op: 'multiply', value: 1.2, sourceId: 'buff:fortify' },
    ];
    const result = resolveStats(base, modifiers);
    // (100 + 100) * 1.2 = 240
    expect(result.maxHp).toBe(240);
  });

  it('multiply の登録順に結果が依存しない（可換性）', () => {
    const modsA: StatModifier[] = [
      { stat: 'attackPower', op: 'multiply', value: 1.5, sourceId: 'a' },
      { stat: 'attackPower', op: 'multiply', value: 2.0, sourceId: 'b' },
    ];
    const modsB: StatModifier[] = [
      { stat: 'attackPower', op: 'multiply', value: 2.0, sourceId: 'b' },
      { stat: 'attackPower', op: 'multiply', value: 1.5, sourceId: 'a' },
    ];
    expect(resolveStats(base, modsA).attackPower).toBe(resolveStats(base, modsB).attackPower);
  });

  it('小数点以下を切り捨てる', () => {
    const modifiers: StatModifier[] = [
      { stat: 'maxHp', op: 'add', value: 10.7, sourceId: 'test' },
      { stat: 'defense', op: 'multiply', value: 1.3, sourceId: 'test' },
    ];
    const result = resolveStats(base, modifiers);
    expect(result.maxHp).toBe(110); // Math.floor(100 + 10.7) = 110
    expect(result.defense).toBe(6); // Math.floor(5 * 1.3) = 6
  });

  it('元の base オブジェクトを変更しない', () => {
    const original = { ...base };
    const modifiers: StatModifier[] = [{ stat: 'maxHp', op: 'add', value: 50, sourceId: 'test' }];
    resolveStats(base, modifiers);
    expect(base).toEqual(original);
  });

  it('複数の add 修飾子を同じ stat に適用できる', () => {
    const modifiers: StatModifier[] = [
      { stat: 'maxHp', op: 'add', value: 30, sourceId: 'parts:torso' },
      { stat: 'maxHp', op: 'add', value: 20, sourceId: 'parts:legs' },
    ];
    const result = resolveStats(base, modifiers);
    expect(result.maxHp).toBe(150);
  });
});
