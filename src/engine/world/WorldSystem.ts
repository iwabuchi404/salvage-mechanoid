import { System } from '../System';
import { Engine } from '../Engine';
import { TileMap } from './TileMap';
import { Tile } from './Tile';
import { Vector3, TileType, EventName, Room, Corridor, TacticalElement } from '../types';
import { EventSystem } from '../events/EventSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { Entity } from '../entity/Entity';
import { TransformComponent } from '../entity/components/Transform';
import { BlockingComponent } from '../entity/components/Blocking';
import { CoordinateSystem } from '../graphics/CoordinateSystem';
import { FloorSnapshot, createFloorSnapshot } from './FloorSnapshot';
import { RoomId } from './RoomId';
import { Doorway } from './Doorway';
import { FloorStore } from './FloorStore';
import { PathfindingService } from './PathfindingService';

/**
 * WorldSystem - ゲーム世界と地形を管理するシステム
 * タイルマップ、コリジョン検出、環境効果などを扱う
 *
 * フロアデータの保持は FloorStore、経路探索は PathfindingService へ委譲する。
 * WorldSystem 自体はイベント処理、タイル効果、衝突判定、公開 API の調整を担当する。
 */
export class WorldSystem implements System {
  // エンジンへの参照
  private engine: Engine | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  // エンティティシステムへの参照
  private entitySystem: EntitySystem | null = null;

  // 座標変換システム
  private coordinateSystem: CoordinateSystem;

  // フロアデータの保持（内部モジュール）
  private floorStore: FloorStore;

  // 経路探索（内部モジュール）
  private pathfinding: PathfindingService;

  /**
   * コンストラクタ
   * @param tileMap 初期タイルマップ
   */
  constructor(tileMap: TileMap) {
    this.coordinateSystem = new CoordinateSystem(160, 120); // 仮のタイルサイズ
    this.floorStore = new FloorStore(tileMap);
    // 初期フロア(1)として空の Room/Corridor/TacticalElement で登録
    this.floorStore.register(1, tileMap, [], [], []);
    // 経路探索サービスは isWalkable を注入して構築
    this.pathfinding = new PathfindingService(this.coordinateSystem, (x, y, z, excludeEntityId) =>
      this.isWalkable(x, y, z, excludeEntityId)
    );

    console.log('WorldSystem created');
  }

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;

    // 依存システムを取得
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;

    if (!this.eventSystem) {
      console.warn('EventSystem not found, world events will not be processed');
    }

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('WorldSystem initialized');
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) return;

    // エンティティ移動イベント
    this.eventSystem.on(EventName.ENTITY_MOVED, (data) => {
      this.onEntityMoved(data);
    });

    // タイル変更イベント
    this.eventSystem.on('tile_changed', (data) => {
      this.onTileChanged(data);
    });
  }

  /**
   * エンティティ移動イベントハンドラ
   * @param data イベントデータ
   */
  private onEntityMoved(data: {
    entityId: string;
    from: Vector3;
    to: Vector3;
    position: Vector3;
  }): void {
    if (!this.entitySystem) return;

    // エンティティを取得
    const entity = this.entitySystem.getEntity(data.entityId);
    if (!entity) return;

    // 現在の位置のタイルを取得
    const tile = this.floorStore
      .getCurrentTileMap()
      .getTile(data.position.x, data.position.y, data.position.z);
    if (!tile) return;

    // タイルの効果を適用
    this.applyTileEffect(entity, tile);

    // タイルイベントの発行
    if (this.eventSystem) {
      this.eventSystem.emit('tile_entered', {
        entityId: data.entityId,
        tilePosition: data.position,
        tileType: tile.type,
      });
    }
  }

  /**
   * タイル変更イベントハンドラ
   * @param data イベントデータ
   */
  private onTileChanged(data: { position: Vector3; type: TileType }): void {
    // 必要に応じて特殊効果を発動
    // 例: 水タイルが増えると周辺タイルも水に変わる可能性がある、など
  }

  /**
   * タイルの効果をエンティティに適用
   * @param entity 対象エンティティ
   * @param tile タイル
   */
  private applyTileEffect(entity: Entity, tile: Tile): void {
    switch (tile.type) {
      case TileType.WATER:
        // 水タイルの効果（例：移動速度低下）
        this.applySlowEffect(entity);
        break;

      case TileType.DAMAGE:
        // ダメージタイルの効果
        this.applyDamageEffect(entity, 5);
        break;

      case TileType.HEAL:
        // 回復タイルの効果
        this.applyHealEffect(entity, 10);
        break;

      case TileType.PORTAL:
        // ポータルタイルの効果
        this.notifyPortalDiscovered(entity);
        break;

      // 必要に応じて他のタイプも追加
    }

    // タイルのカスタムプロパティに基づく追加効果
    if (tile.properties) {
      if (tile.properties.damage) {
        this.applyDamageEffect(entity, tile.properties.damage);
      }

      if (tile.properties.heal) {
        this.applyHealEffect(entity, tile.properties.heal);
      }

      if (tile.properties.speed) {
        const movement = entity.getComponent<any>('movement');
        if (movement) {
          // 一時的な速度変更
          const originalSpeed = movement.speed;
          movement.speed += tile.properties.speed;

          // 数秒後に元に戻す
          setTimeout(() => {
            movement.speed = originalSpeed;
          }, 3000);
        }
      }
    }
  }

  /**
   * 減速効果を適用
   * @param entity 対象エンティティ
   */
  private applySlowEffect(entity: Entity): void {
    // 移動コンポーネントがあれば処理
    const movement = entity.getComponent<any>('movement');
    if (movement) {
      // 一時的な速度低下
      const originalSpeed = movement.speed;
      movement.speed *= 0.7; // 30%減速

      // 数秒後に元に戻す
      setTimeout(() => {
        movement.speed = originalSpeed;
      }, 1000);
    }
  }

  /**
   * ダメージ効果を適用
   * @param entity 対象エンティティ
   * @param amount ダメージ量
   */
  private applyDamageEffect(entity: Entity, amount: number): void {
    // 体力コンポーネントがあれば処理
    const health = entity.getComponent<any>('health');
    if (health && typeof health.takeDamage === 'function') {
      health.takeDamage(amount);
    }
  }

  /**
   * 回復効果を適用
   * @param entity 対象エンティティ
   * @param amount 回復量
   */
  private applyHealEffect(entity: Entity, amount: number): void {
    // 体力コンポーネントがあれば処理
    const health = entity.getComponent<any>('health');
    if (health && typeof health.heal === 'function') {
      health.heal(amount);
    }
  }

  /**
   * ポータル発見を通知
   * @param entity 対象エンティティ
   */
  private notifyPortalDiscovered(entity: Entity): void {
    // プレイヤーの場合のみポータル発見イベントを発行
    if (entity.hasTag('player') && this.eventSystem) {
      this.eventSystem.emit('portal_discovered', {
        entityId: entity.id,
        currentFloor: this.floorStore.getCurrentFloor(),
      });
    }
  }

  /**
   * 指定位置が通行可能かどうかをチェック
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   * @param excludeEntityId 除外するエンティティID（自分自身を除外する場合など）
   * @returns 通行可能な場合はtrue
   */
  isWalkable(x: number, y: number, z = 0, excludeEntityId?: string): boolean {
    // タイルの通行可能性をチェック
    const tileWalkable = this.floorStore.getCurrentTileMap().isWalkable(x, y, z);
    if (!tileWalkable) return false;

    // エンティティとの衝突をチェック
    return !this.isPositionOccupied(x, y, z, excludeEntityId);
  }

  /**
   * 指定位置にエンティティが存在するかをチェック
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   * @param excludeEntityId 除外するエンティティID（自分自身を除外する場合など）
   * @returns エンティティが存在する場合はtrue
   */
  isPositionOccupied(x: number, y: number, z = 0, excludeEntityId?: string): boolean {
    if (!this.entitySystem) return false;

    // チェック対象の座標を整数に丸める
    const checkX = Math.round(x);
    const checkY = Math.round(y);
    const checkZ = Math.round(z);

    // 全エンティティを取得
    for (const entity of this.getAllEntities()) {
      // 除外対象のエンティティはスキップ
      if (excludeEntityId && entity.id === excludeEntityId) {
        continue;
      }

      // C3: 衝突判定は BlockingComponent の有無で宣言する
      // 旧ロジックの item / event_object / portal / charger タグ除外は
      // これらの Entity が BlockingComponent を持たないことで表現される
      if (!entity.getComponent<BlockingComponent>('blocking')) {
        continue;
      }

      const transform = entity.getComponent<TransformComponent>('transform');
      if (transform) {
        const pos = transform.position;
        // 整数座標で比較（Math.roundで四捨五入）
        const entityX = Math.round(pos.x);
        const entityY = Math.round(pos.y);
        const entityZ = Math.round(pos.z);

        if (entityX === checkX && entityY === checkY && entityZ === checkZ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 指定位置にいるエンティティを取得
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   * @returns エンティティ、または undefined
   */
  getEntityAtPosition(x: number, y: number, z = 0): Entity | undefined {
    if (!this.entitySystem) return undefined;

    // D1: 位置インデックス経由で O(1) 検索
    return this.entitySystem.getEntityAtPosition(x, y, z);
  }

  /**
   * すべてのエンティティを取得
   * @returns エンティティの配列
   */
  private getAllEntities(): Entity[] {
    if (!this.entitySystem) return [];

    // エンティティシステムからすべてのエンティティを取得
    return this.entitySystem.getEntities();
  }

  /**
   * ランダムな通行可能なタイルの位置を取得
   * @returns 通行可能な位置、見つからない場合はnull
   */
  getRandomWalkableTile(): Vector3 | null {
    const maxAttempts = 100;
    const mapSize = this.floorStore.getCurrentTileMap().getSize();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.floor(Math.random() * mapSize.width);
      const y = Math.floor(Math.random() * mapSize.height);
      const z = 0; // 通常はz=0のレイヤーを使用

      if (this.isWalkable(x, y, z)) {
        return { x, y, z };
      }
    }

    console.warn('Failed to find a walkable tile after maximum attempts');
    return null;
  }

  /**
   * 指定したタイプのタイルの位置をすべて取得
   * @param tileType 検索するタイルタイプ
   * @returns 位置の配列
   */
  getTilePositionsByType(tileType: TileType): Vector3[] {
    return this.floorStore.getCurrentTileMap().findTilesByType(tileType);
  }

  /**
   * 指定位置の周囲にあるタイルを取得
   * @param x 中心X座標
   * @param y 中心Y座標
   * @param z Z座標
   * @param radius 取得する半径
   * @returns 範囲内のタイルの配列
   */
  getTilesInRange(x: number, y: number, z = 0, radius = 1): Tile[] {
    return this.floorStore.getCurrentTileMap().getTilesInRange(x, y, z, radius);
  }

  /**
   * 現在のフロア番号を取得
   * @returns フロア番号
   */
  getCurrentFloor(): number {
    return this.floorStore.getCurrentFloor();
  }

  /**
   * 現在のフロア番号を設定し、対応する TileMap に切り替える
   * 対象フロアの TileMap が未登録の場合は何もしない
   * @param floorNumber 設定するフロア番号
   */
  setCurrentFloor(floorNumber: number): void {
    if (!this.floorStore.setCurrentFloor(floorNumber)) {
      console.warn(`Floor ${floorNumber} not found in WorldSystem, cannot switch`);
      return;
    }
    console.log(`WorldSystem: switched to floor ${floorNumber}`);
  }

  /**
   * 指定フロアのマップ・Room・Corridor を一括で登録し、現在のフロアを切り替える
   * Game.generateMap などから呼ばれることを想定
   *
   * 旧API。新規コードは registerFloorSnapshot を使用し、
   * TacticalElement も同一世代で登録すること。
   * @param floorNumber フロア番号
   * @param tileMap タイルマップ
   * @param rooms 部屋の配列（省略可）
   * @param corridors 通路の配列（省略可）
   */
  registerFloor(
    floorNumber: number,
    tileMap: TileMap,
    rooms: Room[] = [],
    corridors: Corridor[] = []
  ): void {
    this.registerFloorSnapshot(createFloorSnapshot(floorNumber, tileMap, { rooms, corridors }));
  }

  /**
   * フロアデータ 1 個（FloorSnapshot）を受け取って登録し、現在のフロアを切り替える。
   *
   * TileMap・Room・Corridor・TacticalElement・Doorway は常に同じ世代で登録される。
   * 同一フロア番号へ再登録した場合は上書きされる。
   * Room は生成時に不透明 RoomId が採番済みであることを前提とする。
   * snapshot.doorways が未指定の場合は corridors と rooms から Doorway を導出する。
   * @param snapshot フロアデータ
   */
  registerFloorSnapshot(snapshot: FloorSnapshot): void {
    const { floor, tileMap, rooms, corridors, tacticalElements, doorways } = snapshot;
    this.floorStore.register(floor, tileMap, rooms, corridors, tacticalElements, doorways);
    console.log(
      `WorldSystem: registered floor ${floor} (${rooms.length} rooms, ${
        corridors.length
      } corridors, ${tacticalElements.length} tactical elements, ${
        this.floorStore.getDoorwaysByFloor(floor).length
      } doorways)`
    );
  }

  /**
   * 現在のタイルマップを取得
   * @returns タイルマップ
   */
  getTileMap(): TileMap {
    return this.floorStore.getCurrentTileMap();
  }

  /**
   * 現在のフロアの部屋情報を取得
   * @returns 部屋の配列のコピー（未設定の場合は空配列）
   */
  getRooms(): Room[] {
    return this.floorStore.getRooms();
  }

  /**
   * 現在のフロアから RoomId で Room を取得する
   * @param roomId RoomId
   * @returns Room（未登録の場合は undefined）
   */
  getRoomById(roomId: RoomId): Room | undefined {
    return this.floorStore.getRoomById(roomId);
  }

  /**
   * 指定フロアから RoomId で Room を取得する
   * @param floorNumber フロア番号
   * @param roomId RoomId
   */
  getRoomByIdByFloor(floorNumber: number, roomId: RoomId): Room | undefined {
    return this.floorStore.getRoomByIdByFloor(floorNumber, roomId);
  }

  /**
   * 指定タイル座標を含む現在フロアの Room を取得する。
   *
   * タイルがどの Room にも属さない（通路やマップ外など）場合は undefined を返す。
   * FOV の可視性イベントへ RoomId を関連付けるために使用する。
   *
   * @param x タイルX座標
   * @param y タイルY座標
   * @returns 座標を含む Room、または undefined
   */
  getRoomAtPosition(x: number, y: number): Room | undefined {
    return this.floorStore.getRoomAtPosition(x, y);
  }

  /**
   * 指定フロアの指定タイル座標を含む Room を取得する。
   *
   * @param floorNumber フロア番号
   * @param x タイルX座標
   * @param y タイルY座標
   */
  getRoomAtPositionByFloor(floorNumber: number, x: number, y: number): Room | undefined {
    return this.floorStore.getRoomAtPositionByFloor(floorNumber, x, y);
  }

  /**
   * 現在のフロアの通路情報を取得
   * @returns 通路の配列のコピー（未設定の場合は空配列）
   */
  getCorridors(): Corridor[] {
    return this.floorStore.getCorridors();
  }

  /**
   * 現在のフロアの戦術的要素を取得
   * @returns 戦術的要素の配列のコピー（未設定の場合は空配列）
   */
  getTacticalElements(): TacticalElement[] {
    return this.floorStore.getTacticalElements();
  }

  /**
   * 現在のフロアの Doorway 配列を取得する
   * @returns Doorway の配列のコピー（未設定の場合は空配列）
   */
  getDoorways(): Doorway[] {
    return this.floorStore.getDoorways();
  }

  /**
   * 指定フロアの部屋情報を設定
   * @param floorNumber フロア番号
   * @param rooms 部屋の配列
   */
  setRooms(floorNumber: number, rooms: Room[]): void {
    this.floorStore.setRooms(floorNumber, rooms);
  }

  /**
   * 指定フロアの通路情報を設定
   * @param floorNumber フロア番号
   * @param corridors 通路の配列
   */
  setCorridors(floorNumber: number, corridors: Corridor[]): void {
    this.floorStore.setCorridors(floorNumber, corridors);
  }

  /**
   * 指定フロアの戦術的要素を設定
   * @param floorNumber フロア番号
   * @param elements 戦術的要素の配列
   */
  setTacticalElements(floorNumber: number, elements: TacticalElement[]): void {
    this.floorStore.setTacticalElements(floorNumber, elements);
  }

  /**
   * 指定フロアの部屋情報を取得
   * @param floorNumber フロア番号
   * @returns 部屋の配列のコピー（未設定の場合は空配列）
   */
  getRoomsByFloor(floorNumber: number): Room[] {
    return this.floorStore.getRoomsByFloor(floorNumber);
  }

  /**
   * 指定フロアの通路情報を取得
   * @param floorNumber フロア番号
   * @returns 通路の配列のコピー（未設定の場合は空配列）
   */
  getCorridorsByFloor(floorNumber: number): Corridor[] {
    return this.floorStore.getCorridorsByFloor(floorNumber);
  }

  /**
   * 指定フロア的戦術的要素を取得
   * @param floorNumber フロア番号
   * @returns 戦術的要素の配列のコピー（未設定の場合は空配列）
   */
  getTacticalElementsByFloor(floorNumber: number): TacticalElement[] {
    return this.floorStore.getTacticalElementsByFloor(floorNumber);
  }

  /**
   * 指定フロアの Doorway 配列を取得する
   * @param floorNumber フロア番号
   * @returns Doorway の配列のコピー（未設定の場合は空配列）
   */
  getDoorwaysByFloor(floorNumber: number): Doorway[] {
    return this.floorStore.getDoorwaysByFloor(floorNumber);
  }

  /**
   * 指定フロアの FloorSnapshot を取得する。
   * TileMap は参照、Room/Corridor/TacticalElement/Doorway はコピーを返す。
   * 未登録フロアの場合は undefined を返す。
   * @param floorNumber フロア番号
   */
  getFloorSnapshot(floorNumber: number): FloorSnapshot | undefined {
    const tileMap = this.floorStore.getTileMapByFloor(floorNumber);
    if (!tileMap) return undefined;
    return {
      floor: floorNumber,
      tileMap,
      rooms: this.floorStore.getRoomsByFloor(floorNumber),
      corridors: this.floorStore.getCorridorsByFloor(floorNumber),
      tacticalElements: this.floorStore.getTacticalElementsByFloor(floorNumber),
      doorways: this.floorStore.getDoorwaysByFloor(floorNumber),
    };
  }

  /**
   * 指定位置のタイルを取得
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   * @returns タイル、または undefined
   */
  getTile(x: number, y: number, z = 0): Tile | undefined {
    return this.floorStore.getCurrentTileMap().getTile(x, y, z);
  }

  /**
   * A*アルゴリズムによる経路探索
   * 旧システム（Stage.ts）から移植
   * @param start 開始位置
   * @param goal 目標位置
   * @param maxDistance 最大検索距離（オプション）
   * @param excludeEntityId 衝突判定から除外するエンティティID
   * @returns 経路の位置配列、見つからない場合は空配列
   */
  findPath(start: Vector3, goal: Vector3, maxDistance = 50, excludeEntityId?: string): Vector3[] {
    return this.pathfinding.findPath(start, goal, maxDistance, excludeEntityId);
  }

  /**
   * 2点間の距離を取得
   */
  getDistance(pos1: Vector3, pos2: Vector3): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) + Math.abs(pos1.z - pos2.z);
  }

  /**
   * 各フレームの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(): void {
    // 必要に応じて環境の更新処理を追加
    // 例: 時間経過によるタイルの変化、動的な環境効果など
  }

  /**
   * 指定位置が有効範囲内かをチェック
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   * @returns 有効範囲内の場合はtrue
   */
  isInBounds(x: number, y: number, z = 0): boolean {
    return this.floorStore.getCurrentTileMap().isInBounds(x, y, z);
  }
}
