import { Room, Corridor, TacticalElement } from '../types';
import { TileMap } from './TileMap';
import { Doorway, corridorsToDoorways } from './Doorway';
import { RoomId, roomToId } from './RoomId';

/**
 * FloorStore - WorldSystem 内部でフロアごとのデータを保持するモジュール。
 *
 * TileMap・Room・Corridor・TacticalElement・Doorway をフロア番号単位で
 * 同一世代で管理する。WorldSystem の公開 API はこのストアへ委譲する。
 *
 * このクラスは WorldSystem の実装詳細であり、外部へ直接公開しない。
 */
export class FloorStore {
  private floorMaps: Map<number, TileMap> = new Map();
  private floorRooms: Map<number, Room[]> = new Map();
  private floorCorridors: Map<number, Corridor[]> = new Map();
  private floorTacticalElements: Map<number, TacticalElement[]> = new Map();
  private floorDoorways: Map<number, Doorway[]> = new Map();

  private currentFloor = 1;
  private currentTileMap: TileMap;

  constructor(initialTileMap: TileMap) {
    this.currentTileMap = initialTileMap;
  }

  /**
   * 現在のフロア番号
   */
  getCurrentFloor(): number {
    return this.currentFloor;
  }

  /**
   * 現在の TileMap
   */
  getCurrentTileMap(): TileMap {
    return this.currentTileMap;
  }

  /**
   * 指定フロアの TileMap が登録済みか
   */
  hasFloor(floor: number): boolean {
    return this.floorMaps.has(floor);
  }

  /**
   * 指定フロアの TileMap を取得（未登録時 undefined）
   */
  getTileMapByFloor(floor: number): TileMap | undefined {
    return this.floorMaps.get(floor);
  }

  /**
   * フロアデータを登録し、現在のフロアを切り替える。
   * Room に id が未設定の場合は RoomId を付与する。
   * Doorway が未指定の場合は corridors から導出する。
   */
  register(
    floor: number,
    tileMap: TileMap,
    rooms: readonly Room[],
    corridors: readonly Corridor[],
    tacticalElements: readonly TacticalElement[],
    doorways?: readonly Doorway[]
  ): void {
    const roomsWithId = rooms.map((room) =>
      room.id ? room : { ...room, id: roomToId(room) as string }
    );
    const resolvedDoorways = doorways ? [...doorways] : corridorsToDoorways(corridors, roomsWithId);

    this.floorMaps.set(floor, tileMap);
    this.floorRooms.set(floor, roomsWithId);
    this.floorCorridors.set(floor, [...corridors]);
    this.floorTacticalElements.set(floor, [...tacticalElements]);
    this.floorDoorways.set(floor, resolvedDoorways);

    this.currentFloor = floor;
    this.currentTileMap = tileMap;
  }

  /**
   * 現在のフロアを切り替える。
   * 対象フロアが未登録の場合は何もしない。
   * @returns 切り替えに成功した場合 true
   */
  setCurrentFloor(floor: number): boolean {
    const tileMap = this.floorMaps.get(floor);
    if (!tileMap) return false;
    this.currentFloor = floor;
    this.currentTileMap = tileMap;
    return true;
  }

  // ===== Room =====

  getRooms(): Room[] {
    return this.copyRooms(this.floorRooms.get(this.currentFloor));
  }

  getRoomsByFloor(floor: number): Room[] {
    return this.copyRooms(this.floorRooms.get(floor));
  }

  getRoomById(roomId: RoomId): Room | undefined {
    return this.findRoom(this.floorRooms.get(this.currentFloor), roomId);
  }

  getRoomByIdByFloor(floor: number, roomId: RoomId): Room | undefined {
    return this.findRoom(this.floorRooms.get(floor), roomId);
  }

  /**
   * 指定タイル座標を含む現在フロアの Room を取得する。
   * タイルが Room 矩形外（通路やマップ外）の場合は undefined を返す。
   */
  getRoomAtPosition(x: number, y: number): Room | undefined {
    return this.findRoomAt(this.floorRooms.get(this.currentFloor), x, y);
  }

  /**
   * 指定フロアの指定タイル座標を含む Room を取得する。
   */
  getRoomAtPositionByFloor(floor: number, x: number, y: number): Room | undefined {
    return this.findRoomAt(this.floorRooms.get(floor), x, y);
  }

  setRooms(floor: number, rooms: Room[]): void {
    this.floorRooms.set(floor, [...rooms]);
  }

  // ===== Corridor =====

  getCorridors(): Corridor[] {
    return this.copyCorridors(this.floorCorridors.get(this.currentFloor));
  }

  getCorridorsByFloor(floor: number): Corridor[] {
    return this.copyCorridors(this.floorCorridors.get(floor));
  }

  setCorridors(floor: number, corridors: Corridor[]): void {
    this.floorCorridors.set(floor, [...corridors]);
  }

  // ===== TacticalElement =====

  getTacticalElements(): TacticalElement[] {
    return this.copyTacticalElements(this.floorTacticalElements.get(this.currentFloor));
  }

  getTacticalElementsByFloor(floor: number): TacticalElement[] {
    return this.copyTacticalElements(this.floorTacticalElements.get(floor));
  }

  setTacticalElements(floor: number, elements: TacticalElement[]): void {
    this.floorTacticalElements.set(floor, [...elements]);
  }

  // ===== Doorway =====

  getDoorways(): Doorway[] {
    return this.copyDoorways(this.floorDoorways.get(this.currentFloor));
  }

  getDoorwaysByFloor(floor: number): Doorway[] {
    return this.copyDoorways(this.floorDoorways.get(floor));
  }

  // ===== private helpers =====

  private copyRooms(rooms: Room[] | undefined): Room[] {
    return rooms ? [...rooms] : [];
  }

  private copyCorridors(corridors: Corridor[] | undefined): Corridor[] {
    return corridors ? [...corridors] : [];
  }

  private copyTacticalElements(elements: TacticalElement[] | undefined): TacticalElement[] {
    return elements ? [...elements] : [];
  }

  private copyDoorways(doorways: Doorway[] | undefined): Doorway[] {
    return doorways ? [...doorways] : [];
  }

  private findRoom(rooms: Room[] | undefined, roomId: RoomId): Room | undefined {
    if (!rooms) return undefined;
    return rooms.find((room) => room.id === roomId);
  }

  private findRoomAt(rooms: Room[] | undefined, x: number, y: number): Room | undefined {
    if (!rooms) return undefined;
    return rooms.find(
      (room) => x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height
    );
  }
}
