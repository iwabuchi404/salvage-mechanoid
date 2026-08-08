# 描画エンジン再設計仕様書

**作成日:** 2026-06-22
**対象:** salvage-mechanoid 描画・アニメーションシステム再構築

---

## 1. 設計原則

### 1.1 座標体系

内部座標は**タイル単位の整数座標**を唯一の正とする。

```
論理座標 (tileX: int, tileY: int, tileZ: int)
  ├── ゲームロジック・当たり判定・AI・FOV・配置
  ├── Entityの位置は常に整数
  └── 移動は開始時に即座に確定（アニメーション中も論理座標は目標タイル）

描画座標 (screenX: float, screenY: float)
  ├── CoordinateSystem.isometricToScreen() で変換
  └── アニメーション中のみ補間値を使用
```

### 1.2 設計要件

| # | 要件 | 概要 |
|---|------|------|
| 1 | ワールドContainer方式 | `worldContainer.position`でカメラ移動、O(1) |
| 2 | ビューポートカリング | 画面外タイルは描画スキップ |
| 3 | タイルはソート不要 | TERRAIN層`sortableChildren=false` |
| 4 | テクスチャ一括ロード | 起動時にロード、毎タイル`Assets.load`なし |
| 5 | スプライトプーリング | マップ切替時に再利用 |
| 6 | ズーム・回転対応 | `worldContainer.scale/rotation` |
| 7 | 正確なピッキング | ダイヤモンドヒットテスト |
| 8 | 定数化 | 画面サイズ・タイルサイズを外部管理 |
| 9 | 単一アニメーションループ | Engine内で統一、独立RAF廃止 |
| 10 | エフェクトはオフセット方式 | `sprite.x/y`直接書き換えなし |
| 11 | easing対応 | 線形以外の補間も可 |
| 12 | deltaTimeベース計時 | `performance.now()`直接使用廃止 |
| 13 | 論理座標=整数タイル座標 | 描画座標は別管理、補間用 |
| 14 | PIXI v8 API統一 | v7 API完全排除 |

---

## 2. 全体アーキテクチャ

```
PIXI.Application
  └── stage (sortableChildren=true)
       ├── uiLayer          (PIXI.Container, zIndex=500, 画面固定・カメラ追従なし)
       ├── worldContainer   (PIXI.Container, カメラ移動・ズーム・回転を適用)
       │    ├── terrainLayer    (PIXI.Container, sortableChildren=false)
       │    ├── highlightLayer  (PIXI.Container, sortableChildren=false)
       │    ├── objectLayer     (PIXI.Container, sortableChildren=true)
       │    ├── characterLayer  (PIXI.Container, sortableChildren=true)
       │    └── effectLayer     (PIXI.Container, sortableChildren=true)
       └── (将来的なUIオーバーレイ層)
```

### レイヤー構成

| レイヤー | 用途 | sortableChildren | カリング |
|----------|------|-------------------|----------|
| terrainLayer | タイル床・壁 | false | 手動（ビューポート判定） |
| highlightLayer | タイルハイライト | false | 不要（1要素のみ） |
| objectLayer | 障害物・アイテム | true | 不要（エンティティ数は少ない） |
| characterLayer | プレイヤー・敵 | true | 不要（エンティティ数は少ない） |
| effectLayer | エフェクト・パーティクル | true | 不要（短命） |
| uiLayer | UI要素（画面固定） | false | 不要 |

### カメラ適用方式

```typescript
// 毎フレーム1回のみ（O(1)）
worldContainer.position.set(-camera.x, -camera.y);
worldContainer.scale.set(camera.zoom);
worldContainer.rotation = camera.rotation;
```

全スプライトの`x/y`はワールド座標（カメラオフセットなし）。カメラ移動時に全スプライトを走査する必要がない。

---

## 3. クラス設計

### 3.1 定数・設定

```typescript
// src/engine/graphics/RenderConfig.ts

export const RENDER_CONFIG = {
  TILE_WIDTH: 160,
  TILE_HEIGHT: 120,
  SCREEN_WIDTH: 800,
  SCREEN_HEIGHT: 600,
  BACKGROUND_COLOR: 0x202020,
  ANTIALIAS: true,
} as const;

export const TILE_TEXTURES: Record<number, string> = {
  1: './image.png',      // GRASS / 床
  2: './image02.png',    // WATER
  3: './image03.png',    // MOUNTAIN / 壁
  4: './image.png',      // TILE
};
```

### 3.2 CoordinateSystem（再利用・微修正）

```typescript
// src/engine/graphics/CoordinateSystem.ts

export class CoordinateSystem {
  constructor(
    private tileWidth: number,
    private tileHeight: number
  ) {}

  /** タイル座標(整数) → スクリーン座標(ピクセル) */
  isometricToScreen(tileX: number, tileY: number, tileZ = 0): Vector2 {
    const halfTileWidth = this.tileWidth / 2;
    const tileHeightThird = this.tileHeight / 3;
    return {
      x: (tileX - tileY) * halfTileWidth,
      y: (tileX + tileY) * tileHeightThird - tileZ * tileHeightThird,
    };
  }

  /** スクリーン座標 → タイル座標(整数) */
  screenToTile(screenX: number, screenY: number): { x: number; y: number } {
    const halfTileWidth = this.tileWidth / 2;
    const tileHeightThird = this.tileHeight / 3;
    const fx = (screenX / halfTileWidth + screenY / tileHeightThird) / 2;
    const fy = (screenY / tileHeightThird - screenX / halfTileWidth) / 2;
    return { x: Math.floor(fx), y: Math.floor(fy) };
  }

  /** アンカーオフセットを考慮したピッキング */
  screenToTileWithAnchor(
    screenX: number,
    screenY: number,
    anchorX: number,
    anchorY: number
  ): { x: number; y: number } {
    // アンカー(0.5, 0.5)の場合、タイル中心基準で計算
    const adjustedY = screenY + this.tileHeight * (anchorY - 0.5);
    return this.screenToTile(screenX, adjustedY);
  }

  getTileWidth(): number { return this.tileWidth; }
  getTileHeight(): number { return this.tileHeight; }
  setTileSize(w: number, h: number): void {
    this.tileWidth = Math.max(1, w);
    this.tileHeight = Math.max(1, h);
  }
}
```

**変更点**: `screenToIsometric`を`screenToTile`にリネーム、`Math.floor`で整数化して返す。アンカーオフセット考慮メソッド追加。

### 3.3 Camera（再利用・微修正）

```typescript
// src/engine/graphics/Camera.ts

export class Camera {
  private _position: Vector2 = { x: 0, y: 0 };
  private _zoom = 1.0;
  private _rotation = 0;
  private _targetPosition: Vector2 | null = null;
  private _smoothingFactor = 0.15;

  // ゲッター・セッターは現状維持
  get x(): number { return this._position.x; }
  get y(): number { return this._position.y; }
  get zoom(): number { return this._zoom; }
  get rotation(): number { return this._rotation; }

  setPosition(x: number, y: number): void {
    this._position = { x, y };
    this._targetPosition = null;
  }

  setTargetPosition(x: number, y: number): void {
    this._targetPosition = { x, y };
  }

  /** Engineのゲームループから呼ばれる */
  update(deltaTime: number): void {
    if (this._targetPosition) {
      const dt = deltaTime / 16.67; // 60fps基準の正規化
      const factor = 1 - Math.pow(1 - this._smoothingFactor, dt);
      this._position.x += (this._targetPosition.x - this._position.x) * factor;
      this._position.y += (this._targetPosition.y - this._position.y) * factor;

      const distSq =
        (this._targetPosition.x - this._position.x) ** 2 +
        (this._targetPosition.y - this._position.y) ** 2;
      if (distSq < 0.01) {
        this._position = { ...this._targetPosition };
        this._targetPosition = null;
      }
    }
  }

  /** タイル座標を画面中央に来るようカメラ位置を設定 */
  lookAtTile(tileX: number, tileY: number, tileZ: number, coordSystem: CoordinateSystem): void {
    const screenPos = coordSystem.isometricToScreen(tileX, tileY, tileZ);
    this.setTargetPosition(
      screenPos.x - RENDER_CONFIG.SCREEN_WIDTH / 2,
      screenPos.y - RENDER_CONFIG.SCREEN_HEIGHT / 2
    );
  }

  reset(): void {
    this._position = { x: 0, y: 0 };
    this._zoom = 1.0;
    this._rotation = 0;
    this._targetPosition = null;
  }
}
```

**変更点**:
- `update`が`deltaTime`ベースの計算に変更（フレームレート非依存）
- `lookAtTile`メソッド追加（ハードコードされた画面中央計算を排除）
- `screenToWorld`/`worldToScreen`は削除（worldContainer方式では不要）

### 3.4 RendererSystem（再作成）

```typescript
// src/engine/graphics/RendererSystem.ts

export class RendererSystem implements System {
  private app: PIXI.Application | null = null;
  private canvas: HTMLCanvasElement | null = null;

  // レイヤー
  private worldContainer: PIXI.Container | null = null;
  private terrainLayer: PIXI.Container | null = null;
  private highlightLayer: PIXI.Container | null = null;
  private objectLayer: PIXI.Container | null = null;
  private characterLayer: PIXI.Container | null = null;
  private effectLayer: PIXI.Container | null = null;
  private uiLayer: PIXI.Container | null = null;

  // サブシステム
  private coordinateSystem: CoordinateSystem;
  private camera: Camera;
  private tileRenderer: TileRenderer;
  private animationManager: AnimationManager;

  // タイルマップ参照（カリング用）
  private tileMap: TileMap | null = null;

  // ビューポート計算用キャッシュ
  private lastCameraX = Infinity;
  private lastCameraY = Infinity;
  private lastCameraZoom = -1;

  constructor() {
    this.coordinateSystem = new CoordinateSystem(
      RENDER_CONFIG.TILE_WIDTH,
      RENDER_CONFIG.TILE_HEIGHT
    );
    this.camera = new Camera();
    this.tileRenderer = new TileRenderer(this.coordinateSystem);
    this.animationManager = new AnimationManager();
  }

  async initialize(engine: Engine): Promise<void> {
    // PIXI.Application初期化
    this.app = new PIXI.Application();
    await this.app.init({
      background: RENDER_CONFIG.BACKGROUND_COLOR,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: RENDER_CONFIG.ANTIALIAS,
      width: RENDER_CONFIG.SCREEN_WIDTH,
      height: RENDER_CONFIG.SCREEN_HEIGHT,
    });
    this.canvas.appendChild(this.app.canvas);

    this.setupLayers();
    this.setupEventListeners(engine);
  }

  private setupLayers(): void {
    // ワールドコンテナ（カメラ移動を適用）
    this.worldContainer = new PIXI.Container();
    this.app!.stage.addChild(this.worldContainer);

    // ワールド内レイヤー
    this.terrainLayer = new PIXI.Container();
    this.terrainLayer.sortableChildren = false; // タイルはソート不要
    this.worldContainer.addChild(this.terrainLayer);

    this.highlightLayer = new PIXI.Container();
    this.highlightLayer.sortableChildren = false;
    this.worldContainer.addChild(this.highlightLayer);

    this.objectLayer = new PIXI.Container();
    this.objectLayer.sortableChildren = true; // 深度ソート
    this.worldContainer.addChild(this.objectLayer);

    this.characterLayer = new PIXI.Container();
    this.characterLayer.sortableChildren = true;
    this.worldContainer.addChild(this.characterLayer);

    this.effectLayer = new PIXI.Container();
    this.effectLayer.sortableChildren = true;
    this.worldContainer.addChild(this.effectLayer);

    // UIレイヤー（カメラ追従なし）
    this.uiLayer = new PIXI.Container();
    this.app!.stage.addChild(this.uiLayer);
  }

  /**
   * メインループ更新
   * Engine.gameLoopから呼ばれる
   */
  update(deltaTime: number): void {
    // カメラ更新
    this.camera.update(deltaTime);

    // ワールドコンテナにカメラを適用（O(1)）
    this.worldContainer!.position.set(-this.camera.x, -this.camera.y);
    this.worldContainer!.scale.set(this.camera.zoom);
    this.worldContainer!.rotation = this.camera.rotation;

    // ビューポートカリング（カメラが動いた時のみ）
    if (
      this.camera.x !== this.lastCameraX ||
      this.camera.y !== this.lastCameraY ||
      this.camera.zoom !== this.lastCameraZoom
    ) {
      this.tileRenderer.updateViewport(
        this.terrainLayer!,
        this.camera,
        this.coordinateSystem,
        this.tileMap
      );
      this.lastCameraX = this.camera.x;
      this.lastCameraY = this.camera.y;
      this.lastCameraZoom = this.camera.zoom;
    }

    // アニメーション更新
    this.animationManager.update(deltaTime);
  }

  /**
   * タイルマップを描画
   * テクスチャは事前ロード済み、スプライトはプールから取得
   */
  renderTileMap(tileMap: TileMap): void {
    this.tileMap = tileMap;
    this.tileRenderer.renderTiles(
      this.terrainLayer!,
      tileMap,
      this.camera,
      this.coordinateSystem
    );
  }

  /**
   * エンティティスプライトをレイヤーに追加
   */
  addSprite(sprite: PIXI.Sprite, layer: RenderLayer): void {
    const container = this.getLayerContainer(layer);
    container.addChild(sprite);
  }

  removeSprite(sprite: PIXI.Sprite, layer: RenderLayer): void {
    const container = this.getLayerContainer(layer);
    container.removeChild(sprite);
  }

  private getLayerContainer(layer: RenderLayer): PIXI.Container {
    switch (layer) {
      case RenderLayer.TERRAIN: return this.terrainLayer!;
      case RenderLayer.OBJECTS: return this.objectLayer!;
      case RenderLayer.CHARACTERS: return this.characterLayer!;
      case RenderLayer.EFFECTS: return this.effectLayer!;
      case RenderLayer.UI: return this.uiLayer!;
    }
  }

  /**
   * スクリーン座標 → タイル座標（ピッキング）
   */
  screenToTile(screenX: number, screenY: number): { x: number; y: number } {
    // ワールド座標に逆変換
    const worldX = (screenX / this.camera.zoom + this.camera.x) / this.camera.zoom;
    const worldY = (screenY / this.camera.zoom + this.camera.y) / this.camera.zoom;
    // ズームを考慮した逆変換
    const adjustedX = screenX / this.camera.zoom + this.camera.x;
    const adjustedY = screenY / this.camera.zoom + this.camera.y;
    return this.coordinateSystem.screenToTile(adjustedX, adjustedY);
  }

  // ゲッター
  getCamera(): Camera { return this.camera; }
  getCoordinateSystem(): CoordinateSystem { return this.coordinateSystem; }
  getAnimationManager(): AnimationManager { return this.animationManager; }
  getApp(): PIXI.Application | null { return this.app; }
}

export enum RenderLayer {
  TERRAIN = 'terrain',
  OBJECTS = 'objects',
  CHARACTERS = 'characters',
  EFFECTS = 'effects',
  UI = 'ui',
}
```

### 3.5 TileRenderer（新規・カリングとプーリング）

```typescript
// src/engine/graphics/TileRenderer.ts

/**
 * タイル描画を管理
 * - ビューポートカリング
 * - スプライトプーリング
 * - テクスチャ一括ロード
 */
export class TileRenderer {
  private coordinateSystem: CoordinateSystem;

  // スプライトプール（使い回し）
  private spritePool: PIXI.Sprite[] = [];
  private activeSprites: Map<string, PIXI.Sprite> = new Map(); // key: "x,y"

  // テクスチャキャッシュ
  private textures: Map<number, PIXI.Texture> = new Map();
  private texturesLoaded = false;

  constructor(coordinateSystem: CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
  }

  /**
   * 全タイルテクスチャを一括ロード
   * ゲーム起動時に1回だけ呼ぶ
   */
  async loadTextures(): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    for (const [tileType, path] of Object.entries(TILE_TEXTURES)) {
      const type = Number(tileType);
      loadPromises.push(
        PIXI.Assets.load(path).then((texture) => {
          this.textures.set(type, texture);
        })
      );
    }

    await Promise.all(loadPromises);
    this.texturesLoaded = true;
  }

  /**
   * タイルを描画（ビューポート内のみ）
   */
  renderTiles(
    layer: PIXI.Container,
    tileMap: TileMap,
    camera: Camera,
    coordSystem: CoordinateSystem
  ): void {
    if (!this.texturesLoaded) {
      console.warn('TileRenderer: textures not loaded yet');
      return;
    }

    // ビューポート範囲を計算
    const viewport = this.calculateViewport(camera, coordSystem);

    // 不要になったスプライトをプールに返す
    this.recycleInvisibleSprites(viewport, tileMap);

    // ビューポート内のタイルを描画
    for (let y = viewport.minY; y <= viewport.maxY; y++) {
      for (let x = viewport.minX; x <= viewport.maxX; x++) {
        const tile = tileMap.getTile(x, y);
        if (!tile || tile.type === TileType.EMPTY) continue;

        const key = `${x},${y}`;
        if (this.activeSprites.has(key)) continue; // 既に描画済み

        const texture = this.textures.get(tile.type);
        if (!texture) continue;

        const sprite = this.acquireSprite(texture);
        sprite.anchor.set(0.5, 0.5);

        // ワールド座標（カメラオフセットなし）
        const screenPos = coordSystem.isometricToScreen(x, y, 0);
        sprite.x = screenPos.x;
        sprite.y = screenPos.y;

        // 視野状態を適用
        this.applyVisibility(sprite, tile);

        layer.addChild(sprite);
        this.activeSprites.set(key, sprite);
      }
    }
  }

  /**
   * カメラ移動時にビューポートを更新
   */
  updateViewport(
    layer: PIXI.Container,
    camera: Camera,
    coordSystem: CoordinateSystem,
    tileMap: TileMap | null
  ): void {
    if (!tileMap) return;
    this.renderTiles(layer, tileMap, camera, coordSystem);
  }

  /**
   * ビューポート範囲を計算
   * アイソメトリック座標系での画面に映るタイル範囲
   */
  private calculateViewport(
    camera: Camera,
    coordSystem: CoordinateSystem
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const screenW = RENDER_CONFIG.SCREEN_WIDTH;
    const screenH = RENDER_CONFIG.SCREEN_HEIGHT;
    const zoom = camera.zoom;

    // 画面の4隅をワールド座標に逆変換
    const corners = [
      { x: 0, y: 0 },
      { x: screenW, y: 0 },
      { x: 0, y: screenH },
      { x: screenW, y: screenH },
    ];

    let minTileX = Infinity, maxTileX = -Infinity;
    let minTileY = Infinity, maxTileY = -Infinity;

    for (const corner of corners) {
      const worldX = corner.x / zoom + camera.x;
      const worldY = corner.y / zoom + camera.y;
      const tile = coordSystem.screenToTile(worldX, worldY);
      minTileX = Math.min(minTileX, tile.x);
      maxTileX = Math.max(maxTileX, tile.x);
      minTileY = Math.min(minTileY, tile.y);
      maxTileY = Math.max(maxTileY, tile.y);
    }

    // 余裕を持たせる（1タイル分）
    const margin = 1;
    return {
      minX: minTileX - margin,
      maxX: maxTileX + margin,
      minY: minTileY - margin,
      maxY: maxTileY + margin,
    };
  }

  /**
   * ビューポート外のスプライトをプールに返す
   */
  private recycleInvisibleSprites(
    viewport: { minX: number; maxX: number; minY: number; maxY: number },
    tileMap: TileMap
  ): void {
    const toRemove: string[] = [];

    for (const [key, sprite] of this.activeSprites) {
      const [x, y] = key.split(',').map(Number);
      if (x < viewport.minX || x > viewport.maxX ||
          y < viewport.minY || y > viewport.maxY) {
        sprite.parent?.removeChild(sprite);
        this.releaseSprite(sprite);
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      this.activeSprites.delete(key);
    }
  }

  /**
   * 視野状態に応じてタイルの表示を変更
   */
  private applyVisibility(sprite: PIXI.Sprite, tile: Tile): void {
    if (!tile.explored) {
      sprite.visible = false;
    } else if (!tile.visible) {
      sprite.visible = true;
      sprite.tint = 0x808080; // 探索済み・視野外は暗く
    } else {
      sprite.visible = true;
      sprite.tint = 0xffffff; // 視野内は通常
    }
  }

  /**
   * タイル可視性を更新（FOV変更時）
   */
  updateTileVisibility(
    tileX: number,
    tileY: number,
    visible: boolean,
    explored: boolean
  ): void {
    const key = `${tileX},${tileY}`;
    const sprite = this.activeSprites.get(key);
    if (!sprite) return;

    if (!explored) {
      sprite.visible = false;
    } else if (!visible) {
      sprite.visible = true;
      sprite.tint = 0x808080;
    } else {
      sprite.visible = true;
      sprite.tint = 0xffffff;
    }
  }

  /**
   * スプライトをプールから取得
   */
  private acquireSprite(texture: PIXI.Texture): PIXI.Sprite {
    const sprite = this.spritePool.pop() ?? new PIXI.Sprite();
    sprite.texture = texture;
    sprite.visible = true;
    sprite.tint = 0xffffff;
    sprite.alpha = 1.0;
    return sprite;
  }

  /**
   * スプライトをプールに返す
   */
  private releaseSprite(sprite: PIXI.Sprite): void {
    this.spritePool.push(sprite);
  }

  /**
   * 全タイルスプライトをクリア（マップ切替時）
   */
  clear(layer: PIXI.Container): void {
    for (const [key, sprite] of this.activeSprites) {
      sprite.parent?.removeChild(sprite);
      this.releaseSprite(sprite);
    }
    this.activeSprites.clear();
  }
}
```

### 3.6 AnimationManager（新規・単一ループ）

```typescript
// src/engine/graphics/AnimationManager.ts

/**
 * アニメーション管理
 * Engineのゲームループ内で更新される（独立RAFなし）
 */
export type EasingFn = (t: number) => number;

export const Easing = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

interface AnimationTrack {
  id: string;
  duration: number;       // ミリ秒
  elapsed: number;        // 経過時間
  easing: EasingFn;
  onUpdate: (progress: number) => void;  // progress: 0.0〜1.0 (easing適用済み)
  onComplete?: () => void;
}

export class AnimationManager {
  private tracks: Map<string, AnimationTrack> = new Map();

  /**
   * アニメーションを開始
   */
  animate(track: Omit<AnimationTrack, 'elapsed'>): void {
    this.tracks.set(track.id, { ...track, elapsed: 0 });
  }

  /**
   * アニメーションを停止
   */
  cancel(id: string): void {
    this.tracks.delete(id);
  }

  /**
   * 毎フレーム更新（Engineのゲームループから呼ばれる）
   */
  update(deltaTime: number): void {
    const completed: string[] = [];

    for (const [id, track] of this.tracks) {
      track.elapsed += deltaTime;

      const rawProgress = Math.min(track.elapsed / track.duration, 1);
      const easedProgress = track.easing(rawProgress);

      track.onUpdate(easedProgress);

      if (rawProgress >= 1) {
        track.onComplete?.();
        completed.push(id);
      }
    }

    for (const id of completed) {
      this.tracks.delete(id);
    }
  }

  /**
   * アニメーション中かどうか
   */
  isAnimating(id: string): boolean {
    return this.tracks.has(id);
  }

  /**
   * 全アニメーションをクリア
   */
  clear(): void {
    this.tracks.clear();
  }
}
```

### 3.7 SpriteComponent（再作成）

```typescript
// src/engine/entity/components/Sprite.ts

/**
 * スプライトコンポーネント
 * 論理座標(整数)をワールド座標(ピクセル)に変換して配置
 * アニメーション中は補間座標を使用
 */
export class SpriteComponent implements Component {
  type = 'sprite';
  entity: Entity | null = null;

  private sprite: PIXI.Sprite | null = null;
  private layer: RenderLayer;
  private anchor: { x: number; y: number };

  // 描画用オフセット（アニメーション中の補間）
  // 論理座標はTransformComponentが管理（整数）
  // このオフセットは0.0〜1.0の範囲で、移動元→移動先の補間を表す
  private renderOffsetX = 0;
  private renderOffsetY = 0;

  private _visible = true;
  private _inPlayerFOV = true;

  // エフェクト用オフセット（シェイク等）
  private effectOffsetX = 0;
  private effectOffsetY = 0;

  constructor(
    textureSrc: string | PIXI.Texture,
    layer: RenderLayer = RenderLayer.CHARACTERS,
    anchor: { x: number; y: number } = { x: 0.5, y: 1.0 }
  ) {
    this.layer = layer;
    this.anchor = anchor;
    // テクスチャは初期化時にロード
  }

  async initialize(): Promise<void> {
    if (!this.entity) return;

    // テクスチャロード（キャッシュ済み）
    let texture: PIXI.Texture;
    if (typeof this.textureSrc === 'string') {
      texture = await PIXI.Assets.load(this.textureSrc);
    } else {
      texture = this.textureSrc;
    }

    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(this.anchor.x, this.anchor.y);

    // 初期位置を設定
    this.updateSpritePosition();

    // レンダラーに追加
    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (rendererSystem) {
      rendererSystem.addSprite(this.sprite, this.layer);
    }

    // イベントリスナー
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem && this.entity) {
      eventSystem.on('entity_visibility_changed', (data) => {
        if (data.entityId === this.entity?.id) {
          this.setInFOV(data.inFOV);
        }
      });
    }
  }

  /**
   * 毎フレーム更新
   */
  update(_deltaTime: number): void {
    if (!this.entity || !this.sprite) return;

    // 描画座標を更新（オフセットがあれば適用）
    this.updateSpritePosition();

    // 可視性更新
    if (this.entity.hasTag('player')) {
      this.sprite.visible = this._visible && this.entity.active;
    } else {
      this.sprite.visible = this._visible && this.entity.active && this._inPlayerFOV;
    }
  }

  /**
   * スプライトのワールド座標を計算して設定
   * worldContainerがカメラオフセットを適用するため、
   * ここではカメラオフセットなしのワールド座標を設定する
   */
  private updateSpritePosition(): void {
    if (!this.sprite || !this.entity) return;

    const transform = this.entity.getComponent<TransformComponent>('transform');
    if (!transform) return;

    const pos = transform.position; // 整数座標

    // アニメーションオフセットを適用
    const renderX = pos.x + this.renderOffsetX;
    const renderY = pos.y + this.renderOffsetY;

    // タイル座標 → ワールドピクセル座標
    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (!rendererSystem) return;

    const coordSystem = rendererSystem.getCoordinateSystem();
    const screenPos = coordSystem.isometricToScreen(renderX, renderY, pos.z);

    // エフェクトオフセットを加算（ワールド座標系）
    this.sprite.x = screenPos.x + this.effectOffsetX;
    this.sprite.y = screenPos.y + this.effectOffsetY;

    // 深度ソート
    this.sprite.zIndex = (renderX + renderY) * 1000 + pos.z * 100;
  }

  /**
   * 移動アニメーション用の描画オフセットを設定
   * @param fromTileX 移動元タイルX
   * @param fromTileY 移動元タイルY
   * @param toTileX 移動先タイルX
   * @param toTileY 移動先タイルY
   * @param progress 0.0〜1.0
   */
  setMoveAnimation(
    fromTileX: number, fromTileY: number,
    toTileX: number, toTileY: number,
    progress: number
  ): void {
    // 論理座標は既にtoTileに確定しているため、
    // オフセット = from - to + (to - from) * progress
    // = (from - to) * (1 - progress)
    this.renderOffsetX = (fromTileX - toTileX) * (1 - progress);
    this.renderOffsetY = (fromTileY - toTileY) * (1 - progress);
  }

  /**
   * 移動アニメーション終了
   */
  clearMoveAnimation(): void {
    this.renderOffsetX = 0;
    this.renderOffsetY = 0;
  }

  /**
   * エフェクトオフセットを設定（シェイク等）
   */
  setEffectOffset(x: number, y: number): void {
    this.effectOffsetX = x;
    this.effectOffsetY = y;
  }

  setInFOV(inFOV: boolean): void {
    this._inPlayerFOV = inFOV;
  }

  getSprite(): PIXI.Sprite | null { return this.sprite; }

  destroy(): void {
    if (this.sprite) {
      const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
      if (rendererSystem) {
        rendererSystem.removeSprite(this.sprite, this.layer);
      }
      this.sprite.destroy();
      this.sprite = null;
    }
    this.entity = null;
  }
}
```

### 3.8 MovementComponent（再作成）

```typescript
// src/engine/entity/components/Movement.ts

/**
 * 移動コンポーネント
 * 論理座標は移動開始時に即座に確定
 * 描画はAnimationManagerで補間
 */
export class MovementComponent implements Component {
  type = 'movement';
  entity: Entity | null = null;

  private _direction: Direction = 'down';
  private _isMoving = false;
  private _moveDuration: number; // ミリ秒

  // 移動元座標（描画アニメーション用）
  private _fromX = 0;
  private _fromY = 0;

  // アニメーションID
  private _animId: string | null = null;

  constructor(moveDuration = 250) {
    this._moveDuration = Math.max(1, moveDuration);
  }

  initialize(): void {}

  /**
   * 毎フレーム更新
   * deltaTimeベースで計時（performance.now()不使用）
   */
  update(_deltaTime: number): void {
    // アニメーションはAnimationManagerが管理するため、
    // ここでは何もしない
  }

  /**
   * 指定方向に移動
   */
  moveInDirection(direction: Direction): boolean {
    if (!this.entity || this._isMoving) return false;

    const transform = this.entity.getComponent<TransformComponent>('transform');
    if (!transform) return false;

    const currentPos = transform.position;
    this._direction = direction;

    let nextX = currentPos.x;
    let nextY = currentPos.y;
    switch (direction) {
      case 'up': nextY -= 1; break;
      case 'down': nextY += 1; break;
      case 'left': nextX -= 1; break;
      case 'right': nextX += 1; break;
    }

    if (!this.canMoveTo(nextX, nextY, currentPos.z)) {
      this.emitDirectionChangedEvent();
      return false;
    }

    return this.startMoving(currentPos.x, currentPos.y, nextX, nextY, currentPos.z);
  }

  /**
   * 指定座標への移動を開始
   */
  moveTo(targetX: number, targetY: number, targetZ = 0): boolean {
    if (!this.entity || this._isMoving) return false;

    const transform = this.entity.getComponent<TransformComponent>('transform');
    if (!transform) return false;

    const currentPos = transform.position;
    if (!this.canMoveTo(targetX, targetY, targetZ)) return false;

    return this.startMoving(currentPos.x, currentPos.y, targetX, targetY, targetZ);
  }

  /**
   * 移動を開始
   * 論理座標は即座に目標タイルへ確定
   * 描画はアニメーションで補間
   */
  private startMoving(
    fromX: number, fromY: number,
    toX: number, toY: number, z: number
  ): boolean {
    if (!this.entity) return false;

    const transform = this.entity.getComponent<TransformComponent>('transform');
    if (!transform) return false;

    this._isMoving = true;
    this._fromX = fromX;
    this._fromY = fromY;

    // 方向更新
    if (toX > fromX) this._direction = 'right';
    else if (toX < fromX) this._direction = 'left';
    else if (toY > fromY) this._direction = 'down';
    else if (toY < fromY) this._direction = 'up';

    // 論理座標を即座に確定（整数座標）
    transform.setPosition(toX, toY, z);

    // 描画アニメーションを開始
    const spriteComponent = this.entity.getComponent<SpriteComponent>('sprite');
    const animationManager = Engine.instance
      .getSystem<RendererSystem>('renderer')
      ?.getAnimationManager();

    if (spriteComponent && animationManager) {
      this._animId = `move_${this.entity.id}_${Date.now()}`;
      animationManager.animate({
        id: this._animId,
        duration: this._moveDuration,
        easing: Easing.easeInOut,
        onUpdate: (progress) => {
          spriteComponent.setMoveAnimation(
            this._fromX, this._fromY,
            toX, toY,
            progress
          );
        },
        onComplete: () => {
          spriteComponent.clearMoveAnimation();
          this._isMoving = false;
          this._animId = null;
          this.emitMoveCompletedEvent();
        },
      });
    } else {
      // アニメーションシステムがない場合は即座に完了
      this._isMoving = false;
      this.emitMoveCompletedEvent();
    }

    this.emitMoveStartedEvent();
    this.emitDirectionChangedEvent();
    return true;
  }

  /**
   * 移動可能かチェック
   * 整数座標で判定（Math.round不要）
   */
  private canMoveTo(x: number, y: number, z: number): boolean {
    const worldSystem = Engine.instance.getSystem<WorldSystem>('world');
    if (worldSystem) {
      const entityId = this.entity?.id;
      return worldSystem.isWalkable(x, y, z, entityId);
    }
    return x >= 0 && y >= 0;
  }

  get isMoving(): boolean { return this._isMoving; }
  get direction(): Direction { return this._direction; }
  set direction(value: Direction) {
    if (this._direction !== value) {
      this._direction = value;
      this.emitDirectionChangedEvent();
    }
  }

  destroy(): void {
    if (this._animId) {
      const animationManager = Engine.instance
        .getSystem<RendererSystem>('renderer')
        ?.getAnimationManager();
      animationManager?.cancel(this._animId);
    }
    this.entity = null;
  }

  // イベント発行メソッドは現状維持
  private emitMoveStartedEvent(): void { /* ... */ }
  private emitMoveCompletedEvent(): void { /* ... */ }
  private emitDirectionChangedEvent(): void { /* ... */ }
}
```

### 3.9 EffectSystem（再作成）

```typescript
// src/engine/effects/EffectSystem.ts

/**
 * エフェクトシステム
 * AnimationManagerを使用してエフェクトを再生
 * 独立RAFなし、sprite.x/y直接書き換えなし
 */
export class EffectSystem implements System {
  private engine: Engine | null = null;
  private eventSystem: EventSystem | null = null;
  private entitySystem: EntitySystem | null = null;
  private rendererSystem: RendererSystem | null = null;

  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;
    this.rendererSystem = engine.getSystem<RendererSystem>('renderer') || null;
    this.setupEventListeners();
  }

  update(_deltaTime: number): void {
    // アニメーションはAnimationManagerが管理
  }

  /**
   * ダメージエフェクト（フラッシュ + シェイク）
   */
  playDamageEffect(entityId: string): void {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return;

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) return;

    const sprite = spriteComponent.getSprite();
    if (!sprite) return;

    const animationManager = this.rendererSystem?.getAnimationManager();
    if (!animationManager) return;

    const animId = `damage_${entityId}_${Date.now()}`;

    // 元のtintを保存
    const originalTint = sprite.tint;

    animationManager.animate({
      id: animId,
      duration: 200,
      easing: Easing.linear,
      onUpdate: (progress) => {
        // フラッシュ：前半は赤、後半は戻る
        if (progress < 0.5) {
          sprite.tint = 0xff0000;
        } else {
          // 徐々に元の色に戻す
          sprite.tint = originalTint;
        }

        // シェイク：減衰オシレーション
        const amplitude = 10;
        const frequency = 30;
        const shake = Math.sin(progress * Math.PI * frequency) * amplitude * (1 - progress);
        spriteComponent.setEffectOffset(shake, shake);
      },
      onComplete: () => {
        sprite.tint = originalTint;
        spriteComponent.setEffectOffset(0, 0);
      },
    });
  }

  /**
   * 回復エフェクト（緑フラッシュ）
   */
  playHealEffect(entityId: string): void {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return;

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) return;

    const sprite = spriteComponent.getSprite();
    if (!sprite) return;

    const animationManager = this.rendererSystem?.getAnimationManager();
    if (!animationManager) return;

    const originalTint = sprite.tint;
    const animId = `heal_${entityId}_${Date.now()}`;

    animationManager.animate({
      id: animId,
      duration: 200,
      easing: Easing.easeOut,
      onUpdate: (progress) => {
        if (progress < 0.5) {
          sprite.tint = 0x00ff00;
        } else {
          sprite.tint = originalTint;
        }
      },
      onComplete: () => {
        sprite.tint = originalTint;
      },
    });
  }

  /**
   * 攻撃エフェクト（前進→後退）
   */
  playAttackEffect(entityId: string): void {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return;

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) return;

    const animationManager = this.rendererSystem?.getAnimationManager();
    if (!animationManager) return;

    const animId = `attack_${entityId}_${Date.now()}`;
    const forwardDistance = 20;

    animationManager.animate({
      id: animId,
      duration: 300,
      easing: Easing.easeInOut,
      onUpdate: (progress) => {
        // 前半：前進、後半：後退
        let offset: number;
        if (progress < 0.5) {
          offset = forwardDistance * (progress * 2);
        } else {
          offset = forwardDistance * (2 - progress * 2);
        }
        // エフェクトオフセットはワールド座標系
        // アイソメトリックなのでX方向のみ
        spriteComponent.setEffectOffset(offset, 0);
      },
      onComplete: () => {
        spriteComponent.setEffectOffset(0, 0);
      },
    });
  }

  /**
   * 爆発エフェクト（パーティクル）
   * PIXI v8 API使用
   */
  playExplosionEffect(position: { x: number; y: number; z?: number }): void {
    if (!this.rendererSystem) return;

    const coordSystem = this.rendererSystem.getCoordinateSystem();
    const screenPos = coordSystem.isometricToScreen(
      position.x, position.y, position.z || 0
    );

    // パーティクルコンテナを作成（ワールド座標）
    const explosionContainer = new PIXI.Container();
    explosionContainer.x = screenPos.x;
    explosionContainer.y = screenPos.y;

    const particleCount = 60;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const particle = new Particle(60);
      particles.push(particle);
      explosionContainer.addChild(particle.graphics);
    }

    // EFFECTSレイヤーに追加
    const effectLayer = this.rendererSystem.getLayerContainer(RenderLayer.EFFECTS);
    effectLayer.addChild(explosionContainer);

    // AnimationManagerでパーティクルアニメーション
    const animationManager = this.rendererSystem.getAnimationManager();
    const animId = `explosion_${Date.now()}`;

    animationManager.animate({
      id: animId,
      duration: 1000,
      easing: Easing.linear,
      onUpdate: (progress) => {
        const alive: Particle[] = [];
        for (const particle of particles) {
          if (particle.update()) {
            alive.push(particle);
          } else {
            particle.graphics.parent?.removeChild(particle.graphics);
          }
        }
        // particles配列を更新（参照を維持するためlength=0してpush）
        particles.length = 0;
        particles.push(...alive);
      },
      onComplete: () => {
        explosionContainer.parent?.removeChild(explosionContainer);
        explosionContainer.destroy({ children: true });
      },
    });
  }

  private setupEventListeners(): void {
    if (!this.eventSystem) return;
    this.eventSystem.on('damage_taken', (data) => this.playDamageEffect(data.entityId));
    this.eventSystem.on('health_recovered', (data) => this.playHealEffect(data.entityId));
    this.eventSystem.on('enemy_destroyed', (data) => {
      if (data?.position) this.playExplosionEffect(data.position);
    });
    this.eventSystem.on('attack_performed', (data) => this.playAttackEffect(data.entityId));
  }
}

/**
 * パーティクル（PIXI v8 API）
 */
class Particle {
  graphics: PIXI.Graphics;
  private vx: number;
  private vy: number;
  private radius: number;
  private color: number;
  private decay: number;

  constructor(explosionSize: number) {
    this.graphics = new PIXI.Graphics();
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * explosionSize * 0.2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = Math.random() * explosionSize * 0.05 + explosionSize * 0.02;
    this.color = this.getRandomRedOrange();
    this.decay = Math.random() * 0.02 + 0.02;
    this.draw();
  }

  private getRandomRedOrange(): number {
    const r = Math.floor(Math.random() * 56) + 200;
    const g = Math.floor(Math.random() * 180);
    const b = Math.floor(Math.random() * 100);
    return (r << 16) | (g << 8) | b;
  }

  private draw(): void {
    this.graphics.clear();
    this.graphics.circle(0, 0, this.radius);
    this.graphics.fill(this.color);
  }

  update(): boolean {
    this.graphics.x += this.vx;
    this.graphics.y += this.vy;
    this.graphics.alpha -= this.decay;
    this.radius *= 0.99;
    if (this.radius > 0.1) this.draw();
    return this.graphics.alpha > 0;
  }
}
```

---

## 4. データフロー

### 4.1 通常時（静止）

```
TransformComponent.position = (5, 10, 0)  [整数]
  ↓
SpriteComponent.update()
  ↓
CoordinateSystem.isometricToScreen(5, 10, 0) → (screenX, screenY)  [ピクセル]
  ↓
sprite.x = screenX, sprite.y = screenY  [ワールド座標]
  ↓
worldContainer.position = (-camera.x, -camera.y)  [カメラオフセット]
  ↓
PIXIが描画
```

### 4.2 移動時

```
InputSystem → MovementComponent.moveInDirection('right')
  ↓
canMoveTo(6, 10, 0) → WorldSystem.isWalkable(6, 10, 0) → true
  ↓
TransformComponent.setPosition(6, 10, 0)  [即座に確定・整数]
  ↓
AnimationManager.animate({ id, duration: 250ms, easing: easeInOut,
  onUpdate: (progress) => {
    SpriteComponent.setMoveAnimation(5, 10, 6, 10, progress)
    // renderOffsetX = (5-6) * (1-progress) = -1 * (1-progress)
    // progress=0 → offset=-1 (5の位置に描画)
    // progress=0.5 → offset=-0.5 (5.5の位置に描画)
    // progress=1 → offset=0 (6の位置に描画)
  }
})
  ↓
SpriteComponent.update() → isometricToScreen(6 + offset, 10, 0)
  ↓
PIXIが描画
```

### 4.3 エフェクト時

```
CombatSystem → eventSystem.emit('damage_taken', { entityId })
  ↓
EffectSystem.playDamageEffect(entityId)
  ↓
AnimationManager.animate({ id, duration: 200ms,
  onUpdate: (progress) => {
    SpriteComponent.setEffectOffset(shakeX, shakeY)  [ピクセル単位]
    sprite.tint = 0xff0000
  }
})
  ↓
SpriteComponent.update()
  → sprite.x = screenPos.x + effectOffsetX  [ワールド座標 + エフェクト]
  → worldContainer.position でカメラオフセット適用
  ↓
PIXIが描画
```

### 4.4 カメラ追従

```
Player移動完了 → eventSystem.emit('move_completed')
  ↓
Camera.lookAtTile(tileX, tileY, tileZ, coordSystem)
  → camera.setTargetPosition(screenX - SCREEN_W/2, screenY - SCREEN_H/2)
  ↓
RendererSystem.update(deltaTime)
  → camera.update(deltaTime)  [lerpでスムーズ移動]
  → worldContainer.position.set(-camera.x, -camera.y)  [O(1)]
```

---

## 5. 削除・移行対象

### 削除ファイル

| ファイル | 理由 |
|----------|------|
| `src/engine/graphics/Layer.ts` | 未使用デッドコード |
| `src/engine/graphics/Tile.ts` | TileMapのTileと重複、PIXI v7 API |
| `src/common/EffectManager.ts` | AnimationManagerに統合 |
| `src/common/VisualEffect.ts` | EffectSystemに統合、PIXI v7 API |

### 再作成ファイル

| ファイル | 変更内容 |
|----------|----------|
| `src/engine/graphics/RendererSystem.ts` | 全再作成 |
| `src/engine/graphics/CoordinateSystem.ts` | 微修正（リネーム・ピッキング追加） |
| `src/engine/graphics/Camera.ts` | 微修正（deltaTime・lookAtTile追加） |
| `src/engine/entity/components/Sprite.ts` | 全再作成 |
| `src/engine/entity/components/Movement.ts` | 全再作成 |
| `src/engine/effects/EffectSystem.ts` | 全再作成 |

### 新規ファイル

| ファイル | 用途 |
|----------|------|
| `src/engine/graphics/RenderConfig.ts` | 定数・設定 |
| `src/engine/graphics/TileRenderer.ts` | タイル描画・カリング・プーリング |
| `src/engine/graphics/AnimationManager.ts` | アニメーション統合管理 |

### 影響を受けるが修正で対応

| ファイル | 変更内容 |
|----------|----------|
| `src/game/Game.ts` | RendererSystem初期化・カメラ設定のハードコード除去 |
| `src/engine/entity/Player.ts` | カメラ追従の`setTargetPosition`呼び出しを`lookAtTile`に変更 |
| `src/engine/interaction/InteractionSystem.ts` | ピッキングを`screenToTile`に変更 |
| `src/engine/fov/FOVSystem.ts` | タイル可視性更新を`TileRenderer.updateTileVisibility`に委譲 |

---

## 6. 移行ステップ

1. **新規ファイル作成**: RenderConfig, TileRenderer, AnimationManager
2. **CoordinateSystem・Camera修正**
3. **RendererSystem再作成**
4. **SpriteComponent・MovementComponent再作成**
5. **EffectSystem再作成**
6. **Game.ts・Player.ts・InteractionSystem.ts修正**
7. **旧ファイル削除**: Layer.ts, Tile.ts(graphics), EffectManager.ts, VisualEffect.ts
8. **動作確認**: タイル描画→キャラクター描画→移動アニメーション→エフェクト→カメラ追従→ピッキング
