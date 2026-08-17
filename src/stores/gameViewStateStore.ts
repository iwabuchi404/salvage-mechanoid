/**
 * BU-4 段階2: GameViewState を保持する Pinia ストア
 *
 * 設計 docs/design/UI_BOUNDARY_DESIGN.md §4.1, §8 未決事項1, 2
 *
 * 役割分担:
 * - gameStore: 永続的なゲームデータ（インベントリ・倉庫・スコア）
 * - gameViewStateStore: 実行中の表示状態（プレイヤーHP/方向/位置・進行・選択）
 *
 * Game がドメイン状態をこのストアへ投影し、UI は読み取る。
 * コールバック setter は段階5で撤去するまで併存する。
 */
import { ref, computed, readonly } from 'vue';
import { defineStore } from 'pinia';
import type {
  GameViewState,
  PlayerViewState,
  ProgressViewState,
  SelectionViewState,
} from '../game/view/GameViewState';
import { Direction } from '../engine/types';

export const useGameViewStateStore = defineStore('gameViewState', () => {
  // プレイヤー表示状態
  const player = ref<PlayerViewState>({
    hp: 100,
    maxHp: 100,
    energy: 200,
    maxEnergy: 200,
    level: 1,
    direction: 'down' as Direction,
    position: { x: 0, y: 0 },
  });

  // 進行状況
  const progress = ref<ProgressViewState>({
    floor: 1,
    maxFloors: 10,
    turn: 0,
    isPlayerTurn: true,
  });

  // 選択対象
  const selection = ref<SelectionViewState | null>(null);

  // 読み取り専用の全体状態（computed で投影）
  const state = computed<GameViewState>(() => ({
    player: readonly(player.value),
    progress: readonly(progress.value),
    selection: selection.value ? readonly(selection.value) : null,
  }));

  // ===== 投影アクション（Game から呼ばれる） =====

  function setPlayer(view: Partial<PlayerViewState>): void {
    player.value = { ...player.value, ...view };
  }

  function setProgress(view: Partial<ProgressViewState>): void {
    progress.value = { ...progress.value, ...view };
  }

  function setSelection(view: SelectionViewState | null): void {
    selection.value = view;
  }

  function reset(): void {
    player.value = {
      hp: 100,
      maxHp: 100,
      energy: 200,
      maxEnergy: 200,
      level: 1,
      direction: 'down',
      position: { x: 0, y: 0 },
    };
    progress.value = {
      floor: 1,
      maxFloors: 10,
      turn: 0,
      isPlayerTurn: true,
    };
    selection.value = null;
  }

  return {
    player,
    progress,
    selection,
    state,
    setPlayer,
    setProgress,
    setSelection,
    reset,
  };
});
