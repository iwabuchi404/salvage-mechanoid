import * as PIXI from 'pixi.js';
import { Component } from '../Component';
import { Entity } from '../Entity';
import { Engine } from '../../Engine';
import { RendererSystem } from '../../graphics/RendererSystem';
import { EventSystem } from '../../events/EventSystem';
import { TransformComponent } from './Transform';
import { MovementComponent } from './Movement';
import { LayerName } from '../../types';

/**
 * スプライトコンポーネント - エンティティの視覚的表現を管理
 * ワールド座標で配置（カメラオフセットはworldContainerが適用）
 */
export class SpriteComponent implements Component {
  type = 'sprite';
  entity: Entity | null = null;

  private sprite: PIXI.Sprite | null = null;
  private layer: string;
  private _visible = true;
  private _inPlayerFOV = true;
  private textureSrc: string | PIXI.Texture;
  private anchor: { x: number; y: number };
  private lastPosition: { x: number; y: number; z: number } = { x: -1, y: -1, z: -1 };

  // 登録したリスナーの参照（destroy 時に解除するため保持）
  private visibilityChangedListener: ((data: { entityId: string; inFOV: boolean }) => void) | null = null;

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
      rendererSystem.renderEntity({
        sprite: this.sprite,
        layer: this.layer,
        position: transform ? transform.position : { x: 0, y: 0, z: 0 },
        anchor: this.anchor,
      });
    } else {
      console.error('EventSystem not found or sprite is null');
    }

    // エンティティ可視性変更イベントをリッスン
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem && this.entity) {
      this.visibilityChangedListener = (data: { entityId: string; inFOV: boolean }) => {
        if (data.entityId === this.entity?.id) {
          this.setInFOV(data.inFOV);
        }
      };
      eventSystem.on('entity_visibility_changed', this.visibilityChangedListener);
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

      // 移動中かチェック
      const movement = this.entity.getComponent<MovementComponent>('movement');
      const isMoving = movement?.isMoving ?? false;

      // 位置が変わった場合または移動中（補間位置が毎フレーム変化）は更新
      if (
        isMoving ||
        this.lastPosition.x !== pos.x ||
        this.lastPosition.y !== pos.y ||
        this.lastPosition.z !== pos.z
      ) {
        this.updateSpritePosition(pos.x, pos.y, pos.z);
        this.lastPosition = { x: pos.x, y: pos.y, z: pos.z };
      }

      // 回転も更新
      this.sprite.rotation = transform.rotation;

      // スケールも更新
      const scale = transform.scale;
      this.sprite.scale.set(scale.x, scale.y);
    }

    // 可視性の更新
    // プレイヤー以外は視野内フラグも考慮
    if (this.entity.hasTag('player')) {
      this.sprite.visible = this._visible && this.entity.active;
    } else {
      this.sprite.visible = this._visible && this.entity.active && this._inPlayerFOV;
    }
  }

  /**
   * スプライトの位置を更新
   * ワールド座標で配置（カメラオフセットはworldContainerが適用）
   * 移動中は補間位置を使用、そうでなければ論理位置を使用
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   */
  private updateSpritePosition(x: number, y: number, z: number): void {
    if (!this.sprite) return;

    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (!rendererSystem) return;

    const coordSystem = rendererSystem.getCoordinateSystem();

    // MovementComponentの補間位置を確認
    let renderX = x;
    let renderY = y;
    let renderZ = z;

    if (this.entity) {
      const movement = this.entity.getComponent<MovementComponent>('movement');
      if (movement && movement.isMoving) {
        const interp = movement.getInterpolatedPosition();
        renderX = interp.x;
        renderY = interp.y;
        renderZ = interp.z;
      }
    }

    // ワールド座標で配置（カメラオフセットなし）
    const screenPos = coordSystem.isometricToScreen(renderX, renderY, renderZ);
    this.sprite.x = screenPos.x;
    this.sprite.y = screenPos.y;

    // 深度ソートのためのzIndex
    const baseZIndex = (renderY + renderX) * 1000;
    this.sprite.zIndex = baseZIndex + renderZ * 100;
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

  /**
   * 視野内フラグを設定
   * @param inFOV 視野内かどうか
   */
  setInFOV(inFOV: boolean): void {
    this._inPlayerFOV = inFOV;

    // 可視性を即座に更新
    if (this.sprite && this.entity) {
      if (this.entity.hasTag('player')) {
        this.sprite.visible = this._visible && this.entity.active;
      } else {
        const newVisible = this._visible && this.entity.active && this._inPlayerFOV;
        this.sprite.visible = newVisible;
      }
    }
  }

  /**
   * コンポーネントの破棄処理
   * スプライトをレイヤーから削除し、リソースを解放
   * EventSystem のリスナーも解除する
   */
  destroy(): void {
    // EventSystem のリスナーを解除
    if (this.visibilityChangedListener) {
      const eventSystem = Engine.instance.getSystem<EventSystem>('event');
      eventSystem?.off('entity_visibility_changed', this.visibilityChangedListener);
      this.visibilityChangedListener = null;
    }

    if (this.sprite) {
      const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
      if (rendererSystem) {
        // レイヤーからスプライトを削除
        rendererSystem.removeSprite(this.sprite, this.layer);
      }

      // 親コンテナから削除
      if (this.sprite.parent) {
        this.sprite.parent.removeChild(this.sprite);
      }

      // スプライトを破棄
      this.sprite.destroy();
      this.sprite = null;
    }

    this.entity = null;
  }
}
