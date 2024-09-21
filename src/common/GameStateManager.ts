export enum GameState {
  START,
  PLAYING,
  CLEAR,
  GAME_OVER,
}

export class GameStateManager {
  private currentState: GameState;

  constructor() {
    this.currentState = GameState.START;
  }

  setState(state: GameState) {
    this.currentState = state;
  }

  getState(): GameState {
    return this.currentState;
  }
}
