import { Item } from '../entity/Item';
import { ItemPresentationFactory } from '../presentation/item/ItemPresentationFactory';
import { ItemType, InventoryItemType, PlacedItem } from '../types';

/**
 * ItemType から InventoryItemType への変換マッピング
 *
 * Item 生成側がこの変換を内包し、Game 側は ItemType を知らなくて済む。
 */
const ITEM_TYPE_TO_INVENTORY_TYPE: Readonly<Record<ItemType, InventoryItemType | null>> = {
  [ItemType.HEALTH]: InventoryItemType.HEALTH_PACK,
  [ItemType.ENERGY]: InventoryItemType.ENERGY_CELL,
  [ItemType.WEAPON]: InventoryItemType.WEAPON_UPGRADE,
  [ItemType.UPGRADE]: InventoryItemType.WEAPON_UPGRADE,
  [ItemType.ARMOR]: InventoryItemType.ARMOR_UPGRADE,
  [ItemType.KEY]: InventoryItemType.KEY_ITEM,
  [ItemType.CONSUMABLE]: null,
};

/**
 * ItemType に対応する InventoryItemType を取得する（純粋関数）
 * @param itemType アイテムタイプ
 * @returns インベントリアイテムタイプ、該当なしは null
 */
export function mapItemTypeToInventoryType(itemType: ItemType): InventoryItemType | null {
  return ITEM_TYPE_TO_INVENTORY_TYPE[itemType] ?? null;
}

/**
 * Item エンティティの生成と組み立てを集約する Factory
 *
 * Game はこの Factory へ PlacedItem を渡すだけでよく、
 * ItemType → InventoryItemType の変換や Item の内部構成を知る必要がない。
 * 初期化失敗時には生成済み Entity を破棄して例外を再送する。
 */
export class ItemFactory {
  /**
   * Item を生成・初期化する
   * @param placedItem 配置されたアイテムデータ
   * @returns 初期化済みの Item
   * @throws 初期化失敗時に生成済み Entity を破棄して例外を再送
   */
  static async create(placedItem: PlacedItem): Promise<Item> {
    const item = new Item(placedItem);

    // ItemType → InventoryItemType の変換を内包
    const inventoryType = mapItemTypeToInventoryType(placedItem.type);
    if (inventoryType) {
      item.setInventoryItemType(inventoryType);
    }

    try {
      await item.initialize();
      // C1: 描画ライフサイクルを Presentation へ移譲
      await ItemPresentationFactory.create(item, placedItem.type, inventoryType);
      return item;
    } catch (error) {
      try {
        item.destroy();
      } catch (destroyError) {
        console.error(`Failed to destroy item ${placedItem.id}:`, destroyError);
      }
      throw error;
    }
  }
}
