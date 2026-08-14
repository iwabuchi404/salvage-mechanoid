import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { EventSystem } from '@/engine/events/EventSystem';
import { FOVSystem } from '@/engine/fov/FOVSystem';
import { TileType } from '@/engine/types';
import { createFloorSnapshot } from '@/engine/world/FloorSnapshot';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';

describe('FOVSystem', () => {
  let engine: Engine;
  let events: EventSystem;
  let entities: EntitySystem;
  let world: WorldSystem;
  let fov: FOVSystem;
  let playerTransform: TransformComponent;

  const makeFilledMap = (): TileMap => {
    const map = new TileMap(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        map.setTileAt(x, y, 0, TileType.TILE, true);
      }
    }
    return map;
  };

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();

    engine = Engine.instance;
    engine.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    world = new WorldSystem(makeFilledMap());
    fov = new FOVSystem();

    engine.registerSystem('event', events);
    engine.registerSystem('entity', entities);
    engine.registerSystem('world', world);
    engine.registerSystem('fov', fov);
    await engine.initialize();

    const player = new Entity('player', 'player') as Entity & { viewRadius: number };
    Object.defineProperty(player, 'viewRadius', { value: 4 });
    player.addTag('player');
    playerTransform = new TransformComponent(5, 5, 0);
    player.addComponent(playerTransform);
    entities.registerEntity(player);
  });

  afterEach(() => {
    engine.reset();
    jest.restoreAllMocks();
  });

  it('フロア切替後は同じ座標でも新しいフロアの可視性を再通知する', () => {
    const tileChanges: Array<{ x: number; y: number; visible: boolean }> = [];
    events.on('tile_visibility_changed', (change) => tileChanges.push(change));

    fov.calculateInitialFOV();
    expect(
      tileChanges.filter((change) => change.x === 5 && change.y === 5 && change.visible)
    ).toHaveLength(1);

    world.registerFloorSnapshot(createFloorSnapshot(2, makeFilledMap()));
    events.emit('floor_changed', { floor: 2 });

    expect(
      tileChanges.filter((change) => change.x === 5 && change.y === 5 && change.visible)
    ).toHaveLength(2);
  });

  it('探索済みタイルをフロアごとに分離して保持する', () => {
    fov.calculateInitialFOV();
    expect(fov.isTileExplored(5, 8)).toBe(true);

    world.registerFloorSnapshot(createFloorSnapshot(2, makeFilledMap()));
    playerTransform.setPosition(10, 10, 0);
    events.emit('floor_changed', { floor: 2 });
    expect(fov.isTileExplored(5, 8)).toBe(false);

    world.setCurrentFloor(1);
    playerTransform.setPosition(5, 5, 0);
    events.emit('floor_changed', { floor: 1 });
    expect(fov.isTileExplored(5, 8)).toBe(true);
  });

  it('destroy で追加したイベント購読を解除する', () => {
    expect(events.getListenerCount('floor_changed')).toBe(1);
    expect(events.getListenerCount('move_completed')).toBe(1);
    expect(events.getListenerCount('fov_update_requested')).toBe(1);

    fov.destroy();

    expect(events.getListenerCount('floor_changed')).toBe(0);
    expect(events.getListenerCount('move_completed')).toBe(0);
    expect(events.getListenerCount('fov_update_requested')).toBe(0);
  });
});
