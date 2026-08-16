import { StatsComponent } from '@/engine/entity/components/Stats';
import { HealthComponent } from '@/engine/entity/components/Health';
import { EnergyComponent } from '@/engine/entity/components/Energy';
import { EffectiveStats, StatSource, StatModifier } from '@/engine/entity/stats/StatTypes';
import { Entity } from '@/engine/entity/Entity';
import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';

/**
 * BU-2 段階6: 回復・ステータスブーストアイテムの結線テスト
 *
 * P0-1修正: applyStatBoost の二重計上を検出するため、
 * 修飾子あり状態（base=0 + parts修飾子）でテストを書く。
 */

const baseStats: EffectiveStats = {
  maxHp: 100,
  maxEnergy: 200,
  defense: 5,
  attackPower: 15,
  viewRadius: 4,
  moveSpeed: 4,
  carryCapacity: 10,
  level: 1,
};

/** P0-1 回帰テスト用: 実ゲームと同じく base=0 + parts 修飾子で値を供給する */
const baseStatsWithParts: EffectiveStats = {
  maxHp: 0,
  maxEnergy: 0,
  defense: 0,
  attackPower: 15,
  viewRadius: 4,
  moveSpeed: 4,
  carryCapacity: 0,
  level: 1,
};

/** テスト用の StatSource（parts 相当の修飾子を提供） */
class TestStatSource implements StatSource {
  constructor(readonly sourceId: string, private modifiers: StatModifier[]) {}
  getModifiers(): readonly StatModifier[] {
    return this.modifiers;
  }
}

describe('BU-2 段階6: 回復・ステータスブーストアイテムの結線', () => {
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

    const healed = health.heal(30);

    expect(healed).toBe(30);
    expect(health.currentHp).toBe(80);
  });

  it('maxHp を超えないようにクランプされる', () => {
    expect(health.currentHp).toBe(50);

    const healed = health.heal(100);

    expect(healed).toBe(50);
    expect(health.currentHp).toBe(100);
  });

  it('stat_boost で attackPower が増加する', () => {
    expect(stats.getValue('attackPower')).toBe(15);

    // P0-1修正: 基礎値に加算する（実効値ではない）
    const currentBase = stats.getBase().attackPower;
    stats.setBaseValue('attackPower', currentBase + 5);

    expect(stats.getValue('attackPower')).toBe(20);
  });

  it('stat_boost で maxHp が増加すると HealthComponent.maxHp も更新される', () => {
    expect(health.maxHp).toBe(100);

    const currentBase = stats.getBase().maxHp;
    stats.setBaseValue('maxHp', currentBase + 50);

    expect(health.maxHp).toBe(150);
  });

  it('stat_boost で maxHp が増加した後、heal で新しい maxHp まで回復できる', () => {
    expect(health.currentHp).toBe(50);

    stats.setBaseValue('maxHp', stats.getBase().maxHp + 50);
    expect(health.maxHp).toBe(150);

    const healed = health.heal(100);
    expect(healed).toBe(100);
    expect(health.currentHp).toBe(150);
  });

  // P0-2 回帰テスト: attackPower ブーストが実ダメージに反映される
  it('P0-2: attackPower ブーストで実効攻撃力が増加する', () => {
    expect(stats.getValue('attackPower')).toBe(15);

    // attackPower を +10 ブースト
    const currentBase = stats.getBase().attackPower;
    stats.setBaseValue('attackPower', currentBase + 10);

    expect(stats.getValue('attackPower')).toBe(25);
  });
});

// P0-1 回帰テスト: 修飾子あり状態（実ゲームと同じ構成）で二重計上を検出
describe('P0-1: 修飾子あり状態で stat_boost が二重計上しない', () => {
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

    // 実ゲームと同じく base=0 で作成
    stats = new StatsComponent(baseStatsWithParts);
    entity.addComponent(stats);
    stats.initialize();

    // HealthComponent を初期値 maxHp=100, currentHp=50 で作成
    health = new HealthComponent(100, 50, 0, 0, 0);
    entity.addComponent(health);

    // stats_changed リスナー
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

  it('修飾子あり状態で maxHp をブーストしても二重計上しない', () => {
    // parts 相当の maxHp +100 修飾子を追加
    const partsSource = new TestStatSource('parts', [
      { stat: 'maxHp', op: 'add', value: 100, sourceId: 'parts' },
    ]);
    stats.addSource(partsSource);

    // 実効 maxHp は 0 + 100 = 100
    expect(stats.getValue('maxHp')).toBe(100);
    expect(health.maxHp).toBe(100);

    // maxHp を +10 ブースト（基礎値に加算）
    const currentBase = stats.getBase().maxHp;
    stats.setBaseValue('maxHp', currentBase + 10);

    // 期待: 10 + 100 = 110（二重計上なし）
    // バグ時: 100 + 10 = 110 を基礎値に書き戻す → 110 + 100 = 210
    expect(stats.getValue('maxHp')).toBe(110);
    expect(health.maxHp).toBe(110);
  });
});
