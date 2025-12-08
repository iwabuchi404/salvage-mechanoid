<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { Game } from '../../game/Game';
import { defineEmits } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import BaseButton from '../uiParts/BaseButton.vue';
import BaseWindow from '../uiParts/BaseWindow.vue';
import ItemPickupDialog from '../uiParts/ItemPickupDialog.vue';

const gameStore = useGameStore();
const mainCanvas = ref<HTMLCanvasElement | null>(null);
const game = new Game();

const selectedTile = ref<{
  name: string;
  effect: string;
  statModifier: Record<string, number>;
} | null>(null);
const message = ref<string | null>(null);

const showActionMenu = ref(true);
const showItemList = ref(false);
const showStatusWindow = ref(false);
const playerItems = ref<Array<{ id: string; name: string; description: string }>>([]);
const isPlayerTurn = ref(true);

const energyPercentage = computed(
  () => (gameStore.player.status.energy / gameStore.player.status.maxEnergy) * 100
);
const hpPercentage = computed(
  () => (gameStore.player.status.hp / gameStore.player.status.maxHp) * 100
);

const emit = defineEmits<{
  (e: 'game-clear'): void;
  (e: 'game-over', score: number): void;
}>();

onMounted(async () => {
  if (mainCanvas.value) {
    await game.initialize(mainCanvas.value);

    game.setOnGameOver((score: number) => {
      emit('game-over', score);
    });

    game.setOnTileSelect((tileInfo: any) => {
      selectedTile.value = tileInfo;
      showStatusWindow.value = true; // タイル選択時にステータスウィンドウを表示
    });

    game.setOnEnemySelect((enemyInfo: any) => {
      // 敵の情報をselectedTileに格納して表示
      selectedTile.value = {
        name: enemyInfo.id || 'Enemy',
        effect: 'Enemy Entity',
        statModifier: {},
      };
      showStatusWindow.value = true;
    });

    game.setOnCharacterSelect((characterInfo: any) => {
      // キャラクターの情報をselectedTileに格納して表示
      selectedTile.value = {
        name: characterInfo.id || 'Character',
        effect: 'Character Entity',
        statModifier: {},
      };
      showStatusWindow.value = true;
    });

    // ターン変更コールバックを設定
    game.setOnTurnChange((playerTurn: boolean) => {
      isPlayerTurn.value = playerTurn;
    });

    window.addEventListener('resize', resizeGame);
    resizeGame(); // 初期サイズを設定
  }
});
const movePlayer = (direction: 'up' | 'down' | 'left' | 'right') => {
  if (isPlayerTurn.value) {
    game.movePlayer(direction);
  }
};
const closeStatusWindow = () => {
  showStatusWindow.value = false;
  selectedTile.value = null;
};

const getSelectedName = () => {
  return '';
};

const showItems = () => {
  // 新しいインベントリシステムを使用
  playerItems.value = gameStore.inventory.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
  }));
  showItemList.value = true;
  // showActionMenu.value = false;
};
const closeItemList = () => {
  showItemList.value = false;
  showActionMenu.value = true;
};

// アイテムを使用
const useInventoryItem = (itemId: string) => {
  const success = gameStore.useItem(itemId);
  if (success) {
    message.value = 'アイテムを使用しました';
    setTimeout(() => {
      message.value = '';
    }, 2000);

    // アイテムリストを更新
    showItems();
  }
};
const attack = async () => {
  if (isPlayerTurn.value) {
    await game.playerAttack();
    checkGameClear();
  }
};
const showStatus = () => {
  showStatusWindow.value = true;
  selectedTile.value = null;
};

// ゲームクリア時の処理を追加
function checkGameClear() {
  if (game.isAllEnemiesDefeated()) {
    emit('game-clear');
  }
}

const resizeGame = () => {
  if (!mainCanvas.value || !game) {
    return;
  }

  const containerWidth = mainCanvas.value.clientWidth;
  const containerHeight = mainCanvas.value.clientHeight;
  const aspectRatio = 4 / 3; // 800 / 600

  let newWidth, newHeight;

  if (containerWidth / containerHeight > aspectRatio) {
    newHeight = containerHeight;
    newWidth = newHeight * aspectRatio;
  } else {
    newWidth = containerWidth;
    newHeight = newWidth / aspectRatio;
  }

  game.resize(newWidth, newHeight);
};

const closePortalDialog = () => {
  gameStore.setPortalActive(false);
};
</script>

<template>
  <div class="game-screen">
    <div id="game-container" ref="mainCanvas"></div>
    <div id="ui-overlay">
      <div class="player-info">
        <p class="energy-text">
          HP: {{ gameStore.player.status.hp }} / {{ gameStore.player.status.maxHp }}
        </p>
        <div class="energy-bar energy-text--hp">
          <div class="energy-fill energy-fill--hp" :style="{ width: `${hpPercentage}%` }"></div>
        </div>
        <p class="energy-text">
          Energy: {{ gameStore.player.status.energy }} / {{ gameStore.player.status.maxEnergy }}
        </p>
        <div class="energy-bar">
          <div class="energy-fill" :style="{ width: `${energyPercentage}%` }"></div>
        </div>
      </div>
      <div class="controls">
        <button @click="movePlayer('up')">↑</button>
        <button @click="movePlayer('left')">←</button>
        <button @click="movePlayer('right')">→</button>
        <button @click="movePlayer('down')">↓</button>
      </div>
      <div v-if="showActionMenu" class="action-menu">
        <BaseButton @click="attack" :type="'small'">攻撃</BaseButton>
        <BaseButton @click="showStatus" :type="'small'">ステータス</BaseButton>
        <BaseButton @click="showItems" :type="'small'">アイテム</BaseButton>
      </div>

      <BaseWindow
        height="360px"
        width="300px"
        :pos="{ x: 'calc(100% - 340px)', y: 'calc(10px)' }"
        :state="showStatusWindow"
        :title="getSelectedName() ? getSelectedName() + 'ステータス' : 'プレイヤーステータス'"
        @close="closeStatusWindow"
      >
        <template v-if="selectedTile">
          <h2>{{ selectedTile.name }}</h2>
          <p>Effect: {{ selectedTile.effect }}</p>
          <p v-for="(value, key) in selectedTile.statModifier" :key="key">
            {{ key }}: {{ value > 0 ? '+' : '' }}{{ value }}
          </p>
        </template>
        <template v-else>
          <!-- プレイヤーのステータス表示 -->
          <h2>プレイヤーステータス</h2>
          <p>レベル: {{ gameStore.player.status.level }}</p>
          <p>HP: {{ gameStore.player.status.hp }} / {{ gameStore.player.status.maxHp }}</p>
          <p>
            エネルギー: {{ gameStore.player.status.energy }} /
            {{ gameStore.player.status.maxEnergy }}
          </p>
          <p>攻撃力: {{ gameStore.player.status.strength }}</p>
          <p>防御力: {{ gameStore.player.status.defense }}</p>
        </template>
      </BaseWindow>

      <BaseWindow
        height="400px"
        width="500px"
        :pos="{ x: '10px', y: '0px' }"
        :state="showItemList"
        :title="'インベントリ'"
        @close="closeItemList"
      >
        <div v-if="showItemList" class="item-list">
          <div class="inventory-header">
            <span
              >アイテム数: {{ gameStore.inventory.length }} / {{ gameStore.maxInventorySize }}</span
            >
          </div>
          <ul v-if="gameStore.inventory.length > 0">
            <li v-for="item in gameStore.inventory" :key="item.id" class="inventory-item">
              <div class="item-info-row">
                <div class="item-details">
                  <strong>{{ item.name }}</strong>
                  <span v-if="item.stackable" class="item-quantity">x{{ item.quantity }}</span>
                  <p class="item-desc">{{ item.description }}</p>
                </div>
                <BaseButton @click="useInventoryItem(item.id)" :type="'small'">使用</BaseButton>
              </div>
            </li>
          </ul>
          <div v-else class="empty-inventory">インベントリは空です</div>
        </div>
      </BaseWindow>
      <div v-if="message" class="message-window">
        <p class="message-window__text">{{ message }}</p>
      </div>

      <!-- アイテム取得確認ダイアログ -->
      <ItemPickupDialog />
      <BaseWindow
        height="240px"
        width="480px"
        :pos="{ x: '0', y: '0' }"
        :state="gameStore.isPortalActive"
        :title="'ポータル'"
        @close="closePortalDialog"
      >
        <p>ポータルが見つかりました。次の階層に進みますか？</p>
        <p style="color: #ffd700; margin-top: 10px">
          ※ フロア移動機能は新システムで自動的に処理されます
        </p>
        <div class="u-d--flex u-flex--center u-mg--t10">
          <BaseButton @click="closePortalDialog" :type="'small'">閉じる</BaseButton>
        </div>
      </BaseWindow>
    </div>
  </div>
</template>
<style scoped>
#game-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
  max-width: 800px;
  max-height: 600px;
  margin: auto;
  overflow: hidden;
  background-color: rgba(255, 102, 0, 0.2);
  border: 2px solid #f17523ce;
  box-shadow: 0 0 10px #ff5e0046, 0 0 20px #ff5e0034;
}

.controls {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  pointer-events: auto;
  font-family: 'DotGothic16', sans-serif;
}

.controls button {
  display: grid;
  place-content: center;
  width: 50px;

  height: 50px;
  font-size: 24px;
  border: none;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.3s;

  background-color: rgba(184, 80, 11, 0.66);
  border: 2px solid #f17623;
  color: #fdb788;
  transition: all 0.15s ease-in-out;
}

.controls button:hover {
  background-color: rgb(143, 33, 6);
}

.controls button:nth-child(1) {
  grid-column: 2;
}

.controls button:nth-child(2) {
  grid-column: 1;
  grid-row: 2;
}

.controls button:nth-child(3) {
  grid-column: 3;
  grid-row: 2;
}

.controls button:nth-child(4) {
  grid-column: 2;
  grid-row: 3;
}

.status-window {
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px;
  border-radius: 10px;
  min-width: 200px;
  pointer-events: auto;
  font-family: 'DotGothic16', sans-serif;
}

.close-button {
  position: absolute;
  top: 5px;
  right: 5px;
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 25px;
  height: 25px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.message-window {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 200px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 20px;

  border-radius: 10px;
  pointer-events: auto;
  min-width: 200px;
}

.action-menu {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  pointer-events: auto;
}

.action-menu button {
  padding: 10px 20px;
  font-size: 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;

  background-color: rgba(184, 80, 11, 0.66);
  border: 2px solid #f17623;
  color: #fdb788;
  transition: all 0.15s ease-in-out;
  font-family: 'DotGothic16', sans-serif;
}
.action-menu button:hover {
  background-color: rgb(143, 33, 6);
}

.item-list {
  pointer-events: auto;
}

.item-list ul {
  list-style-type: none;
  padding: 0;
  padding-left: 10px;
  padding-right: 10px;

  margin-bottom: 10px;
}
.item-list li {
  border: solid 1px #ff964f1e;
  border-top: none;
  border-left: none;
  border-right: none;
}
.item-list li a {
  display: block;
  padding: 10px;
  border-bottom: #ff964f1e;
  cursor: pointer;
}
.item-list li a:hover {
  background-color: #ff964f1e;
}

.player-info {
  background-color: #333333b0;
  position: absolute;
  top: 10px;
  left: 10px;
  width: 260px;
  color: #fdb788;
  border: solid 1px #f17623;

  .energy-bar {
    width: 100%;
    height: 6px;
    background-color: #4b4b4b;
  }

  .energy-fill {
    height: 100%;
    background-color: #f17623;
    transition: width 0.3s cubic-bezier(0.28, 0.2, 0.45, 1.31);
  }
  .energy-fill--hp {
    background-color: #f17623;
    height: 7px;
    border: 1px solid #35180d;
    border-top: none;
    border-left: none;
    border-right: none;
  }
  .energy-text {
    margin: 0 6px 2px 6px;
    font-size: 12px;
    font-family: 'DotGothic16', sans-serif;
  }
}

/* インベントリUI */
.inventory-header {
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  margin-bottom: 12px;
  border-radius: 4px;
  text-align: center;
  font-weight: bold;
}

.inventory-item {
  padding: 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  transition: background 0.2s;
}

.inventory-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.item-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.item-details {
  flex: 1;
}

.item-details strong {
  display: inline-block;
  margin-right: 8px;
  color: #ffd700;
}

.item-quantity {
  color: #88ff88;
  font-size: 14px;
}

.item-desc {
  margin: 4px 0 0 0;
  color: #ccc;
  font-size: 13px;
}

.empty-inventory {
  text-align: center;
  padding: 40px;
  color: #999;
  font-style: italic;
}
</style>
