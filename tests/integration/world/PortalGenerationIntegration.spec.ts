import { createPinia, setActivePinia } from 'pinia';
import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { Game } from '@/game/Game';
import { EntitySystem } from '@/engine/entity/EntitySystem';

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
 * 結合テスト G-2: 実リソース生成経路でポータル（event_object）が配置される
 *
 * docs/TESTING_STRATEGY.md §8 段階3:
 * - G-2: 生成マップから資源を配置し、event_object（ポータル）が 1 体以上
 *
 * 生成器自身はリソース配置を別システムへ移したと明記しており、
 * 実ゲームの event_object は Game.ts の buildEventObjects() で別途生成される。
 * したがって FeatureType.PORTAL のみを検証するのではなく、
 * 実 Game.initialize() 経路で portal タグを持つ Entity が生成されることを検証する。
 *
 * これにより createPortal() / buildEventObjects() / 床判定が壊れても G-2 が失敗する。
 */
describe('結合テスト G-2: 実リソース生成経路でポータル（event_object）が配置される', () => {
  let assetsLoadSpy: jest.SpyInstance;
  let appInitSpy: jest.SpyInstance;
  let appDestroySpy: jest.SpyInstance;
  let mockCanvas: HTMLCanvasElement;

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
  });

  afterEach(() => {
    Engine.instance.reset();
    assetsLoadSpy.mockRestore();
    appInitSpy.mockRestore();
    appDestroySpy.mockRestore();
    jest.restoreAllMocks();
  });

  /**
   * G-2: Game.initialize() 経路で portal タグを持つ Entity が1つ以上生成される
   */
  it('G-2: Game.initialize() 経路で portal タグを持つ Entity が1つ以上生成される', async () => {
    const game = new Game();
    await game.initialize(mockCanvas);

    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity')!;
    const portals = entitySystem.getEntitiesByTag('portal');

    expect(portals.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * G-2: ポータル Entity は EventObjectEntity であり、transform を持つ
   */
  it('G-2: ポータル Entity は transform を持つ', async () => {
    const game = new Game();
    await game.initialize(mockCanvas);

    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity')!;
    const portals = entitySystem.getEntitiesByTag('portal');

    expect(portals.length).toBeGreaterThanOrEqual(1);
    const portal = portals[0];
    const transform = portal.getComponent('transform');
    expect(transform).toBeDefined();
  });
});
