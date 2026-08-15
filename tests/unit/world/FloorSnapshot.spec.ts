import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { createFloorSnapshot } from '@/engine/world/FloorSnapshot';
import { RoomIdGenerator } from '@/engine/world/RoomId';
import {
  Corridor,
  CorridorGenerationMethod,
  Room,
  RoomType,
  TacticalElement,
  TacticalElementType,
  TileType,
} from '@/engine/types';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * FloorSnapshot と WorldSystem.registerFloorSnapshot の境界テスト
 * フロア単位で TileMap・Room・Corridor・TacticalElement が
 * 同一世代で登録・保持されることを検証する。
 */
describe('FloorSnapshot', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let world: WorldSystem;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();

    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    Engine.instance.registerSystem('event', events);
    Engine.instance.registerSystem('entity', entities);
    await entities.initialize(Engine.instance);

    const map = new TileMap(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.setTileAt(x, y, 0, TileType.TILE, true);
      }
    }
    world = new WorldSystem(map);
    Engine.instance.registerSystem('world', world);
    await world.initialize(Engine.instance);
  });

  afterEach(() => {
    Engine.instance.reset();
    jest.restoreAllMocks();
  });

  const sampleRooms = (): Room[] => {
    const gen = new RoomIdGenerator();
    const r0 = gen.next() as string;
    const r1 = gen.next() as string;
    return [
      { id: r0, x: 1, y: 1, width: 4, height: 4, type: RoomType.ENTRANCE },
      { id: r1, x: 6, y: 6, width: 3, height: 3, type: RoomType.EXIT },
    ];
  };

  const sampleCorridors = (): Corridor[] => {
    const rooms = sampleRooms();
    return [
      {
        startX: 4,
        startY: 3,
        endX: 6,
        endY: 7,
        width: 1,
        method: CorridorGenerationMethod.ASTAR,
        connectedRooms: [rooms[0].id, rooms[1].id],
      },
    ];
  };

  const sampleTacticalElements = (): TacticalElement[] => [
    {
      x: 3,
      y: 3,
      type: TacticalElementType.CHOKEPOINT,
      effect: { range: 1, bonus: 2, description: 'chokepoint' },
      accessibility: { energyCost: 1 },
    },
  ];

  it('createFloorSnapshot は省略した配列を空配列として構築する', () => {
    const map = new TileMap(5, 5);
    const snapshot = createFloorSnapshot(2, map);

    expect(snapshot.floor).toBe(2);
    expect(snapshot.tileMap).toBe(map);
    expect(snapshot.rooms).toEqual([]);
    expect(snapshot.corridors).toEqual([]);
    expect(snapshot.tacticalElements).toEqual([]);
  });

  it('createFloorSnapshot は入力配列をコピーして保持する', () => {
    const map = new TileMap(5, 5);
    const rooms = sampleRooms();
    const corridors = sampleCorridors();
    const elements = sampleTacticalElements();

    const snapshot = createFloorSnapshot(1, map, { rooms, corridors, tacticalElements: elements });

    // 入力配列を変更しても snapshot 内部に影響しない
    rooms.push({ id: 'room:extra', x: 99, y: 99, width: 1, height: 1, type: RoomType.NORMAL });
    corridors.length = 0;
    elements.length = 0;

    expect(snapshot.rooms).toHaveLength(2);
    expect(snapshot.corridors).toHaveLength(1);
    expect(snapshot.tacticalElements).toHaveLength(1);
  });

  it('registerFloorSnapshot は TileMap・Room・Corridor・TacticalElement を同一世代で登録する', () => {
    const map = new TileMap(20, 20);
    const snapshot = createFloorSnapshot(5, map, {
      rooms: sampleRooms(),
      corridors: sampleCorridors(),
      tacticalElements: sampleTacticalElements(),
    });

    world.registerFloorSnapshot(snapshot);

    expect(world.getCurrentFloor()).toBe(5);
    expect(world.getTileMap()).toBe(map);
    expect(world.getRooms()).toHaveLength(2);
    expect(world.getCorridors()).toHaveLength(1);
    expect(world.getTacticalElements()).toHaveLength(1);
    expect(world.getRoomsByFloor(5)).toHaveLength(2);
    expect(world.getCorridorsByFloor(5)).toHaveLength(1);
    expect(world.getTacticalElementsByFloor(5)).toHaveLength(1);
  });

  it('registerFloorSnapshot 後、getFloorSnapshot は同一世代のデータを返す', () => {
    const map = new TileMap(20, 20);
    const snapshot = createFloorSnapshot(3, map, {
      rooms: sampleRooms(),
      corridors: sampleCorridors(),
      tacticalElements: sampleTacticalElements(),
    });

    world.registerFloorSnapshot(snapshot);
    const restored = world.getFloorSnapshot(3);

    expect(restored).toBeDefined();
    expect(restored!.floor).toBe(3);
    expect(restored!.tileMap).toBe(map);
    expect(restored!.rooms).toHaveLength(2);
    expect(restored!.corridors).toHaveLength(1);
    expect(restored!.tacticalElements).toHaveLength(1);
  });

  it('getFloorSnapshot は未登録フロアに対して undefined を返す', () => {
    expect(world.getFloorSnapshot(99)).toBeUndefined();
  });

  it('registerFloorSnapshot の getter は内部配列のコピーを返す', () => {
    const map = new TileMap(20, 20);
    world.registerFloorSnapshot(
      createFloorSnapshot(1, map, {
        rooms: sampleRooms(),
        corridors: sampleCorridors(),
        tacticalElements: sampleTacticalElements(),
      })
    );

    const rooms = world.getRooms();
    const corridors = world.getCorridors();
    const elements = world.getTacticalElements();
    rooms.push({ id: 'room:extra', x: 99, y: 99, width: 1, height: 1, type: RoomType.NORMAL });
    corridors.length = 0;
    elements.length = 0;

    expect(world.getRooms()).toHaveLength(2);
    expect(world.getCorridors()).toHaveLength(1);
    expect(world.getTacticalElements()).toHaveLength(1);
  });

  it('同一フロア番号へ再登録すると戦術的要素も上書きされる', () => {
    const map1 = new TileMap(20, 20);
    world.registerFloorSnapshot(
      createFloorSnapshot(2, map1, {
        rooms: sampleRooms(),
        corridors: sampleCorridors(),
        tacticalElements: sampleTacticalElements(),
      })
    );
    expect(world.getTacticalElementsByFloor(2)).toHaveLength(1);

    const map2 = new TileMap(20, 20);
    world.registerFloorSnapshot(createFloorSnapshot(2, map2));
    expect(world.getTacticalElementsByFloor(2)).toEqual([]);
    expect(world.getRoomsByFloor(2)).toEqual([]);
  });

  it('フロア切替後も各階の戦術的要素が独立して保持される', async () => {
    const map2 = new TileMap(20, 20);
    world.registerFloorSnapshot(
      createFloorSnapshot(2, map2, { tacticalElements: sampleTacticalElements() })
    );

    const map3 = new TileMap(20, 20);
    world.registerFloorSnapshot(createFloorSnapshot(3, map3));

    // フロア2に切り替え
    world.setCurrentFloor(2);
    expect(world.getTacticalElements()).toHaveLength(1);

    // フロア3に切り替え
    world.setCurrentFloor(3);
    expect(world.getTacticalElements()).toEqual([]);

    // フロア2に戻っても戦術的要素が保持されている
    world.setCurrentFloor(2);
    expect(world.getTacticalElements()).toHaveLength(1);
  });

  it('旧 registerFloor API は互換アダプタとして動作し戦術的要素を空配列で登録する', () => {
    const map = new TileMap(20, 20);
    world.registerFloor(7, map, sampleRooms(), sampleCorridors());

    expect(world.getCurrentFloor()).toBe(7);
    expect(world.getRooms()).toHaveLength(2);
    expect(world.getCorridors()).toHaveLength(1);
    expect(world.getTacticalElements()).toEqual([]);
  });
});
