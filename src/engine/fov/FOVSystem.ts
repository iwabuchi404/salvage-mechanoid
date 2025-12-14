import { System } from '../System';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { WorldSystem } from '../world/WorldSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { Player } from '../entity/Player';
import { TransformComponent } from '../entity/components/Transform';
import { MovementComponent } from '../entity/components/Movement';
import { TileType, Direction } from '../types';

/**
 * Field of View System - プレイヤーの視野を計算・管理
 * Recursive Shadowcasting アルゴリズムを使用
 */
export class FOVSystem implements System {
  private engine: Engine | null = null;
  private eventSystem: EventSystem | null = null;
  private worldSystem: WorldSystem | null = null;
  private entitySystem: EntitySystem | null = null;

  // 視野情報を保存（座標 -> 可視フラグ）
  private visibleTiles: Set<string> = new Set();
  private exploredTiles: Set<string> = new Set();

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
   * プレイヤーの視野を更新
   */
  private updatePlayerFOV(): void {
    // 遅延初期化：必要なシステムへの参照を取得
    if (!this.entitySystem && this.engine) {
      this.entitySystem = this.engine.getSystem<EntitySystem>('entity') || null;
    }
    if (!this.worldSystem && this.engine) {
      this.worldSystem = this.engine.getSystem<WorldSystem>('world') || null;
    }

    if (!this.entitySystem || !this.worldSystem) {
      console.warn('FOVSystem: entitySystem or worldSystem not available');
      return;
    }

    // プレイヤーを取得
    const players = this.entitySystem.getEntitiesByTag('player');
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
    const playerDirection = movement ? movement.direction : 'down';

    console.log(
      `FOVSystem: Updating FOV for player at (${playerX}, ${playerY}) with base radius ${baseViewRadius}, direction: ${playerDirection}`
    );

    // 視野を計算（方向に応じた視野範囲）
    this.calculateFOV(playerX, playerY, baseViewRadius, playerDirection);

    // タイルとエンティティの可視性を更新
    this.updateVisibility();

    console.log(
      `FOVSystem: Visible tiles: ${this.visibleTiles.size}, Explored tiles: ${this.exploredTiles.size}`
    );
  }

  /**
   * 視野を計算（シンプルなレイキャスティング方式、方向に応じた視野範囲）
   * @param cx 中心X座標
   * @param cy 中心Y座標
   * @param baseRadius 基本視野半径（未使用、互換性のため残す）
   * @param direction プレイヤーの向き
   */
  private calculateFOV(cx: number, cy: number, baseRadius: number, direction: Direction): void {
    // 方向に応じた視野範囲を固定値で設定
    const frontRadius = 4; // 正面方向（真っ直ぐ前 + 左右1つずつ）は4マス
    const sideRadius = 3; // それ以外は3マス

    console.log(
      `FOVSystem.calculateFOV: Called with frontRadius=${frontRadius}, sideRadius=${sideRadius}, direction=${direction}, center=(${cx}, ${cy})`
    );

    // 前回の可視タイルをクリア
    this.visibleTiles.clear();

    // プレイヤーの位置は常に可視
    this.visibleTiles.add(`${cx},${cy}`);
    this.exploredTiles.add(`${cx},${cy}`);

    let checkedCount = 0;
    let visibleCount = 0;

    // 最大半径でループ（正面方向の半径を使用）
    const maxRadius = Math.max(frontRadius, sideRadius);
    for (let dy = -maxRadius; dy <= maxRadius; dy++) {
      for (let dx = -maxRadius; dx <= maxRadius; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;

        // タイルの方向を判定
        const tileDirection = this.getDirectionFromDelta(dx, dy);
        const isFrontDirection = this.isFrontDirection(direction, tileDirection);
        const effectiveRadius = isFrontDirection ? frontRadius : sideRadius;

        // 距離チェック（方向に応じた視野範囲）
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > effectiveRadius) continue;

        checkedCount++;

        // 範囲外チェック
        if (!this.isInBounds(tx, ty)) continue;

        // レイキャストで視線が通るかチェック
        if (this.hasLineOfSight(cx, cy, tx, ty)) {
          this.visibleTiles.add(`${tx},${ty}`);
          this.exploredTiles.add(`${tx},${ty}`);
          visibleCount++;
        }
      }
    }

    console.log(
      `FOVSystem.calculateFOV: Checked ${checkedCount} tiles, found ${visibleCount} visible tiles`
    );
  }

  /**
   * デルタ座標から方向を取得
   * @param dx X方向のデルタ
   * @param dy Y方向のデルタ
   * @returns 方向（8方向）
   */
  private getDirectionFromDelta(dx: number, dy: number): string {
    if (dx === 0 && dy === 0) return 'center';
    if (dx === 0) return dy < 0 ? 'up' : 'down';
    if (dy === 0) return dx < 0 ? 'left' : 'right';
    if (Math.abs(dx) === Math.abs(dy)) {
      if (dx < 0 && dy < 0) return 'up-left';
      if (dx > 0 && dy < 0) return 'up-right';
      if (dx < 0 && dy > 0) return 'down-left';
      if (dx > 0 && dy > 0) return 'down-right';
    }
    // 斜め方向の判定（より近い方向を優先）
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? 'left' : 'right';
    } else {
      return dy < 0 ? 'up' : 'down';
    }
  }

  /**
   * タイルの方向がプレイヤーの正面方向かどうかを判定
   * @param playerDirection プレイヤーの向き
   * @param tileDirection タイルの方向
   * @returns 正面方向の場合true
   */
  private isFrontDirection(playerDirection: Direction, tileDirection: string): boolean {
    // 中心は常に正面
    if (tileDirection === 'center') return true;

    // プレイヤーの向きに応じて正面方向を判定
    switch (playerDirection) {
      case 'up':
        return (
          tileDirection === 'up' || tileDirection === 'up-left' || tileDirection === 'up-right'
        );
      case 'down':
        return (
          tileDirection === 'down' ||
          tileDirection === 'down-left' ||
          tileDirection === 'down-right'
        );
      case 'left':
        return (
          tileDirection === 'left' || tileDirection === 'up-left' || tileDirection === 'down-left'
        );
      case 'right':
        return (
          tileDirection === 'right' ||
          tileDirection === 'up-right' ||
          tileDirection === 'down-right'
        );
      default:
        return false;
    }
  }

  /**
   * 2点間の視線が通るかチェック（Bresenhamのライン）
   * @param x0 開始X座標
   * @param y0 開始Y座標
   * @param x1 終了X座標
   * @param y1 終了Y座標
   * @returns 視線が通る場合true
   */
  private hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    // 最大ステップ数（無限ループ防止）
    const maxSteps = dx + dy + 1;

    for (let step = 0; step < maxSteps; step++) {
      // 目標地点に到達
      if (x === x1 && y === y1) {
        return true;
      }

      // 開始地点以外で障害物があれば視線が遮られる
      if (!(x === x0 && y === y0) && this.isBlocking(x, y)) {
        return false;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return false;
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
   * タイルとエンティティの可視性を更新
   */
  private updateVisibility(): void {
    // 遅延初期化
    if (!this.eventSystem && this.engine) {
      this.eventSystem = this.engine.getSystem<EventSystem>('event') || null;
    }

    if (!this.worldSystem || !this.entitySystem || !this.eventSystem) {
      console.warn('FOVSystem: Cannot update visibility - missing systems');
      return;
    }

    const tileMap = this.worldSystem.getTileMap();
    if (!tileMap) {
      console.warn('FOVSystem: TileMap not found');
      return;
    }

    let tileUpdateCount = 0;
    let entityUpdateCount = 0;

    // すべてのタイルの可視性を更新
    for (let y = 0; y < tileMap.getHeight(); y++) {
      for (let x = 0; x < tileMap.getWidth(); x++) {
        const key = `${x},${y}`;
        const visible = this.visibleTiles.has(key);
        const explored = this.exploredTiles.has(key);

        // タイル可視性更新イベントを発行
        this.eventSystem.emit('tile_visibility_changed', {
          x,
          y,
          visible,
          explored,
        });
        tileUpdateCount++;
      }
    }

    // エンティティの可視性を更新
    const entities = this.entitySystem.getEntities();
    for (const entity of entities) {
      // プレイヤー自身は常に可視
      if (entity.hasTag('player')) continue;

      const transform = entity.getComponent<TransformComponent>('transform');
      if (!transform) continue;

      const pos = transform.position;
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);

      // エンティティの位置とその周辺（移動中の位置ずれを考慮）をチェック
      let inFOV = false;
      const checkPositions = [
        { x, y }, // 現在位置
        { x: x - 1, y }, // 左
        { x: x + 1, y }, // 右
        { x, y: y - 1 }, // 上
        { x, y: y + 1 }, // 下
      ];

      for (const checkPos of checkPositions) {
        const key = `${checkPos.x},${checkPos.y}`;
        if (this.visibleTiles.has(key)) {
          inFOV = true;
          break;
        }
      }

      // デバッグログ（敵エンティティのみ、視野内の場合のみ）
      if (entity.hasTag('enemy') && inFOV) {
        console.log(
          `FOVSystem: Enemy ${
            entity.id
          } at (${x}, ${y}) is in FOV. Checked positions: ${checkPositions
            .map((p) => `${p.x},${p.y}`)
            .join(', ')}`
        );
      }

      // エンティティ可視性更新イベントを発行
      this.eventSystem.emit('entity_visibility_changed', {
        entityId: entity.id,
        inFOV,
      });
      entityUpdateCount++;
    }

    console.log(`FOVSystem: Updated ${tileUpdateCount} tiles and ${entityUpdateCount} entities`);
  }

  /**
   * FOVシステムをリセット（リトライ時など）
   */
  reset(): void {
    console.log('FOVSystem: Resetting FOV state...');
    this.visibleTiles.clear();
    this.exploredTiles.clear();
    console.log('FOVSystem: Reset complete');
  }

  /**
   * 初期視野を計算（ゲーム開始時）
   */
  calculateInitialFOV(): void {
    console.log('FOVSystem: calculateInitialFOV called');

    // 遅延初期化：必要なシステムへの参照を取得
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
