import { HealthComponent } from '@/engine/entity/components/Health';
import { MovementComponent } from '@/engine/entity/components/Movement';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { Enemy } from '@/engine/entity/Enemy';
import { resolveEnemyStats } from '@/engine/entity/enemy/EnemyStatProfile';
import { EnemyBehavior, EnemyType, PlacedEnemy } from '@/engine/types';

describe('Enemy data model', () => {
  const createPlacedEnemy = (overrides: Partial<PlacedEnemy> = {}): PlacedEnemy => ({
    id: 'enemy-1',
    type: EnemyType.SOLDIER,
    x: 4,
    y: 7,
    level: 1,
    behavior: EnemyBehavior.GUARD,
    ...overrides,
  });

  // C2: Enemy コンストラクタが stats を要求するため、プロファイルから解決して渡す
  const createEnemy = (overrides: Partial<PlacedEnemy> = {}) => {
    const placed = createPlacedEnemy(overrides);
    return new Enemy(placed, resolveEnemyStats(placed.type, placed.level));
  };

  it('配置データと行動データをエンティティへ保持する', () => {
    const patrolRoute = [
      { x: 4, y: 7, z: 0 },
      { x: 5, y: 7, z: 0 },
    ];
    const enemy = createEnemy({ patrolRoute });

    expect(enemy.id).toBe('enemy-1');
    expect(enemy.type).toBe('enemy');
    expect(enemy.getEnemyType()).toBe(EnemyType.SOLDIER);
    expect(enemy.getBehavior()).toBe(EnemyBehavior.GUARD);
    expect(enemy.getLevel()).toBe(1);
    expect(enemy.getPatrolRoute()).toBe(patrolRoute);
    expect(enemy.getTags()).toEqual(
      expect.arrayContaining(['enemy', EnemyType.SOLDIER, `behavior_${EnemyBehavior.GUARD}`])
    );
    expect(enemy.getComponent<TransformComponent>('transform')?.position).toEqual({
      x: 4,
      y: 7,
      z: 0,
    });
  });

  it.each([
    [EnemyType.SCOUT, 30, 3, 6],
    [EnemyType.SOLDIER, 50, 5, 4],
    [EnemyType.HEAVY, 100, 10, 2],
  ])('%sの基礎ステータスをコンポーネントへ反映する', (type, hp, defense, speed) => {
    const enemy = createEnemy({ type });

    expect(enemy.getComponent<HealthComponent>('health')).toEqual(
      expect.objectContaining({ currentHp: hp, maxHp: hp, defense })
    );
    expect(enemy.getComponent<MovementComponent>('movement')?.speed).toBe(speed);
  });

  it('レベルに応じてHPと防御力を拡大する', () => {
    const enemy = createEnemy({ type: EnemyType.HEAVY, level: 3 });
    const health = enemy.getComponent<HealthComponent>('health');

    expect(health?.maxHp).toBe(140);
    expect(health?.defense).toBe(14);
  });

  it('方向はMovementComponentを唯一の状態として読み書きする', () => {
    const enemy = createEnemy();

    expect(enemy.getDirection()).toBe('down');
    enemy.setDirection('left');

    expect(enemy.getDirection()).toBe('left');
    expect(enemy.getComponent<MovementComponent>('movement')?.direction).toBe('left');
  });

  // C2: EnemyStatProfile から注入されたステータスを getStats() で取得できる
  it('getStats() が注入されたステータスを返す', () => {
    const enemy = createEnemy({ type: EnemyType.SCOUT, level: 2 });

    const stats = enemy.getStats();
    expect(stats.maxHealth).toBe(36); // 30 * 1.2 = 36
    expect(stats.defense).toBe(3); // 3 * 1.2 = 3.6 -> 3
    expect(stats.moveSpeed).toBe(6);
    expect(stats.attackPower).toBe(6); // 5 * 1.2 = 6
  });
});
