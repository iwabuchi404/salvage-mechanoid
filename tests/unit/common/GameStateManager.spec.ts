import { GameState, GameStateManager } from '@/common/GameStateManager';

const mockSoundManager = {
  loadSounds: jest.fn(),
  stopBGM: jest.fn(),
  playBGM: jest.fn(),
};

jest.mock('@/common/SoundManager', () => ({
  SoundManager: {
    getInstance: () => mockSoundManager,
  },
}));

describe('GameStateManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('START状態で初期化し、サウンドを一度読み込む', () => {
    const manager = new GameStateManager();

    expect(manager.getState()).toBe(GameState.START);
    expect(mockSoundManager.loadSounds).toHaveBeenCalledTimes(1);
  });

  it.each([
    [GameState.START, 'bgm03'],
    [GameState.PLAYING, 'bgm01'],
    [GameState.CLEAR, 'bgm01'],
    [GameState.GAME_OVER, 'bgm02'],
  ])('状態変更時に既存BGMを止めて対応するBGMを再生する', (state, bgm) => {
    const manager = new GameStateManager();
    jest.clearAllMocks();

    manager.setState(state);

    expect(manager.getState()).toBe(state);
    expect(mockSoundManager.stopBGM).toHaveBeenCalledTimes(1);
    expect(mockSoundManager.playBGM).toHaveBeenCalledWith(bgm);
  });
});
