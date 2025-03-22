import { Component } from '../Component';
import { Entity } from '../Entity';
import { Engine } from '../../Engine';
import { EventSystem } from '../../events/EventSystem';
import { Vector3, EventName } from '../../types';

/**
 * トランスフォームコンポーネント - エンティティの位置、回転、スケールを管理
 */
export class TransformComponent implements Component {
  /**
   * コンポーネントのタイプ
   */
  type = 'transform';

  /**
   * このコンポーネントを所有するエンティティ
   */
  entity: Entity | null = null;

  /**
   * 位置
   */
  private _position: Vector3 = { x: 0, y: 0, z: 0 };

  /**
   * 回転（ラジアン）
   */
  private _rotation = 0;

  /**
   * スケール（1.0 が標準）
   */
  private _scale: Vector3 = { x: 1, y: 1, z: 1 };

  /**
   * 変更フラグ - 位置が変更されたかどうか
   */
  private dirty = true;

  /**
   * コンストラクタ
   * @param x 初期X座標
   * @param y 初期Y座標
   * @param z 初期Z座標
   */
  constructor(x = 0, y = 0, z = 0) {
    this._position = { x, y, z };
  }

  /**
   * コンポーネントの初期化
   */
  initialize(): void {
    this.dirty = true;
  }
  /**
   * 毎フレームの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // 位置が変更された場合、位置変更イベントを発行
    if (this.dirty) {
      this.emitPositionChangedEvent();
      this.dirty = false;
    }
  }

  /**
   * 位置を取得
   */
  get position(): Vector3 {
    return { ...this._position };
  }

  /**
   * X座標を取得
   */
  get x(): number {
    return this._position.x;
  }

  /**
   * X座標を設定
   */
  set x(value: number) {
    if (this._position.x !== value) {
      this._position.x = value;
      this.dirty = true;
    }
  }

  /**
   * Y座標を取得
   */
  get y(): number {
    return this._position.y;
  }

  /**
   * Y座標を設定
   */
  set y(value: number) {
    if (this._position.y !== value) {
      this._position.y = value;
      this.dirty = true;
    }
  }

  /**
   * Z座標を取得
   */
  get z(): number {
    return this._position.z;
  }

  /**
   * Z座標を設定
   */
  set z(value: number) {
    if (this._position.z !== value) {
      this._position.z = value;
      this.dirty = true;
    }
  }

  /**
   * 回転を取得（ラジアン）
   */
  get rotation(): number {
    return this._rotation;
  }

  /**
   * 回転を設定（ラジアン）
   */
  set rotation(value: number) {
    // 角度を0〜2πの範囲に正規化
    const normalized = value % (Math.PI * 2);
    if (this._rotation !== normalized) {
      this._rotation = normalized;
      this.dirty = true;
    }
  }

  /**
   * スケールを取得
   */
  get scale(): Vector3 {
    return { ...this._scale };
  }

  /**
   * X方向のスケールを取得
   */
  get scaleX(): number {
    return this._scale.x;
  }

  /**
   * X方向のスケールを設定
   */
  set scaleX(value: number) {
    if (this._scale.x !== value) {
      this._scale.x = value;
      this.dirty = true;
    }
  }

  /**
   * Y方向のスケールを取得
   */
  get scaleY(): number {
    return this._scale.y;
  }

  /**
   * Y方向のスケールを設定
   */
  set scaleY(value: number) {
    if (this._scale.y !== value) {
      this._scale.y = value;
      this.dirty = true;
    }
  }

  /**
   * Z方向のスケールを取得
   */
  get scaleZ(): number {
    return this._scale.z;
  }

  /**
   * Z方向のスケールを設定
   */
  set scaleZ(value: number) {
    if (this._scale.z !== value) {
      this._scale.z = value;
      this.dirty = true;
    }
  }

  /**
   * 位置を設定
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   */
  setPosition(x: number, y: number, z = 0): void {
    if (this._position.x !== x || this._position.y !== y || this._position.z !== z) {
      this._position = { x, y, z };
      this.dirty = true;
    }
  }

  /**
   * 相対的に位置を移動
   * @param dx X方向の移動量
   * @param dy Y方向の移動量
   * @param dz Z方向の移動量
   */
  translate(dx: number, dy: number, dz = 0): void {
    this._position.x += dx;
    this._position.y += dy;
    this._position.z += dz;
    this.dirty = true;
  }

  /**
   * スケールを設定
   * @param x X方向のスケール
   * @param y Y方向のスケール
   * @param z Z方向のスケール
   */
  setScale(x: number, y: number, z = 1): void {
    if (this._scale.x !== x || this._scale.y !== y || this._scale.z !== z) {
      this._scale = { x, y, z };
      this.dirty = true;
    }
  }

  /**
   * 位置変更イベントを発行
   */
  private emitPositionChangedEvent(): void {
    if (!this.entity) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit(EventName.ENTITY_MOVED, {
        entityId: this.entity.id,
        position: this._position,
        rotation: this._rotation,
        scale: this._scale,
      });
    }
  }
}
