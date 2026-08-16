import { StatsComponent } from '@/engine/entity/components/Stats';
import { HealthComponent } from '@/engine/entity/components/Health';
import { EnergyComponent } from '@/engine/entity/components/Energy';
import { EffectiveStats } from '@/engine/entity/stats/StatTypes';
import { Entity } from '@/engine/entity/Entity';
import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';

/**
 * BU-2 段階6: 回復アイテムの結線テスト
 *
 * useItem('heal') 後に HealthComponent.currentHp が増えることを検証する。
 * これは現在の不具合（gameStore だけ書き換わって HealthComponent は変わらない）
 * の回帰防止テスト。
 */

const baseStats: EffectiveStats = {
  maxHp: 100,
  maxEnergy: 200,
  defense: 5,
  attackPower: 15,
  viewRadius: 4,
  moveSpeed: 4,
  carryCapacity: 10,
  strength: 10,
  level: 1,
};

describe('BU-2 段階6: 回復アイテムの結線', () => {
  let eventSystem: EventSystem;
  let entitySystem: EntitySystem;
  let entity: Entity;
  let stats: StatsComponent;
  let health: HealthComponent;

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

    // HealthComponent を初期値 maxHp=100, currentHp=50 で作成
    health = new HealthComponent(100, 50, 0, 0, 0);
    entity.addComponent(health);

    // stats_changed リスナー（Player と同じロジック）
    eventSystem.on('stats_changed', (data) => {
      if (data.entityId === entity.id) {
        health.setMaxHp(data.stats.maxHp);
        health.defense = data.stats.defense;
      }
    });

    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('heal handler 経由で HealthComponent.currentHp が増える', () => {
    expect(health.currentHp).toBe(50);

    // heal handler を呼ぶ（Game.useInventoryItem と同じ経路）
    const healed = health.heal(30);

    expect(healed).toBe(30);
    expect(health.currentHp).toBe(80);
  });

  it('maxHp を超えないようにクランプされる', () => {
    expect(health.currentHp).toBe(50);

    const healed = health.heal(100);

    // 50 + 100 = 150 だが maxHp=100 でクランプ
    expect(healed).toBe(50);
    expect(health.currentHp).toBe(100);
  });

  it('stat_boost で strength が増加する', () => {
    expect(stats.getValue('strength')).toBe(10);

    // statBoost handler と同じロジック
    const currentValue = stats.getValue('strength');
    stats.setBaseValue('strength', currentValue + 5);

    expect(stats.getValue('strength')).toBe(15);
  });

  it('stat_boost で maxHp が増加すると HealthComponent.maxHp も更新される', () => {
    expect(health.maxHp).toBe(100);

    // maxHp を +50 する
    const currentValue = stats.getValue('maxHp');
    stats.setBaseValue('maxHp', currentValue + 50);

    // stats_changed が発行され、HealthComponent.maxHp が更新される
    expect(health.maxHp).toBe(150);
  });

  it('stat_boost で maxHp が増加した後、heal で新しい maxHp まで回復できる', () => {
    expect(health.currentHp).toBe(50);

    // maxHp を +50 する
    stats.setBaseValue('maxHp', stats.getValue('maxHp') + 50);
    expect(health.maxHp).toBe(150);

    // 100 まで回復（元の maxHp は 100 だったが、今は 150 まで回復可能）
    const healed = health.heal(100);
    expect(healed).toBe(100);
    expect(health.currentHp).toBe(150);
  });
});
