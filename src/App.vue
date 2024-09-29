<script setup lang="ts">
import { ref } from 'vue';
import { GameState, GameStateManager } from './common/GameStateManager';
import StartScreen from './components/scene/StartScreen.vue';
import GameScreen from './components/scene/GameScreen.vue';
import ClearScreen from './components/scene/ClearScreen.vue';
import GameOverScreen from './components/scene/GameOverScreen.vue';

const gameStateManager = new GameStateManager();
const gameState = ref(gameStateManager.getState());
const score = ref(0);

function startGame() {
  gameStateManager.setState(GameState.PLAYING);
  gameState.value = gameStateManager.getState();
}

function showClearScreen() {
  gameStateManager.setState(GameState.CLEAR);
  gameState.value = gameStateManager.getState();
}

function restartGame() {
  gameStateManager.setState(GameState.PLAYING);
  gameState.value = gameStateManager.getState();
}

function showGameOverScreen(finalScore: number) {
  score.value = finalScore;
  gameStateManager.setState(GameState.GAME_OVER);
  gameState.value = gameStateManager.getState();
}

function returnToTitle() {
  gameStateManager.setState(GameState.START);
  gameState.value = gameStateManager.getState();
}
</script>

<template>
  <div id="app-container">
    <StartScreen v-if="gameState === GameState.START" @start-game="startGame" />
    <GameScreen
      v-if="gameState === GameState.PLAYING"
      @game-clear="showClearScreen"
      @game-over="showGameOverScreen"
    />
    <ClearScreen v-if="gameState === GameState.CLEAR" @retry="restartGame" />
    <GameOverScreen
      v-if="gameState === GameState.GAME_OVER"
      :score="score"
      @retry="restartGame"
      @title="returnToTitle"
    />
  </div>
</template>

<style>
body {
  margin: 0;
  height: 100%;
  width: 100%;
  min-height: 100vh;
  min-width: 100vw;
  background: linear-gradient(to bottom, #000000, #2e1a1a);
  font-family: 'DotGothic16', sans-serif;
  font-weight: 400;
  font-style: normal;
}
#app-container {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 840px;
  min-height: 640px;
}

#pixi-container {
  width: 800px;
  height: 600px;
}

#ui-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 800px;
  height: 600px;
  z-index: 1;
  pointer-events: none;
  margin: auto;
}
</style>
