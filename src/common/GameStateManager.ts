import { sound } from '@pixi/sound';

export enum GameState {
  START,
  PLAYING,
  CLEAR,
  GAME_OVER,
}

export class GameStateManager {
  private currentState: GameState;

  constructor() {
    //bgm読み込み
    sound.add('bgm01', 'bgm01.mp3');
    sound.add('bgm02', 'bgm02.mp3');
    sound.add('bgm03', 'bgm03.mp3');

    //シーンスタート
    this.currentState = GameState.START;
  }

  setState(state: GameState) {
    this.currentState = state;

    sound.stop;
    //bgm再生
    switch (this.currentState) {
      case GameState.START:
        sound.play('bgm03', { loop: true, volume: 0.1 });
        break;
      case GameState.PLAYING:
        sound.play('bgm01', { loop: true, volume: 0.1 });
        break;
      case GameState.CLEAR:
        sound.play('bgm01', { loop: true, volume: 0.1 });
        break;
      case GameState.GAME_OVER:
        sound.play('bgm02', { loop: true, volume: 0.1 });
        break;
    }
  }

  getState(): GameState {
    return this.currentState;
  }
}
