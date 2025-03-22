import * as PIXI from 'pixi.js';
import { Vector2 } from '../types';

/**
 * レイヤークラス - レンダリングレイヤーを管理
 * 複数レイヤーで構成される2Dシーンの深度管理を担当
 */
export class Layer {
  // PIXIのコンテナ
  private container: PIXI.Container;

  // レイヤーの名前
  private name: string;

  // レイヤーの可視性
  private _visible = true;

  // レイヤーの透明度
  private _alpha = 1.0;

  // レイヤーの位置オフセット
  private _offset: Vector2 = { x: 0, y: 0 };

  // スケーリング
  private _scale: Vector2 = { x: 1, y: 1 };

  /**
   * コンストラクタ
   * @param name レイヤーの名前
   * @param zIndex 重ね順（大きいほど手前）
   */
  constructor(name: string, zIndex = 0) {
    this.name = name;
    this.container = new PIXI.Container();
    this.container.sortableChildren = true; // 子要素の自動ソートを有効化
    this.container.zIndex = zIndex;

    console.log(`Created layer '${name}' with zIndex ${zIndex}`);
  }

  /**
   * レイヤーの名前を取得
   * @returns レイヤー名
   */
  getName(): string {
    return this.name;
  }

  /**
   * レイヤーのコンテナを取得
   * @returns PIXIコンテナ
   */
  getContainer(): PIXI.Container {
    return this.container;
  }

  /**
   * レイヤーにスプライトを追加
   * @param sprite 追加するスプライト
   * @param zIndex 任意の重ね順（指定がなければスプライトの既存のzIndexを使用）
   */
  addSprite(sprite: PIXI.Sprite, zIndex?: number): void {
    if (zIndex !== undefined) {
      sprite.zIndex = zIndex;
    }

    this.container.addChild(sprite);
  }

  /**
   * レイヤーからスプライトを削除
   * @param sprite 削除するスプライト
   */
  removeSprite(sprite: PIXI.Sprite): void {
    this.container.removeChild(sprite);
  }

  /**
   * レイヤーの可視性を取得
   */
  get visible(): boolean {
    return this._visible;
  }

  /**
   * レイヤーの可視性を設定
   */
  set visible(value: boolean) {
    this._visible = value;
    this.container.visible = value;
  }

  /**
   * レイヤーの透明度を取得
   */
  get alpha(): number {
    return this._alpha;
  }

  /**
   * レイヤーの透明度を設定
   */
  set alpha(value: number) {
    this._alpha = Math.max(0, Math.min(1, value)); // 0〜1に制限
    this.container.alpha = this._alpha;
  }

  /**
   * レイヤーのX位置オフセットを取得
   */
  get offsetX(): number {
    return this._offset.x;
  }

  /**
   * レイヤーのX位置オフセットを設定
   */
  set offsetX(value: number) {
    this._offset.x = value;
    this.container.x = value;
  }

  /**
   * レイヤーのY位置オフセットを取得
   */
  get offsetY(): number {
    return this._offset.y;
  }

  /**
   * レイヤーのY位置オフセットを設定
   */
  set offsetY(value: number) {
    this._offset.y = value;
    this.container.y = value;
  }

  /**
   * レイヤーの位置オフセットを設定
   * @param x X方向のオフセット
   * @param y Y方向のオフセット
   */
  setOffset(x: number, y: number): void {
    this._offset = { x, y };
    this.container.position.set(x, y);
  }

  /**
   * レイヤーのスケールを設定
   * @param x X方向のスケール
   * @param y Y方向のスケール
   */
  setScale(x: number, y: number): void {
    this._scale = { x, y };
    this.container.scale.set(x, y);
  }

  /**
   * レイヤーをクリア（すべての子要素を削除）
   */
  clear(): void {
    this.container.removeChildren();
  }

  /**
   * レイヤーの重ね順（zIndex）を設定
   * @param zIndex 新しい重ね順
   */
  setZIndex(zIndex: number): void {
    this.container.zIndex = zIndex;
  }
}
