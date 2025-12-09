import * as PIXI from 'pixi.js';
import { System } from '../System';
import { Engine } from '../Engine';
import { CoordinateSystem } from './CoordinateSystem';
import { Camera } from './Camera';
import { EventSystem } from '../events/EventSystem';
import { LayerName, Vector3 } from '../types';

/**
 * レンダリングシステム - PIXIJSを使用して画面描画を管理
 */
export class RendererSystem implements System {
  // PIXIJSアプリケーション
  private app: PIXI.Application | null = null;

  // 描画先のキャンバス要素
  private canvas: HTMLCanvasElement | null = null;

  // レイヤー（コンテナ）のマップ
  private layers: Map<string, PIXI.Container> = new Map();

  // 座標変換システム
  private coordinateSystem: CoordinateSystem;

  // カメラシステム
  private camera: Camera;

  // ハイライトレイヤー（タイルホバー用）
  private highlightLayer: PIXI.Container | null = null;

  // 現在ホバー中のタイル座標
  private hoveredTile: { x: number; y: number } | null = null;

  // ハイライトグラフィックス
  private highlightGraphics: PIXI.Graphics | null = null;

  // タイルマップデータ（タイルの存在判定用）
  private tileMapData: number[][] | null = null;

  // タイルスプライトのマップ（座標 -> スプライト）
  private tileSprites: Map<string, PIXI.Sprite> = new Map();

  // 警告済みの欠落タイル（スパム防止用）
  private missingTileWarnings: Set<string> | null = null;

  // レンダラーの設定
  private config = {
    backgroundColor: 0x202020,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
  };

  /**
   * コンストラクタ
   * @param tileWidth タイルの幅（ピクセル）
   * @param tileHeight タイルの高さ（ピクセル）
   */
  constructor(tileWidth = 160, tileHeight = 120) {
    this.coordinateSystem = new CoordinateSystem(tileWidth, tileHeight);
    this.camera = new Camera();
    console.log(`RendererSystem created with tile dimensions: ${tileWidth}x${tileHeight}`);
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

    console.log('Initializing RendererSystem...');

    // PIXIJSアプリケーションを作成
    this.app = new PIXI.Application();
    await this.app.init({
      background: this.config.backgroundColor,
      resolution: this.config.resolution,
      autoDensity: this.config.autoDensity,
      antialias: this.config.antialias,
    });
    console.log(
      'PIXI Application initialized with size:',
      this.app.screen.width,
      'x',
      this.app.screen.height
    );
    // キャンバスにPIXIJSのキャンバスを追加
    this.canvas.appendChild(this.app.canvas);

    // レイヤーをセットアップ
    this.setupLayers();

    // ハイライトレイヤーをセットアップ
    this.setupHighlightLayer();

    // イベントシステムとの連携
    const eventSystem = engine.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.on('render_entity', this.renderEntity.bind(this));
      eventSystem.on('tile_hovered', this.handleTileHover.bind(this));
      eventSystem.on('tile_visibility_changed', this.handleTileVisibilityChanged.bind(this));
      console.log(
        "Registered for 'render_entity', 'tile_hovered', and 'tile_visibility_changed' events"
      );
    } else {
      console.warn('EventSystem not found, rendering events will not be processed');
    }

    console.log('RendererSystem initialized');
  }

  /**
   * レイヤーをセットアップ
   */
  private setupLayers(): void {
    // レイヤー名の配列
    const layerNames = [
      LayerName.BACKGROUND,
      LayerName.TERRAIN,
      LayerName.OBJECTS,
      LayerName.CHARACTERS,
      LayerName.EFFECTS,
      LayerName.UI,
    ];

    // 各レイヤーを作成して登録
    layerNames.forEach((name, index) => {
      const layer = new PIXI.Container();
      layer.sortableChildren = true; // 自動深度ソート
      layer.zIndex = index * 100; // レイヤーの重ね順を設定

      this.app!.stage.addChild(layer);
      this.layers.set(name, layer);

      console.log(`Created layer: ${name} with zIndex: ${layer.zIndex}`);
    });

    // ルートステージにzIndexを設定
    this.app!.stage.sortableChildren = true;
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
    sprite.zIndex = (position.y + position.z * 100) * 1000 + position.x;

    // スプライトをレイヤーに追加（まだ追加されていない場合）
    // 位置の設定はSpriteComponent.update()で行われるため、ここでは設定しない
    if (!sprite.parent) {
      this.layers.get(layer)!.addChild(sprite);
      console.log(
        `Added sprite to layer '${layer}' at position (${position.x}, ${position.y}, ${position.z})`
      );
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
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // カメラの更新
    this.camera.update(deltaTime);

    // カメラが移動した場合のみテレイン更新（パフォーマンス最適化）
    if (this.camera.x !== this.lastCameraX || this.camera.y !== this.lastCameraY) {
      this.updateTerrainLayerPositions();
      this.updateHighlight(); // カメラ移動時にハイライトも更新
      this.lastCameraX = this.camera.x;
      this.lastCameraY = this.camera.y;
    }

    // 必要に応じて他の更新処理を追加
    // 例: アニメーションの更新、パーティクルシステムの更新など
  }

  // カメラ位置のキャッシュ（最適化用）
  private lastCameraX = 0;
  private lastCameraY = 0;

  /**
   * すべてのレイヤーのスプライト位置をカメラオフセットに合わせて更新
   */
  private updateTerrainLayerPositions(): void {
    // カメラ追従が必要なレイヤーを更新
    const cameraFollowLayers = [
      LayerName.TERRAIN,
      LayerName.OBJECTS,
      LayerName.CHARACTERS,
      LayerName.EFFECTS,
    ];

    for (const layerName of cameraFollowLayers) {
      const layer = this.layers.get(layerName);
      if (!layer) continue;

      for (const child of layer.children) {
        const sprite = child as PIXI.Sprite & {
          __baseScreenX?: number;
          __baseScreenY?: number;
        };

        if (sprite.__baseScreenX === undefined || sprite.__baseScreenY === undefined) continue;

        sprite.x = sprite.__baseScreenX - this.camera.x;
        sprite.y = sprite.__baseScreenY - this.camera.y;
      }
    }
  }

  /**
   * レンダラーのサイズを変更
   * @param width 新しい幅
   * @param height 新しい高さ
   */
  resize(width: number, height: number): void {
    if (this.app) {
      console.log(`Resizing renderer to ${width}x${height}`);
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
   * @param tileMap タイルマップデータ（2D配列）
   * @param tileWidth タイルの幅
   * @param tileHeight タイルの高さ
   */
  async renderTileMap(tileMap: number[][]): Promise<void> {
    console.log(`Rendering tilemap: ${tileMap[0]?.length}x${tileMap.length}`);

    // タイルマップデータを保存（ハイライト判定用）
    this.tileMapData = tileMap;

    const terrainLayer = this.layers.get(LayerName.TERRAIN);
    if (!terrainLayer) {
      console.warn('Terrain layer not found');
      return;
    }

    // 既存のタイルをクリア
    terrainLayer.removeChildren();
    this.tileSprites.clear();

    // タイルマップを描画
    for (let y = 0; y < tileMap.length; y++) {
      for (let x = 0; x < tileMap[y].length; x++) {
        const tileType = tileMap[y][x];

        // 空タイル（0）はスキップ
        if (tileType === 0) continue;

        // タイルのテクスチャを決定
        const texturePath = this.getTileTexture(tileType);

        try {
          // テクスチャを読み込み
          const texture = await PIXI.Assets.load(texturePath);

          // スプライトを作成
          const sprite = new PIXI.Sprite(texture) as PIXI.Sprite & {
            __baseScreenX?: number;
            __baseScreenY?: number;
          };
          sprite.anchor.set(0.5, 0.5); // 旧システムに合わせてタイル中心をアンカーに

          // アイソメトリック座標をスクリーン座標に変換
          const screenPos = this.coordinateSystem.isometricToScreen(x, y, 0);
          sprite.__baseScreenX = screenPos.x;
          sprite.__baseScreenY = screenPos.y;

          // カメラオフセットを適用（カメラが移動すると、スプライトは逆方向に移動）
          sprite.x = screenPos.x - this.camera.x;
          sprite.y = screenPos.y - this.camera.y;

          // 各タイルタイプで異なる画像を使用するため、色調変更は不要

          // 深度ソート用のzIndexを設定
          sprite.zIndex = y * 1000 + x;

          // タイルスプライトマップに保存
          this.tileSprites.set(`${x},${y}`, sprite);

          terrainLayer.addChild(sprite);
        } catch (error) {
          console.warn(`Failed to load tile texture: ${texturePath}`, error);
        }
      }
    }

    console.log(
      `Rendered ${terrainLayer.children.length} tiles, tileSprites map size: ${this.tileSprites.size}`
    );
  }

  /**
   * タイルタイプに応じたテクスチャパスを取得
   * @param tileType タイルタイプ
   * @returns テクスチャパス
   */
  private getTileTexture(tileType: number): string {
    // publicフォルダ内の画像を使用
    switch (tileType) {
      case 1: // GRASS (床)
        return './image.png';
      case 2: // WATER
        return './image02.png';
      case 3: // MOUNTAIN (壁)
        return './image03.png';
      case 4: // TILE
        return './image.png';
      default:
        return './image.png';
    }
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
   * @param x X座標
   * @param y Y座標
   * @param visible 現在視野内かどうか
   * @param explored 探索済みかどうか
   */
  updateTileVisibility(x: number, y: number, visible: boolean, explored: boolean): void {
    const key = `${x},${y}`;
    const sprite = this.tileSprites.get(key);
    if (!sprite) {
      // 初回のみログ出力（スパム防止）
      if (!this.missingTileWarnings) {
        this.missingTileWarnings = new Set();
      }
      if (!this.missingTileWarnings.has(key)) {
        console.warn(`RendererSystem: Tile sprite not found for (${x}, ${y})`);
        this.missingTileWarnings.add(key);
      }
      return;
    }

    if (!explored) {
      // 未探索は少し暗く表示（alphaは使わない）
      sprite.visible = true;
      sprite.alpha = 1.0;
      sprite.tint = 0xb0b0b0; // 少し暗く
    } else if (!visible) {
      // 探索済み・視野外は少し暗く表示（alphaは使わない）
      sprite.visible = true;
      sprite.alpha = 1.0;
      sprite.tint = 0xc0c0c0; // 少し暗く
    } else {
      // 視野内は通常表示
      sprite.visible = true;
      sprite.alpha = 1.0;
      sprite.tint = 0xffffff;
    }
  }

  /**
   * ハイライトレイヤーをセットアップ
   */
  private setupHighlightLayer(): void {
    // タイル(TERRAIN: 100)とオブジェクト(OBJECTS: 200)の間にハイライトレイヤーを配置
    this.highlightLayer = new PIXI.Container();
    this.highlightLayer.sortableChildren = true;
    this.highlightLayer.zIndex = 150; // TERRAINとOBJECTSの間

    this.app!.stage.addChild(this.highlightLayer);

    // ハイライトグラフィックスを作成
    this.highlightGraphics = new PIXI.Graphics();
    this.highlightLayer.addChild(this.highlightGraphics);

    console.log('Highlight layer created with zIndex: 150 (between TERRAIN and OBJECTS)');
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
   */
  private updateHighlight(): void {
    if (!this.highlightGraphics || !this.hoveredTile) {
      return;
    }

    // グラフィックスをクリア
    this.highlightGraphics.clear();

    // アイソメトリック座標をスクリーン座標に変換
    const screenPos = this.coordinateSystem.isometricToScreen(
      this.hoveredTile.x,
      this.hoveredTile.y,
      0
    );

    // カメラオフセットを適用
    const displayX = screenPos.x - this.camera.x;
    const displayY = screenPos.y - this.camera.y;

    // タイルサイズを取得
    const tileWidth = this.coordinateSystem.getTileWidth();
    const tileHeight = this.coordinateSystem.getTileHeight();

    // アイソメトリックダイヤモンド形状を描画
    // CoordinateSystemでは tileHeight / 3 を使用しているため、
    // 実際のダイヤモンドの高さは tileHeight / 3 * 2 = tileHeight * 2 / 3
    const halfWidth = tileWidth / 2;
    const halfHeight = tileHeight / 3; // tileHeight / 3 を使用

    // ハイライトを少し上に調整
    const offsetY = -tileHeight / 6; // 上方向に少しオフセット (120/6 = 20px上)

    // 半透明のオレンジでハイライト
    this.highlightGraphics.poly([
      { x: displayX, y: displayY + offsetY - halfHeight }, // 上
      { x: displayX + halfWidth, y: displayY + offsetY }, // 右
      { x: displayX, y: displayY + offsetY + halfHeight }, // 下
      { x: displayX - halfWidth, y: displayY + offsetY }, // 左
    ]);
    this.highlightGraphics.fill({ color: 0xffa500, alpha: 0.3 }); // オレンジ色

    // 枠線を描画
    this.highlightGraphics.poly([
      { x: displayX, y: displayY + offsetY - halfHeight }, // 上
      { x: displayX + halfWidth, y: displayY + offsetY }, // 右
      { x: displayX, y: displayY + offsetY + halfHeight }, // 下
      { x: displayX - halfWidth, y: displayY + offsetY }, // 左
      { x: displayX, y: displayY + offsetY - halfHeight }, // 上（閉じる）
    ]);
    this.highlightGraphics.stroke({ width: 2, color: 0xffa500, alpha: 0.8 }); // オレンジ色
  }
}
