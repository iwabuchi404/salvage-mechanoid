import { Component } from '../Component';
import { Entity } from '../Entity';
import { Engine } from '../../Engine';
import { EventSystem } from '../../events/EventSystem';
import { TransformComponent } from './Transform';
import { Vector3, Direction } from '../../types';
import { Easing, EasingFn } from '../../graphics/AnimationManager';

/**
 * 移動コンポーネント - エンティティの移動を管理
 * 論理位置は移動開始時に即座に確定、描画位置はdeltaTimeで補間
 */
export class MovementComponent implements Component {
  type = 'movement';
  entity: Entity | null = null;

  private _direction: Direction = 'down';
  private _speed: number;
  private _isMoving = false;
  private _moveDuration: number;
  private _elapsedTime = 0;
  private _moveStartPosition: Vector3 = { x: 0, y: 0, z: 0 };
  private _moveTargetPosition: Vector3 = { x: 0, y: 0, z: 0 };
  private _interpolatedPosition: Vector3 = { x: 0, y: 0, z: 0 };
  private _easing: EasingFn;

  /**
   * コンストラクタ
   * @param speed 移動速度（タイル/秒）
   * @param moveDuration 移動のアニメーション時間（ミリ秒）
   */
  constructor(speed = 4, moveDuration = 250, easing: EasingFn = Easing.easeInOut) {
    this._speed = Math.max(0.1, speed);
    this._moveDuration = Math.max(1, moveDuration);
    this._easing = easing;
  }

  /**
   * コンポーネントの初期化
   */
  initialize(): void {
    // 必要に応じて初期化処理を追加
  }

  /**
   * 毎フレームの更新処理
   * deltaTimeベースで補間位置を更新
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    if (!this.entity || !this._isMoving) return;

    this._elapsedTime += deltaTime;
    const rawProgress = Math.min(this._elapsedTime / this._moveDuration, 1);
    const progress = this._easing(rawProgress);

    this._interpolatedPosition = {
      x:
        this._moveStartPosition.x +
        (this._moveTargetPosition.x - this._moveStartPosition.x) * progress,
      y:
        this._moveStartPosition.y +
        (this._moveTargetPosition.y - this._moveStartPosition.y) * progress,
      z:
        this._moveStartPosition.z +
        (this._moveTargetPosition.z - this._moveStartPosition.z) * progress,
    };

    if (rawProgress >= 1) {
      this._interpolatedPosition = { ...this._moveTargetPosition };
      this._isMoving = false;
      this.emitMoveCompletedEvent();
    }
  }

  /**
   * 補間位置を取得（描画用）
   * @returns 補間された位置
   */
  getInterpolatedPosition(): Vector3 {
    return { ...this._interpolatedPosition };
  }

  /**
   * 指定方向に移動
   * @param direction 移動方向
   * @returns 移動が開始された場合はtrue
   */
  moveInDirection(direction: Direction): boolean {
    if (!this.entity || this._isMoving) return false;

    const transform = this.entity.getComponent<TransformComponent>('transform');
    if (!transform) return false;

    // 現在の位置を取得
    const currentPos = transform.position;

    // 方向を設定
    this._direction = direction;

    // 方向に基づいて次の位置を計算
    let nextPos: Vector3;
    switch (direction) {
      case 'up':
        nextPos = { ...currentPos, y: currentPos.y - 1 };
        break;
      case 'down':
        nextPos = { ...currentPos, y: currentPos.y + 1 };
        break;
      case 'left':
        nextPos = { ...currentPos, x: currentPos.x - 1 };
        break;
      case 'right':
        nextPos = { ...currentPos, x: currentPos.x + 1 };
        break;
    }

    // 移動可能かチェック
    if (!this.canMoveTo(nextPos.x, nextPos.y, nextPos.z)) {
      // 移動方向のイベントだけ発行
      this.emitDirectionChangedEvent();
      return false;
    }

    // 移動を開始
    return this.startMoving(nextPos);
  }

  /**
   * 指定座標への移動を開始
   * @param targetX 目標X座標
   * @param targetY 目標Y座標
   * @param targetZ 目標Z座標
   * @returns 移動が開始された場合はtrue
   */
  moveTo(targetX: number, targetY: number, targetZ = 0): boolean {
    const targetPos: Vector3 = { x: targetX, y: targetY, z: targetZ };
    return this.startMoving(targetPos);
  }

  /**
   * 移動を開始する内部メソッド
   * @param targetPos 目標位置
   * @returns 移動が開始された場合はtrue
   */
  private startMoving(targetPos: Vector3): boolean {
    if (!this.entity || this._isMoving) return false;

    const transform = this.entity.getComponent<TransformComponent>('transform');
    if (!transform) return false;

    const currentPos = transform.position;

    // 論理位置を即座に確定（整数タイル座標）
    transform.setPosition(targetPos.x, targetPos.y, targetPos.z);

    // 補間用情報を設定
    this._isMoving = true;
    this._elapsedTime = 0;
    this._moveStartPosition = { ...currentPos };
    this._moveTargetPosition = { ...targetPos };
    this._interpolatedPosition = { ...currentPos };

    // 方向を更新
    if (targetPos.x > currentPos.x) {
      this._direction = 'right';
    } else if (targetPos.x < currentPos.x) {
      this._direction = 'left';
    } else if (targetPos.y > currentPos.y) {
      this._direction = 'down';
    } else if (targetPos.y < currentPos.y) {
      this._direction = 'up';
    }

    this.emitMoveStartedEvent();
    this.emitDirectionChangedEvent();

    return true;
  }

  /**
   * 指定位置に移動可能かどうかをチェック
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   * @returns 移動可能な場合はtrue
   */
  private canMoveTo(x: number, y: number, z: number): boolean {
    const worldSystem = Engine.instance.getSystem('world');
    if (worldSystem && typeof worldSystem === 'object' && 'isWalkable' in worldSystem) {
      // 自分自身を除外して衝突判定を行う
      const entityId = this.entity ? this.entity.id : undefined;
      return (worldSystem as any).isWalkable(x, y, z, entityId);
    }

    // WorldSystemがない場合は範囲内チェックのみ行う
    return x >= 0 && y >= 0; // 基本的な範囲チェック
  }

  /**
   * 現在移動中かどうかを取得
   */
  get isMoving(): boolean {
    return this._isMoving;
  }

  /**
   * 現在の方向を取得
   */
  get direction(): Direction {
    return this._direction;
  }

  /**
   * 方向を設定
   */
  set direction(value: Direction) {
    if (this._direction !== value) {
      this._direction = value;
      this.emitDirectionChangedEvent();
    }
  }

  /**
   * 移動速度を取得
   */
  get speed(): number {
    return this._speed;
  }

  /**
   * 移動速度を設定
   */
  set speed(value: number) {
    this._speed = Math.max(0.1, value);
  }

  /**
   * 移動開始イベントを発行
   */
  private emitMoveStartedEvent(): void {
    if (!this.entity) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('move_started', {
        entityId: this.entity.id,
        from: this._moveStartPosition,
        to: this._moveTargetPosition,
        direction: this._direction,
      });
    }
  }

  /**
   * 移動完了イベントを発行
   */
  private emitMoveCompletedEvent(): void {
    if (!this.entity) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('move_completed', {
        entityId: this.entity.id,
        position: this._moveTargetPosition,
        direction: this._direction,
      });
    }
  }

  /**
   * 方向変更イベントを発行
   */
  private emitDirectionChangedEvent(): void {
    if (!this.entity) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('direction_changed', {
        entityId: this.entity.id,
        direction: this._direction,
      });
    }
  }
}
