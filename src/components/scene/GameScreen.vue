<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue';
import { Game } from '../../game/Game';
import { defineEmits } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import { useGameViewStateStore } from '../../stores/gameViewStateStore';
import { useUIPanelStore } from '../../stores/uiPanelStore';
import { usePanelInputBlock } from '../../composables/usePanelInputBlock';
import BaseButton from '../uiParts/BaseButton.vue';
import BaseWindow from '../uiParts/BaseWindow.vue';
import ItemPickupDialog from '../uiParts/ItemPickupDialog.vue';
import SkillSelectDialog from '../uiParts/SkillSelectDialog.vue';
import type { Direction } from '../../engine/types';

const gameStore = useGameStore();
const viewStore = useGameViewStateStore();
const panelStore = useUIPanelStore();
const mainCanvas = ref<HTMLCanvasElement | null>(null);
const game = new Game();

const message = ref<string | null>(null);

// BU-4 段階4: パネル状態は uiPanelStore で一元管理
const showActionMenu = computed(() => panelStore.isOpen('action_menu'));
const showItemList = computed(() => panelStore.isOpen('item_list'));
const showStatusWindow = computed(() => panelStore.isOpen('status_window'));
const showSkillMenu = computed(() => panelStore.isOpen('skill_menu'));

const playerItems = ref<Array<{ id: string; name: string; description: string }>>([]);
const playerSkills = ref<
  Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    energyCost: number;
    cooldown: number;
    currentCooldown: number;
    canUse: boolean;
  }>
>([]);

// BU-4 段階3: ビューモデルから方向・ターン・選択を取得（ポーリング廃止）
const playerDirection = computed<Direction>(() => viewStore.player.direction);
const isPlayerTurn = computed<boolean>(() => viewStore.progress.isPlayerTurn);
const selectedTile = computed(() => {
  const sel = viewStore.selection;
  if (!sel) return null;
  // 既存のテンプレート互換形式へ変換
  switch (sel.kind) {
    case 'tile':
      return { name: sel.name, effect: sel.effect, statModifier: {} as Record<string, number> };
    case 'enemy':
      return { name: sel.name, effect: 'Enemy Entity', statModifier: {} as Record<string, number> };
    case 'player':
      return {
        name: sel.name,
        effect: 'Character Entity',
        statModifier: {} as Record<string, number>,
      };
    case 'object':
      return { name: sel.name, effect: 'Entity', statModifier: {} as Record<string, number> };
  }
  return null;
});

const energyPercentage = computed(
  () => (gameStore.player.status.energy / gameStore.player.status.maxEnergy) * 100
);
const hpPercentage = computed(
  () => (gameStore.player.status.hp / gameStore.player.status.maxHp) * 100
);

// 扇形ボタンの色を取得
const getSectorColor = (direction: Direction): string => {
  const isActive = playerDirection.value === direction;
  return isActive ? 'rgba(74, 158, 255, 0.8)' : 'rgba(74, 158, 255, 0.4)';
};

const emit = defineEmits<{
  (e: 'game-clear'): void;
  (e: 'game-over', score: number): void;
}>();

// BU-4 段階4: 非同期 onMounted 内で生成される watch 停止ハンドルと
// resize リスナー解除を setup スコープで保持し、トップレベルの onUnmounted で
// 確実に解除できるようにする。Vue のライフサイクルフック登録は
// 同期 setup 中に行う必要があるため、onUnmounted を onMounted 内に
// 入れるとコンポーネントへ関連付けられない。
let stopPanelInputBlock: (() => void) | null = null;
let stopSelectionWatch: (() => void) | null = null;

onUnmounted(() => {
  window.removeEventListener('resize', resizeGame);
  if (stopPanelInputBlock) {
    stopPanelInputBlock();
    stopPanelInputBlock = null;
  }
  if (stopSelectionWatch) {
    stopSelectionWatch();
    stopSelectionWatch = null;
  }
});

onMounted(async () => {
  if (mainCanvas.value) {
    await game.initialize(mainCanvas.value);

    game.setOnGameOver((score: number) => {
      emit('game-over', score);
    });

    // BU-4 段階3: 選択イベントは viewStore.selection へ投影済み（Game 側）
    // selectedTile は computed で viewStore から読み取る
    // ステータスウィンドウの表示は selection の変化で制御
    // 停止ハンドルを setup スコープの変数に保持し、
    // トップレベルの onUnmounted で解除する
    stopSelectionWatch = watch(
      () => viewStore.selection,
      (selection) => {
        if (selection) {
          panelStore.open('status_window');
        }
      }
    );

    // BU-4 段階4: action_menu を初期表示
    panelStore.open('action_menu');

    // BU-4 段階4: モーダルパネル表示中は InputSystem の入力を無効化
    // composable に抽出してテスト可能にしている
    // 停止ハンドルを setup スコープの変数に保持し、
    // トップレベルの onUnmounted で解除する
    stopPanelInputBlock = usePanelInputBlock(game);

    // BU-4 段階3: ターン変更は viewStore.progress.isPlayerTurn で購読（computed）
    // コールバック setter は不要だが、併存期間中は残す

    // BU-4 段階3: ポーリング廃止
    // direction_changed イベントは StatsProjection が viewStore.player.direction へ投影済み
    // playerDirection は computed で viewStore から読み取る

    window.addEventListener('resize', resizeGame);
    resizeGame(); // 初期サイズを設定
  }
});
const movePlayer = (direction: 'up' | 'down' | 'left' | 'right') => {
  // BU-4 段階4: モーダルパネル表示中は移動をブロック
  if (isPlayerTurn.value && !panelStore.inputBlocked) {
    game.movePlayer(direction);
  }
};

const turnPlayer = (direction: 'up' | 'down' | 'left' | 'right') => {
  // BU-4 段階4: モーダルパネル表示中は方向転換もブロック
  if (isPlayerTurn.value && !panelStore.inputBlocked) {
    game.turnPlayer(direction);
    // 方向は viewStore 経由で更新されるため、ここでは設定しない
  }
};

const getDirectionIcon = (direction: 'up' | 'down' | 'left' | 'right'): string => {
  switch (direction) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'left':
      return '←';
    case 'right':
      return '→';
    default:
      return '↓';
  }
};
const closeStatusWindow = () => {
  // BU-4 段階4: PanelManager 経由で閉じる + selection をクリア
  panelStore.close('status_window');
  viewStore.setSelection(null);
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
  // BU-4 段階4: PanelManager 経由で開く
  panelStore.open('item_list');
};
const closeItemList = () => {
  // BU-4 段階4: PanelManager 経由で閉じる
  // item_list を閉じたら action_menu を再表示（旧挙動の維持）
  panelStore.close('item_list');
  panelStore.open('action_menu');
};

// アイテムを使用
const useInventoryItem = (itemId: string) => {
  const success = game.useInventoryItem(itemId);
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
  // BU-4 段階4: モーダルパネル表示中は攻撃もブロック
  if (isPlayerTurn.value && !panelStore.inputBlocked) {
    // BU-4 段階5: GameCommands.attack 経由
    await game.attack();
    checkGameClear();
  }
};
const showStatus = () => {
  // BU-4 段階4: PanelManager 経由で開く
  panelStore.open('status_window');
  viewStore.setSelection(null);
};

// スキルメニューを表示
const showSkills = () => {
  const skillSystem = game.getSkillSystem();
  if (!skillSystem) {
    console.warn('SkillSystem not found');
    return;
  }

  // 習得済みスキル一覧を取得
  const learnedSkills = skillSystem.getLearnedSkills();
  const currentEnergy = gameStore.player.status.energy;

  // スキル情報を整形
  playerSkills.value = learnedSkills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    icon: skill.icon,
    energyCost: skill.energyCost,
    cooldown: skill.cooldown,
    currentCooldown: skillSystem.getCooldownRemaining(skill.id),
    canUse: skillSystem.canUseSkill(skill.id, currentEnergy),
  }));

  // BU-4 段階4: PanelManager 経由で開く
  panelStore.open('skill_menu');
};

// スキルメニューを閉じる
const closeSkillMenu = () => {
  // BU-4 段階4: PanelManager 経由で閉じる
  panelStore.close('skill_menu');
};

// スキルを使用
const useSkill = (skillId: string) => {
  const success = game.useSkill(skillId);
  if (success) {
    message.value = 'スキルを使用しました';
    setTimeout(() => {
      message.value = '';
    }, 2000);
  } else {
    message.value = 'スキルを使用できません';
    setTimeout(() => {
      message.value = '';
    }, 2000);
  }
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
        <p class="energy-text" data-testid="hud-hp">
          HP: {{ gameStore.player.status.hp }} / {{ gameStore.player.status.maxHp }}
        </p>
        <div class="energy-bar energy-text--hp">
          <div class="energy-fill energy-fill--hp" :style="{ width: `${hpPercentage}%` }"></div>
        </div>
        <p class="energy-text" data-testid="hud-energy">
          Energy: {{ gameStore.player.status.energy }} / {{ gameStore.player.status.maxEnergy }}
        </p>
        <p class="energy-text" data-testid="hud-position">
          Pos: {{ viewStore.player.position.x }},{{ viewStore.player.position.y }}
        </p>
        <div class="energy-bar">
          <div class="energy-fill" :style="{ width: `${energyPercentage}%` }"></div>
        </div>
      </div>
      <!-- 統合コントロール（移動 + 方向転換） -->
      <div class="unified-controls">
        <!-- 外側：方向転換ボタン（扇形） - SVGで直接描画 -->
        <svg class="direction-sectors" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
          <!-- 上方向 -->
          <g
            class="direction-sector"
            :class="{ active: playerDirection === 'up' }"
            @click="!isPlayerTurn ? null : turnPlayer('up')"
            :style="{
              cursor: isPlayerTurn ? 'pointer' : 'not-allowed',
              opacity: isPlayerTurn ? 1 : 0.3,
            }"
          >
            <path
              d="M 90 90 L 90 0 A 90 90 0 0 1 180 90 Z"
              :fill="getSectorColor('up')"
              stroke="#4a9eff"
              stroke-width="2"
              class="sector-path"
            />
            <text
              x="135"
              y="45"
              class="direction-icon"
              text-anchor="middle"
              dominant-baseline="middle"
            >
              ↑
            </text>
          </g>
          <!-- 右方向 -->
          <g
            class="direction-sector"
            :class="{ active: playerDirection === 'right' }"
            @click="!isPlayerTurn ? null : turnPlayer('right')"
            :style="{
              cursor: isPlayerTurn ? 'pointer' : 'not-allowed',
              opacity: isPlayerTurn ? 1 : 0.3,
            }"
          >
            <path
              d="M 90 90 L 180 90 A 90 90 0 0 1 180 180 L 90 180 Z"
              :fill="getSectorColor('right')"
              stroke="#4a9eff"
              stroke-width="2"
              class="sector-path"
            />
            <text
              x="135"
              y="135"
              class="direction-icon"
              text-anchor="middle"
              dominant-baseline="middle"
            >
              →
            </text>
          </g>
          <!-- 下方向 -->
          <g
            class="direction-sector"
            :class="{ active: playerDirection === 'down' }"
            @click="!isPlayerTurn ? null : turnPlayer('down')"
            :style="{
              cursor: isPlayerTurn ? 'pointer' : 'not-allowed',
              opacity: isPlayerTurn ? 1 : 0.3,
            }"
          >
            <path
              d="M 90 90 L 90 180 A 90 90 0 0 1 0 180 L 0 90 Z"
              :fill="getSectorColor('down')"
              stroke="#4a9eff"
              stroke-width="2"
              class="sector-path"
            />
            <text
              x="45"
              y="135"
              class="direction-icon"
              text-anchor="middle"
              dominant-baseline="middle"
            >
              ↓
            </text>
          </g>
          <!-- 左方向 -->
          <g
            class="direction-sector"
            :class="{ active: playerDirection === 'left' }"
            @click="!isPlayerTurn ? null : turnPlayer('left')"
            :style="{
              cursor: isPlayerTurn ? 'pointer' : 'not-allowed',
              opacity: isPlayerTurn ? 1 : 0.3,
            }"
          >
            <path
              d="M 90 90 L 0 90 A 90 90 0 0 1 0 0 L 90 0 Z"
              :fill="getSectorColor('left')"
              stroke="#4a9eff"
              stroke-width="2"
              class="sector-path"
            />
            <text
              x="45"
              y="45"
              class="direction-icon"
              text-anchor="middle"
              dominant-baseline="middle"
            >
              ←
            </text>
          </g>
        </svg>

        <!-- 中リング：移動ボタン（円形） -->
        <button class="move-btn move-up" @click="movePlayer('up')" :disabled="!isPlayerTurn">
          ↑
        </button>
        <button class="move-btn move-right" @click="movePlayer('right')" :disabled="!isPlayerTurn">
          →
        </button>
        <button class="move-btn move-down" @click="movePlayer('down')" :disabled="!isPlayerTurn">
          ↓
        </button>
        <button class="move-btn move-left" @click="movePlayer('left')" :disabled="!isPlayerTurn">
          ←
        </button>

        <!-- 中央：現在の向きインジケーター -->
        <div class="direction-indicator">
          <span class="indicator-icon">{{ getDirectionIcon(playerDirection) }}</span>
        </div>
      </div>
      <div v-if="showActionMenu" class="action-menu">
        <BaseButton @click="attack" :type="'small'">攻撃</BaseButton>
        <BaseButton @click="showStatus" :type="'small'">ステータス</BaseButton>
        <BaseButton @click="showItems" :type="'small'">アイテム</BaseButton>
        <BaseButton @click="showSkills" :type="'small'">スキル</BaseButton>
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
          <p>攻撃力: {{ gameStore.player.status.attackPower }}</p>
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

      <!-- スキル選択ダイアログ -->
      <BaseWindow
        height="360px"
        width="300px"
        :pos="{ x: 'calc(100% - 340px)', y: 'calc(10px)' }"
        :state="showSkillMenu"
        :title="'スキル選択'"
        @close="closeSkillMenu"
      >
        <SkillSelectDialog
          :skills="playerSkills"
          :current-energy="gameStore.player.status.energy"
          @use-skill="useSkill"
        />
      </BaseWindow>

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

/* 統合コントロール（移動 + 方向転換） */
.unified-controls {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 180px;
  height: 180px;
  pointer-events: auto;
  font-family: 'DotGothic16', sans-serif;
}

/* 外側：方向転換ボタン（扇形） */
.direction-btn {
  position: absolute;
  width: 90px;
  height: 90px;
  border: none;
  background-color: transparent;
  color: #b8d9ff;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  font-family: 'DotGothic16', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  overflow: hidden;
  padding: 0;
}

.sector-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  display: block;
}

.direction-icon {
  font-size: 24px;
  font-weight: bold;
  fill: #b8d9ff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  user-select: none;
}

/* 方向転換ボタン（SVGで直接描画） */
.direction-sectors {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.direction-sector {
  pointer-events: all;
  transition: all 0.15s ease-in-out;
}

.direction-sector:hover .sector-path {
  opacity: 0.8;
  filter: brightness(1.2);
}

.direction-sector:active .sector-path {
  opacity: 0.9;
  filter: brightness(1.3);
}

.direction-sector.active .sector-path {
  filter: brightness(1.3) drop-shadow(0 0 8px rgba(184, 217, 255, 0.6));
}

.sector-path {
  transition: all 0.15s ease-in-out;
}

.direction-btn:hover:not(:disabled) {
  opacity: 0.8;
  filter: brightness(1.2);
}

.direction-btn:active:not(:disabled) {
  opacity: 0.9;
  filter: brightness(1.3);
}

.direction-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.direction-btn.active {
  filter: brightness(1.3) drop-shadow(0 0 8px rgba(184, 217, 255, 0.6));
}

/* 中リング：移動ボタン（円形） */
.move-btn {
  position: absolute;
  width: 50px;
  height: 50px;
  border: 2px solid #f17623;
  background-color: rgba(184, 80, 11, 0.66);
  color: #fdb788;
  border-radius: 50%;
  cursor: pointer;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease-in-out;
  font-family: 'DotGothic16', sans-serif;
  z-index: 3;
}

.move-btn:hover:not(:disabled) {
  background-color: rgb(143, 33, 6);
}

.move-btn:active:not(:disabled) {
  background-color: rgb(100, 20, 4);
}

.move-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.move-up {
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
}

.move-right {
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
}

.move-down {
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
}

.move-left {
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
}

/* 中央：現在の向きインジケーター */
.direction-indicator {
  position: absolute;
  width: 60px;
  height: 60px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(241, 118, 35, 0.4);
  border: 3px solid #f17623;
  border-radius: 50%;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.indicator-icon {
  font-size: 28px;
  color: #fdb788;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
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
