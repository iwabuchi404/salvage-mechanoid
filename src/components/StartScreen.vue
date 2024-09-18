<template>
  <div class="start-screen">
    <h1 class="game-title">サルベージ・メカノイド</h1>
    <div class="menu-container">
      <button @click="$emit('start-game')" class="start-button">ダンジョン潜入</button>
      <button class="option-button">オプション</button>
    </div>
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
  background: linear-gradient(to bottom, #000000, #1a1a2e);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.game-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 4rem;
  color: #00ffff;
  text-shadow: 0 0 10px #00ffff, 0 0 20px #00ffff;
  margin-bottom: 2rem;
}

.menu-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.start-button,
.option-button {
  font-family: 'Press Start 2P', cursive;
  font-size: 1.5rem;
  padding: 1rem 2rem;
  background-color: rgba(0, 255, 255, 0.2);
  border: 2px solid #00ffff;
  color: #00ffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.start-button:hover,
.option-button:hover {
  background-color: rgba(0, 255, 255, 0.4);
  transform: scale(1.05);
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
</style>
