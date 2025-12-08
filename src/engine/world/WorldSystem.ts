import { System } from '../System';
import { Engine } from '../Engine';
import { TileMap } from './TileMap';
import { Tile } from './Tile';
import { Vector3, TileType, EventName } from '../types';
import { EventSystem } from '../events/EventSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { Entity } from '../entity/Entity';
import { TransformComponent } from '../entity/components/Transform';
import { CoordinateSystem } from '../graphics/CoordinateSystem';

/**
 * WorldSystem - ゲーム世界と地形を管理するシステム
 * タイルマップ、コリジョン検出、環境効果などを扱う
 */
export class WorldSystem implements System {
  // タイルマップ
  private tileMap: TileMap;

  // エンジンへの参照
  private engine: Engine | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  // エンティティシステムへの参照
  private entitySystem: EntitySystem | null = null;

  // 座標変換システム
  private coordinateSystem: CoordinateSystem;

  // 現在のフロア番号
  private currentFloor = 1;

  // フロアごとのマップを保存（複数フロア対応）
  private floorMaps: Map<number, TileMap> = new Map();

  /**
   * コンストラクタ
   * @param tileMap 初期タイルマップ
   */
  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
    this.coordinateSystem = new CoordinateSystem(160, 120); // 仮のタイルサイズ
    this.floorMaps.set(this.currentFloor, tileMap);

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

    // ポータル使用イベント
    this.eventSystem.on('portal_used', (data) => {
      this.onPortalUsed(data);
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
  private onEntityMoved(data: { entityId: string; position: Vector3 }): void {
    if (!this.entitySystem) return;

    // エンティティを取得
    const entity = this.entitySystem.getEntity(data.entityId);
    if (!entity) return;

    // 現在の位置のタイルを取得
    const tile = this.tileMap.getTile(data.position.x, data.position.y, data.position.z);
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
   * ポータル使用イベントハンドラ
   * @param data イベントデータ
   */
  private onPortalUsed(data: { entityId: string; targetFloor?: number }): void {
    // プレイヤーが対象の場合のみ処理（必要に応じて変更可能）
    if (!this.entitySystem) return;

    const entity = this.entitySystem.getEntity(data.entityId);
    if (!entity || !entity.hasTag('player')) return;

    // 目標フロアを決定
    const targetFloor = data.targetFloor || this.currentFloor + 1;

    // 指定されたフロアに移動
    this.changeFloor(targetFloor);
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
        currentFloor: this.currentFloor,
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
    const tileWalkable = this.tileMap.isWalkable(x, y, z);
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

      // アイテムタグを持つエンティティは衝突判定しない
      if (entity.hasTag('item')) {
        continue;
      }

      // イベントオブジェクト（ポータル、チャージャー）は衝突判定しない
      if (entity.hasTag('event_object') || entity.hasTag('portal') || entity.hasTag('charger')) {
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

    for (const entity of this.getAllEntities()) {
      const transform = entity.getComponent<TransformComponent>('transform');
      if (transform) {
        const pos = transform.position;
        if (
          Math.round(pos.x) === Math.round(x) &&
          Math.round(pos.y) === Math.round(y) &&
          Math.round(pos.z) === Math.round(z)
        ) {
          return entity;
        }
      }
    }

    return undefined;
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
   * フロアを変更
   * @param floorNumber 目標フロア番号
   */
  async changeFloor(floorNumber: number): Promise<void> {
    // 既存のフロアマップがあれば使用、なければ新規生成
    if (!this.floorMaps.has(floorNumber)) {
      // 新しいフロアのマップを生成
      await this.generateNewFloor(floorNumber);
    }

    // フロアを切り替え
    this.currentFloor = floorNumber;
    this.tileMap = this.floorMaps.get(floorNumber)!;

    // フロア変更イベントを発行
    if (this.eventSystem) {
      this.eventSystem.emit('floor_changed', {
        floorNumber: floorNumber,
      });
    }

    console.log(`Changed to floor ${floorNumber}`);
  }

  /**
   * 新しいフロアを生成
   * @param floorNumber フロア番号
   */
  private async generateNewFloor(floorNumber: number): Promise<void> {
    // フロア番号に基づいて難易度を調整
    const difficulty = Math.min(1 + (floorNumber - 1) * 0.1, 2);

    // フロア番号に応じて戦術的ステージタイプを決定
    const stageTypes = [
      StageType.TACTICAL_COMBAT,
      StageType.STEALTH_MISSION,
      StageType.ENERGY_MANAGEMENT,
      StageType.RESOURCE_CONTROL,
      StageType.INFORMATION_WAR,
      StageType.SURVIVAL_CHALLENGE,
    ];
    const stageType = stageTypes[(floorNumber - 1) % stageTypes.length];

    // MapGeneratorFacadeを使用
    const mapGenerator = new MapGeneratorFacade(50, 50);

    // 戦術的マップを生成
    const tacticalData = await mapGenerator.generateTacticalMap(stageType, {
      minRoomSize: Math.max(3, Math.floor(4 / difficulty)),
      maxRoomSize: Math.max(5, Math.floor(8 / difficulty)),
      energyTightness: floorNumber <= 2 ? 'relaxed' : floorNumber <= 4 ? 'balanced' : 'tight',
      playerLevel: floorNumber,
    });

    // 新しいタイルマップを作成
    const newMap = new TileMap(50, 50);
    newMap.importMapData(tacticalData.map);

    // フロアマップに保存
    this.floorMaps.set(floorNumber, newMap);

    console.log(`Generated new floor ${floorNumber} with stage type: ${stageType}`);
    console.log(`  Rooms: ${tacticalData.rooms.length}`);
    console.log(`  Energy points: ${tacticalData.energyPoints.length}`);
    console.log(`  Tactical elements: ${tacticalData.tacticalElements.length}`);
  }

  /**
   * ランダムな通行可能なタイルの位置を取得
   * @returns 通行可能な位置、見つからない場合はnull
   */
  getRandomWalkableTile(): Vector3 | null {
    const maxAttempts = 100;
    const mapSize = this.tileMap.getSize();

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
    return this.tileMap.findTilesByType(tileType);
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
    return this.tileMap.getTilesInRange(x, y, z, radius);
  }

  /**
   * 現在のフロア番号を取得
   * @returns フロア番号
   */
  getCurrentFloor(): number {
    return this.currentFloor;
  }

  /**
   * 現在のタイルマップを取得
   * @returns タイルマップ
   */
  getTileMap(): TileMap {
    return this.tileMap;
  }

  /**
   * 指定位置のタイルを取得
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   * @returns タイル、または undefined
   */
  getTile(x: number, y: number, z = 0): Tile | undefined {
    return this.tileMap.getTile(x, y, z);
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
    // 開始位置と目標位置が同じ場合は開始位置のみを返す
    if (start.x === goal.x && start.y === goal.y && start.z === goal.z) {
      return [{ ...start }];
    }

    // 2点間の距離が最大距離を超える場合は空配列を返す
    const distance = this.coordinateSystem.getDistance(start, goal);
    if (distance > maxDistance) {
      return [];
    }

    // A*アルゴリズムで経路を探索
    const openSet: PathNode[] = [];
    const closedSet: Set<string> = new Set();
    const startNode = new PathNode(start.x, start.y, start.z);
    const goalNode = new PathNode(goal.x, goal.y, goal.z);

    startNode.g = 0;
    startNode.h = this.heuristic(startNode, goalNode);
    startNode.f = startNode.g + startNode.h;

    openSet.push(startNode);

    while (openSet.length > 0) {
      // F値が最小のノードを取得
      const currentNode = this.getLowestFScoreNode(openSet);

      // ゴールに到達したか確認
      if (this.isGoalNode(currentNode, goalNode)) {
        return this.reconstructPath(currentNode);
      }

      // 現在のノードをopenSetから削除し、closedSetに追加
      this.removeFromArray(openSet, currentNode);
      closedSet.add(this.nodeToString(currentNode));

      // 隣接ノードを取得
      const neighbors = this.getNeighborNodes(currentNode, excludeEntityId);

      for (const neighbor of neighbors) {
        // 既に処理済みならスキップ
        if (closedSet.has(this.nodeToString(neighbor))) {
          continue;
        }

        const tentativeGScore = currentNode.g + 1;

        // openSetに含まれていない場合は追加
        if (!this.isInOpenSet(openSet, neighbor)) {
          openSet.push(neighbor);
        } else if (tentativeGScore >= neighbor.g) {
          // より良いパスではない場合はスキップ
          continue;
        }

        // より良いパスが見つかったので更新
        neighbor.parent = currentNode;
        neighbor.g = tentativeGScore;
        neighbor.h = this.heuristic(neighbor, goalNode);
        neighbor.f = neighbor.g + neighbor.h;
      }
    }

    // パスが見つからない場合
    return [];
  }

  /**
   * F値が最小のノードを取得
   */
  private getLowestFScoreNode(nodes: PathNode[]): PathNode {
    return nodes.reduce((lowest, node) => (node.f < lowest.f ? node : lowest));
  }

  /**
   * ゴールノードかどうかを判定
   */
  private isGoalNode(node: PathNode, goal: PathNode): boolean {
    return node.x === goal.x && node.y === goal.y && node.z === goal.z;
  }

  /**
   * 配列からノードを削除
   */
  private removeFromArray(arr: PathNode[], node: PathNode): void {
    const index = arr.indexOf(node);
    if (index > -1) {
      arr.splice(index, 1);
    }
  }

  /**
   * ノードがopenSetに含まれているかを判定
   */
  private isInOpenSet(openSet: PathNode[], node: PathNode): boolean {
    return openSet.some((n) => n.x === node.x && n.y === node.y && n.z === node.z);
  }

  /**
   * ノードを文字列に変換（ハッシュキー用）
   */
  private nodeToString(node: PathNode): string {
    return `${node.x},${node.y},${node.z}`;
  }

  /**
   * パスを再構築
   */
  private reconstructPath(node: PathNode): Vector3[] {
    const path: Vector3[] = [];
    let current: PathNode | null = node;
    while (current != null) {
      path.unshift({ x: current.x, y: current.y, z: current.z });
      current = current.parent;
    }
    return path;
  }

  /**
   * 隣接ノードを取得
   */
  private getNeighborNodes(node: PathNode, excludeEntityId?: string): PathNode[] {
    const neighbors: PathNode[] = [];
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (const dir of directions) {
      const newX = node.x + dir.dx;
      const newY = node.y + dir.dy;

      // 通行可能かチェック（excludeEntityIdを使用して自分自身を除外）
      if (this.isWalkable(newX, newY, node.z, excludeEntityId)) {
        neighbors.push(new PathNode(newX, newY, node.z));
      }
    }

    return neighbors;
  }

  /**
   * ヒューリスティック関数（マンハッタン距離）
   */
  private heuristic(a: PathNode, b: PathNode): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
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
    return this.tileMap.isInBounds(x, y, z);
  }
}

// 必要なインポート
import { MapGeneratorFacade } from './MapGeneratorFacade';
import { StageType } from '../types';

/**
 * A*パスファインディング用のノードクラス
 */
class PathNode {
  x: number;
  y: number;
  z: number;
  g: number; // 開始ノードからのコスト
  h: number; // ゴールまでの推定コスト
  f: number; // g + h
  parent: PathNode | null;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.g = 0;
    this.h = 0;
    this.f = 0;
    this.parent = null;
  }

  equals(other: PathNode): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }
}
