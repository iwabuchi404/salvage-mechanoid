import { ItemType, InventoryItemType, ItemRarity } from '../../types';

/**
 * アイテムの表示設定（PixiJS オブジェクトを含まない純粋データ）
 *
 * Item ドメインエンティティから描画関心を切り離すため、
 * 色・サイズ・オフセットなどの表示パラメータを純データとして保持する。
 */
export interface ItemVisualProfile {
  /** 円の半径（ピクセル） */
  readonly radius: number;
  /** 塗りつぶし色 */
  readonly fillColor: number;
  /** 縁取り色 */
  readonly strokeColor: number;
  /** 縁取り幅 */
  readonly strokeWidth: number;
  /** Y軸オフセット（タイル中心より上に浮かせる量） */
  readonly yOffset: number;
}

const DEFAULT_PROFILE: ItemVisualProfile = Object.freeze({
  radius: 8,
  fillColor: 0xffffff,
  strokeColor: 0x000000,
  strokeWidth: 2,
  yOffset: 16,
});

const ITEM_TYPE_COLORS: Readonly<Record<ItemType, number>> = Object.freeze({
  [ItemType.HEALTH]: 0x00ff00,
  [ItemType.ENERGY]: 0x00ffff,
  [ItemType.WEAPON]: 0xff9900,
  [ItemType.ARMOR]: 0x0099ff,
  [ItemType.KEY]: 0xffff00,
  [ItemType.UPGRADE]: 0xff00ff,
  [ItemType.CONSUMABLE]: 0xffffff,
});

const INVENTORY_ITEM_TYPE_COLORS: Readonly<Record<InventoryItemType, number>> = Object.freeze({
  [InventoryItemType.HEALTH_PACK]: 0x00ff00,
  [InventoryItemType.ENERGY_CELL]: 0x00ffff,
  [InventoryItemType.WEAPON_UPGRADE]: 0xff9900,
  [InventoryItemType.ARMOR_UPGRADE]: 0x0099ff,
  [InventoryItemType.KEY_ITEM]: 0xffff00,
});

/**
 * ItemType に対応する表示色を取得する（純粋関数）
 */
export function getItemColor(itemType: ItemType): number {
  return ITEM_TYPE_COLORS[itemType] ?? 0xffffff;
}

/**
 * InventoryItemType に対応する表示色を取得する（純粋関数）
 */
export function getInventoryItemColor(inventoryType: InventoryItemType): number {
  return INVENTORY_ITEM_TYPE_COLORS[inventoryType] ?? 0xffffff;
}

/**
 * ItemVisualProfile を構築する（純粋関数）
 *
 * InventoryItemType が設定されている場合はそちらを優先し、
 * 未設定の場合は ItemType から色を決定する。
 */
export function getItemVisualProfile(
  itemType: ItemType,
  inventoryItemType: InventoryItemType | null
): ItemVisualProfile {
  const fillColor = inventoryItemType
    ? getInventoryItemColor(inventoryItemType)
    : getItemColor(itemType);

  return Object.freeze({
    ...DEFAULT_PROFILE,
    fillColor,
  });
}

/**
 * レアリティに対応する色を取得する（純粋関数、将来的な拡張用）
 */
export function getRarityColor(rarity: ItemRarity): number {
  switch (rarity) {
    case ItemRarity.COMMON:
      return 0xffffff;
    case ItemRarity.UNCOMMON:
      return 0x00ff00;
    case ItemRarity.RARE:
      return 0x0080ff;
    case ItemRarity.LEGENDARY:
      return 0xff8000;
    default:
      return 0xffffff;
  }
}
