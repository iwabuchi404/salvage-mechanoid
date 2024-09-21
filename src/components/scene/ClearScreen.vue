<template>
  <div class="clear-screen">
    <h2 class="clear-title">フロアクリア！</h2>
    <div class="stats-container">
      <p>探索時間: {{ explorationTime }}</p>
      <p>収集アイテム: {{ collectedItems }}</p>
      <p>スキャンデータ: {{ scannedData }}</p>
    </div>
    <div class="decision-container">
      <button @click="$emit('next-floor')" class="next-button">次のフロアへ</button>
      <button @click="$emit('return-surface')" class="return-button">地上に戻る</button>
    </div>
    <div class="energy-warning" v-if="lowEnergy">警告：エネルギー残量低下</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const explorationTime = ref('05:23');
const collectedItems = ref(12);
const scannedData = ref('67%');
const lowEnergy = ref(true);

// defineEmits(['next-floor', 'return-surface']);
</script>

<style scoped>
.clear-screen {
  width: 100%;
  height: 100vh;
  background: linear-gradient(to bottom, #1a1a2e, #0f3460);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #00ffff;
  font-family: 'Orbitron', sans-serif;
}

.clear-title {
  font-size: 3rem;
  margin-bottom: 2rem;
  text-shadow: 0 0 10px #00ffff;
}

.stats-container {
  background-color: rgba(0, 255, 255, 0.1);
  border: 2px solid #00ffff;
  padding: 1rem 2rem;
  margin-bottom: 2rem;
}

.stats-container p {
  font-size: 1.2rem;
  margin: 0.5rem 0;
}

.decision-container {
  display: flex;
  gap: 1rem;
}

.next-button,
.return-button {
  font-family: 'Press Start 2P', cursive;
  font-size: 1rem;
  padding: 0.8rem 1.5rem;
  background-color: rgba(0, 255, 255, 0.2);
  border: 2px solid #00ffff;
  color: #00ffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.next-button:hover,
.return-button:hover {
  background-color: rgba(0, 255, 255, 0.4);
  transform: scale(1.05);
}

.energy-warning {
  margin-top: 2rem;
  color: #ff0000;
  font-size: 1.2rem;
  animation: blink 1s infinite;
}

@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
</style>
