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

    // イベントシステムとの連携
    const eventSystem = engine.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.on('render_entity', this.renderEntity.bind(this));
      console.log("Registered for 'render_entity' events");
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

    // アイソメトリック座標をスクリーン座標に変換
    const screenPos = this.coordinateSystem.isometricToScreen(position.x, position.y, position.z);

    // スプライトの位置をカメラ位置を考慮して設定
    sprite.x = screenPos.x + this.camera.x;
    sprite.y = screenPos.y + this.camera.y;

    // 深度ソートのためのzIndexを設定
    // Y座標が大きいほど手前に表示される
    sprite.zIndex = position.y * 1000 + position.x;

    // スプライトをレイヤーに追加（まだ追加されていない場合）
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

    // 必要に応じて他の更新処理を追加
    // 例: アニメーションの更新、パーティクルシステムの更新など
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
}
