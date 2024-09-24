import { sound } from '@pixi/sound';
import { SoundManager } from './SoundManager';

export enum GameState {
  START,
  PLAYING,
  CLEAR,
  GAME_OVER,
}

export class GameStateManager {
  private currentState: GameState;
  private soundManager: SoundManager;

  constructor() {
    //シーンスタート
    this.currentState = GameState.START;
    this.soundManager = SoundManager.getInstance();
    this.soundManager.loadSounds();
  }

  setState(state: GameState) {
    this.currentState = state;

    this.soundManager.stopBGM();
    //bgm再生
    switch (this.currentState) {
      case GameState.START:
        this.soundManager.playBGM('bgm03');
        break;
      case GameState.PLAYING:
        this.soundManager.playBGM('bgm01');
        break;
      case GameState.CLEAR:
        this.soundManager.playBGM('bgm01');
        break;
      case GameState.GAME_OVER:
        this.soundManager.playBGM('bgm02');
        break;
    }
  }

  getState(): GameState {
    return this.currentState;
  }
}
