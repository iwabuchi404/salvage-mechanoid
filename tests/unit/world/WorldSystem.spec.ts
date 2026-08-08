import { Engine } from '@/engine/Engine';
import { HealthComponent } from '@/engine/entity/components/Health';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { TileType } from '@/engine/types';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';

describe('WorldSystem', () => {
  let map: TileMap;
  let events: EventSystem;
  let entities: EntitySystem;
  let world: WorldSystem;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    map = new TileMap(5, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        map.setTileAt(x, y, 0, TileType.TILE, true);
      }
    }
    events = new EventSystem();
    entities = new EntitySystem();
    world = new WorldSystem(map);
    const engine = {
      getSystem: (name: string) => {
        if (name === 'event') return events;
        if (name === 'entity') return entities;
        return undefined;
      },
    } as unknown as Engine;
    await entities.initialize(engine);
    await world.initialize(engine);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const addEntity = (id: string, x: number, y: number, ...tags: string[]): Entity => {
    const entity = new Entity(id, 'test');
    entity.addComponent(new TransformComponent(x, y, 0));
    tags.forEach((tag) => entity.addTag(tag));
    entities.registerEntity(entity);
    return entity;
  };

  it('地形と衝突エンティティの両方で通行可否を判定する', () => {
    map.setTileAt(0, 0, 0, TileType.MOUNTAIN, false);
    addEntity('blocker', 2, 2, 'enemy');

    expect(world.isWalkable(0, 0)).toBe(false);
    expect(world.isWalkable(2, 2)).toBe(false);
    expect(world.isWalkable(2, 2, 0, 'blocker')).toBe(true);
    expect(world.isWalkable(1, 1)).toBe(true);
  });

  it.each([['item'], ['event_object'], ['portal'], ['charger']])(
    '%sタグを持つエンティティは移動を妨げない',
    (tag) => {
      addEntity(tag, 1, 1, tag);

      expect(world.isPositionOccupied(1, 1)).toBe(false);
    }
  );

  it('位置にいるエンティティを丸めた座標で取得する', () => {
    const entity = addEntity('enemy', 1.4, 2.4, 'enemy');

    expect(world.getEntityAtPosition(1, 2)).toBe(entity);
    expect(world.getEntityAtPosition(4, 4)).toBeUndefined();
  });

  it('障害物を避ける経路を開始地点と終了地点を含めて返す', () => {
    addEntity('blocker', 1, 0, 'enemy');

    const path = world.findPath({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 });

    expect(path[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0, z: 0 });
    expect(path).not.toContainEqual({ x: 1, y: 0, z: 0 });
  });

  it('同一点はその地点だけを返し、最大距離外は経路を返さない', () => {
    const start = { x: 0, y: 0, z: 0 };

    expect(world.findPath(start, start)).toEqual([start]);
    expect(world.findPath(start, { x: 4, y: 4, z: 0 }, 3)).toEqual([]);
  });

  it('移動イベントでタイル効果を適用し、入場イベントを発行する', () => {
    const entity = addEntity('player', 2, 2, 'player');
    const health = new HealthComponent(100, 100, 0, 0, 0, false);
    const takeDamage = jest.spyOn(health, 'takeDamage');
    entity.addComponent(health);
    map.setTileAt(2, 2, 0, TileType.DAMAGE, true);
    const entered = jest.fn();
    events.on('tile_entered', entered);

    events.emit('entity_moved', { entityId: entity.id, position: { x: 2, y: 2, z: 0 } });

    expect(takeDamage).toHaveBeenCalledWith(5);
    expect(entered).toHaveBeenCalledWith({
      entityId: entity.id,
      tilePosition: { x: 2, y: 2, z: 0 },
      tileType: TileType.DAMAGE,
    });
  });
});
