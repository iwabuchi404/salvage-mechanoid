import { StatsComponent } from '@/engine/entity/components/Stats';
import { HealthComponent } from '@/engine/entity/components/Health';
import { EnergyComponent } from '@/engine/entity/components/Energy';
import { EffectiveStats, StatSource, StatModifier } from '@/engine/entity/stats/StatTypes';
import { Entity } from '@/engine/entity/Entity';
import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';

/**
 * BU-2 段階4: Health/Energy の最大値が stats_changed から導出されることのテスト
 *
 * StatsComponent の実効値が変わると、HealthComponent.maxHp と
 * EnergyComponent.maxEnergy が更新されることを検証する。
 * また、最大値低下時に現在値がクランプされることを検証する。
 */

const baseStats: EffectiveStats = {
  maxHp: 0,
  maxEnergy: 0,
  defense: 0,
  attackPower: 15,
  viewRadius: 4,
  moveSpeed: 4,
  carryCapacity: 0,
  strength: 10,
  level: 1,
};

class TestStatSource implements StatSource {
  constructor(readonly sourceId: string, private modifiers: StatModifier[]) {}

  getModifiers(): readonly StatModifier[] {
    return this.modifiers;
  }

  setModifiers(modifiers: StatModifier[]): void {
    this.modifiers = modifiers;
  }
}

describe('BU-2 段階4: Health/Energy の最大値を stats_changed から導出', () => {
  let eventSystem: EventSystem;
  let entitySystem: EntitySystem;
  let entity: Entity;
  let stats: StatsComponent;
  let health: HealthComponent;
  let energy: EnergyComponent;

  beforeEach(() => {
    eventSystem = new EventSystem();
    entitySystem = new EntitySystem();

    jest.spyOn(Engine, 'instance', 'get').mockReturnValue({
      getSystem: jest.fn((key: string) => {
        if (key === 'event') return eventSystem;
        if (key === 'entity') return entitySystem;
        return undefined;
      }),
    } as any);

    entity = new Entity('test-player', 'player');
    entity.addTag('player');

    stats = new StatsComponent(baseStats);
    entity.addComponent(stats);
    stats.initialize();

    // HealthComponent を初期値 maxHp=100, currentHp=100 で作成
    health = new HealthComponent(100, 100, 0, 0, 0);
    entity.addComponent(health);

    // EnergyComponent を初期値 maxEnergy=200, currentEnergy=200 で作成
    energy = new EnergyComponent(200, 200);
    entity.addComponent(energy);

    // stats_changed リスナーを設定（Player と同じロジック）
    eventSystem.on('stats_changed', (data) => {
      if (data.entityId === entity.id) {
        health.setMaxHp(data.stats.maxHp);
        health.defense = data.stats.defense;
        energy.setMaxEnergy(data.stats.maxEnergy);
      }
    });

    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('装備追加で maxHp が増加すると HealthComponent.maxHp が更新される', () => {
    const source = new TestStatSource('parts', [
      { stat: 'maxHp', op: 'add', value: 150, sourceId: 'parts' },
      { stat: 'maxEnergy', op: 'add', value: 250, sourceId: 'parts' },
      { stat: 'defense', op: 'add', value: 10, sourceId: 'parts' },
    ]);

    stats.addSource(source);

    expect(health.maxHp).toBe(150);
    expect(health.defense).toBe(10);
    expect(energy.maxEnergy).toBe(250);
  });

  it('装備変更で maxHp が増加すると現在 HP はそのまま維持される', () => {
    // 初期: maxHp=100, currentHp=100
    expect(health.currentHp).toBe(100);

    const source = new TestStatSource('parts', [
      { stat: 'maxHp', op: 'add', value: 200, sourceId: 'parts' },
    ]);
    stats.addSource(source);

    // maxHp=200 に増加、currentHp は 100 のまま
    expect(health.maxHp).toBe(200);
    expect(health.currentHp).toBe(100);
  });

  it('装備外しで maxHp が低下すると現在 HP がクランプされる', () => {
    // 初期装備で maxHp=200 にする
    const source = new TestStatSource('parts', [
      { stat: 'maxHp', op: 'add', value: 200, sourceId: 'parts' },
    ]);
    stats.addSource(source);
    expect(health.maxHp).toBe(200);

    // HP を最大まで回復してから減らす
    health.heal(100);
    expect(health.currentHp).toBe(200);
    health.takeDamage(20, true);
    expect(health.currentHp).toBe(180);

    // 装備を外して maxHp=0（base）に戻す → setMaxHp で最低1になる
    stats.removeSource('parts');

    // maxHp=0 → Math.max(1, 0) = 1 にクランプ
    expect(health.maxHp).toBe(1);
    expect(health.currentHp).toBe(1); // 1 にクランプ
  });

  it('装備外しで maxEnergy が低下すると現在 energy がクランプされる', () => {
    const source = new TestStatSource('parts', [
      { stat: 'maxEnergy', op: 'add', value: 300, sourceId: 'parts' },
    ]);
    stats.addSource(source);
    expect(energy.maxEnergy).toBe(300);
    expect(energy.currentEnergy).toBe(200); // 初期値のまま

    // エネルギーを 280 まで回復
    energy.restore(80);
    expect(energy.currentEnergy).toBe(280);

    // 装備を外して maxEnergy=0（base）に戻す → setMaxEnergy で最低1になる
    stats.removeSource('parts');

    expect(energy.maxEnergy).toBe(1); // Math.max(1, 0) = 1
    expect(energy.currentEnergy).toBe(1); // クランプ
  });

  it('defense が stats_changed で更新される', () => {
    const source = new TestStatSource('buff:shield', [
      { stat: 'defense', op: 'add', value: 15, sourceId: 'buff:shield' },
    ]);
    stats.addSource(source);

    expect(health.defense).toBe(15);

    stats.removeSource('buff:shield');
    expect(health.defense).toBe(0);
  });
});
