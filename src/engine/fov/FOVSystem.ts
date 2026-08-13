import { System } from '../System';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { WorldSystem } from '../world/WorldSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { Player } from '../entity/Player';
import { TransformComponent } from '../entity/components/Transform';
import { MovementComponent } from '../entity/components/Movement';
import { TileType, Direction, Room } from '../types';
import { computeFOV, tileKey, FOVBoundsQuery, FOVObstacleQuery } from './FOVCalculator';
import { diffEntityVisibility, diffTileVisibility, isPlayerEntity } from './VisibilityRule';

/**
 * Field of View System - プレイヤーの視野を計算・管理
 *
 * 視界の計算自体は純粋関数 `computeFOV` へ委譲し、本クラスは
 * - システム間の依存解決
 * - 計算に必要な query の組み立て
 * - 計算結果の保持と探索状態の蓄積
 * - 変化したタイル/エンティティのみへの可視性イベント発行
 * を担当する。
 *
 * Room 関連付け（R6-6）として、tile_visibility_changed イベントへ
 * 該当タイルの RoomId を含める。
 */
export class FOVSystem implements System {
  private engine: Engine | null = null;
  private eventSystem: EventSystem | null = null;
  private worldSystem: WorldSystem | null = null;
  private entitySystem: EntitySystem | null = null;

  // 視野情報を保存（座標 -> 可視フラグ）
  private visibleTiles: Set<string> = new Set();
  private exploredTiles: Set<string> = new Set();

  // 前回の可視状態（差分イベント発行のため保持）
  private previousVisibleTiles: Set<string> = new Set();
  private previousEntityVisibility: Map<string, boolean> = new Map();

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.worldSystem = engine.getSystem<WorldSystem>('world') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;

    this.setupEventListeners();

    console.log('FOVSystem initialized');
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) return;

    // プレイヤー移動完了時に視野を再計算
    this.eventSystem.on('move_completed', (data) => {
      if (data.entityId === 'player' || (data.entityId && data.entityId.startsWith('player'))) {
        console.log(`FOVSystem: move_completed event received for ${data.entityId}`);
        this.updatePlayerFOV();
      }
    });

    // 視野更新リクエスト時（視野半径変更時など）
    this.eventSystem.on('fov_update_requested', (data) => {
      if (data.entityId && data.entityId.startsWith('player')) {
        this.updatePlayerFOV();
      }
    });
  }

  /**
   * 毎フレームの更新処理
   * @param _deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(_deltaTime: number): void {
    // FOVSystemはイベント駆動なので、通常の更新処理は不要
  }

  /**
   * 計算に必要なシステム参照を遅延解決する。
   * 初期化順序に依存しないよう、計算直前に最新参照を取得する。
   */
  private resolveSystems(): boolean {
    if (!this.entitySystem && this.engine) {
      this.entitySystem = this.engine.getSystem<EntitySystem>('entity') || null;
    }
    if (!this.worldSystem && this.engine) {
      this.worldSystem = this.engine.getSystem<WorldSystem>('world') || null;
    }
    if (!this.eventSystem && this.engine) {
      this.eventSystem = this.engine.getSystem<EventSystem>('event') || null;
    }
    return !!(this.entitySystem && this.worldSystem && this.eventSystem);
  }

  /**
   * プレイヤーの視野を更新
   */
  private updatePlayerFOV(): void {
    if (!this.resolveSystems()) {
      console.warn('FOVSystem: entitySystem or worldSystem not available');
      return;
    }

    const entitySystem = this.entitySystem!;
    const worldSystem = this.worldSystem!;

    // プレイヤーを取得
    const players = entitySystem.getEntitiesByTag('player');
    const player = players[0] as Player;
    if (!player) {
      console.warn('FOVSystem: Player not found');
      return;
    }

    // プレイヤーの位置を取得
    const transform = player.getComponent<TransformComponent>('transform');
    if (!transform) {
      console.warn('FOVSystem: Player transform not found');
      return;
    }

    const pos = transform.position;
    const playerX = Math.round(pos.x);
    const playerY = Math.round(pos.y);
    const baseViewRadius = player.viewRadius;

    // プレイヤーの向きを取得
    const movement = player.getComponent<MovementComponent>('movement');
    const playerDirection: Direction = movement ? movement.direction : 'down';

    console.log(
      `FOVSystem: Updating FOV for player at (${playerX}, ${playerY}) with base radius ${baseViewRadius}, direction: ${playerDirection}`
    );

    // 計算用 query を組み立てる
    const bounds: FOVBoundsQuery = {
      isInBounds: (x, y) => this.isInBounds(x, y),
    };
    const obstacle: FOVObstacleQuery = {
      isBlocking: (x, y) => this.isBlocking(x, y),
    };

    // 視界を計算（純粋関数）
    const result = computeFOV({
      cx: playerX,
      cy: playerY,
      direction: playerDirection,
      bounds,
      obstacle,
    });

    // 計算結果を状態へ反映
    this.visibleTiles = new Set(result.visibleTiles);
    for (const key of result.visibleTiles) {
      this.exploredTiles.add(key);
    }

    // タイルとエンティティの可視性を更新（差分イベント発行）
    this.updateVisibility();

    console.log(
      `FOVSystem: Visible tiles: ${this.visibleTiles.size}, Explored tiles: ${this.exploredTiles.size}`
    );
  }

  /**
   * 座標がマップ範囲内かチェック
   * @param x X座標
   * @param y Y座標
   * @returns 範囲内ならtrue
   */
  private isInBounds(x: number, y: number): boolean {
    if (!this.worldSystem) return false;
    const tileMap = this.worldSystem.getTileMap();
    if (!tileMap) return false;

    return x >= 0 && x < tileMap.getWidth() && y >= 0 && y < tileMap.getHeight();
  }

  /**
   * タイルまたは障害物が視線を遮るかチェック
   * @param x X座標
   * @param y Y座標
   * @returns 視線を遮る場合true
   */
  private isBlocking(x: number, y: number): boolean {
    if (!this.worldSystem || !this.entitySystem) return false;

    // 1. 壁タイルをチェック
    const tileMap = this.worldSystem.getTileMap();
    if (!tileMap) return false;

    const tile = tileMap.getTile(x, y);

    // タイルがない場合、または空タイル（壁）の場合は遮る
    if (!tile || tile.type === TileType.EMPTY) {
      return true;
    }

    // 山タイプは視線を遮る
    if (tile.type === TileType.MOUNTAIN) {
      return true;
    }

    // 2. その位置の障害物をチェック
    const entities = this.entitySystem.getEntities();
    for (const entity of entities) {
      if (!entity.hasTag('obstacle')) continue;

      const transform = entity.getComponent<TransformComponent>('transform');
      if (!transform) continue;

      const pos = transform.position;
      if (Math.round(pos.x) === x && Math.round(pos.y) === y) {
        // 障害物のblocksVisionプロパティをチェック
        // Obstacleエンティティから取得
        const obstacle = entity as any;
        if (obstacle.blocksVision && obstacle.blocksVision()) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * タイルとエンティティの可視性を更新（差分イベント発行）
   *
   * 前回の可視状態と比較し、変化したタイル/エンティティのみへ
   * 可視性変更イベントを発行する。変化のない対象への再送は行わない。
   *
   * tile_visibility_changed イベントには該当タイルの roomId を含める（R6-6）。
   */
  private updateVisibility(): void {
    if (!this.resolveSystems()) {
      console.warn('FOVSystem: Cannot update visibility - missing systems');
      return;
    }

    const worldSystem = this.worldSystem!;
    const entitySystem = this.entitySystem!;
    const eventSystem = this.eventSystem!;

    const tileMap = worldSystem.getTileMap();
    if (!tileMap) {
      console.warn('FOVSystem: TileMap not found');
      return;
    }

    // タイル可視性の差分を計算して発行
    const tileChanges = diffTileVisibility(this.visibleTiles, this.previousVisibleTiles);
    let tileUpdateCount = 0;
    for (const change of tileChanges) {
      const roomId = this.getRoomIdAt(change.x, change.y);
      eventSystem.emit('tile_visibility_changed', {
        x: change.x,
        y: change.y,
        visible: change.visible,
        explored: this.exploredTiles.has(tileKey(change.x, change.y)),
        roomId,
      });
      tileUpdateCount++;
    }

    // エンティティ可視性の差分を計算して発行
    const entities = entitySystem.getEntities();
    const entityChanges = diffEntityVisibility(
      entities,
      this.visibleTiles,
      this.previousEntityVisibility
    );

    for (const change of entityChanges) {
      eventSystem.emit('entity_visibility_changed', {
        entityId: change.entityId,
        inFOV: change.inFOV,
      });
    }

    // 状態を更新
    this.previousVisibleTiles = new Set(this.visibleTiles);
    this.previousEntityVisibility = new Map();
    for (const entity of entities) {
      if (isPlayerEntity(entity)) continue;
      const transform = entity.getComponent<TransformComponent>('transform');
      if (!transform) continue;
      // 現在の可視状態を記録（次回差分比較用）
      const pos = transform.position;
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      const checkPositions = [
        { x, y },
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ];
      const inFOV = checkPositions.some((p) => this.visibleTiles.has(tileKey(p.x, p.y)));
      this.previousEntityVisibility.set(entity.id, inFOV);
    }

    console.log(
      `FOVSystem: Updated ${tileUpdateCount} tile changes and ${entityChanges.length} entity changes`
    );
  }

  /**
   * 指定タイル座標の RoomId を取得する。
   * Room に属さないタイルの場合は undefined を返す。
   */
  private getRoomIdAt(x: number, y: number): string | undefined {
    if (!this.worldSystem) return undefined;
    const room: Room | undefined = this.worldSystem.getRoomAtPosition(x, y);
    return room?.id;
  }

  /**
   * FOVシステムをリセット（リトライ時など）
   */
  reset(): void {
    console.log('FOVSystem: Resetting FOV state...');
    this.visibleTiles.clear();
    this.exploredTiles.clear();
    this.previousVisibleTiles.clear();
    this.previousEntityVisibility.clear();
    console.log('FOVSystem: Reset complete');
  }

  /**
   * 初期視野を計算（ゲーム開始時）
   */
  calculateInitialFOV(): void {
    console.log('FOVSystem: calculateInitialFOV called');

    if (!this.entitySystem && this.engine) {
      this.entitySystem = this.engine.getSystem<EntitySystem>('entity') || null;
      console.log(`FOVSystem: entitySystem ${this.entitySystem ? 'found' : 'not found'}`);
    }
    if (!this.worldSystem && this.engine) {
      this.worldSystem = this.engine.getSystem<WorldSystem>('world') || null;
      console.log(`FOVSystem: worldSystem ${this.worldSystem ? 'found' : 'not found'}`);
    }

    console.log('FOVSystem: Calculating initial FOV...');
    this.updatePlayerFOV();
    console.log(
      `FOVSystem: Initial FOV complete. Visible: ${this.visibleTiles.size}, Explored: ${this.exploredTiles.size}`
    );
  }

  /**
   * タイルが探索済みかチェック
   * @param x X座標
   * @param y Y座標
   * @returns 探索済みならtrue
   */
  isTileExplored(x: number, y: number): boolean {
    return this.exploredTiles.has(`${x},${y}`);
  }

  /**
   * タイルが可視かチェック
   * @param x X座標
   * @param y Y座標
   * @returns 可視ならtrue
   */
  isTileVisible(x: number, y: number): boolean {
    return this.visibleTiles.has(`${x},${y}`);
  }
}
