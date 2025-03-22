import { Vector2 } from '../types';

/**
 * カメラクラス - ゲーム世界のビューを制御する
 */
export class Camera {
  // カメラの位置
  private _position: Vector2 = { x: 0, y: 0 };

  // カメラのズームレベル
  private _zoom = 1.0;

  // カメラの回転角（ラジアン）
  private _rotation = 0;

  // カメラの移動速度
  private _speed = 5;

  // 目標位置（スムーズカメラ移動用）
  private _targetPosition: Vector2 | null = null;

  // スムージング係数（0〜1）- 値が大きいほど動きが素早くなる
  private _smoothingFactor = 0.1;

  /**
   * コンストラクタ
   * @param x 初期X座標
   * @param y 初期Y座標
   * @param zoom 初期ズームレベル
   */
  constructor(x = 0, y = 0, zoom = 1.0) {
    this._position = { x, y };
    this._zoom = zoom;
  }

  /**
   * カメラのX座標を取得
   */
  get x(): number {
    return this._position.x;
  }

  /**
   * カメラのX座標を設定
   */
  set x(value: number) {
    this._position.x = value;
    this._targetPosition = null; // 手動設定の場合はターゲット追跡を無効化
  }

  /**
   * カメラのY座標を取得
   */
  get y(): number {
    return this._position.y;
  }

  /**
   * カメラのY座標を設定
   */
  set y(value: number) {
    this._position.y = value;
    this._targetPosition = null; // 手動設定の場合はターゲット追跡を無効化
  }

  /**
   * カメラのズームレベルを取得
   */
  get zoom(): number {
    return this._zoom;
  }

  /**
   * カメラのズームレベルを設定
   * @param value 新しいズームレベル（0より大きい値）
   */
  set zoom(value: number) {
    if (value <= 0) {
      throw new Error('Zoom level must be greater than 0');
    }
    this._zoom = value;
  }

  /**
   * カメラの回転角を取得（ラジアン）
   */
  get rotation(): number {
    return this._rotation;
  }

  /**
   * カメラの回転角を設定（ラジアン）
   */
  set rotation(value: number) {
    this._rotation = value;
  }

  /**
   * カメラの位置を設定
   * @param x X座標
   * @param y Y座標
   */
  setPosition(x: number, y: number): void {
    this._position = { x, y };
    this._targetPosition = null; // 手動設定の場合はターゲット追跡を無効化
  }

  /**
   * カメラを指定した量だけ移動
   * @param dx X方向の移動量
   * @param dy Y方向の移動量
   */
  move(dx: number, dy: number): void {
    this._position.x += dx;
    this._position.y += dy;
    this._targetPosition = null; // 手動移動の場合はターゲット追跡を無効化
  }

  /**
   * 目標位置を設定し、カメラをスムーズに移動させる
   * @param x 目標X座標
   * @param y 目標Y座標
   */
  setTargetPosition(x: number, y: number): void {
    this._targetPosition = { x, y };
  }

  /**
   * スムージング係数を設定
   * @param factor スムージング係数（0〜1）- 値が大きいほど動きが素早くなる
   */
  setSmoothingFactor(factor: number): void {
    if (factor < 0 || factor > 1) {
      throw new Error('Smoothing factor must be between 0 and 1');
    }
    this._smoothingFactor = factor;
  }

  /**
   * 画面上の座標をワールド座標に変換
   * @param screenX 画面上のX座標
   * @param screenY 画面上のY座標
   * @returns ワールド座標
   */
  screenToWorld(screenX: number, screenY: number): Vector2 {
    // カメラの回転と拡大縮小を考慮した座標変換
    const cosR = Math.cos(-this._rotation);
    const sinR = Math.sin(-this._rotation);

    const relativeX = (screenX - this._position.x) / this._zoom;
    const relativeY = (screenY - this._position.y) / this._zoom;

    return {
      x: relativeX * cosR - relativeY * sinR,
      y: relativeX * sinR + relativeY * cosR,
    };
  }

  /**
   * ワールド座標を画面上の座標に変換
   * @param worldX ワールドのX座標
   * @param worldY ワールドのY座標
   * @returns 画面上の座標
   */
  worldToScreen(worldX: number, worldY: number): Vector2 {
    // カメラの回転と拡大縮小を考慮した座標変換
    const cosR = Math.cos(this._rotation);
    const sinR = Math.sin(this._rotation);

    const rotatedX = worldX * cosR - worldY * sinR;
    const rotatedY = worldX * sinR + worldY * cosR;

    return {
      x: rotatedX * this._zoom + this._position.x,
      y: rotatedY * this._zoom + this._position.y,
    };
  }

  /**
   * カメラの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // 目標位置が設定されている場合、スムーズに移動
    if (this._targetPosition) {
      // 線形補間（lerp）を使用してカメラをスムーズに移動
      this._position.x += (this._targetPosition.x - this._position.x) * this._smoothingFactor;
      this._position.y += (this._targetPosition.y - this._position.y) * this._smoothingFactor;

      // 目標位置に十分近づいたら、正確に設定（浮動小数点誤差を避けるため）
      const distanceSquared =
        Math.pow(this._targetPosition.x - this._position.x, 2) +
        Math.pow(this._targetPosition.y - this._position.y, 2);

      if (distanceSquared < 0.01) {
        this._position = { ...this._targetPosition };
      }
    }
  }

  /**
   * カメラの状態をリセット
   */
  reset(): void {
    this._position = { x: 0, y: 0 };
    this._zoom = 1.0;
    this._rotation = 0;
    this._targetPosition = null;
  }
}
