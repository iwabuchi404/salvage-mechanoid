<template>
  <div>
    <div v-if="dialogVisible" class="item-pickup-overlay" @click="cancelPickup"></div>
    <BaseWindow
      type="normal"
      :state="dialogVisible"
      width="500px"
      height="400px"
      :pos="{ x: 'calc(50% - 250px)', y: 'calc(50% - 200px)' }"
      :z-index="10001"
      title="アイテム発見"
      @close="cancelPickup"
    >
      <div v-if="item" class="item-content">
        <div class="item-name">{{ item.name }}</div>
        <div class="item-description">{{ item.description }}</div>

        <div class="item-stats">
          <div v-if="item.effect.type === 'heal'" class="stat">
            HP回復: +{{ item.effect.value }}
          </div>
          <div v-if="item.effect.type === 'energy'" class="stat">
            エネルギー回復: +{{ item.effect.value }}
          </div>
          <div v-if="item.effect.type === 'stat_boost'" class="stat">
            {{ getStatName(item.effect.statType!) }}: +{{ item.effect.value }}
          </div>
          <div v-if="item.effect.type === 'special'" class="stat">特殊効果</div>
        </div>

        <div class="inventory-status">
          インベントリ: {{ gameStore.inventory.length }} / {{ gameStore.maxInventorySize }}
        </div>

        <div v-if="gameStore.isInventoryFull" class="warning">インベントリが満杯です！</div>
      </div>

      <div class="dialog-buttons">
        <BaseButton type="small" width="120px" @click="pickupItem"> 拾う </BaseButton>
        <BaseButton type="small" width="120px" @click="cancelPickup"> キャンセル </BaseButton>
      </div>
    </BaseWindow>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import { useUIPanelStore } from '../../stores/uiPanelStore';
import type { InventoryItem } from '../../engine/types';
import BaseWindow from './BaseWindow.vue';
import BaseButton from './BaseButton.vue';

const gameStore = useGameStore();
const panelStore = useUIPanelStore();

// BU-4 段階4: uiPanelStore から item_pickup パネルの状態を取得
const dialogVisible = computed(() => panelStore.isOpen('item_pickup'));

interface ItemPickupPayload {
  item: InventoryItem;
  position: { x: number; y: number };
  itemEntityId: string | null;
}

const payload = computed<ItemPickupPayload | null>(() =>
  panelStore.getPayload<ItemPickupPayload>('item_pickup')
);
const item = computed(() => payload.value?.item ?? null);

// ステータス名を取得
function getStatName(statType: string): string {
  const statNames: { [key: string]: string } = {
    strength: '攻撃力',
    defense: '防御力',
    maxHp: '最大HP',
    maxEnergy: '最大エネルギー',
  };
  return statNames[statType] || statType;
}

// アイテムを拾う
function pickupItem() {
  if (!item.value) return;
  if (gameStore.isInventoryFull) return;

  // インベントリに追加
  const success = gameStore.addItemToInventory(item.value);

  if (success) {
    // Stageからアイテムを削除（カスタムイベントで通知）
    const itemEntityId = payload.value?.itemEntityId;
    if (itemEntityId) {
      window.dispatchEvent(
        new CustomEvent('removeItem', {
          detail: { itemId: itemEntityId },
        })
      );
    }

    // BU-4 段階4: PanelManager 経由で閉じる
    panelStore.close('item_pickup');
  }
}

// キャンセル
function cancelPickup() {
  // BU-4 段階4: PanelManager 経由で閉じる
  panelStore.close('item_pickup');
}
</script>

<style scoped>
.item-pickup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  pointer-events: auto;
}

.item-content {
  margin-bottom: 20px;
}

.item-name {
  color: #ffd700;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 12px;
  text-align: center;
}

.item-description {
  color: #ccc;
  font-size: 1rem;
  margin-bottom: 16px;
  line-height: 1.6;
  text-align: center;
}

.item-stats {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #f17623;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
}

.stat {
  color: #88ff88;
  font-size: 1rem;
  margin: 4px 0;
}

.inventory-status {
  color: #f17623;
  font-size: 0.9rem;
  text-align: center;
  margin-bottom: 8px;
}

.warning {
  color: #ff6666;
  font-size: 1rem;
  text-align: center;
  margin-bottom: 12px;
  font-weight: bold;
}

.dialog-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}
</style>
