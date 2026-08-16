import { Room, Corridor, TacticalElement } from '../types';
import { TileMap } from './TileMap';
import { Doorway, corridorsToDoorways, validateDoorways } from './Doorway';
import { RoomId } from './RoomId';

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
   * Room は生成時に RoomId が採番済みであることを前提とする。
   * Doorway が未指定の場合は corridors から導出する。
   * Doorway 検証を本番経路で実行し、不正な Doorway があれば警告を出力する（B3）。
   *
   * P1-fix: register() は登録と切替を同時に行う（旧仕様の互換性のため）。
   * フロア生成ハンドラーの実行中に getCurrentFloor() が移動先を返す
   * 副作用があるが、FloorManager はロールバック時に
   * setCurrentFloor(oldFloor) で復元するため、実用上は問題ない。
   * 将来的に登録と切替を完全に分離する場合は、呼び出し元が
   * 明示的に setCurrentFloor() を呼ぶ形へ移行する。
   */
  register(
    floor: number,
    tileMap: TileMap,
    rooms: readonly Room[],
    corridors: readonly Corridor[],
    tacticalElements: readonly TacticalElement[],
    doorways?: readonly Doorway[]
  ): void {
    const resolvedDoorways = doorways ? [...doorways] : corridorsToDoorways(corridors, rooms);

    // P2-fix: rooms と corridors があるのに doorways が0件の場合は
    // 無言の失敗の可能性が高いため警告を出力する
    if (rooms.length > 0 && corridors.length > 0 && resolvedDoorways.length === 0) {
      console.warn(
        `[FloorStore] Floor ${floor} has ${rooms.length} rooms and ${corridors.length} corridors ` +
          `but 0 doorways were derived. This may indicate a connectivity issue.`
      );
    }

    // Doorway 検証を本番経路で実行（B3）
    // 不正な Doorway があれば警告を出力するが、登録はブロックしない。
    // 通行可能性判定は TileMap 経由で行う。
    if (resolvedDoorways.length > 0 && rooms.length > 0) {
      const validationResult = validateDoorways(resolvedDoorways, rooms, (x, y) =>
        tileMap.isWalkable(x, y, 0)
      );
      if (!validationResult.valid) {
        for (const error of validationResult.errors) {
          console.warn(
            `[FloorStore] Doorway validation error on floor ${floor}: ` +
              `${error.kind} at doorway #${error.doorwayIndex}: ${error.message}`
          );
        }
      }
    }

    this.floorMaps.set(floor, tileMap);
    this.floorRooms.set(floor, [...rooms]);
    this.floorCorridors.set(floor, [...corridors]);
    this.floorTacticalElements.set(floor, [...tacticalElements]);
    this.floorDoorways.set(floor, resolvedDoorways);

    this.currentFloor = floor;
    this.currentTileMap = tileMap;
  }

  /**
   * 現在のフロアを切り替える。
   * P1-fix: 対象フロアが未登録の場合は拒否し、状態を一切更新しない。
   * 旧実装は未登録フロアでも currentFloor だけ更新し、currentTileMap は
   * 旧フロアのまま維持する仕様だったが、これにより getCurrentFloor() が 5 を
   * 返しながら getTileMap() は3階の地図、getRooms() は [] という
   * 不整合状態が作れる問題があった。
   * @returns 対象フロアが登録済みで切替に成功した場合 true、未登録の場合 false
   */
  setCurrentFloor(floor: number): boolean {
    const tileMap = this.floorMaps.get(floor);
    if (!tileMap) {
      console.warn(`[FloorStore] Cannot switch to unregistered floor ${floor}`);
      return false;
    }
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
