import { watch, WatchStopHandle } from 'vue';
import { useUIPanelStore } from '../stores/uiPanelStore';
import { Game } from '../game/Game';

/**
 * BU-4 段階4: パネル入力ブロックの結線
 *
 * uiPanelStore.inputBlocked の変化を watch し、
 * Game.setInputBlocked() 経由で InputSystem の入力を制御する。
 *
 * GameScreen.vue の onMounted で呼び出され、
 * テストからも直接呼び出して結線を検証できる。
 *
 * flush: 'sync' を指定して、テスト環境（Vue アプリ未マウント）でも
 * watch コールバックが同期的に発火するようにする。
 */
export function usePanelInputBlock(game: Game): WatchStopHandle {
  const panelStore = useUIPanelStore();
  return watch(
    () => panelStore.inputBlocked,
    (blocked) => {
      game.setInputBlocked(blocked);
    },
    { immediate: true, flush: 'sync' }
  );
}
