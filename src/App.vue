<template>
  <div id="app-container">
    <div id="game-container" ref="mainCanvas"></div>
    <div id="ui-overlay">
      <div class="controls">
        <button @click="movePlayer('up')">↑</button>
        <button @click="movePlayer('left')">←</button>
        <button @click="movePlayer('right')">→</button>
        <button @click="movePlayer('down')">↓</button>
      </div>
      <div v-if="showActionMenu" class="action-menu">
        <button @click="attack">攻撃</button>
        <button @click="showStatus">ステータス</button>
        <button @click="showItems">アイテム</button>
      </div>
      <div v-if="showStatusWindow" class="status-window">
        <button class="close-button" @click="closeStatusWindow">&times;</button>
        <h2>{{ getSelectedName() }} ステータス</h2>
        <template v-if="selectedCharacter">
          <p>レベル: {{ selectedCharacter.getStatus().level }}</p>
          <p>
            HP: {{ selectedCharacter.getStatus().hp }} /
            {{ selectedCharacter.getStatus().maxHp }}
          </p>
          <p>
            MP: {{ selectedCharacter.getStatus().mp }} /
            {{ selectedCharacter.getStatus().maxMp }}
          </p>
          <p>攻撃力: {{ selectedCharacter.getStatus().strength }}</p>
          <p>防御力: {{ selectedCharacter.getStatus().defense }}</p>
        </template>
        <template v-else-if="selectedEnemy">
          <p>HP: {{ selectedEnemy.getHp() }}</p>
          <p>攻撃力: {{ selectedEnemy.getAttack() }}</p>
        </template>
        <template v-else-if="selectedTile">
          <h2>{{ selectedTile.name }}</h2>
          <p>Effect: {{ selectedTile.effect }}</p>
          <p v-for="(value, key) in selectedTile.statModifier" :key="key">
            {{ key }}: {{ value > 0 ? '+' : '' }}{{ value }}
          </p>
        </template>
      </div>
      <div v-if="showItemList" class="item-list">
        <h2>アイテム一覧</h2>
        <ul>
          <li v-for="item in playerItems" :key="item.id">
            {{ item.name }} - {{ item.description }}
          </li>
        </ul>
        <button @click="closeItemList" class="close-button">&times;</button>
      </div>
      <div v-if="message" class="message-window">
        <p class="message-window__text">{{ message }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Game } from './game';
import { onMounted, ref, compile, computed, watch } from 'vue';
import { Application, Assets, Graphics } from 'pixi.js';
import { Character } from './common/Character';
import { Enemy } from './common/Enemy';
import { TileInfo } from './common/Stage';
import { TurnManager, TurnPhase } from './common/TurnManager';

const mainCanvas = ref<HTMLCanvasElement | null>(null);
const game = new Game();
const selectedCharacter = ref<Character | null>(null);
const selectedEnemy = ref<Enemy | null>(null);
const selectedTile = ref<TileInfo | null>(null);
const message = ref<string | null>(null);

const showActionMenu = ref(true);
const showItemList = ref(false);
const playerItems = ref<any[]>([]);
const isPlayerTurn = ref(true);

onMounted(() => {
  if (mainCanvas.value) {
    console.log('init');
    // initPixi(mainCanvas.value);
    game.initialize(mainCanvas.value);

    // ターンの変更を監視
    watch(
      () => game.getCurrentPhase(),
      (newPhase) => {
        isPlayerTurn.value = newPhase === TurnPhase.PLAYER;
      }
    );

    game.setOnCharacterSelect((character) => {
      selectedCharacter.value = character;
      console.log('setOnCharacterSelect');
    });

    game.setOnEnemySelect((enemy) => {
      selectedEnemy.value = enemy;
      selectedCharacter.value = null;
      console.log('setOnEnemySelect');
    });

    game.setOnTileSelect((tileInfo) => {
      selectedTile.value = tileInfo;
    });
  }
});
const movePlayer = (direction: 'up' | 'down' | 'left' | 'right') => {
  if (isPlayerTurn.value) {
    game.movePlayer(direction);
  }
};
const closeStatusWindow = () => {
  selectedCharacter.value = null;
  selectedEnemy.value = null;
  selectedTile.value = null;
};

const getSelectedName = () => {
  return selectedCharacter.value?.getName() || selectedEnemy.value?.getName() || '';
};

const getSelectedPosition = () => {
  return (
    selectedCharacter.value?.getPosition() ||
    selectedEnemy.value?.getPosition() || { x: 0, y: 0, z: 0 }
  );
};
const showStatusWindow = computed(() => {
  return selectedCharacter.value || selectedEnemy.value || selectedTile.value;
});

const showItems = () => {
  playerItems.value = game.getPlayerItems();
  showItemList.value = true;
  // showActionMenu.value = false;
};
const closeItemList = () => {
  showItemList.value = false;
  showActionMenu.value = true;
};
const attack = () => {
  if (isPlayerTurn.value) {
    game.playerAttack();
  }
};
const showStatus = () => {
  showStatusWindow.value = true;
};

const endTurn = () => {
  if (isPlayerTurn.value) {
    game.endPlayerTurn();
  }
};
</script>

<style>
#app-container {
  display: block;
  width: 100%;
  height: 100%;
  background-color: #404040;
}

#game-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 800px;
  height: 600px;
  margin: auto;
  overflow: hidden;
  border: 2px solid #d84f00;
  border-radius: 0px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

#pixi-container {
  width: 800px;
  height: 600px;
}

#ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 800px;
  height: 600px;
  z-index: 1;
  pointer-events: none;
  margin: auto;
}

.controls {
  position: absolute;
  bottom: 20px;
  left: 20px;
  /* transform: translateX(-50%); */
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  pointer-events: auto;
  transform: rotate(25deg);
}

.controls button {
  width: 50px;
  height: 50px;
  font-size: 24px;
  border: none;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.3s;
}

.controls button:hover {
  background-color: rgba(255, 255, 255, 0.9);
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
  background-color: rgba(255, 255, 255, 0.8);
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.item-list {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px;
  border-radius: 10px;
  pointer-events: auto;
}

.item-list ul {
  list-style-type: none;
  padding: 0;
}

.item-list li {
  margin-bottom: 10px;
}
</style>
