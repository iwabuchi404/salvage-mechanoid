import { createPinia, setActivePinia } from 'pinia';
import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { Game } from '@/game/Game';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { StatsComponent } from '@/engine/entity/components/Stats';
import { useGameStore } from '@/stores/gameStore';

// SoundManager をモック
jest.mock('@/common/SoundManager', () => ({
  SoundManager: {
    getInstance: () => ({
      loadSounds: jest.fn(),
      stopBGM: jest.fn(),
      playBGM: jest.fn(),
      playSE: jest.fn(),
      setVolume: jest.fn(),
      stopAllSounds: jest.fn(),
    }),
  },
}));

/**
 * P0-3 回帰テスト: リトライ時に攻撃力が累積しないことを検証する。
 *
 * 旧バグ: gameStore.strength に +5 して config.attackPower に渡していたため、
 * 投影された実効値（15）+ 5 = 20 が2周目の基礎値になり、累積していた。
 *
 * 修正後: gameStore.attackPower をそのまま config.attackPower に渡すため、
 * 往復が恒等になり累積しない。
 *
 * このテストは実際の Game.initialize() 経路を2回呼び出し、
 * StatsProjection → gameStore → createPlayer() の往復が
 * 恒等であることを検証する。
 */
describe('P0-3: リトライ時の攻撃力累積検出（実経路）', () => {
  let game: Game;
  let assetsLoadSpy: jest.SpyInstance;
  let mockCanvas: HTMLCanvasElement;
  let appInitSpy: jest.SpyInstance;
  let appDestroySpy: jest.SpyInstance;

  beforeEach(() => {
    setActivePinia(createPinia());
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    assetsLoadSpy = jest.spyOn(PIXI.Assets, 'load').mockResolvedValue(PIXI.Texture.EMPTY as any);
    appInitSpy = jest
      .spyOn(PIXI.Application.prototype, 'init')
      .mockImplementation(async function (this: any) {
        Object.defineProperty(this, 'canvas', {
          value: document.createElement('canvas'),
          writable: true,
          configurable: true,
        });
        this.stage = new PIXI.Container();
        this.renderer = { resize: jest.fn(), destroy: jest.fn() };
      });
    appDestroySpy = jest.spyOn(PIXI.Application.prototype, 'destroy').mockImplementation();

    mockCanvas = document.createElement('div') as unknown as HTMLCanvasElement;

    Engine.instance.reset();
    game = new Game();
  });

  afterEach(() => {
    Engine.instance.reset();
    assetsLoadSpy.mockRestore();
    appInitSpy.mockRestore();
    appDestroySpy.mockRestore();
    jest.restoreAllMocks();
  });

  /**
   * P0-3: 2回初期化（リトライ）しても attackPower が累積しない
   *
   * 実際の Game.initialize() → createPlayer() → StatsProjection 経路を
   * 2回通して、attackPower が初期値のまま変わらないことを検証する。
   */
  it('2回初期化しても attackPower が累積しない', async () => {
    const gameStore = useGameStore();
    const initialAttackPower = gameStore.player.status.attackPower;

    // 1周目: Game.initialize() → createPlayer() → StatsProjection が投影
    await game.initialize(mockCanvas);

    // 1周目のプレイヤーの実効 attackPower を確認
    const entitySystem1 = Engine.instance.getSystem<EntitySystem>('entity')!;
    const player1 = entitySystem1.getEntitiesByTag('player')[0];
    const stats1 = player1.getComponent<StatsComponent>('stats')!;
    const attackPower1 = stats1.getValue('attackPower');

    // gameStore に投影された値を確認
    const storeAttackPower1 = gameStore.player.status.attackPower;

    // 2周目: 再初期化（リトライ）
    await game.initialize(mockCanvas);

    const entitySystem2 = Engine.instance.getSystem<EntitySystem>('entity')!;
    const player2 = entitySystem2.getEntitiesByTag('player')[0];
    const stats2 = player2.getComponent<StatsComponent>('stats')!;
    const attackPower2 = stats2.getValue('attackPower');

    // 2周目の gameStore 値
    const storeAttackPower2 = gameStore.player.status.attackPower;

    // 累積していないことを確認
    expect(attackPower1).toBe(initialAttackPower);
    expect(attackPower2).toBe(initialAttackPower);
    expect(storeAttackPower1).toBe(initialAttackPower);
    expect(storeAttackPower2).toBe(initialAttackPower);
  });

  /**
   * P0-3: 3回連続初期化しても attackPower が変わらない
   */
  it('3回連続初期化しても attackPower が変わらない', async () => {
    const gameStore = useGameStore();
    const initialAttackPower = gameStore.player.status.attackPower;

    for (let i = 0; i < 3; i++) {
      await game.initialize(mockCanvas);

      const entitySystem = Engine.instance.getSystem<EntitySystem>('entity')!;
      const player = entitySystem.getEntitiesByTag('player')[0];
      const stats = player.getComponent<StatsComponent>('stats')!;

      expect(stats.getValue('attackPower')).toBe(initialAttackPower);
      expect(gameStore.player.status.attackPower).toBe(initialAttackPower);
    }
  });
});
