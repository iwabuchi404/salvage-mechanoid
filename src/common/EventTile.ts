// src/common/EventTile.ts
import { Character } from './Character';

export type EventCallback = (character: Character) => void;

export class EventTile {
  private x: number;
  private y: number;
  private z: number;
  private eventCallback: EventCallback;

  constructor(x: number, y: number, z: number, eventCallback: EventCallback) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.eventCallback = eventCallback;
  }

  public triggerEvent(character: Character): void {
    this.eventCallback(character);
  }

  public isCharacterOn(characterX: number, characterY: number, characterZ: number): boolean {
    return this.x === characterX && this.y === characterY && this.z === characterZ;
  }

  public getPosition(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }
}
