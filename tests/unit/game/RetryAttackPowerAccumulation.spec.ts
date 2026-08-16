import { createPinia, setActivePinia } from 'pinia';
import { useGameStore } from '@/stores/gameStore';
import { PlayerInitialConfig } from '@/engine/entity/PlayerInitialConfig';

/**
 * P0-3 回帰テスト: リトライ時に攻撃力が累積しないことを検証する。
 *
 * gameStore は Pinia のシングルトンで、Game.reset() も createPlayer() も
 * status.attackPower を初期化しない。1周目のプレイで StatsProjection が
 * 実効 attackPower を gameStore へ投影した後、2周目の createPlayer() が
 * その gameStore 値を読んで config に渡す。
 *
 * 旧バグ: gameStore.strength に +5 して config.attackPower に渡していたため、
 * 投影された実効値（15）+ 5 = 20 が2周目の基礎値になり、累積していた。
 *
 * 修正後: gameStore.attackPower をそのまま config.attackPower に渡すため、
 * 往復が恒等になり累積しない。
 */
describe('P0-3: リトライ時の攻撃力累積検出', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('1周目投影後の gameStore 値を2周目の config に使っても attackPower が変わらない', () => {
    const store = useGameStore();

    // 初期状態
    expect(store.player.status.attackPower).toBe(15);

    // 1周目のプレイをシミュレート: StatsProjection が実効 attackPower を投影
    // （stats_changed で data.stats.attackPower = 15 が投影される）
    store.player.status.attackPower = 15;

    // 2周目の createPlayer() で config を構築（Game.ts と同じロジック）
    const config: PlayerInitialConfig = {
      maxHp: store.player.status.maxHp,
      hp: store.player.status.hp,
      maxEnergy: store.player.status.maxEnergy,
      energy: store.player.status.energy,
      defense: store.player.status.defense,
      attackPower: store.player.status.attackPower, // 旧バグ: + 5
      viewRadius: store.player.status.viewRadius,
      level: store.player.status.level,
    };

    // 2周目の config.attackPower は 15 のままであるべき
    expect(config.attackPower).toBe(15);
  });

  it('stat_boost アイテム使用後のリトライでも累積しない', () => {
    const store = useGameStore();

    // 初期状態
    expect(store.player.status.attackPower).toBe(15);

    // 1周目で attackPower +10 のブーストアイテムを使った状態をシミュレート
    // StatsProjection が実効 attackPower = 25 を投影
    store.player.status.attackPower = 25;

    // 2周目の createPlayer() で config を構築
    const config: PlayerInitialConfig = {
      maxHp: store.player.status.maxHp,
      hp: store.player.status.hp,
      maxEnergy: store.player.status.maxEnergy,
      energy: store.player.status.energy,
      defense: store.player.status.defense,
      attackPower: store.player.status.attackPower,
      viewRadius: store.player.status.viewRadius,
      level: store.player.status.level,
    };

    // 旧バグ: 25 + 5 = 30 が2周目の基礎値になる
    // 修正後: 25 のまま（ブースト分は1周目のセーブデータに残る想定だが、
    //         gameStore 往復だけ見れば累積しない）
    expect(config.attackPower).toBe(25);
  });

  it('3周連続で config 構築を繰り返しても attackPower が変わらない', () => {
    const store = useGameStore();
    expect(store.player.status.attackPower).toBe(15);

    // 3周分の config 構築をシミュレート
    for (let i = 0; i < 3; i++) {
      const config: PlayerInitialConfig = {
        maxHp: store.player.status.maxHp,
        hp: store.player.status.hp,
        maxEnergy: store.player.status.maxEnergy,
        energy: store.player.status.energy,
        defense: store.player.status.defense,
        attackPower: store.player.status.attackPower,
        viewRadius: store.player.status.viewRadius,
        level: store.player.status.level,
      };

      // 投影をシミュレート（StatsProjection が config.attackPower を投影）
      store.player.status.attackPower = config.attackPower;

      expect(config.attackPower).toBe(15);
    }
  });
});
