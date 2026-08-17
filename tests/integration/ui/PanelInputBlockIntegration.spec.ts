import { createPinia, setActivePinia } from 'pinia';
import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { Game } from '@/game/Game';
import { InputSystem } from '@/engine/input/InputSystem';
import { useUIPanelStore } from '@/stores/uiPanelStore';
import { usePanelInputBlock } from '@/composables/usePanelInputBlock';

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
 * 結合テスト I-5: uiPanelStore.inputBlocked → usePanelInputBlock → Game.setInputBlocked → InputSystem
 *
 * docs/TESTING_STRATEGY.md §8 段階2:
 * - I-5: uiPanelStore.inputBlocked → InputSystem の入力遮断
 *
 * GameScreen.vue が使用する usePanelInputBlock composable を経由して、
 * panelStore.inputBlocked の変化が Game.setInputBlocked() → InputSystem へ
 * 伝播することを検証する。
 *
 * enableInput / disableInput の spy を使って、
 * composable が実際にこれらのメソッドを呼んでいることを証明する。
 * composable が何もしなければ spy は呼ばれず、テストが失敗する。
 */
describe('結合テスト I-5: uiPanelStore → usePanelInputBlock → Game → InputSystem', () => {
  let game: Game;
  let panelStore: ReturnType<typeof useUIPanelStore>;
  let inputSystem: InputSystem;
  let assetsLoadSpy: jest.SpyInstance;
  let mockCanvas: HTMLCanvasElement;
  let appInitSpy: jest.SpyInstance;
  let appDestroySpy: jest.SpyInstance;
  let unwatch: ReturnType<typeof usePanelInputBlock>;
  let disableInputSpy: jest.SpyInstance;
  let enableInputSpy: jest.SpyInstance;

  beforeEach(async () => {
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
    await game.initialize(mockCanvas);

    panelStore = useUIPanelStore();
    inputSystem = Engine.instance.getSystem<InputSystem>('input')!;

    // enableInput / disableInput に spy を仕込む
    // composable が実際にこれらを呼ぶことを証明する
    disableInputSpy = jest.spyOn(inputSystem, 'disableInput');
    enableInputSpy = jest.spyOn(inputSystem, 'enableInput');

    // GameScreen.vue と同じ composable をセットアップ
    unwatch = usePanelInputBlock(game);

    // immediate: true によりセットアップ時に enableInput() が1回呼ばれるため
    // spy の呼び出し記録をクリアする
    disableInputSpy.mockClear();
    enableInputSpy.mockClear();
  });

  afterEach(() => {
    unwatch();
    Engine.instance.reset();
    assetsLoadSpy.mockRestore();
    appInitSpy.mockRestore();
    appDestroySpy.mockRestore();
    jest.restoreAllMocks();
  });

  /**
   * I-5: モーダルパネルを開くと disableInput() が呼ばれる
   *
   * panelStore.open('item_list') → inputBlocked=true → watch →
   * game.setInputBlocked(true) → InputSystem.disableInput() の全経路を検証する。
   * spy で disableInput が実際に呼ばれたことを証明する。
   */
  it('I-5: モーダルパネルを開くと disableInput() が呼ばれる', () => {
    expect(panelStore.inputBlocked).toBe(false);

    // モーダルパネルを開く
    panelStore.open('item_list');
    expect(panelStore.inputBlocked).toBe(true);

    // watch 経由で disableInput() が呼ばれたことを spy で証明
    expect(disableInputSpy).toHaveBeenCalled();
  });

  /**
   * I-5: モーダルパネルを閉じると enableInput() が呼ばれる
   *
   * panelStore.close('item_list') → inputBlocked=false → watch →
   * game.setInputBlocked(false) → InputSystem.enableInput() の全経路を検証する。
   * spy で enableInput が実際に呼ばれたことを証明する。
   * composable が何もしなければ enableInput は呼ばれず、テストが失敗する。
   */
  it('I-5: モーダルパネルを閉じると enableInput() が呼ばれる', () => {
    // まず無効化
    panelStore.open('item_list');
    expect(disableInputSpy).toHaveBeenCalled();

    // モーダルパネルを閉じる
    panelStore.close('item_list');
    expect(panelStore.inputBlocked).toBe(false);

    // watch 経由で enableInput() が呼ばれたことを spy で証明
    // composable が close を無視しても、ここで失敗する
    expect(enableInputSpy).toHaveBeenCalled();
  });

  /**
   * I-5: 非モーダルパネルだけの場合は disableInput() が呼ばれない
   */
  it('I-5: 非モーダルパネルだけの場合は disableInput() が呼ばれない', () => {
    // action_menu は modal: false
    panelStore.open('action_menu');
    expect(panelStore.inputBlocked).toBe(false);

    // disableInput は呼ばれない
    expect(disableInputSpy).not.toHaveBeenCalled();
  });

  /**
   * I-5: closeAll() で全パネルを閉じると enableInput() が呼ばれる
   */
  it('I-5: closeAll() で全パネルを閉じると enableInput() が呼ばれる', () => {
    panelStore.open('action_menu');
    panelStore.open('item_list');
    expect(disableInputSpy).toHaveBeenCalled();

    panelStore.closeAll();
    expect(panelStore.inputBlocked).toBe(false);

    // closeAll() で inputBlocked=false になったら enableInput が呼ばれる
    expect(enableInputSpy).toHaveBeenCalled();
  });

  /**
   * I-5: 開閉を繰り返すと disableInput / enableInput が交互に呼ばれる
   *
   * composable の watch が実際に機能していることを証明する。
   * もし watch が機能していなければ、2回目の open で disableInput は
   * 呼ばれず、呼び出し回数は 1 のままになる。
   */
  it('I-5: 開閉を繰り返すと disableInput / enableInput が交互に呼ばれる', () => {
    // 1回目: 開く → disableInput
    panelStore.open('item_list');
    expect(disableInputSpy).toHaveBeenCalledTimes(1);
    expect(enableInputSpy).not.toHaveBeenCalled();

    // 1回目: 閉じる → enableInput
    panelStore.close('item_list');
    expect(enableInputSpy).toHaveBeenCalledTimes(1);

    // 2回目: 開く → disableInput が再度呼ばれる
    // watch が機能していなければ呼ばれない
    panelStore.open('skill_menu');
    expect(disableInputSpy).toHaveBeenCalledTimes(2);

    // 2回目: 閉じる → enableInput が再度呼ばれる
    panelStore.close('skill_menu');
    expect(enableInputSpy).toHaveBeenCalledTimes(2);
  });
});
