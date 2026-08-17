import { setActivePinia, createPinia } from 'pinia';
import { useGameViewStateStore } from '@/stores/gameViewStateStore';

/**
 * BU-4 段階2: GameViewStateStore の投影テスト
 *
 * StatsProjection 経由でドメインイベントが viewStore へ反映されること、
 * Game からの直接投影が正しく動作することを検証する。
 */
describe('BU-4 段階2: GameViewStateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('初期状態', () => {
    it('プレイヤー状態の初期値', () => {
      const store = useGameViewStateStore();

      expect(store.player.hp).toBe(100);
      expect(store.player.maxHp).toBe(100);
      expect(store.player.energy).toBe(200);
      expect(store.player.maxEnergy).toBe(200);
      expect(store.player.level).toBe(1);
      expect(store.player.direction).toBe('down');
      expect(store.player.position).toEqual({ x: 0, y: 0 });
    });

    it('進行状況の初期値', () => {
      const store = useGameViewStateStore();

      expect(store.progress.floor).toBe(1);
      expect(store.progress.maxFloors).toBe(10);
      expect(store.progress.turn).toBe(0);
      expect(store.progress.isPlayerTurn).toBe(true);
    });

    it('選択対象の初期値は null', () => {
      const store = useGameViewStateStore();

      expect(store.selection).toBeNull();
    });
  });

  describe('setPlayer', () => {
    it('部分更新で HP と方向が反映される', () => {
      const store = useGameViewStateStore();

      store.setPlayer({ hp: 80, direction: 'right' });

      expect(store.player.hp).toBe(80);
      expect(store.player.direction).toBe('right');
      // 更新していないフィールドは維持
      expect(store.player.maxHp).toBe(100);
      expect(store.player.energy).toBe(200);
    });

    it('位置が反映される', () => {
      const store = useGameViewStateStore();

      store.setPlayer({ position: { x: 5, y: 3 } });

      expect(store.player.position).toEqual({ x: 5, y: 3 });
    });
  });

  describe('setProgress', () => {
    it('部分更新で フロア と ターン が反映される', () => {
      const store = useGameViewStateStore();

      store.setProgress({ floor: 3, turn: 15 });

      expect(store.progress.floor).toBe(3);
      expect(store.progress.turn).toBe(15);
      // 更新していないフィールドは維持
      expect(store.progress.maxFloors).toBe(10);
    });

    it('isPlayerTurn が反映される', () => {
      const store = useGameViewStateStore();

      store.setProgress({ isPlayerTurn: false });
      expect(store.progress.isPlayerTurn).toBe(false);

      store.setProgress({ isPlayerTurn: true });
      expect(store.progress.isPlayerTurn).toBe(true);
    });
  });

  describe('setSelection', () => {
    it('tile 選択が反映される', () => {
      const store = useGameViewStateStore();

      store.setSelection({
        kind: 'tile',
        name: '床',
        position: { x: 3, y: 4 },
        effect: 'なし',
      });

      expect(store.selection).not.toBeNull();
      expect(store.selection!.kind).toBe('tile');
    });

    it('enemy 選択が反映される', () => {
      const store = useGameViewStateStore();

      store.setSelection({
        kind: 'enemy',
        name: 'SOLDIER',
        position: { x: 7, y: 2 },
        hp: 30,
        maxHp: 50,
      });

      expect(store.selection).not.toBeNull();
      expect(store.selection!.kind).toBe('enemy');
    });

    it('null でクリアされる', () => {
      const store = useGameViewStateStore();
      store.setSelection({
        kind: 'tile',
        name: '床',
        position: { x: 0, y: 0 },
        effect: 'なし',
      });

      store.setSelection(null);

      expect(store.selection).toBeNull();
    });
  });

  describe('reset', () => {
    it('全状態が初期値に戻る', () => {
      const store = useGameViewStateStore();

      store.setPlayer({ hp: 50, direction: 'up', position: { x: 9, y: 9 } });
      store.setProgress({ floor: 5, turn: 100, isPlayerTurn: false });
      store.setSelection({
        kind: 'enemy',
        name: 'SCOUT',
        position: { x: 1, y: 1 },
        hp: 10,
        maxHp: 30,
      });

      store.reset();

      expect(store.player.hp).toBe(100);
      expect(store.player.direction).toBe('down');
      expect(store.player.position).toEqual({ x: 0, y: 0 });
      expect(store.progress.floor).toBe(1);
      expect(store.progress.turn).toBe(0);
      expect(store.progress.isPlayerTurn).toBe(true);
      expect(store.selection).toBeNull();
    });
  });

  describe('state computed', () => {
    it('全体状態が読み取れる', () => {
      const store = useGameViewStateStore();

      store.setPlayer({ hp: 75 });
      store.setProgress({ turn: 5 });

      const state = store.state;
      expect(state.player.hp).toBe(75);
      expect(state.progress.turn).toBe(5);
      expect(state.selection).toBeNull();
    });
  });
});
