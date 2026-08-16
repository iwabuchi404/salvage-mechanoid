import { Entity } from '../../entity/Entity';
import { ItemType, InventoryItemType } from '../../types';
import { ItemPresentation } from './ItemPresentation';

/**
 * Item の Presentation を生成するファクトリ
 *
 * Item 本体（ドメイン）と Presentation（描画）の組み立てを分離し、
 * Item が PixiJS や RendererSystem を知らなくて済むようにする。
 *
 * C1: Player / Item の描画ライフサイクルを Presentation へ移す
 */
export class ItemPresentationFactory {
  /**
   * Item の Presentation を生成・初期化する
   * @param entity 対象の Item エンティティ
   * @param itemType アイテムタイプ
   * @param inventoryItemType インベントリアイテムタイプ（任意）
   * @returns 初期化済みの ItemPresentation
   */
  static async create(
    entity: Entity,
    itemType: ItemType,
    inventoryItemType: InventoryItemType | null = null
  ): Promise<ItemPresentation> {
    const existing = entity.getComponent<ItemPresentation>('item-presentation');
    if (existing) return existing;

    const presentation = new ItemPresentation(itemType, inventoryItemType);
    entity.addComponent(presentation);

    try {
      await presentation.initialize();
      return presentation;
    } catch (error) {
      entity.removeComponent(presentation.type);
      throw error;
    }
  }
}
