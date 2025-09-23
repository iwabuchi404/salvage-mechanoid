import * as PIXI from 'pixi.js';
import { Component } from '../Component';
import { Entity } from '../Entity';
import { Engine } from '../../Engine';
import { RendererSystem } from '../../graphics/RendererSystem';
import { TransformComponent } from './Transform';
import { LayerName } from '../../types';

/**
 * スプライトコンポーネント - エンティティの視覚的表現を管理
 */
export class SpriteComponent implements Component {
  /**
   * コンポーネントのタイプ
   */
  type = 'sprite';

  /**
   * このコンポーネントを所有するエンティティ
   */
  entity: Entity | null = null;

  /**
   * PIXIスプライト
   */
  private sprite: PIXI.Sprite | null = null;

  /**
   * レイヤー名
   */
  private layer: string;

  /**
   * 表示中かどうか
   */
  private _visible = true;

  /**
   * テクスチャの名前または直接のテクスチャ
   */
  private textureSrc: string | PIXI.Texture;

  /**
   * アンカーポイント
   */
  private anchor: { x: number; y: number };

  /**
   * コンストラクタ
   * @param textureSrc テクスチャのパスまたはPIXIテクスチャ
   * @param layer 描画レイヤー
   * @param anchor アンカーポイント (0,0が左上、1,1が右下)
   */
  constructor(
    textureSrc: string | PIXI.Texture,
    layer: string = LayerName.CHARACTERS,
    anchor: { x: number; y: number } = { x: 0.5, y: 1.0 }
  ) {
    this.textureSrc = textureSrc;
    this.layer = layer;
    this.anchor = anchor;
  }

  /**
   * コンポーネントの初期化
   */
  async initialize(): Promise<void> {
    if (!this.entity) return;

    // テクスチャの読み込み
    let texture: PIXI.Texture;

    if (typeof this.textureSrc === 'string') {
      try {
        texture = await PIXI.Assets.load(this.textureSrc);
        console.log('Texture loaded successfully:', this.textureSrc);
      } catch (error) {
        console.error(`Failed to load texture: ${this.textureSrc}`, error);
        // フォールバックとして空のテクスチャを使用
        texture = PIXI.Texture.EMPTY;
      }
    } else {
      texture = this.textureSrc;
    }

    // スプライトの作成
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(this.anchor.x, this.anchor.y);

    // 初期位置の設定
    const transform = this.entity.getComponent<TransformComponent>('transform');
    if (transform) {
      const pos = transform.position;
      this.updateSpritePosition(pos.x, pos.y, pos.z);
    }

    // 可視性の設定
    this.sprite.visible = this._visible;

    // レンダラーにスプライトを登録
    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (rendererSystem) {
      console.log('Emitting render_entity event for:', this.entity.id);
      rendererSystem.renderEntity({
        sprite: this.sprite,
        layer: this.layer,
        position: transform ? transform.position : { x: 0, y: 0, z: 0 },
        anchor: this.anchor,
      });
    } else {
      console.error('EventSystem not found or sprite is null');
    }
  }

  /**
   * 毎フレームの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    if (!this.entity || !this.sprite) return;

    // トランスフォームコンポーネントから位置情報を取得
    const transform = this.entity.getComponent<TransformComponent>('transform');
    if (transform) {
      const pos = transform.position;
      this.updateSpritePosition(pos.x, pos.y, pos.z);

      // 回転も更新
      this.sprite.rotation = transform.rotation;

      // スケールも更新
      const scale = transform.scale;
      this.sprite.scale.set(scale.x, scale.y);
    }

    // 可視性の更新
    this.sprite.visible = this._visible && this.entity.active;
  }

  /**
   * スプライトの位置を更新
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   */
  private updateSpritePosition(x: number, y: number, z: number): void {
    if (!this.sprite) return;

    // レンダラーから座標変換システムを取得
    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (rendererSystem) {
      const coordSystem = rendererSystem.getCoordinateSystem();
      const camera = rendererSystem.getCamera();

      // アイソメトリック座標をスクリーン座標に変換
      const screenPos = coordSystem.isometricToScreen(x, y, z);

      // スプライトの基本位置を設定（カメラ位置はRendererSystemで適用）
      this.sprite.x = screenPos.x;
      this.sprite.y = screenPos.y;

      // 深度ソートのためのzIndexを設定（Y座標が小さいほど手前に表示され、Z座標（高さ）も考慮）
      this.sprite.zIndex = (y + z * 100) * 1000 + x;
    }
  }

  /**
   * スプライトの可視性を取得
   */
  get visible(): boolean {
    return this._visible;
  }

  /**
   * スプライトの可視性を設定
   */
  set visible(value: boolean) {
    this._visible = value;
    if (this.sprite) {
      this.sprite.visible = value && (this.entity ? this.entity.active : true);
    }
  }

  /**
   * スプライトの色合いを設定
   * @param color 色（16進数形式、例: 0xFF0000 for red）
   */
  setTint(color: number): void {
    if (this.sprite) {
      this.sprite.tint = color;
    }
  }

  /**
   * スプライトのアルファ値（透明度）を設定
   * @param alpha アルファ値（0.0〜1.0）
   */
  setAlpha(alpha: number): void {
    if (this.sprite) {
      this.sprite.alpha = Math.max(0, Math.min(1, alpha));
    }
  }

  /**
   * テクスチャを変更
   * @param textureSrc 新しいテクスチャのパスまたはPIXIテクスチャ
   */
  async changeTexture(textureSrc: string | PIXI.Texture): Promise<void> {
    this.textureSrc = textureSrc;

    if (!this.sprite) return;

    let texture: PIXI.Texture;

    if (typeof textureSrc === 'string') {
      try {
        texture = await PIXI.Assets.load(textureSrc);
      } catch (error) {
        console.error(`Failed to load texture: ${textureSrc}`, error);
        return;
      }
    } else {
      texture = textureSrc;
    }

    this.sprite.texture = texture;
  }

  /**
   * スプライトインスタンスを取得
   */
  getSprite(): PIXI.Sprite | null {
    return this.sprite;
  }

  /**
   * レイヤーを変更
   * @param newLayer 新しいレイヤー名
   */
  changeLayer(newLayer: string): void {
    if (this.layer === newLayer) return;

    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (rendererSystem && this.sprite) {
      // 現在のレイヤーからスプライトを削除
      rendererSystem.removeSprite(this.sprite, this.layer);

      // レイヤーを更新
      this.layer = newLayer;

      // 新しいレイヤーにスプライトを追加
      const transform = this.entity?.getComponent<TransformComponent>('transform');
      rendererSystem.renderEntity({
        sprite: this.sprite,
        layer: this.layer,
        position: transform ? transform.position : { x: 0, y: 0, z: 0 },
        anchor: this.anchor,
      });
    }
  }
}
