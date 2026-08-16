import { StatsComponent } from '@/engine/entity/components/Stats';
import { CombatSystem } from '@/engine/combat/CombatSystem';
import { HealthComponent } from '@/engine/entity/components/Health';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { BlockingComponent } from '@/engine/entity/components/Blocking';
import { AttackPowerComponent } from '@/engine/entity/components/AttackPower';
import { EffectiveStats, StatModifier } from '@/engine/entity/stats/StatTypes';
import { Entity } from '@/engine/entity/Entity';
import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';

/**
 * BU-2 段階5: 攻撃力アイテムの結線テスト
 *
 * StatsComponent の attackPower が変わると、CombatSystem のダメージが
 * 変わることを検証する。
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

describe('BU-2 段階5: CombatSystem が StatsComponent から攻撃力を参照', () => {
  let eventSystem: EventSystem;
  let entitySystem: EntitySystem;
  let combat: CombatSystem;
  let attacker: Entity;
  let target: Entity;
  let stats: StatsComponent;

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

    // CombatSystem を初期化
    combat = new CombatSystem();
    combat.initialize(Engine.instance);

    // 攻撃者エンティティ（StatsComponent 付き）
    attacker = new Entity('attacker', 'player');
    attacker.addTag('player');
    attacker.addComponent(new TransformComponent(0, 0, 0));
    attacker.addComponent(new BlockingComponent());
    stats = new StatsComponent(baseStats);
    attacker.addComponent(stats);
    stats.initialize();

    // ターゲットエンティティ
    target = new Entity('target', 'enemy');
    target.addTag('enemy');
    target.addComponent(new TransformComponent(1, 0, 0));
    target.addComponent(new BlockingComponent());
    target.addComponent(new HealthComponent(1000, 1000, 0, 0, 0));

    entitySystem.registerEntity(attacker);
    entitySystem.registerEntity(target);

    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('StatsComponent の attackPower を基準にダメージが計算される', () => {
    // attackPower = 15、randomFactor は 0.8〜1.2
    // Math.random をモックして 1.0 に固定
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // 0.8 + 0.1 * 0.4 = 0.84

    const damage = (combat as any).calculateDamage('attacker', 'target');
    expect(damage).toBe(Math.floor(15 * 0.84)); // 12
  });

  it('StatsComponent の attackPower が増加するとダメージも増加する', () => {
    // attackPower を 15 → 30 に増加
    const modifiers: StatModifier[] = [
      { stat: 'attackPower', op: 'add', value: 15, sourceId: 'item:power_chip' },
    ];

    // addSource の代わりに setBaseValue で直接変更（テスト用）
    stats.setBaseValue('attackPower', 30);

    jest.spyOn(Math, 'random').mockReturnValue(0.1); // factor = 0.84

    const damage = (combat as any).calculateDamage('attacker', 'target');
    expect(damage).toBe(Math.floor(30 * 0.84)); // 25
  });

  it('AttackPowerComponent のみを持つエンティティはフォールバックする', () => {
    // StatsComponent なし、AttackPowerComponent のみ
    const enemyAttacker = new Entity('enemy-attacker', 'enemy');
    enemyAttacker.addTag('enemy');
    enemyAttacker.addComponent(new TransformComponent(0, 0, 0));
    enemyAttacker.addComponent(new BlockingComponent());
    enemyAttacker.addComponent(new AttackPowerComponent(20));
    entitySystem.registerEntity(enemyAttacker);

    jest.spyOn(Math, 'random').mockReturnValue(0.1); // factor = 0.84

    const damage = (combat as any).calculateDamage('enemy-attacker', 'target');
    expect(damage).toBe(Math.floor(20 * 0.84)); // 16
  });
});
