<script setup lang="ts">
import { onMounted, ref, compile, computed, watch } from 'vue';
import BaseButton from '../uiParts/BaseButton.vue';
import BaseWindow from '../uiParts/BaseWindow.vue';

const statusShowstate = ref(false);
const statusClose = () => {
  statusShowstate.value = false;
};
</script>

<template>
  <div class="start-screen">
    <h1 class="game-title"><span class="inner">サルベージ・メカノイド</span></h1>
    <div class="menu-container">
      <BaseButton @click="$emit('start-game')" type="'normal'">ダンジョン潜入</BaseButton>
      <BaseButton
        @click="
          () => {
            statusShowstate = true;
          }
        "
        type="'normal'"
        >オプション</BaseButton
      >
    </div>
    <BaseWindow
      height="620px"
      width="840px"
      :pos="{ x: '0', y: '0' }"
      :state="statusShowstate"
      :title="'オプション'"
      @close="statusClose"
    >
      <ul>
        <li>難易度</li>
        <li>グラフィック</li>
        <li>サウンド</li>
      </ul>
    </BaseWindow>
    <div class="background-elements">
      <div class="robot-silhouette"></div>
      <div class="underground-city"></div>
    </div>
  </div>
</template>

<style scoped>
.start-screen {
  width: 100%;
  height: 100vh;
  background: linear-gradient(to bottom, #000000, #2e1a1a);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.game-title {
  /* font-family: 'Orbitron', sans-serif; */
  font-size: 4rem;
  color: #f17623;
  text-shadow: 0 0 10px #ff5e00, 0 0 20px #ff5e00;
  margin-bottom: 2rem;
  animation: wiggleLoop 4s infinite;
  animation-delay: 5s;
  .inner {
    animation: gradationAnime 1.5s infinite alternate;
  }
}

.menu-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.start-button,
.option-button {
  /* font-family: 'Press Start 2P', cursive; */
  font-size: 1.5rem;
  padding: 1rem 2rem;
  background-color: rgba(255, 102, 0, 0.2);
  border: 2px solid #f17623;
  color: #f17623;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  position: relative;
  font-family: 'DotGothic16', sans-serif;
}

.start-button:hover,
.option-button:hover {
  background-color: rgba(255, 60, 0, 0.4);
  transform: scale(1.06);
}

.start-button::after,
.option-button::after {
  content: '';
  display: block;
  position: absolute;
  z-index: -1;
  left: 0;
  top: 0;
  height: 100%;
  width: 100%;
  background-color: rgba(255, 60, 0, 0.4);
  border: 2px solid #f17623;
  opacity: 0;
  filter: blur(2px);
}

.start-button:hover::after,
.option-button:hover::after {
  opacity: 0.4;
  animation: zoomEffect 0.4s ease-out;
}

.background-elements {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}

.robot-silhouette {
  position: absolute;
  bottom: 0;
  right: 10%;
  width: 300px;
  height: 400px;
  /* background-image: url('/path-to-robot-silhouette.png'); */
  background-size: contain;
  background-repeat: no-repeat;
  opacity: 0.3;
}

.underground-city {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 200px;
  /* background-image: url('/path-to-underground-city.png'); */
  background-size: cover;
  background-repeat: no-repeat;
  opacity: 0.2;
}
@keyframes wiggleLoop {
  0% {
    transform: skewX(24deg);
  }
  1% {
    transform: skewX(-8deg);
  }
  2% {
    transform: skewX(55deg);
  }
  3% {
    transform: skewX(-90deg);
  }
  4% {
    transform: skewX(29deg);
  }
  5% {
    transform: skewX(-90deg);
  }
  6% {
    transform: skewX(3deg);
  }
  7% {
    transform: skewX(-2deg);
  }
  8% {
    transform: skewX(1deg);
  }
  9% {
    transform: skewX(10deg);
  }
  10% {
    transform: skewX(0deg);
  }
  100% {
    transform: skewX(0deg);
  }
}
@keyframes wiggle {
  0% {
    transform: skewX(24deg);
  }
  10% {
    transform: skewX(-8deg);
  }
  20% {
    transform: skewX(55deg);
  }
  30% {
    transform: skewX(-90deg);
  }
  40% {
    transform: skewX(29deg);
  }
  50% {
    transform: skewX(-90deg);
  }
  60% {
    transform: skewX(3deg);
  }
  70% {
    transform: skewX(-2deg);
  }
  80% {
    transform: skewX(1deg);
  }
  90% {
    transform: skewX(10deg);
  }
  100% {
    transform: skewX(0deg);
  }
}
@keyframes zoomEffect {
  0% {
    transform: scale(0.8);
    opacity: 0.4;
  }
  15% {
    transform: scale(1.4);
    opacity: 0.2;
  }
  100% {
    opacity: 0;
  }
}
@keyframes gradationAnime {
  0% {
    text-shadow: 0 0 10px #ff5e00, 0 0 20px #ff5e00;
  }
  10% {
    text-shadow: 0 0 15px #ff5e00, 0 0 15px #ff5e00;
  }
  100% {
    text-shadow: 0 0 6px #ff5e00, 0 0 25px #ff5e00;
  }
}
</style>
