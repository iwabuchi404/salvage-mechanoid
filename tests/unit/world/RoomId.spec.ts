import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { createFloorSnapshot } from '@/engine/world/FloorSnapshot';
import { RoomIdGenerator, roomToId, isRoomId } from '@/engine/world/RoomId';
import { Room, RoomType, TileType } from '@/engine/types';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * RoomId 生成規則と WorldSystem の Room ID 参照の境界テスト
 */
describe('RoomId', () => {
  describe('RoomId helpers', () => {
    it('RoomIdGenerator.next は "room:<n>" 形式の文字列を返す', () => {
      const gen = new RoomIdGenerator();
      expect(gen.next()).toBe('room:0');
      expect(gen.next()).toBe('room:1');
    });

    it('roomToId は Room.id から RoomId を取得する', () => {
      const gen = new RoomIdGenerator();
      const id = gen.next();
      const room: Room = {
        id: id as string,
        x: 7,
        y: 2,
        width: 4,
        height: 4,
        type: RoomType.NORMAL,
      };
      expect(roomToId(room)).toBe(id);
    });

    it('roomToId は id 未設定の Room に例外を投げる', () => {
      const room = { x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL } as Room;
      expect(() => roomToId(room)).toThrow();
    });

    it('isRoomId は "room:" プレフィックスの文字列を判定する', () => {
      expect(isRoomId('room:0')).toBe(true);
      expect(isRoomId('room:123')).toBe(true);
    });

    it('isRoomId は tileKey ("x,y") と衝突しない', () => {
      expect(isRoomId('3,5')).toBe(false);
      expect(isRoomId('0,0')).toBe(false);
    });

    it('isRoomId は無効な形式を弾く', () => {
      expect(isRoomId('abc')).toBe(false);
      expect(isRoomId('')).toBe(false);
      expect(isRoomId(123)).toBe(false);
      expect(isRoomId(null)).toBe(false);
    });

    it('RoomIdGenerator はインスタンスごとに独立して採番する', () => {
      const gen1 = new RoomIdGenerator();
      const gen2 = new RoomIdGenerator();
      expect(gen1.next()).toBe('room:0');
      expect(gen2.next()).toBe('room:0');
      expect(gen1.next()).toBe('room:1');
    });
  });

  describe('WorldSystem Room ID assignment', () => {
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

    /** テスト用 Room を作成するヘルパ */
    const makeRoom = (
      gen: RoomIdGenerator,
      x: number,
      y: number,
      width: number,
      height: number,
      type: RoomType = RoomType.NORMAL
    ): Room => ({
      id: gen.next() as string,
      x,
      y,
      width,
      height,
      type,
    });

    it('registerFloorSnapshot は Room の不透明 ID を保持する', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(20, 20);
      const rooms: Room[] = [
        makeRoom(gen, 1, 1, 4, 4, RoomType.ENTRANCE),
        makeRoom(gen, 6, 6, 3, 3, RoomType.EXIT),
      ];

      world.registerFloorSnapshot(createFloorSnapshot(2, map, { rooms }));

      const registered = world.getRooms();
      expect(registered[0].id).toBe(rooms[0].id);
      expect(registered[1].id).toBe(rooms[1].id);
    });

    it('registerFloorSnapshot は既存の id を保持する', () => {
      const map = new TileMap(20, 20);
      const rooms: Room[] = [
        { id: 'room:custom', x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL },
      ];

      world.registerFloorSnapshot(createFloorSnapshot(2, map, { rooms }));

      expect(world.getRooms()[0].id).toBe('room:custom');
    });

    it('getRoomById は RoomId で Room を取得する', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(20, 20);
      const rooms: Room[] = [
        makeRoom(gen, 1, 1, 4, 4, RoomType.ENTRANCE),
        makeRoom(gen, 6, 6, 3, 3, RoomType.EXIT),
      ];

      world.registerFloorSnapshot(createFloorSnapshot(1, map, { rooms }));

      const room = world.getRoomById(rooms[1].id as any);
      expect(room).toBeDefined();
      expect(room!.type).toBe(RoomType.EXIT);
    });

    it('getRoomById は未登録 ID に undefined を返す', () => {
      const map = new TileMap(20, 20);
      world.registerFloorSnapshot(createFloorSnapshot(1, map));

      expect(world.getRoomById('room:999' as any)).toBeUndefined();
    });

    it('getRoomByIdByFloor は指定フロアの Room を取得する', () => {
      const gen1 = new RoomIdGenerator();
      const gen2 = new RoomIdGenerator();
      const map1 = new TileMap(20, 20);
      const map2 = new TileMap(20, 20);
      const room1 = makeRoom(gen1, 1, 1, 4, 4, RoomType.ENTRANCE);
      const room2 = makeRoom(gen2, 5, 5, 4, 4, RoomType.EXIT);
      world.registerFloorSnapshot(createFloorSnapshot(1, map1, { rooms: [room1] }));
      world.registerFloorSnapshot(createFloorSnapshot(2, map2, { rooms: [room2] }));

      // フロア1のまま、フロア2の Room を取得
      const room2Result = world.getRoomByIdByFloor(2, room2.id as any);
      expect(room2Result).toBeDefined();
      expect(room2Result!.type).toBe(RoomType.EXIT);

      // フロア1の Room は取得できる
      const room1Result = world.getRoomByIdByFloor(1, room1.id as any);
      expect(room1Result).toBeDefined();
      expect(room1Result!.type).toBe(RoomType.ENTRANCE);
    });

    it('RoomId は フロア切替後も安定して参照できる', () => {
      const gen1 = new RoomIdGenerator();
      const gen2 = new RoomIdGenerator();
      const map1 = new TileMap(20, 20);
      const map2 = new TileMap(20, 20);
      const room1 = makeRoom(gen1, 1, 1, 4, 4, RoomType.ENTRANCE);
      const room2 = makeRoom(gen2, 5, 5, 4, 4, RoomType.EXIT);
      world.registerFloorSnapshot(createFloorSnapshot(1, map1, { rooms: [room1] }));
      world.registerFloorSnapshot(createFloorSnapshot(2, map2, { rooms: [room2] }));

      // フロア2に切り替え
      world.setCurrentFloor(2);
      expect(world.getRoomById(room2.id as any)).toBeDefined();

      // フロア1に戻っても RoomId で参照できる
      world.setCurrentFloor(1);
      expect(world.getRoomById(room1.id as any)).toBeDefined();
    });

    it('getRoomAtPosition は座標を含む Room を返す', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map, {
          rooms: [makeRoom(gen, 1, 1, 4, 4)],
        })
      );

      // Room 矩形内の座標
      expect(world.getRoomAtPosition(1, 1)).toBeDefined();
      expect(world.getRoomAtPosition(4, 4)).toBeDefined();
      expect(world.getRoomAtPosition(2, 3)).toBeDefined();
    });

    it('getRoomAtPosition は Room 矩形外の座標に undefined を返す', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map, {
          rooms: [makeRoom(gen, 1, 1, 4, 4)],
        })
      );

      // 幅4なので x=5 は矩形外
      expect(world.getRoomAtPosition(5, 1)).toBeUndefined();
      expect(world.getRoomAtPosition(1, 5)).toBeUndefined();
      expect(world.getRoomAtPosition(10, 10)).toBeUndefined();
    });

    it('getRoomAtPosition は Room 未登録フロアで undefined を返す', () => {
      const map = new TileMap(20, 20);
      world.registerFloorSnapshot(createFloorSnapshot(1, map));

      expect(world.getRoomAtPosition(5, 5)).toBeUndefined();
    });

    it('getRoomAtPosition は複数 Room から該当座標を含むものを返す', () => {
      const gen = new RoomIdGenerator();
      const map = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map, {
          rooms: [
            makeRoom(gen, 1, 1, 3, 3, RoomType.ENTRANCE),
            makeRoom(gen, 6, 6, 3, 3, RoomType.EXIT),
          ],
        })
      );

      const room1 = world.getRoomAtPosition(2, 2);
      expect(room1).toBeDefined();
      expect(room1!.type).toBe(RoomType.ENTRANCE);

      const room2 = world.getRoomAtPosition(7, 7);
      expect(room2).toBeDefined();
      expect(room2!.type).toBe(RoomType.EXIT);
    });

    it('getRoomAtPositionByFloor は指定フロアの Room を返す', () => {
      const gen1 = new RoomIdGenerator();
      const gen2 = new RoomIdGenerator();
      const map1 = new TileMap(20, 20);
      const map2 = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map1, {
          rooms: [makeRoom(gen1, 1, 1, 4, 4, RoomType.ENTRANCE)],
        })
      );
      world.registerFloorSnapshot(
        createFloorSnapshot(2, map2, {
          rooms: [makeRoom(gen2, 5, 5, 4, 4, RoomType.EXIT)],
        })
      );

      // フロア1のまま、フロア2の Room を位置で取得
      const room2 = world.getRoomAtPositionByFloor(2, 6, 6);
      expect(room2).toBeDefined();
      expect(room2!.type).toBe(RoomType.EXIT);

      // フロア1の Room も位置で取得
      const room1 = world.getRoomAtPositionByFloor(1, 2, 2);
      expect(room1).toBeDefined();
      expect(room1!.type).toBe(RoomType.ENTRANCE);
    });
  });
});
