import { Character } from './Character';
import { Enemy } from './Enemy';

export enum TurnPhase {
  PLAYER,
  ENEMY,
  END,
}

export class TurnManager {
  private static instance: TurnManager | null = null;
  private characters: (Character | Enemy)[] = [];
  private currentIndex = 0;
  private currentPhase: TurnPhase = TurnPhase.PLAYER;

  private constructor() {
    console.log('TurnManager new');
  }

  public static getInstance(): TurnManager {
    if (!TurnManager.instance) {
      TurnManager.instance = new TurnManager();
    }
    return TurnManager.instance;
  }

  public initialize(player: Character, enemies: Enemy[]): void {
    if (enemies) {
      this.characters = [player, ...enemies];
    }
    this.currentIndex = 0;
    this.currentPhase = TurnPhase.PLAYER;
  }

  public startTurn(): TurnPhase {
    this.currentIndex = 0;
    this.currentPhase = TurnPhase.PLAYER;
    return this.currentPhase;
  }

  public nextTurn(): TurnPhase {
    this.currentIndex++;
    if (this.currentIndex >= this.characters.length) {
      this.currentIndex = 0;
      this.currentPhase = TurnPhase.END;
    } else if (this.currentIndex === 1) {
      this.currentPhase = TurnPhase.ENEMY;
    }
    return this.currentPhase;
  }

  public getCurrentCharacter(): Character | Enemy {
    return this.characters[this.currentIndex];
  }

  public getCurrentPhase(): TurnPhase {
    return this.currentPhase;
  }

  public removeCharacter(character: Character | Enemy): void {
    const index = this.characters.indexOf(character);
    if (index > -1) {
      this.characters.splice(index, 1);
      if (this.currentIndex >= index && this.currentIndex > 0) {
        this.currentIndex--;
      }
    }
  }
}
