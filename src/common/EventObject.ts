// src/common/EventObject.ts
import { GameObject } from './GameObject';
import { Stage } from './Stage';
import { Character } from './Character';

export type EventCallback = (character: Character) => void;

export class EventObject extends GameObject {
  private eventCallback: EventCallback;

  constructor(
    stage: Stage,
    texture: string,
    x: number,
    y: number,
    z: number,
    eventCallback: EventCallback,
    hasCollision = false,
    center?: { x: number; y: number }
  ) {
    super(stage, texture, x, y, z, hasCollision, center);
    this.eventCallback = eventCallback;
  }

  public triggerEvent(character: Character): void {
    this.eventCallback(character);
  }

  public isCharacterOn(characterX: number, characterY: number, characterZ: number): boolean {
    return (
      this.position.x === characterX &&
      this.position.y === characterY &&
      this.position.z === characterZ
    );
  }

  // オプション: アニメーションなどの追加機能
  public setupAnimation(): void {
    // 具体的なアニメーションはサブクラスで実装
  }
}
