import { HealthComponent } from '@/engine/entity/components/Health';

describe('HealthComponent', () => {
  it('最大HPと現在HPを有効範囲に丸める', () => {
    expect(new HealthComponent(0, -10).maxHp).toBe(1);
    expect(new HealthComponent(0, -10).currentHp).toBe(0);
    expect(new HealthComponent(100, 120).currentHp).toBe(100);
  });

  it('防御力を差し引き、最低1ダメージを与える', () => {
    const health = new HealthComponent(100, 100, 0, 8);

    expect(health.takeDamage(20)).toBe(12);
    expect(health.takeDamage(3)).toBe(1);
    expect(health.currentHp).toBe(87);
  });

  it('防御力を無視できる', () => {
    const health = new HealthComponent(100, 100, 0, 8);

    expect(health.takeDamage(20, true)).toBe(20);
    expect(health.currentHp).toBe(80);
  });

  it('無敵時間中は通常ダメージを拒否し、時間経過後に再び受ける', () => {
    const health = new HealthComponent(100, 100, 500);

    expect(health.takeDamage(10)).toBe(10);
    expect(health.isInvincible).toBe(true);
    expect(health.takeDamage(10)).toBe(0);

    health.update(500);

    expect(health.isInvincible).toBe(false);
    expect(health.takeDamage(10)).toBe(10);
    expect(health.currentHp).toBe(80);
  });

  it('無敵時間を明示的に無視できる', () => {
    const health = new HealthComponent(100, 100, 500);

    health.takeDamage(10);

    expect(health.takeDamage(10, false, true)).toBe(10);
    expect(health.currentHp).toBe(80);
  });

  it('回復量を最大HPで制限し、実際の回復量を返す', () => {
    const health = new HealthComponent(100, 60);

    expect(health.heal(60)).toBe(40);
    expect(health.currentHp).toBe(100);
    expect(health.heal(10)).toBe(0);
  });

  it('死亡状態からは通常回復しない', () => {
    const health = new HealthComponent(100, 0);

    expect(health.isAlive).toBe(false);
    expect(health.heal(20)).toBe(0);
    expect(health.fullHeal()).toBe(0);
  });

  it('最大HPを下げると現在HPも新しい最大値に合わせる', () => {
    const health = new HealthComponent(100, 80);

    health.setMaxHp(50);

    expect(health.maxHp).toBe(50);
    expect(health.currentHp).toBe(50);
    expect(health.hpPercentage).toBe(1);
  });

  it('deltaTimeに応じて自動回復する', () => {
    const health = new HealthComponent(100, 50, 0, 0, 10);

    health.update(1500);

    expect(health.currentHp).toBe(65);
  });
});
