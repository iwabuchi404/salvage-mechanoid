import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { EventName } from '@/engine/types';

describe('EntitySystem', () => {
  let eventSystem: EventSystem;
  let entitySystem: EntitySystem;

  beforeEach(async () => {
    eventSystem = new EventSystem();
    entitySystem = new EntitySystem();
    const engine = {
      getSystem: (name: string) => (name === 'event' ? eventSystem : undefined),
    } as unknown as Engine;
    await entitySystem.initialize(engine);
  });

  it('登録したエンティティをID・type・tagで検索する', () => {
    const player = new Entity('player', 'actor');
    player.addTag('player');
    const enemy = new Entity('enemy-1', 'actor');
    enemy.addTag('enemy');

    entitySystem.registerEntity(player);
    entitySystem.registerEntity(enemy);

    expect(entitySystem.getEntity('player')).toBe(player);
    expect(entitySystem.getEntitiesByType('actor')).toEqual([player, enemy]);
    expect(entitySystem.getEntitiesByTag('enemy')).toEqual([enemy]);
    expect(entitySystem.getEntityCount()).toBe(2);
  });

  it('登録と削除のイベントを同じエンティティ参照で発行する', () => {
    const created = jest.fn();
    const destroyed = jest.fn();
    eventSystem.on(EventName.ENTITY_CREATED, created);
    eventSystem.on(EventName.ENTITY_DESTROYED, destroyed);
    const entity = new Entity('enemy-1', 'enemy');
    const destroy = jest.spyOn(entity, 'destroy');

    entitySystem.registerEntity(entity);
    expect(created).toHaveBeenCalledWith({ entity });

    expect(entitySystem.removeEntity(entity.id)).toBe(true);
    expect(destroyed).toHaveBeenCalledWith({ entity });
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(entitySystem.getEntity(entity.id)).toBeUndefined();
    expect(entitySystem.removeEntity(entity.id)).toBe(false);
  });

  it('アクティブなエンティティだけを更新する', () => {
    const active = new Entity('active', 'test');
    const inactive = new Entity('inactive', 'test');
    inactive.active = false;
    const activeUpdate = jest.spyOn(active, 'update');
    const inactiveUpdate = jest.spyOn(inactive, 'update');
    entitySystem.registerEntity(active);
    entitySystem.registerEntity(inactive);

    entitySystem.update(16);

    expect(activeUpdate).toHaveBeenCalledWith(16);
    expect(inactiveUpdate).not.toHaveBeenCalled();
  });

  it('clearで全エンティティを破棄して空にする', () => {
    const first = new Entity('first', 'test');
    const second = new Entity('second', 'test');
    const firstDestroy = jest.spyOn(first, 'destroy');
    const secondDestroy = jest.spyOn(second, 'destroy');
    entitySystem.registerEntity(first);
    entitySystem.registerEntity(second);

    entitySystem.clear();

    expect(firstDestroy).toHaveBeenCalledTimes(1);
    expect(secondDestroy).toHaveBeenCalledTimes(1);
    expect(entitySystem.getEntities()).toEqual([]);
  });
});
