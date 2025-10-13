// src/stores/ui.ts
import { defineStore } from 'pinia';
import type { InventoryItem } from '../engine/types';

export const useUIStore = defineStore('ui', {
  state: () => ({
    isMenuOpen: false,
    selectedMenuItem: null,
    volume: 0.5,
    isMuted: false,
    // アイテム取得確認ダイアログ
    itemPickupDialog: {
      visible: false,
      item: null as InventoryItem | null,
      position: { x: 0, y: 0 },
      itemEntityId: null as string | null, // アイテムエンティティのID
    },
    // インベントリパネル
    inventoryPanelVisible: false,
  }),
  actions: {
    toggleMenu() {
      this.isMenuOpen = !this.isMenuOpen;
    },
    setVolume(volume: number) {
      this.volume = volume;
    },
    toggleMute() {
      this.isMuted = !this.isMuted;
    },
    // アイテム取得確認ダイアログを表示
    showItemPickupDialog(item: InventoryItem, position: { x: number; y: number }) {
      this.itemPickupDialog.visible = true;
      this.itemPickupDialog.item = item;
      this.itemPickupDialog.position = position;
    },
    // アイテム取得確認ダイアログを閉じる
    hideItemPickupDialog() {
      this.itemPickupDialog.visible = false;
      this.itemPickupDialog.item = null;
      this.itemPickupDialog.itemEntityId = null;
    },
    // インベントリパネルを開閉
    toggleInventoryPanel() {
      this.inventoryPanelVisible = !this.inventoryPanelVisible;
    },
    // インベントリパネルを表示
    showInventoryPanel() {
      this.inventoryPanelVisible = true;
    },
    // インベントリパネルを非表示
    hideInventoryPanel() {
      this.inventoryPanelVisible = false;
    },
  },
});
