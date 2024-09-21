<!-- src/components/GameOverScreen.vue -->
<template>
  <div class="game-over-screen">
    <h2 class="title">ゲームオーバー</h2>
    <p>スコア: {{ score }}</p>
    <button class="title-button" @click="$emit('retry')">リトライ</button>
    <button class="return-button" @click="$emit('title')">タイトルへ</button>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
  score: number;
}>();

defineEmits(['retry', 'title']);
</script>

<style scoped>
.game-over-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(to bottom, #1a1a2e, #0f3460);
  align-items: center;
  color: #00ffff;
  /* font-family: 'Orbitron', sans-serif; */
}

button {
  margin: 10px;
  padding: 10px 20px;
  font-size: 18px;
  cursor: pointer;
}

.title {
  font-size: 3rem;
  margin-bottom: 2rem;
  text-shadow: 0 0 10px #00ffff;
}

.title-button,
.return-button {
  /* font-family: 'Press Start 2P', cursive; */
  font-size: 1rem;
  padding: 0.8rem 1.5rem;
  background-color: rgba(0, 255, 255, 0.2);
  border: 2px solid #00ffff;
  color: #00ffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.title-button:hover,
.return-button:hover {
  background-color: rgba(0, 255, 255, 0.4);
  transform: scale(1.05);
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
