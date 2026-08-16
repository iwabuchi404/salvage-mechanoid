import {
  getItemVisualProfile,
  getItemColor,
  getInventoryItemColor,
  getRarityColor,
} from '@/engine/presentation/item/ItemVisualProfile';
import { ItemType, InventoryItemType, ItemRarity } from '@/engine/types';

/**
 * ItemVisualProfile の純粋関数テスト
 * PixiJS 初期化なしで実行できる。
 *
 * C1: Player / Item の描画ライフサイクルを Presentation へ移す
 */
describe('ItemVisualProfile', () => {
  describe('getItemColor', () => {
    it.each([
      [ItemType.HEALTH, 0x00ff00],
      [ItemType.ENERGY, 0x00ffff],
      [ItemType.WEAPON, 0xff9900],
      [ItemType.ARMOR, 0x0099ff],
      [ItemType.KEY, 0xffff00],
      [ItemType.UPGRADE, 0xff00ff],
      [ItemType.CONSUMABLE, 0xffffff],
    ])('ItemType %s の色を取得できる', (itemType, expectedColor) => {
      expect(getItemColor(itemType)).toBe(expectedColor);
    });
  });

  describe('getInventoryItemColor', () => {
    it.each([
      [InventoryItemType.HEALTH_PACK, 0x00ff00],
      [InventoryItemType.ENERGY_CELL, 0x00ffff],
      [InventoryItemType.WEAPON_UPGRADE, 0xff9900],
      [InventoryItemType.ARMOR_UPGRADE, 0x0099ff],
      [InventoryItemType.KEY_ITEM, 0xffff00],
    ])('InventoryItemType %s の色を取得できる', (inventoryType, expectedColor) => {
      expect(getInventoryItemColor(inventoryType)).toBe(expectedColor);
    });
  });

  describe('getItemVisualProfile', () => {
    it('InventoryItemType 未設定時は ItemType から色を決定する', () => {
      const profile = getItemVisualProfile(ItemType.HEALTH, null);

      expect(profile.fillColor).toBe(0x00ff00);
      expect(profile.radius).toBe(8);
      expect(profile.strokeColor).toBe(0x000000);
      expect(profile.strokeWidth).toBe(2);
      expect(profile.yOffset).toBe(16);
    });

    it('InventoryItemType 設定時はそちらを優先する', () => {
      const profile = getItemVisualProfile(ItemType.HEALTH, InventoryItemType.WEAPON_UPGRADE);

      expect(profile.fillColor).toBe(0xff9900);
    });

    it('プロファイルが不変（freeze）である', () => {
      const profile = getItemVisualProfile(ItemType.HEALTH, null);

      expect(Object.isFrozen(profile)).toBe(true);
    });
  });

  describe('getRarityColor', () => {
    it.each([
      [ItemRarity.COMMON, 0xffffff],
      [ItemRarity.UNCOMMON, 0x00ff00],
      [ItemRarity.RARE, 0x0080ff],
      [ItemRarity.LEGENDARY, 0xff8000],
    ])('ItemRarity %s の色を取得できる', (rarity, expectedColor) => {
      expect(getRarityColor(rarity)).toBe(expectedColor);
    });
  });
});
