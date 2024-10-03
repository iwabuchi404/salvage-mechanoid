// src/stores/game.ts
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export const useGameStore = defineStore('game', () => {
  // プレイヤーの状態を管理するref
  const player = ref({
    status: {
      level: 1,
      hp: 100,
      maxHp: 100,
      energy: 200,
      maxEnergy: 200,
      strength: 10,
      defense: 5,
    },
    position: { x: 0, y: 0, z: 0 },
    items: [''],
  });

  // その他のゲーム状態を管理するref
  const enemies = ref([]);
  const objects = ref([]);

  const currentFloor = ref(1);
  const score = ref(0);

  const isPortalActive = ref(false);

  // プレイヤーが生存しているかどうかを計算するgetter
  const isPlayerAlive = computed(() => player.value.status.hp > 0);

  // プレイヤーのエネルギーパーセンテージを計算するgetter
  const playerEnergyPercentage = computed(
    () => (player.value.status.energy / player.value.status.maxEnergy) * 100
  );

  // プレイヤーの位置を更新する関数
  function updatePlayerPosition(x: number, y: number, z: number) {
    player.value.position = { x, y, z };
  }

  // プレイヤーにダメージを与える関数
  function damagePlayer(amount: number) {
    player.value.status.hp = Math.max(0, player.value.status.hp - amount);
  }

  // プレイヤーのエネルギーを消費する関数
  function usePlayerEnergy(amount: number) {
    player.value.status.energy = Math.max(0, player.value.status.energy - amount);
  }

  // スコアを追加する関数
  function addScore(points: number) {
    score.value += points;
  }

  const setPortalActive = (isActive: boolean) => {
    isPortalActive.value = isActive;
  };

  // 外部から使用可能な状態とメソッドを返す
  return {
    player,
    enemies,
    objects,
    currentFloor,
    score,
    isPlayerAlive,
    playerEnergyPercentage,
    updatePlayerPosition,
    damagePlayer,
    usePlayerEnergy,
    addScore,
    setPortalActive,
    isPortalActive,
  };
});
