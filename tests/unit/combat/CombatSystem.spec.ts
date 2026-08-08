import { CombatSystem } from '@/engine/combat/CombatSystem';
import { Engine } from '@/engine/Engine';
import { HealthComponent } from '@/engine/entity/components/Health';
import { MovementComponent } from '@/engine/entity/components/Movement';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';

describe('CombatSystem', () => {
  let events: EventSystem;
  let entities: EntitySystem;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    events = new EventSystem();
    entities = new EntitySystem();
    const engine = {
      getSystem: (name: string) => {
        if (name === 'event') return events;
        if (name === 'entity') return entities;
        return undefined;
      },
    } as unknown as Engine;
    await entities.initialize(engine);
    const combat = new CombatSystem();
    await combat.initialize(engine);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createActor = (
    id: string,
    tag: 'player' | 'enemy',
    x: number,
    y: number
  ): { entity: Entity; health: HealthComponent; movement: MovementComponent } => {
    const entity = new Entity(id, 'actor');
    const health = new HealthComponent(100, 100, 0, 0, 0, false);
    const movement = new MovementComponent();
    entity.addTag(tag);
    entity.addComponent(new TransformComponent(x, y, 0));
    entity.addComponent(health);
    entity.addComponent(movement);
    entities.registerEntity(entity);
    return { entity, health, movement };
  };

  const flushAsyncEvent = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it('プレイヤー正面の敵へ固定基礎値から計算したダメージを与える', async () => {
    const player = createActor('player', 'player', 1, 1);
    const enemy = createActor('enemy-1', 'enemy', 2, 1);
    player.movement.direction = 'right';
    const performed = jest.fn();
    const completed = jest.fn();
    const damageTaken = jest.fn();
    events.on('attack_performed', performed);
    events.on('turn_action_completed', completed);
    events.on('damage_taken', damageTaken);

    events.emit('player_attack_requested', { playerId: player.entity.id });
    await flushAsyncEvent();

    expect(enemy.health.currentHp).toBe(85);
    expect(damageTaken).toHaveBeenCalledWith({
      entityId: enemy.entity.id,
      damage: 15,
      attackerId: player.entity.id,
    });
    expect(performed).toHaveBeenCalledWith({ entityId: player.entity.id });
    expect(completed).toHaveBeenCalledWith({ entityId: player.entity.id });
  });

  it('空振りでも攻撃演出とターン完了を通知する', async () => {
    const player = createActor('player', 'player', 1, 1);
    player.movement.direction = 'left';
    const performed = jest.fn();
    const completed = jest.fn();
    const damageTaken = jest.fn();
    events.on('attack_performed', performed);
    events.on('turn_action_completed', completed);
    events.on('damage_taken', damageTaken);

    events.emit('player_attack_requested', { playerId: player.entity.id });
    await flushAsyncEvent();

    expect(damageTaken).not.toHaveBeenCalled();
    expect(performed).toHaveBeenCalledWith({ entityId: player.entity.id });
    expect(completed).toHaveBeenCalledWith({ entityId: player.entity.id });
  });

  it('敵の攻撃要求で対象へ敵用の基礎ダメージを与える', async () => {
    const enemy = createActor('enemy-1', 'enemy', 2, 1);
    const player = createActor('player', 'player', 1, 1);
    const performed = jest.fn();
    events.on('attack_performed', performed);

    events.emit('enemy_attack_requested', {
      enemyId: enemy.entity.id,
      targetId: player.entity.id,
    });
    await flushAsyncEvent();

    expect(player.health.currentHp).toBe(90);
    expect(performed).toHaveBeenCalledWith({ entityId: enemy.entity.id });
  });

  it('存在しない攻撃者・対象の要求は副作用なしで終了する', async () => {
    const performed = jest.fn();
    const completed = jest.fn();
    events.on('attack_performed', performed);
    events.on('turn_action_completed', completed);

    events.emit('player_attack_requested', { playerId: 'missing' });
    events.emit('enemy_attack_requested', { enemyId: 'missing', targetId: 'also-missing' });
    await flushAsyncEvent();

    expect(performed).not.toHaveBeenCalled();
    expect(completed).not.toHaveBeenCalled();
  });
});
