import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { EventName } from '@/engine/types';
import { TransformComponent } from '@/engine/entity/components/Transform';

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

  // ===== D1: 位置インデックス =====

  describe('位置インデックス (D1)', () => {
    it('登録時に TransformComponent の位置からインデックスへ追加される', () => {
      const entity = new Entity('entity-1', 'actor');
      entity.addComponent(new TransformComponent(3, 5, 0));

      entitySystem.registerEntity(entity);

      const found = entitySystem.getEntityAtPosition(3, 5, 0);
      expect(found).toBe(entity);
    });

    it('未登録位置には undefined を返す', () => {
      const entity = new Entity('entity-1', 'actor');
      entity.addComponent(new TransformComponent(3, 5, 0));

      entitySystem.registerEntity(entity);

      expect(entitySystem.getEntityAtPosition(99, 99, 0)).toBeUndefined();
    });

    it('TransformComponent 未保持のエンティティはインデックスへ追加されない', () => {
      const entity = new Entity('entity-1', 'actor');

      entitySystem.registerEntity(entity);

      expect(entitySystem.getEntityAtPosition(0, 0, 0)).toBeUndefined();
    });

    it('removeEntity で位置インデックスからも削除される', () => {
      const entity = new Entity('entity-1', 'actor');
      entity.addComponent(new TransformComponent(3, 5, 0));

      entitySystem.registerEntity(entity);
      expect(entitySystem.getEntityAtPosition(3, 5, 0)).toBe(entity);

      entitySystem.removeEntity('entity-1');
      expect(entitySystem.getEntityAtPosition(3, 5, 0)).toBeUndefined();
    });

    it('updateEntityPosition で移動後にインデックスが更新される', () => {
      const entity = new Entity('entity-1', 'actor');
      entity.addComponent(new TransformComponent(3, 5, 0));

      entitySystem.registerEntity(entity);

      const transform = entity.getComponent<TransformComponent>('transform')!;
      const oldPos = { ...transform.position };
      transform.setPosition(7, 8, 0);
      entitySystem.updateEntityPosition(entity, oldPos);

      expect(entitySystem.getEntityAtPosition(3, 5, 0)).toBeUndefined();
      expect(entitySystem.getEntityAtPosition(7, 8, 0)).toBe(entity);
    });

    it('ENTITY_MOVED イベントで位置インデックスが自動更新される', () => {
      const entity = new Entity('entity-1', 'actor');
      entity.addComponent(new TransformComponent(3, 5, 0));

      entitySystem.registerEntity(entity);

      // 実運用と同じ順序: setPosition → ENTITY_MOVED イベント発行
      const transform = entity.getComponent<TransformComponent>('transform')!;
      transform.setPosition(10, 12, 0);

      eventSystem.emit(EventName.ENTITY_MOVED, {
        entityId: 'entity-1',
        from: { x: 3, y: 5, z: 0 },
        to: { x: 10, y: 12, z: 0 },
      });

      expect(entitySystem.getEntityAtPosition(3, 5, 0)).toBeUndefined();
      expect(entitySystem.getEntityAtPosition(10, 12, 0)).toBe(entity);
    });

    it('clear で位置インデックスもクリアされる', () => {
      const entity = new Entity('entity-1', 'actor');
      entity.addComponent(new TransformComponent(3, 5, 0));

      entitySystem.registerEntity(entity);
      entitySystem.clear();

      expect(entitySystem.getEntityAtPosition(3, 5, 0)).toBeUndefined();
    });

    it('複数エンティティが同位置に存在できる', () => {
      const entity1 = new Entity('entity-1', 'actor');
      entity1.addComponent(new TransformComponent(3, 5, 0));
      const entity2 = new Entity('entity-2', 'item');
      entity2.addComponent(new TransformComponent(3, 5, 0));

      entitySystem.registerEntity(entity1);
      entitySystem.registerEntity(entity2);

      const entities = entitySystem.getEntitiesAtPosition(3, 5, 0);
      expect(entities).toHaveLength(2);
      expect(entities).toContain(entity1);
      expect(entities).toContain(entity2);
    });
  });
});
