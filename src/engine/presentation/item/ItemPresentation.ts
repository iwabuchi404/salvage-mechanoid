import { Entity } from '../../entity/Entity';
import { Component } from '../../entity/Component';
import { TransformComponent } from '../../entity/components/Transform';
import { Engine } from '../../Engine';
import { RendererSystem } from '../../graphics/RendererSystem';
import { EventSystem } from '../../events/EventSystem';
import { ItemType, InventoryItemType } from '../../types';
import { ItemVisualProfile, getItemVisualProfile } from './ItemVisualProfile';
import * as PIXI from 'pixi.js';

/**
 * Item の描画ライフサイクルを管理する Presentation クラス
 *
 * PIXI.Graphics による円描画の生成・配置、FOV 変更時の可視性切替、
 * 位置同期を担当する。Item（ドメイン）側は PixiJS を知らなくて済む。
 *
 * C1: Player / Item の描画ライフサイクルを Presentation へ移す
 */
export class ItemPresentation implements Component {
  readonly type = 'item-presentation';
  entity: Entity | null = null;

  private readonly itemType: ItemType;
  private profile: ItemVisualProfile;
  private graphics: PIXI.Graphics | null = null;
  private inFOV = false;
  private destroyed = false;
  private eventSystem: EventSystem | null = null;
  private visibilityChangedListener: ((data: { entityId: string; inFOV: boolean }) => void) | null =
    null;

  /**
   * コンストラクタ
   * @param itemType アイテムタイプ
   * @param inventoryItemType インベントリアイテムタイプ（任意）
   */
  constructor(itemType: ItemType, inventoryItemType: InventoryItemType | null = null) {
    this.itemType = itemType;
    this.profile = getItemVisualProfile(itemType, inventoryItemType);
  }

  /**
   * Profile を更新する（InventoryItemType 設定後など）
   */
  updateProfile(inventoryItemType: InventoryItemType | null): void {
    this.profile = getItemVisualProfile(this.itemType, inventoryItemType);
    if (this.graphics) {
      this.redrawGraphics();
    }
  }

  /**
   * Presentation を初期化する
   * PIXI.Graphics を生成して RendererSystem の objects レイヤーへ配置し、
   * entity_visibility_changed リスナーを登録する
   */
  async initialize(): Promise<void> {
    const entity = this.entity;
    if (!entity || this.destroyed || this.graphics) return;

    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (!rendererSystem) return;

    const transform = entity.getComponent<TransformComponent>('transform');
    if (!transform) return;

    this.graphics = this.createGraphics();
    this.applyGraphicsPosition(transform, rendererSystem);

    const layer = rendererSystem.getLayer('objects');
    if (layer) {
      layer.addChild(this.graphics);
    }

    // entity_visibility_changed イベントを購読
    this.eventSystem = Engine.instance.getSystem<EventSystem>('event') ?? null;
    if (this.eventSystem) {
      this.visibilityChangedListener = (data) => {
        if (data.entityId === entity.id) {
          this.inFOV = data.inFOV;
          this.updateVisibility(entity);
        }
      };
      this.eventSystem.on('entity_visibility_changed', this.visibilityChangedListener);
    }
  }

  update(): void {
    if (!this.graphics) return;
    const entity = this.entity;
    if (!entity) return;

    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    const transform = entity.getComponent<TransformComponent>('transform');
    if (!rendererSystem || !transform) return;

    this.applyGraphicsPosition(transform, rendererSystem);
    this.updateVisibility(entity);
  }

  /**
   * Presentation を破棄する
   * リスナー解除と Graphics の破棄を行う
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.eventSystem && this.visibilityChangedListener) {
      this.eventSystem.off('entity_visibility_changed', this.visibilityChangedListener);
      this.visibilityChangedListener = null;
    }

    if (this.graphics) {
      if (this.graphics.parent) {
        this.graphics.parent.removeChild(this.graphics);
      }
      this.graphics.destroy();
      this.graphics = null;
    }

    this.eventSystem = null;
    this.entity = null;
  }

  // ===== 内部メソッド =====

  private createGraphics(): PIXI.Graphics {
    const graphics = new PIXI.Graphics();
    this.drawCircle(graphics);
    return graphics;
  }

  private redrawGraphics(): void {
    if (!this.graphics) return;
    this.graphics.clear();
    this.drawCircle(this.graphics);
  }

  private drawCircle(graphics: PIXI.Graphics): void {
    graphics.circle(0, 0, this.profile.radius);
    graphics.fill(this.profile.fillColor);
    graphics.stroke({ width: this.profile.strokeWidth, color: this.profile.strokeColor });
  }

  private applyGraphicsPosition(
    transform: TransformComponent,
    rendererSystem: RendererSystem
  ): void {
    if (!this.graphics) return;

    const pos = transform.position;
    const screenPos = rendererSystem.getCoordinateSystem().isometricToScreen(pos.x, pos.y, pos.z);
    this.graphics.x = screenPos.x;
    this.graphics.y = screenPos.y - this.profile.yOffset;

    const baseZIndex = (pos.y + pos.x) * 1000;
    this.graphics.zIndex = baseZIndex + pos.z * 100;
  }

  private updateVisibility(entity: Entity): void {
    if (!this.graphics) return;
    // Item が collected でない限り描画。collected は active=false で表現される。
    this.graphics.visible = entity.active && this.inFOV;
  }
}
