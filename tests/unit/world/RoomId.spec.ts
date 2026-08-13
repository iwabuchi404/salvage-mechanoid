import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { createFloorSnapshot } from '@/engine/world/FloorSnapshot';
import { createRoomId, roomToId, isRoomId, roomIdToCoords } from '@/engine/world/RoomId';
import { Room, RoomType, TileType } from '@/engine/types';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * RoomId 生成規則と WorldSystem の Room ID 付与の境界テスト
 */
describe('RoomId', () => {
  describe('RoomId helpers', () => {
    it('createRoomId は "x,y" 形式の文字列を返す', () => {
      expect(createRoomId(3, 5)).toBe('3,5');
      expect(createRoomId(0, 0)).toBe('0,0');
    });

    it('roomToId は Room の左上座標から RoomId を生成する', () => {
      const room: Room = { x: 7, y: 2, width: 4, height: 4, type: RoomType.NORMAL };
      expect(roomToId(room)).toBe('7,2');
    });

    it('isRoomId は有効な "x,y" 形式を判定する', () => {
      expect(isRoomId('3,5')).toBe(true);
      expect(isRoomId('0,0')).toBe(true);
      expect(isRoomId('10,20')).toBe(true);
    });

    it('isRoomId は無効な形式を弾く', () => {
      expect(isRoomId('abc')).toBe(false);
      expect(isRoomId('1,2,3')).toBe(false);
      expect(isRoomId('')).toBe(false);
      expect(isRoomId('-1,2')).toBe(false);
      expect(isRoomId('1,-2')).toBe(false);
      expect(isRoomId(123)).toBe(false);
      expect(isRoomId(null)).toBe(false);
    });

    it('roomIdToCoords は RoomId を座標へ戻す', () => {
      expect(roomIdToCoords(createRoomId(3, 5))).toEqual({ x: 3, y: 5 });
      expect(roomIdToCoords(createRoomId(0, 0))).toEqual({ x: 0, y: 0 });
    });

    it('同一座標からは同一 RoomId が生成される', () => {
      expect(createRoomId(1, 2)).toBe(createRoomId(1, 2));
    });

    it('異なる座標からは異なる RoomId が生成される', () => {
      expect(createRoomId(1, 2)).not.toBe(createRoomId(2, 1));
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

    it('registerFloorSnapshot は id 未設定の Room に RoomId を付与する', () => {
      const map = new TileMap(20, 20);
      const rooms: Room[] = [
        { x: 1, y: 1, width: 4, height: 4, type: RoomType.ENTRANCE },
        { x: 6, y: 6, width: 3, height: 3, type: RoomType.EXIT },
      ];

      world.registerFloorSnapshot(createFloorSnapshot(2, map, { rooms }));

      const registered = world.getRooms();
      expect(registered[0].id).toBe('1,1');
      expect(registered[1].id).toBe('6,6');
    });

    it('registerFloorSnapshot は既存の id を保持する', () => {
      const map = new TileMap(20, 20);
      const rooms: Room[] = [
        { id: 'custom-id', x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL },
      ];

      world.registerFloorSnapshot(createFloorSnapshot(2, map, { rooms }));

      expect(world.getRooms()[0].id).toBe('custom-id');
    });

    it('getRoomById は RoomId で Room を取得する', () => {
      const map = new TileMap(20, 20);
      const rooms: Room[] = [
        { x: 1, y: 1, width: 4, height: 4, type: RoomType.ENTRANCE },
        { x: 6, y: 6, width: 3, height: 3, type: RoomType.EXIT },
      ];

      world.registerFloorSnapshot(createFloorSnapshot(1, map, { rooms }));

      const room = world.getRoomById(createRoomId(6, 6));
      expect(room).toBeDefined();
      expect(room!.type).toBe(RoomType.EXIT);
    });

    it('getRoomById は未登録 ID に undefined を返す', () => {
      const map = new TileMap(20, 20);
      world.registerFloorSnapshot(createFloorSnapshot(1, map));

      expect(world.getRoomById(createRoomId(99, 99))).toBeUndefined();
    });

    it('getRoomByIdByFloor は指定フロアの Room を取得する', () => {
      const map1 = new TileMap(20, 20);
      const map2 = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map1, {
          rooms: [{ x: 1, y: 1, width: 4, height: 4, type: RoomType.ENTRANCE }],
        })
      );
      world.registerFloorSnapshot(
        createFloorSnapshot(2, map2, {
          rooms: [{ x: 5, y: 5, width: 4, height: 4, type: RoomType.EXIT }],
        })
      );

      // フロア1のまま、フロア2の Room を取得
      const room2 = world.getRoomByIdByFloor(2, createRoomId(5, 5));
      expect(room2).toBeDefined();
      expect(room2!.type).toBe(RoomType.EXIT);

      // フロア1の Room は取得できる
      const room1 = world.getRoomByIdByFloor(1, createRoomId(1, 1));
      expect(room1).toBeDefined();
      expect(room1!.type).toBe(RoomType.ENTRANCE);
    });

    it('RoomId は フロア切替後も安定して参照できる', () => {
      const map1 = new TileMap(20, 20);
      const map2 = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map1, {
          rooms: [{ x: 1, y: 1, width: 4, height: 4, type: RoomType.ENTRANCE }],
        })
      );
      world.registerFloorSnapshot(
        createFloorSnapshot(2, map2, {
          rooms: [{ x: 5, y: 5, width: 4, height: 4, type: RoomType.EXIT }],
        })
      );

      // フロア2に切り替え
      world.setCurrentFloor(2);
      expect(world.getRoomById(createRoomId(5, 5))).toBeDefined();

      // フロア1に戻っても RoomId で参照できる
      world.setCurrentFloor(1);
      expect(world.getRoomById(createRoomId(1, 1))).toBeDefined();
    });

    it('getRoomAtPosition は座標を含む Room を返す', () => {
      const map = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map, {
          rooms: [{ x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL }],
        })
      );

      // Room 矩形内の座標
      expect(world.getRoomAtPosition(1, 1)).toBeDefined();
      expect(world.getRoomAtPosition(4, 4)).toBeDefined();
      expect(world.getRoomAtPosition(2, 3)).toBeDefined();
    });

    it('getRoomAtPosition は Room 矩形外の座標に undefined を返す', () => {
      const map = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map, {
          rooms: [{ x: 1, y: 1, width: 4, height: 4, type: RoomType.NORMAL }],
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
      const map = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map, {
          rooms: [
            { x: 1, y: 1, width: 3, height: 3, type: RoomType.ENTRANCE },
            { x: 6, y: 6, width: 3, height: 3, type: RoomType.EXIT },
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
      const map1 = new TileMap(20, 20);
      const map2 = new TileMap(20, 20);
      world.registerFloorSnapshot(
        createFloorSnapshot(1, map1, {
          rooms: [{ x: 1, y: 1, width: 4, height: 4, type: RoomType.ENTRANCE }],
        })
      );
      world.registerFloorSnapshot(
        createFloorSnapshot(2, map2, {
          rooms: [{ x: 5, y: 5, width: 4, height: 4, type: RoomType.EXIT }],
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
