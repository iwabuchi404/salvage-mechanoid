<script setup lang="ts">
import { ref } from 'vue';
import BaseButton from '../uiParts/BaseButton.vue';
import BaseWindow from '../uiParts/BaseWindow.vue';
import UiTab from '../uiParts/UiTab.vue';

const statusShowstate = ref(false);
const statusClose = () => {
  statusShowstate.value = false;
};
const tabs = ref([
  { label: '難易度', value: 'difficulty' },
  { label: 'グラフィック', value: 'graphic' },
  { label: 'サウンド', value: 'sound' },
]);
const changeTab = (value: string) => {
  console.log(value);
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
      <UiTab :tabs="tabs" @change="changeTab">
        <template #difficulty>
          <h2>難易度設定</h2>
          <div class="difficulty-container">
            <ul class="option-list">
              <li class="option-item">
                <a class="option-difficulty-btn is-active"
                  >Easy
                  <p class="option-difficulty-btn-label">簡単</p>
                  <p class="option-difficulty-btn-description">
                    敵の攻撃力が低く、ダメージが少ない
                  </p>
                </a>
              </li>
              <li class="option-item">
                <a class="option-difficulty-btn">
                  Normal
                  <p class="option-difficulty-btn-label">普通</p>
                  <p class="option-difficulty-btn-description">敵の攻撃力が普通、ダメージが普通</p>
                </a>
              </li>
              <li class="option-item">
                <a class="option-difficulty-btn">
                  Hard
                  <p class="option-difficulty-btn-label">難しい</p>
                  <p class="option-difficulty-btn-description">敵の攻撃力が高く、ダメージが多い</p>
                </a>
              </li>
            </ul>
          </div>
        </template>
        <template #graphic>
          <h2>グラフィック設定</h2>
          <div class="graphic-container">
            <ul class="option-list">
              <li class="option-item">
                <span>解像度</span
                ><select name="" id="">
                  <option value="1">640X480</option>
                  <option value="2">800X600</option>
                  <option value="3">1024X768</option>
                  <option value="4">1280X1024</option>
                  <option value="5">1600X1200</option>
                  <option value="6">1920X1080</option>
                </select>
              </li>
              <li class="option-item">
                <span>UIズーム倍率</span
                ><select name="" id="">
                  <option value="1">100%</option>
                  <option value="2">120%</option>
                  <option value="3">150%</option>
                  <option value="4">200%</option>
                </select>
              </li>
              <li class="option-item">
                <span>フルスクリーン</span><input type="checkbox" name="" id="" />
              </li>
            </ul>
          </div>
        </template>
        <template #sound>
          <h2>サウンド設定</h2>
          <div class="sound-container">
            <ul class="option-list">
              <li class="option-item">
                <span>マスターボリューム</span><input type="range" min="0" max="100" value="50" />
              </li>
              <li class="option-item">
                <span>BGMボリューム</span><input type="range" min="0" max="100" value="50" />
              </li>
              <li class="option-item">
                <span>SEボリューム</span><input type="range" min="0" max="100" value="50" />
              </li>
            </ul>
          </div>
        </template>
      </UiTab>
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

.difficulty-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.difficulty-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.graphic-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sound-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.option-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-item span {
  font-size: 1.2rem;
  font-weight: bold;
}

.option-item select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #f17623;
  border-radius: 0.5rem;
  background-color: #f17623;
  color: #000000;
}

.option-item input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #f17623;
  border-radius: 0.5rem;
}

.option-item input[type='checkbox'] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #f17623;
  border-radius: 0.5rem;
  position: relative;
  width: 0;
}
.option-item input[type='checkbox']::before {
  content: '';
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  width: 40px;
  height: 40px;
  background-color: #85461b;
  border: 3px solid #f17623;
  border-radius: 0.5rem;
}

.option-item input[type='checkbox']:checked {
  background-color: #f17623;
  color: #000000;
}

.option-item input[type='checkbox']:checked::after {
  content: '';
  display: block;
  background-color: #ff8951;
  border-radius: 0.55rem;
  position: absolute;
  top: 8px;
  left: 8px;
  width: 24px;
  height: 24px;
}
.option-item input[type='range'] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #f17623;
  border-radius: 0.5rem;
  background-color: #f17623;
  color: #000000;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}
.option-item input[type='range']::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: #f1752371;
  border: 3px solid #f1752371;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  box-shadow: 0px 0px 6px 3px rgba(88, 36, 8, 0.8);
}
.option-difficulty-btn {
  font-size: 1.8rem;
  font-weight: bold;
  text-align: center;
  max-width: 460px;
  margin: auto;
  padding: 8px 46px;
  border-radius: 2px;
}
.option-difficulty-btn:hover {
  box-shadow: 0 0 10px #4119023b, 0 0 20px #4119023b;
  border: 6px solid #f17623;
  border-bottom: none;
  border-top: none;
}

.option-difficulty-btn.is-active {
  background-color: #f1752371;
  color: #ffffff;
  box-shadow: 0 0 10px #4119023b, 0 0 20px #4119023b;
  border-radius: 2px;
  border: 6px solid #f17623;
  border-bottom: none;
  border-top: none;
}
.option-difficulty-btn-label {
  color: #ab907e;
  font-size: 1rem;
  text-align: left;
}
.option-difficulty-btn-description {
  color: #ab907e;
  font-size: 1rem;
  text-align: left;
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
