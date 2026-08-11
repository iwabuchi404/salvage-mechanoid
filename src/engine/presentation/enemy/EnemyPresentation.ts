import { Entity } from '../../entity/Entity';
import { Component } from '../../entity/Component';
import { SpriteComponent } from '../../entity/components/Sprite';
import { Engine } from '../../Engine';
import { EventSystem } from '../../events/EventSystem';
import { Direction, EnemyType } from '../../types';
import { getEnemyVisualProfile, getEnemyTexturePath } from './EnemyVisualProfile';

/**
 * Enemy の描画ライフサイクルを管理する Presentation クラス
 *
 * SpriteComponent の生成・初期化、方向変更時のテクスチャ切替、
 * direction_changed イベントの購読と解除を担当する。
 *
 * Enemy（ドメイン）側は方向を MovementComponent に設定するだけでよく、
 * テクスチャ切替は本クラスが direction_changed イベント経由で行う。
 */
export class EnemyPresentation implements Component {
  readonly type = 'enemy-presentation';
  entity: Entity | null = null;

  private readonly enemyType: EnemyType;
  private spriteComponent: SpriteComponent | null = null;
  private eventSystem: EventSystem | null = null;
  private destroyed = false;
  private directionChangedListener:
    | ((data: { entityId: string; direction: Direction }) => void)
    | null = null;

  /**
   * コンストラクタ
   * @param enemyType 敵タイプ（テクスチャ選択用）
   */
  constructor(enemyType: EnemyType) {
    this.enemyType = enemyType;
  }

  /**
   * Presentation を初期化する
   * SpriteComponent を生成して Entity に追加し、初期化してから direction_changed リスナーを登録する
   */
  async initialize(): Promise<void> {
    const entity = this.entity;
    if (!entity || this.destroyed || this.spriteComponent) return;

    const profile = getEnemyVisualProfile(this.enemyType);

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
    }
  }

  update(): void {
    // 描画位置・active・FOV の更新は Entity が所有する SpriteComponent が担当する
  }

  /**
   * 方向に応じてテクスチャを更新
   * @param direction 新しい方向
   */
  private updateDirectionTexture(direction: Direction): void {
    if (!this.spriteComponent) return;

    const texturePath = getEnemyTexturePath(this.enemyType, direction);
    this.spriteComponent.changeTexture(texturePath);
  }

  /**
   * Presentation を破棄する
   * direction_changed リスナーと SpriteComponent を破棄する
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.eventSystem && this.directionChangedListener) {
      this.eventSystem.off('direction_changed', this.directionChangedListener);
      this.directionChangedListener = null;
    }

    const entity = this.entity;
    if (entity && entity.getComponent<SpriteComponent>('sprite') === this.spriteComponent) {
      entity.removeComponent('sprite');
    } else {
      this.spriteComponent?.destroy();
    }

    this.spriteComponent = null;
    this.eventSystem = null;
    this.entity = null;
  }
}
