import { Entity } from '../../entity/Entity';
import { Component } from '../../entity/Component';
import { SpriteComponent } from '../../entity/components/Sprite';
import { Engine } from '../../Engine';
import { EventSystem } from '../../events/EventSystem';
import { RendererSystem } from '../../graphics/RendererSystem';
import { Camera } from '../../graphics/Camera';
import { RENDER_CONFIG } from '../../graphics/RenderConfig';
import { Direction } from '../../types';
import { getPlayerVisualProfile, getPlayerTexturePath } from './PlayerVisualProfile';

/**
 * Player の描画ライフサイクルを管理する Presentation クラス
 *
 * SpriteComponent の生成・初期化、方向変更時のテクスチャ切替、
 * カメラ追従を担当する。Player（ドメイン）側は PixiJS や RendererSystem
 * を知らなくて済む。
 *
 * C1: Player / Item の描画ライフサイクルを Presentation へ移す
 */
export class PlayerPresentation implements Component {
  readonly type = 'player-presentation';
  entity: Entity | null = null;

  private spriteComponent: SpriteComponent | null = null;
  private eventSystem: EventSystem | null = null;
  private destroyed = false;
  private camera: Camera | null = null;
  private directionChangedListener:
    | ((data: { entityId: string; direction: Direction }) => void)
    | null = null;
  private moveCompletedListener:
    | ((data: { entityId: string; position: { x: number; y: number; z: number } }) => void)
    | null = null;
  private moveStartedListener:
    | ((data: { entityId: string; to: { x: number; y: number; z: number } }) => void)
    | null = null;
  private playerAttackedListener: ((data: { attackerId: string }) => void) | null = null;

  /**
   * Presentation を初期化する
   * SpriteComponent を生成して Entity に追加し、初期化してから
   * direction_changed リスナーを登録する
   */
  async initialize(): Promise<void> {
    const entity = this.entity;
    if (!entity || this.destroyed || this.spriteComponent) return;

    const profile = getPlayerVisualProfile();

    // SpriteComponent を生成して Entity に追加
    this.spriteComponent = new SpriteComponent(profile.defaultTexturePath, profile.layer, {
      x: profile.anchor.x,
      y: profile.anchor.y,
    });
    entity.addComponent(this.spriteComponent);

    // SpriteComponent を初期化（テクスチャ読み込み・Renderer への登録など）
    if (this.spriteComponent.initialize) {
      await this.spriteComponent.initialize();
    }

    // direction_changed イベントを購読
    this.eventSystem = Engine.instance.getSystem<EventSystem>('event') ?? null;
    if (this.eventSystem) {
      this.directionChangedListener = (data) => {
        if (data.entityId === entity.id) {
          this.updateDirectionTexture(data.direction);
        }
      };
      this.eventSystem.on('direction_changed', this.directionChangedListener);

      // player_attacked イベントを購読して攻撃時の tint アニメーションを行う
      this.playerAttackedListener = (data) => {
        if (data.attackerId === entity.id) {
          this.playAttackAnimation();
        }
      };
      this.eventSystem.on('player_attacked', this.playerAttackedListener);
    }
  }

  update(): void {
    // 描画位置・active・FOV の更新は Entity が所有する SpriteComponent が担当
  }

  /**
   * カメラの追跡対象に設定する
   * move_completed / move_started イベントを購読してカメラを追従させる
   * @param camera 追跡用カメラ
   */
  setCameraTarget(camera: Camera): void {
    this.camera = camera;
    camera.setSmoothingFactor(0.15);

    if (!this.eventSystem) return;

    // move_completed: 移動完了時にカメラを更新
    this.moveCompletedListener = (data) => {
      if (data.entityId === this.entity?.id && this.camera) {
        this.updateCameraPosition(data.position.x, data.position.y, data.position.z);
      }
    };
    this.eventSystem.on('move_completed', this.moveCompletedListener);

    // move_started: 移動開始時にもカメラを追従開始
    this.moveStartedListener = (data) => {
      if (data.entityId === this.entity?.id && this.camera) {
        this.updateCameraPosition(data.to.x, data.to.y, data.to.z);
      }
    };
    this.eventSystem.on('move_started', this.moveStartedListener);
  }

  /**
   * 方向に応じてテクスチャを更新
   * @param direction 新しい方向
   */
  private updateDirectionTexture(direction: Direction): void {
    if (!this.spriteComponent) return;

    const texturePath = getPlayerTexturePath(direction);
    this.spriteComponent.changeTexture(texturePath);
  }

  /**
   * カメラの目標位置を更新する
   */
  private updateCameraPosition(x: number, y: number, z: number): void {
    if (!this.camera) return;

    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (!rendererSystem) return;

    const coordSystem = rendererSystem.getCoordinateSystem();
    const screenPos = coordSystem.isometricToScreen(x, y, z);
    this.camera.setTargetPosition(
      screenPos.x - RENDER_CONFIG.SCREEN_WIDTH / 2,
      screenPos.y - RENDER_CONFIG.SCREEN_HEIGHT / 2
    );
  }

  /**
   * 攻撃時の tint アニメーションを再生する
   * C1: Player.attack() から player_attacked イベント経由で呼び出される
   */
  private playAttackAnimation(): void {
    if (!this.spriteComponent) return;

    this.spriteComponent.setTint(0xff0000);
    setTimeout(() => {
      if (this.spriteComponent && !this.destroyed) {
        this.spriteComponent.setTint(0xffffff);
      }
    }, 100);
  }

  /**
   * Presentation を破棄する
   * リスナー解除と SpriteComponent の破棄を行う
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.eventSystem) {
      if (this.directionChangedListener) {
        this.eventSystem.off('direction_changed', this.directionChangedListener);
        this.directionChangedListener = null;
      }
      if (this.moveCompletedListener) {
        this.eventSystem.off('move_completed', this.moveCompletedListener);
        this.moveCompletedListener = null;
      }
      if (this.moveStartedListener) {
        this.eventSystem.off('move_started', this.moveStartedListener);
        this.moveStartedListener = null;
      }
      if (this.playerAttackedListener) {
        this.eventSystem.off('player_attacked', this.playerAttackedListener);
        this.playerAttackedListener = null;
      }
    }

    const entity = this.entity;
    if (entity && entity.getComponent<SpriteComponent>('sprite') === this.spriteComponent) {
      entity.removeComponent('sprite');
    } else {
      this.spriteComponent?.destroy();
    }

    this.spriteComponent = null;
    this.camera = null;
    this.eventSystem = null;
    this.entity = null;
  }
}
