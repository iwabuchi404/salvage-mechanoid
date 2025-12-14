<template>
  <div class="compass-ui">
    <div class="compass-container">
      <!-- 現在の向きを表示する中央の矢印 -->
      <div class="compass-center">
        <div class="compass-arrow" :class="`arrow-${currentDirection}`">
          <span class="arrow-icon">{{ getDirectionIcon(currentDirection) }}</span>
        </div>
      </div>
      <!-- 4方向のボタン -->
      <button
        class="compass-button compass-up"
        :class="{ active: currentDirection === 'up' }"
        @click="handleDirectionClick('up')"
        :disabled="!isPlayerTurn"
        title="上を向く"
      >
        ↑
      </button>
      <button
        class="compass-button compass-down"
        :class="{ active: currentDirection === 'down' }"
        @click="handleDirectionClick('down')"
        :disabled="!isPlayerTurn"
        title="下を向く"
      >
        ↓
      </button>
      <button
        class="compass-button compass-left"
        :class="{ active: currentDirection === 'left' }"
        @click="handleDirectionClick('left')"
        :disabled="!isPlayerTurn"
        title="左を向く"
      >
        ←
      </button>
      <button
        class="compass-button compass-right"
        :class="{ active: currentDirection === 'right' }"
        @click="handleDirectionClick('right')"
        :disabled="!isPlayerTurn"
        title="右を向く"
      >
        →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { Direction } from '../../engine/types';

const props = defineProps<{
  currentDirection: Direction;
  isPlayerTurn: boolean;
  onDirectionChange: (direction: Direction) => void;
}>();

const getDirectionIcon = (direction: Direction): string => {
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

const handleDirectionClick = (direction: Direction) => {
  if (!props.isPlayerTurn) return;
  if (props.currentDirection === direction) return; // 同じ方向の場合は何もしない
  props.onDirectionChange(direction);
};
</script>

<style scoped>
.compass-ui {
  position: absolute;
  top: 20px;
  right: 20px;
  pointer-events: auto;
  font-family: 'DotGothic16', sans-serif;
  z-index: 1000;
}

.compass-container {
  position: relative;
  width: 140px;
  height: 140px;
  background-color: rgba(0, 0, 0, 0.85);
  border: 3px solid #f17623;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
}

.compass-center {
  position: absolute;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.compass-arrow {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(241, 118, 35, 0.4);
  border-radius: 50%;
  border: 2px solid #f17623;
}

.arrow-icon {
  font-size: 28px;
  color: #fdb788;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

.compass-button {
  position: absolute;
  width: 42px;
  height: 42px;
  border: 2px solid #f17623;
  background-color: rgba(184, 80, 11, 0.8);
  color: #fdb788;
  border-radius: 50%;
  cursor: pointer;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  font-family: 'DotGothic16', sans-serif;
  user-select: none;
  -webkit-user-select: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.compass-button:hover:not(:disabled) {
  background-color: rgba(241, 118, 35, 0.9);
  border-color: #fdb788;
}

.compass-button:active:not(:disabled) {
  background-color: rgba(143, 33, 6, 0.9);
}

.compass-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.compass-button.active {
  background-color: rgba(241, 118, 35, 0.9);
  border-color: #fdb788;
  box-shadow: 0 0 12px rgba(253, 183, 136, 0.6);
}

.compass-up {
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
}

.compass-down {
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
}

.compass-left {
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
}

.compass-right {
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
}
</style>
