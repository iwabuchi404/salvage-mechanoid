import * as PIXI from 'pixi.js';
import { System } from '../System';
import { Engine } from '../Engine';
import { CoordinateSystem } from './CoordinateSystem';
import { Camera } from './Camera';
import { TileRenderer } from './TileRenderer';
import { AnimationManager } from './AnimationManager';
import { EventSystem } from '../events/EventSystem';
import { LayerName, Vector3 } from '../types';
import { RENDER_CONFIG as CONFIG } from './RenderConfig';

/**
 * レンダリングシステム - PIXIJSを使用して画面描画を管理
 * ワールドコンテナ方式によりカメラ移動をO(1)で実現
 */
export class RendererSystem implements System {
  private app: PIXI.Application | null = null;
  private canvas: HTMLCanvasElement | null = null;

  // ワールドコンテナ（カメラ移動・ズーム・回転を適用）
  private worldContainer: PIXI.Container | null = null;

  // レイヤー（ワールドコンテナ内）
  private terrainLayer: PIXI.Container | null = null;
  private highlightLayer: PIXI.Container | null = null;
  private objectLayer: PIXI.Container | null = null;
  private characterLayer: PIXI.Container | null = null;
  private effectLayer: PIXI.Container | null = null;

  // UIレイヤー（画面固定、カメラ追従なし）
  private uiLayer: PIXI.Container | null = null;

  // レガシーレイヤーマップ（後方互換用）
  private layers: Map<string, PIXI.Container> = new Map();

  private coordinateSystem: CoordinateSystem;
  private camera: Camera;
  private tileRenderer: TileRenderer;
  private animationManager: AnimationManager;

  // ハイライト
  private highlightGraphics: PIXI.Graphics | null = null;
  private hoveredTile: { x: number; y: number } | null = null;
  private tileMapData: number[][] | null = null;

  // カメラ位置キャッシュ
  private lastCameraX = Infinity;
  private lastCameraY = Infinity;
  private lastCameraZoom = -1;

  /**
   * コンストラクタ
   * @param tileWidth タイルの幅（ピクセル）
   * @param tileHeight タイルの高さ（ピクセル）
   */
  constructor(tileWidth: number = CONFIG.TILE_WIDTH, tileHeight: number = CONFIG.TILE_HEIGHT) {
    this.coordinateSystem = new CoordinateSystem(tileWidth, tileHeight);
    this.camera = new Camera();
    this.tileRenderer = new TileRenderer(this.coordinateSystem);
    this.animationManager = new AnimationManager();
  }

  /**
   * キャンバス要素を設定
   * @param canvas 描画先のキャンバス要素
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    if (!this.canvas) {
      throw new Error('Canvas must be set before initialization');
    }

    this.app = new PIXI.Application();
    await this.app.init({
      background: CONFIG.BACKGROUND_COLOR,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: CONFIG.ANTIALIAS,
      width: CONFIG.SCREEN_WIDTH,
      height: CONFIG.SCREEN_HEIGHT,
    });
    this.canvas.appendChild(this.app.canvas);

    this.setupLayers();
    this.setupHighlightLayer();

    // テクスチャ一括ロード
    await this.tileRenderer.loadTextures();

    const eventSystem = engine.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.on('render_entity', this.renderEntity.bind(this));
      eventSystem.on('tile_hovered', this.handleTileHover.bind(this));
      eventSystem.on('tile_visibility_changed', this.handleTileVisibilityChanged.bind(this));
    }
  }

  /**
   * レイヤーをセットアップ
   */
  private setupLayers(): void {
    // ワールドコンテナ（カメラ移動を適用）
    this.worldContainer = new PIXI.Container();
    this.app!.stage.addChild(this.worldContainer);

    // ワールド内レイヤー
    this.terrainLayer = new PIXI.Container();
    this.terrainLayer.sortableChildren = true;
    this.worldContainer.addChild(this.terrainLayer);
    this.layers.set(LayerName.TERRAIN, this.terrainLayer);

    this.highlightLayer = new PIXI.Container();
    this.highlightLayer.sortableChildren = false;
    this.worldContainer.addChild(this.highlightLayer);
    this.layers.set(LayerName.BACKGROUND, this.highlightLayer);

    this.objectLayer = new PIXI.Container();
    this.objectLayer.sortableChildren = true;
    this.worldContainer.addChild(this.objectLayer);
    this.layers.set(LayerName.OBJECTS, this.objectLayer);

    this.characterLayer = new PIXI.Container();
    this.characterLayer.sortableChildren = true;
    this.worldContainer.addChild(this.characterLayer);
    this.layers.set(LayerName.CHARACTERS, this.characterLayer);

    this.effectLayer = new PIXI.Container();
    this.effectLayer.sortableChildren = true;
    this.worldContainer.addChild(this.effectLayer);
    this.layers.set(LayerName.EFFECTS, this.effectLayer);

    // UIレイヤー（カメラ追従なし）
    this.uiLayer = new PIXI.Container();
    this.app!.stage.addChild(this.uiLayer);
    this.layers.set(LayerName.UI, this.uiLayer);
  }

  /**
   * エンティティをレンダリング
   * イベントシステムから呼び出される
   * @param data レンダリングデータ
   */
  renderEntity(data: {
    sprite: PIXI.Sprite;
    layer: string;
    position: Vector3;
    anchor?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
    tint?: number;
  }): void {
    const { sprite, layer, position, anchor, scale, rotation, tint } = data;

    // レイヤーの確認
    if (!sprite || !this.layers.has(layer)) {
      console.warn(`Cannot render entity: Invalid sprite or layer '${layer}'`);
      return;
    }

    // アンカーポイントを設定（指定があれば）
    if (anchor) {
      sprite.anchor.set(anchor.x, anchor.y);
    }

    // スケールを設定（指定があれば）
    if (scale) {
      sprite.scale.set(scale.x, scale.y);
    }

    // 回転を設定（指定があれば）
    if (rotation !== undefined) {
      sprite.rotation = rotation;
    }

    // 色合いを設定（指定があれば）
    if (tint !== undefined) {
      sprite.tint = tint;
    }

    // 深度ソートのためのzIndexを設定
    // Y座標が小さいほど手前に表示され、Z座標（高さ）も考慮
    sprite.zIndex = (position.y + position.x) * 1000 + position.z * 100;

    // スプライトをレイヤーに追加（まだ追加されていない場合）
    // 位置の設定はSpriteComponent.update()で行われるため、ここでは設定しない
    if (!sprite.parent) {
      this.layers.get(layer)!.addChild(sprite);
    }
  }

  /**
   * スプライトを指定したレイヤーから削除
   * @param sprite 削除するスプライト
   * @param layer レイヤー名
   */
  removeSprite(sprite: PIXI.Sprite, layer: string): void {
    if (this.layers.has(layer)) {
      this.layers.get(layer)!.removeChild(sprite);
    }
  }

  /**
   * 各フレームでの更新処理
   * ワールドコンテナ方式によりO(1)でカメラを適用
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // カメラの更新
    this.camera.update(deltaTime);

    // ワールドコンテナにカメラを適用（O(1)）
    if (this.worldContainer) {
      this.worldContainer.position.set(-this.camera.x, -this.camera.y);
      this.worldContainer.scale.set(this.camera.zoom);
      this.worldContainer.rotation = this.camera.rotation;
    }

    // ビューポートカリング（カメラが動いた時のみ）
    if (
      this.camera.x !== this.lastCameraX ||
      this.camera.y !== this.lastCameraY ||
      this.camera.zoom !== this.lastCameraZoom
    ) {
      if (this.terrainLayer) {
        this.tileRenderer.updateViewport(this.terrainLayer, this.camera, this.coordinateSystem);
      }
      this.updateHighlight();
      this.lastCameraX = this.camera.x;
      this.lastCameraY = this.camera.y;
      this.lastCameraZoom = this.camera.zoom;
    }

    // アニメーション更新
    this.animationManager.update(deltaTime);
  }

  /**
   * レンダラーのサイズを変更
   * @param width 新しい幅
   * @param height 新しい高さ
   */
  resize(width: number, height: number): void {
    if (this.app) {
      this.app.renderer.resize(width, height);

      // リサイズ後にカメラの位置を中央に調整するなどの処理を追加可能
    }
  }

  /**
   * カメラを取得
   * @returns カメラのインスタンス
   */
  getCamera(): Camera {
    return this.camera;
  }

  /**
   * 座標変換システムを取得
   * @returns 座標変換システムのインスタンス
   */
  getCoordinateSystem(): CoordinateSystem {
    return this.coordinateSystem;
  }

  /**
   * レイヤーを取得
   * @param name レイヤー名
   * @returns レイヤーのコンテナ、存在しない場合はundefined
   */
  getLayer(name: string): PIXI.Container | undefined {
    return this.layers.get(name);
  }

  /**
   * PIXIアプリケーションを取得
   * @returns PIXIアプリケーション、初期化されていない場合はnull
   */
  getApp(): PIXI.Application | null {
    return this.app;
  }

  /**
   * タイルマップを描画
   * TileRendererに委譲（ビューポートカリング・スプライトプーリング）
   * @param tileMap タイルマップデータ（2D配列）
   */
  async renderTileMap(tileMap: number[][]): Promise<void> {
    this.tileMapData = tileMap;

    const terrainLayer = this.layers.get(LayerName.TERRAIN);
    if (!terrainLayer) return;

    this.tileRenderer.clear();
    this.tileRenderer.renderTiles(terrainLayer, tileMap, this.camera, this.coordinateSystem);
  }

  /**
   * タイル可視性変更イベントを処理
   * @param data イベントデータ
   */
  private handleTileVisibilityChanged(data: {
    x: number;
    y: number;
    visible: boolean;
    explored: boolean;
  }): void {
    this.updateTileVisibility(data.x, data.y, data.visible, data.explored);
  }

  /**
   * タイルの可視性を更新
   * TileRendererに委譲
   * @param x X座標
   * @param y Y座標
   * @param visible 現在視野内かどうか
   * @param explored 探索済みかどうか
   */
  updateTileVisibility(x: number, y: number, visible: boolean, explored: boolean): void {
    this.tileRenderer.updateTileVisibility(x, y, visible, explored);
  }

  /**
   * ハイライトレイヤーをセットアップ
   * ワールドコンテナ内のhighlightLayerに配置
   */
  private setupHighlightLayer(): void {
    if (!this.highlightLayer) return;

    this.highlightGraphics = new PIXI.Graphics();
    this.highlightLayer.addChild(this.highlightGraphics);
  }

  /**
   * タイルホバーイベントを処理
   * @param data イベントデータ
   */
  private handleTileHover(data: { position: { x: number; y: number } | null }): void {
    // positionがnullの場合はハイライトを非表示
    if (!data.position) {
      this.hoveredTile = null;
      this.clearHighlight();
      return;
    }

    const { x, y } = data.position;

    // タイルマップデータが存在し、タイルが有効かチェック
    if (this.tileMapData) {
      // 範囲外チェック
      if (y < 0 || y >= this.tileMapData.length || x < 0 || x >= this.tileMapData[0]?.length) {
        this.hoveredTile = null;
        this.clearHighlight();
        return;
      }

      // タイルが存在するかチェック（0は空タイル）
      if (this.tileMapData[y][x] === 0) {
        this.hoveredTile = null;
        this.clearHighlight();
        return;
      }
    }

    // 同じタイルをホバー中の場合は何もしない
    if (this.hoveredTile && this.hoveredTile.x === x && this.hoveredTile.y === y) {
      return;
    }

    // 新しいタイルをホバー
    this.hoveredTile = { x, y };
    this.updateHighlight();
  }

  /**
   * ハイライトをクリア
   */
  private clearHighlight(): void {
    if (this.highlightGraphics) {
      this.highlightGraphics.clear();
    }
  }

  /**
   * ハイライトを更新
   * ワールド座標で描画（カメラオフセットはworldContainerが適用）
   */
  private updateHighlight(): void {
    if (!this.highlightGraphics || !this.hoveredTile) {
      return;
    }

    this.highlightGraphics.clear();

    // ワールド座標（カメラオフセットなし）
    const screenPos = this.coordinateSystem.isometricToScreen(
      this.hoveredTile.x,
      this.hoveredTile.y,
      0
    );

    const tileWidth = this.coordinateSystem.getTileWidth();
    const tileHeight = this.coordinateSystem.getTileHeight();

    const halfWidth = tileWidth / 2;
    const halfHeight = tileHeight / 3;
    const offsetY = -tileHeight / 6;

    this.highlightGraphics.poly([
      { x: screenPos.x, y: screenPos.y + offsetY - halfHeight },
      { x: screenPos.x + halfWidth, y: screenPos.y + offsetY },
      { x: screenPos.x, y: screenPos.y + offsetY + halfHeight },
      { x: screenPos.x - halfWidth, y: screenPos.y + offsetY },
    ]);
    this.highlightGraphics.fill({ color: 0xffa500, alpha: 0.3 });

    this.highlightGraphics.poly([
      { x: screenPos.x, y: screenPos.y + offsetY - halfHeight },
      { x: screenPos.x + halfWidth, y: screenPos.y + offsetY },
      { x: screenPos.x, y: screenPos.y + offsetY + halfHeight },
      { x: screenPos.x - halfWidth, y: screenPos.y + offsetY },
      { x: screenPos.x, y: screenPos.y + offsetY - halfHeight },
    ]);
    this.highlightGraphics.stroke({ width: 2, color: 0xffa500, alpha: 0.8 });
  }

  /**
   * AnimationManagerを取得
   * @returns AnimationManagerのインスタンス
   */
  getAnimationManager(): AnimationManager {
    return this.animationManager;
  }

  /**
   * TileRendererを取得
   * @returns TileRendererのインスタンス
   */
  getTileRenderer(): TileRenderer {
    return this.tileRenderer;
  }

  /**
   * スクリーン座標 → タイル座標（ピッキング）
   * @param screenX スクリーンX座標
   * @param screenY スクリーンY座標
   * @returns タイル座標（整数）
   */
  screenToTile(screenX: number, screenY: number): { x: number; y: number } {
    const worldX = screenX / this.camera.zoom + this.camera.x;
    const worldY = screenY / this.camera.zoom + this.camera.y;
    return this.coordinateSystem.screenToTile(worldX, worldY);
  }

  destroy(): void {
    this.tileRenderer.destroy();
    this.animationManager.destroy();

    for (const [, layer] of this.layers) {
      layer.destroy({ children: true });
    }
    this.layers.clear();

    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
  }
}
