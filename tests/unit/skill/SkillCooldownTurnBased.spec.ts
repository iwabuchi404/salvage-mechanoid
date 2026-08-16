import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { SkillSystem } from '@/engine/skill/SkillSystem';

/**
 * BU-3 段階1: SkillSystem のクールダウンがターン番号ベースで動作することのテスト
 *
 * 旧実装は player_turn_started で残りターン数を減算していた。
 * 新実装は turn_started で現在ターンを更新し、失効ターンとの差で判定する。
 */
describe('BU-3 段階1: SkillSystem クールダウンのターン番号ベース化', () => {
  let events: EventSystem;
  let skills: SkillSystem;

  beforeEach(async () => {
    events = new EventSystem();
    const engine = {
      getSystem: (name: string) => {
        if (name === 'event') return events;
        return undefined;
      },
    } as unknown as Engine;
    skills = new SkillSystem();
    await skills.initialize(engine);
  });

  /** ターンを進めるヘルパ */
  const advanceTurn = (turn: number) => {
    events.emit('turn_started', { turn });
  };

  it('スキル使用直後はクールダウン中', () => {
    advanceTurn(1);
    // dash は cooldown=3 で登録済み（registerDefaultSkills で learnSkill 済み）
    const ok = skills.useSkill('dash', 'player', 100);
    expect(ok).toBe(true);

    expect(skills.isOnCooldown('dash')).toBe(true);
    expect(skills.getCooldownRemaining('dash')).toBe(4); // 1 + 3 + 1 - 1 = 4
  });

  it('クールダウン経過後に使用可能になる', () => {
    advanceTurn(1);
    skills.useSkill('dash', 'player', 100);
    expect(skills.isOnCooldown('dash')).toBe(true);

    // 失効ターンは 1 + 3 + 1 = 5
    advanceTurn(2);
    expect(skills.isOnCooldown('dash')).toBe(true);
    advanceTurn(3);
    expect(skills.isOnCooldown('dash')).toBe(true);
    advanceTurn(4);
    expect(skills.isOnCooldown('dash')).toBe(true);

    // ターン5で失効
    advanceTurn(5);
    expect(skills.isOnCooldown('dash')).toBe(false);
    expect(skills.getCooldownRemaining('dash')).toBe(0);
  });

  it('クールダウン中は useSkill が false を返す', () => {
    advanceTurn(1);
    skills.useSkill('dash', 'player', 100);

    advanceTurn(2);
    const ok = skills.useSkill('dash', 'player', 100);
    expect(ok).toBe(false);
  });

  it('失効後に再使用できる', () => {
    advanceTurn(1);
    skills.useSkill('dash', 'player', 100);

    advanceTurn(5);
    expect(skills.isOnCooldown('dash')).toBe(false);

    const ok = skills.useSkill('dash', 'player', 100);
    expect(ok).toBe(true);
    // 失効ターンは 5 + 3 + 1 = 9
    expect(skills.getCooldownRemaining('dash')).toBe(4);
  });
});
