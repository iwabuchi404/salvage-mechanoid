// src/stores/game.ts
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { InventoryItem, RobotPart, Weapon } from '../engine/types';

export interface ItemEffectHandlers {
  restoreEnergy?: (amount: number) => number;
  increaseMaxEnergy?: (amount: number) => boolean;
}

export const useGameStore = defineStore('game', () => {
  // プレイヤーの状態を管理するref
  const player = ref({
    status: {
      level: 1,
      hp: 100,
      maxHp: 100,
      energy: 200,
      maxEnergy: 200,
      strength: 10,
      defense: 5,
      viewRadius: 12, // 視野半径（マス数）
    },
    position: { x: 0, y: 0, z: 0 },
    items: [''], // 旧形式（互換性のため残す）
  });

  // インベントリ（新形式）
  const inventory = ref<InventoryItem[]>([]);
  const maxInventorySize = ref(10); // 初期スロット数10

  // その他のゲーム状態を管理するref
  const enemies = ref([]);
  const objects = ref([]);

  const currentFloor = ref(1);
  const score = ref(0);

  const isPortalActive = ref(false);

  // プレイヤーが生存しているかどうかを計算するgetter
  const isPlayerAlive = computed(() => player.value.status.hp > 0);

  // プレイヤーのエネルギーパーセンテージを計算するgetter
  const playerEnergyPercentage = computed(
    () => (player.value.status.energy / player.value.status.maxEnergy) * 100
  );

  // プレイヤーの位置を更新する関数
  function updatePlayerPosition(x: number, y: number, z: number) {
    player.value.position = { x, y, z };
  }

  // プレイヤーにダメージを与える関数
  function damagePlayer(amount: number) {
    player.value.status.hp = Math.max(0, player.value.status.hp - amount);
  }

  // スコアを追加する関数
  function addScore(points: number) {
    score.value += points;
  }

  const setPortalActive = (isActive: boolean) => {
    isPortalActive.value = isActive;
  };

  // ============================================================
  // インベントリ管理関数
  // ============================================================

  /**
   * アイテムをインベントリに追加
   * @param item 追加するアイテム
   * @returns 追加に成功したかどうか
   */
  function addItemToInventory(item: InventoryItem): boolean {
    // インベントリが満杯かチェック
    if (inventory.value.length >= maxInventorySize.value) {
      console.warn('Inventory is full');
      return false;
    }

    // スタック可能なアイテムの場合、既存のアイテムを探す
    if (item.stackable) {
      const existingItem = inventory.value.find((i) => i.type === item.type);
      if (existingItem) {
        existingItem.quantity += item.quantity;
        console.log(`Stacked item: ${item.name} (total: ${existingItem.quantity})`);
        return true;
      }
    }

    // 新規追加
    inventory.value.push(item);
    console.log(`Added item to inventory: ${item.name}`);
    return true;
  }

  /**
   * アイテムをインベントリから削除
   * @param itemId アイテムID
   * @returns 削除に成功したかどうか
   */
  function removeItemFromInventory(itemId: string): boolean {
    const index = inventory.value.findIndex((i) => i.id === itemId);
    if (index === -1) {
      console.warn(`Item not found: ${itemId}`);
      return false;
    }

    inventory.value.splice(index, 1);
    console.log(`Removed item from inventory: ${itemId}`);
    return true;
  }

  /**
   * アイテムを使用
   * @param itemId アイテムID
   * @returns 使用に成功したかどうか
   */
  function useItem(itemId: string, handlers: ItemEffectHandlers = {}): boolean {
    const item = inventory.value.find((i) => i.id === itemId);
    if (!item) {
      console.warn(`Item not found: ${itemId}`);
      return false;
    }

    // アイテム効果を適用
    const success = applyItemEffect(item, handlers);

    if (success) {
      // スタック可能なアイテムは数量を減らす
      if (item.stackable && item.quantity > 1) {
        item.quantity--;
        console.log(`Used item: ${item.name} (remaining: ${item.quantity})`);
      } else {
        // 数量が1またはスタック不可の場合は削除
        removeItemFromInventory(itemId);
      }
    }

    return success;
  }

  /**
   * アイテム効果を適用
   * @param item アイテム
   * @returns 適用に成功したかどうか
   */
  function applyItemEffect(item: InventoryItem, handlers: ItemEffectHandlers): boolean {
    const effect = item.effect;

    switch (effect.type) {
      case 'heal':
        // HP回復
        if (effect.value) {
          const newHp = Math.min(player.value.status.hp + effect.value, player.value.status.maxHp);
          player.value.status.hp = newHp;
          console.log(`Healed ${effect.value} HP (current: ${newHp})`);
        }
        return true;

      case 'energy':
        if (!effect.value || !handlers.restoreEnergy) return false;
        handlers.restoreEnergy(effect.value);
        console.log(`Restored ${effect.value} energy`);
        return true;

      case 'stat_boost':
        // ステータスブースト
        if (effect.statType && effect.value) {
          switch (effect.statType) {
            case 'strength':
              player.value.status.strength += effect.value;
              console.log(
                `Strength increased by ${effect.value} (current: ${player.value.status.strength})`
              );
              break;
            case 'defense':
              player.value.status.defense += effect.value;
              console.log(
                `Defense increased by ${effect.value} (current: ${player.value.status.defense})`
              );
              break;
            case 'maxHp':
              player.value.status.maxHp += effect.value;
              console.log(
                `Max HP increased by ${effect.value} (current: ${player.value.status.maxHp})`
              );
              break;
            case 'maxEnergy':
              if (!handlers.increaseMaxEnergy) return false;
              return handlers.increaseMaxEnergy(effect.value);
          }
        }
        return true;

      case 'special':
        // 特殊効果（キーアイテムなど）
        console.log(`Special item used: ${item.name}`);
        // ポータル解放などの特殊処理はここで実装
        setPortalActive(true);
        return true;

      default:
        console.warn(`Unknown effect type: ${effect.type}`);
        return false;
    }
  }

  /**
   * インベントリ容量を拡張
   * @param additionalSlots 追加スロット数
   */
  function expandInventory(additionalSlots: number): void {
    maxInventorySize.value += additionalSlots;
    console.log(`Inventory expanded by ${additionalSlots} (new max: ${maxInventorySize.value})`);
  }

  /**
   * インベントリの空きスロット数を取得
   */
  const availableInventorySlots = computed(() => {
    return maxInventorySize.value - inventory.value.length;
  });

  /**
   * インベントリが満杯かどうか
   */
  const isInventoryFull = computed(() => {
    return inventory.value.length >= maxInventorySize.value;
  });

  // ============================================================
  // パーツ倉庫管理
  // ============================================================

  const partsStorage = ref<RobotPart[]>([]);
  const weaponsStorage = ref<Weapon[]>([]);
  const maxStorageCapacity = ref(20); // 初期容量20個

  /**
   * パーツを倉庫に追加
   */
  function addPartToStorage(part: RobotPart): boolean {
    const totalItems = partsStorage.value.length + weaponsStorage.value.length;
    if (totalItems >= maxStorageCapacity.value) {
      console.warn('Storage is full');
      return false;
    }

    partsStorage.value.push(part);
    console.log(`Added part to storage: ${part.name}`);
    return true;
  }

  /**
   * 武器を倉庫に追加
   */
  function addWeaponToStorage(weapon: Weapon): boolean {
    const totalItems = partsStorage.value.length + weaponsStorage.value.length;
    if (totalItems >= maxStorageCapacity.value) {
      console.warn('Storage is full');
      return false;
    }

    weaponsStorage.value.push(weapon);
    console.log(`Added weapon to storage: ${weapon.name}`);
    return true;
  }

  /**
   * パーツを倉庫から削除
   */
  function removePartFromStorage(partId: string): boolean {
    const index = partsStorage.value.findIndex((p) => p.id === partId);
    if (index === -1) {
      console.warn(`Part not found: ${partId}`);
      return false;
    }

    partsStorage.value.splice(index, 1);
    console.log(`Removed part from storage: ${partId}`);
    return true;
  }

  /**
   * 武器を倉庫から削除
   */
  function removeWeaponFromStorage(weaponId: string): boolean {
    const index = weaponsStorage.value.findIndex((w) => w.id === weaponId);
    if (index === -1) {
      console.warn(`Weapon not found: ${weaponId}`);
      return false;
    }

    weaponsStorage.value.splice(index, 1);
    console.log(`Removed weapon from storage: ${weaponId}`);
    return true;
  }

  /**
   * 倉庫容量を拡張
   */
  function expandStorage(additionalSlots: number): void {
    maxStorageCapacity.value += additionalSlots;
    console.log(`Storage expanded by ${additionalSlots} (new max: ${maxStorageCapacity.value})`);
  }

  /**
   * 倉庫の空きスロット数を取得
   */
  const availableStorageSlots = computed(() => {
    const totalItems = partsStorage.value.length + weaponsStorage.value.length;
    return maxStorageCapacity.value - totalItems;
  });

  /**
   * 倉庫が満杯かどうか
   */
  const isStorageFull = computed(() => {
    const totalItems = partsStorage.value.length + weaponsStorage.value.length;
    return totalItems >= maxStorageCapacity.value;
  });

  // 外部から使用可能な状態とメソッドを返す
  return {
    player,
    enemies,
    objects,
    currentFloor,
    score,
    isPlayerAlive,
    playerEnergyPercentage,
    updatePlayerPosition,
    damagePlayer,
    addScore,
    setPortalActive,
    isPortalActive,
    // インベントリ関連
    inventory,
    maxInventorySize,
    availableInventorySlots,
    isInventoryFull,
    addItemToInventory,
    removeItemFromInventory,
    useItem,
    expandInventory,
    // パーツ倉庫関連
    partsStorage,
    weaponsStorage,
    maxStorageCapacity,
    availableStorageSlots,
    isStorageFull,
    addPartToStorage,
    addWeaponToStorage,
    removePartFromStorage,
    removeWeaponFromStorage,
    expandStorage,
  };
});
