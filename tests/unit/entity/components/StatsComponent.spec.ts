import { StatsComponent } from '@/engine/entity/components/Stats';
import { StatSource, StatModifier, EffectiveStats } from '@/engine/entity/stats/StatTypes';
import { Entity } from '@/engine/entity/Entity';
import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';

/**
 * BU-2 段階2: StatsComponent の単体テスト
 *
 * 供給元の追加・削除・invalidate が実効値へ反映されることを確認する。
 * stats_changed イベントが発行されることを確認する。
 */

/** テスト用の基礎値 */
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

/** テスト用の StatSource */
class TestStatSource implements StatSource {
  constructor(readonly sourceId: string, private modifiers: StatModifier[]) {}

  getModifiers(): readonly StatModifier[] {
    return this.modifiers;
  }

  setModifiers(modifiers: StatModifier[]): void {
    this.modifiers = modifiers;
  }
}

describe('BU-2 段階2: StatsComponent', () => {
  let stats: StatsComponent;
  let entity: Entity;
  let eventSystem: EventSystem;
  let entitySystem: EntitySystem;

  beforeEach(() => {
    // Engine のモックを設定
    eventSystem = new EventSystem();
    entitySystem = new EntitySystem();

    // Engine.instance をモック
    jest.spyOn(Engine, 'instance', 'get').mockReturnValue({
      getSystem: jest.fn((key: string) => {
        if (key === 'event') return eventSystem;
        if (key === 'entity') return entitySystem;
        return undefined;
      }),
    } as any);

    entity = new Entity('test-entity', 'test');
    stats = new StatsComponent(baseStats);
    entity.addComponent(stats);
    // initialize() で初回の recalculate() が走る（previous が null のためイベントは発行されない）
    stats.initialize();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('基礎値を取得できる', () => {
    expect(stats.getBase()).toEqual(baseStats);
    expect(stats.getValue('maxHp')).toBe(100);
    expect(stats.getValue('attackPower')).toBe(15);
  });

  it('供給元なしの場合は基礎値と同じ実効値を返す', () => {
    expect(stats.get()).toEqual(baseStats);
  });

  it('供給元を追加すると実効値へ反映される', () => {
    const source = new TestStatSource('parts:torso', [
      { stat: 'maxHp', op: 'add', value: 50, sourceId: 'parts:torso' },
      { stat: 'defense', op: 'add', value: 3, sourceId: 'parts:torso' },
    ]);

    stats.addSource(source);

    expect(stats.getValue('maxHp')).toBe(150);
    expect(stats.getValue('defense')).toBe(8);
  });

  it('供給元を削除すると実効値が元に戻る', () => {
    const source = new TestStatSource('parts:torso', [
      { stat: 'maxHp', op: 'add', value: 50, sourceId: 'parts:torso' },
    ]);

    stats.addSource(source);
    expect(stats.getValue('maxHp')).toBe(150);

    stats.removeSource('parts:torso');
    expect(stats.getValue('maxHp')).toBe(100);
  });

  it('invalidate() で供給元の内容変更を反映する', () => {
    const source = new TestStatSource('buff:rage', [
      { stat: 'attackPower', op: 'add', value: 10, sourceId: 'buff:rage' },
    ]);

    stats.addSource(source);
    expect(stats.getValue('attackPower')).toBe(25);

    // 供給元の内容が変わった
    source.setModifiers([{ stat: 'attackPower', op: 'add', value: 20, sourceId: 'buff:rage' }]);
    stats.invalidate();

    expect(stats.getValue('attackPower')).toBe(35);
  });

  it('複数の供給元を組み合わせられる', () => {
    const sourceA = new TestStatSource('parts:torso', [
      { stat: 'maxHp', op: 'add', value: 50, sourceId: 'parts:torso' },
    ]);
    const sourceB = new TestStatSource('buff:fortify', [
      { stat: 'maxHp', op: 'multiply', value: 1.2, sourceId: 'buff:fortify' },
    ]);

    stats.addSource(sourceA);
    stats.addSource(sourceB);

    // (100 + 50) * 1.2 = 180
    expect(stats.getValue('maxHp')).toBe(180);
  });

  it('setBaseValue で基礎値の単一キーを更新できる', () => {
    stats.setBaseValue('strength', 20);
    expect(stats.getValue('strength')).toBe(20);
    // 他の値は変わらない
    expect(stats.getValue('maxHp')).toBe(100);
  });

  it('addSource/invalidate/removeSource で stats_changed イベントが発行される', () => {
    const spy = jest.fn();
    eventSystem.on('stats_changed', spy);

    // 初期化時は previous が null のため発行されない
    expect(spy).not.toHaveBeenCalled();

    const source = new TestStatSource('parts:torso', [
      { stat: 'maxHp', op: 'add', value: 50, sourceId: 'parts:torso' },
    ]);

    stats.addSource(source);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'test-entity',
        stats: expect.objectContaining({ maxHp: 150 }),
        previous: expect.objectContaining({ maxHp: 100 }),
      })
    );

    stats.removeSource('parts:torso');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
