import { StatsComponent } from '@/engine/entity/components/Stats';
import { HealthComponent } from '@/engine/entity/components/Health';
import { EnergyComponent } from '@/engine/entity/components/Energy';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { BlockingComponent } from '@/engine/entity/components/Blocking';
import { MovementComponent } from '@/engine/entity/components/Movement';
import { EffectiveStats } from '@/engine/entity/stats/StatTypes';
import { Player } from '@/engine/entity/Player';
import { PlayerInitialConfig } from '@/engine/entity/PlayerInitialConfig';
import { Entity } from '@/engine/entity/Entity';
import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import {
  ActionExecutor,
  createMoveAction,
  createAttackAction,
  createWaitAction,
} from '@/engine/turn/ActionExecutor';

/**
 * BU-3 段階3: ActionExecutor のテスト
 *
 * エネルギー消費が Player から ActionExecutor へ移ったことを検証する。
 */
describe('BU-3 段階3: ActionExecutor', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let player: Player;
  let executor: ActionExecutor;
  let energy: EnergyComponent;

  const config: PlayerInitialConfig = {
    maxHp: 100,
    hp: 100,
    maxEnergy: 100,
    energy: 50,
    defense: 5,
    attackPower: 15,
    viewRadius: 4,
    level: 1,
  };

  const baseStats: EffectiveStats = {
    maxHp: 100,
    maxEnergy: 100,
    defense: 5,
    attackPower: 15,
    viewRadius: 4,
    moveSpeed: 4,
    carryCapacity: 10,
    level: 1,
  };

  beforeEach(async () => {
    events = new EventSystem();
    entities = new EntitySystem();

    jest.spyOn(Engine, 'instance', 'get').mockReturnValue({
      getSystem: jest.fn((key: string) => {
        if (key === 'event') return events;
        if (key === 'entity') return entities;
        return undefined;
      }),
    } as any);

    player = new Player('player', { x: 5, y: 5, z: 0 }, config);
    // StatsComponent と EnergyComponent は Player コンストラクタで追加済み
    await player.initialize();
    entities.registerEntity(player);

    energy = player.getComponent<EnergyComponent>('energy')!;

    executor = new ActionExecutor();
    executor.initialize();

    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('移動 Action でゲームエネルギーを 1 消費する', async () => {
    const before = energy.currentEnergy;
    expect(before).toBe(50);

    const result = await executor.execute(createMoveAction('player', 'up'));

    // 移動先が壁かもしれないので success は問わないが、エネルギー消費は発生する
    expect(energy.currentEnergy).toBe(before - 1);
  });

  it('攻撃 Action でゲームエネルギーを 2 消費する', async () => {
    const before = energy.currentEnergy;

    await executor.execute(createAttackAction('player'));

    expect(energy.currentEnergy).toBe(before - 2);
  });

  it('待機 Action はエネルギーを消費しない', async () => {
    const before = energy.currentEnergy;

    const result = await executor.execute(createWaitAction('player'));

    expect(result.success).toBe(true);
    expect(energy.currentEnergy).toBe(before);
  });

  it('エネルギー不足時は移動を拒否する', async () => {
    // エネルギーを 0 にする
    energy.consume(energy.currentEnergy);
    expect(energy.currentEnergy).toBe(0);

    const result = await executor.execute(createMoveAction('player', 'up'));

    expect(result.success).toBe(false);
    expect(result.reason).toBe('insufficient_energy');
    expect(energy.currentEnergy).toBe(0);
  });

  it('エネルギー不足時は攻撃を拒否する', async () => {
    // エネルギーを 1 にする（攻撃には 2 必要）
    energy.consume(energy.currentEnergy - 1);
    expect(energy.currentEnergy).toBe(1);

    const result = await executor.execute(createAttackAction('player'));

    expect(result.success).toBe(false);
    expect(result.reason).toBe('insufficient_energy');
    expect(energy.currentEnergy).toBe(1);
  });

  it('存在しないアクターへの行動は失敗する', async () => {
    const result = await executor.execute(createMoveAction('nonexistent', 'up'));

    expect(result.success).toBe(false);
    expect(result.reason).toBe('actor_not_found');
  });
});
