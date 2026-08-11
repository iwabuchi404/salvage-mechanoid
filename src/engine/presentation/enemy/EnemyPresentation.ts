import { Entity } from '../../entity/Entity';
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
export class EnemyPresentation {
  private entity: Entity;
  private enemyType: EnemyType;
  private spriteComponent: SpriteComponent | null = null;
  private directionChangedListener:
    | ((data: { entityId: string; direction: Direction }) => void)
    | null = null;

  /**
   * コンストラクタ
   * @param entity 対象の Enemy エンティティ
   * @param enemyType 敵タイプ（テクスチャ選択用）
   */
  constructor(entity: Entity, enemyType: EnemyType) {
    this.entity = entity;
    this.enemyType = enemyType;
  }

  /**
   * Presentation を初期化する
   * SpriteComponent を生成して Entity に追加し、初期化してから direction_changed リスナーを登録する
   */
  async initialize(): Promise<void> {
    const profile = getEnemyVisualProfile(this.enemyType);

    // SpriteComponent を生成して Entity に追加
    this.spriteComponent = new SpriteComponent(profile.defaultTexturePath, profile.layer, {
      x: profile.anchor.x,
      y: profile.anchor.y,
    });
    this.entity.addComponent(this.spriteComponent);

    // SpriteComponent を初期化（テクスチャ読み込み・Renderer への登録など）
    if (this.spriteComponent.initialize) {
      await this.spriteComponent.initialize();
    }

    // direction_changed イベントを購読
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      this.directionChangedListener = (data) => {
        if (data.entityId === this.entity.id) {
          this.updateDirectionTexture(data.direction);
        }
      };
      eventSystem.on('direction_changed', this.directionChangedListener);
    }
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
   * direction_changed リスナーを解除する
   * SpriteComponent 自体の破棄は Entity.destroy() 経由で行われる
   */
  destroy(): void {
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem && this.directionChangedListener) {
      eventSystem.off('direction_changed', this.directionChangedListener);
      this.directionChangedListener = null;
    }

    this.spriteComponent = null;
    this.entity = null as unknown as Entity;
  }
}
