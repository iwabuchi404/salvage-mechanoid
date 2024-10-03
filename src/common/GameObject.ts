import * as PIXI from 'pixi.js';
import { Stage } from './Stage';

export class GameObject {
  public sprite: PIXI.Sprite;
  public position: { x: number; y: number; z: number };
  public stage: Stage;
  public hasCollision: boolean;
  public texture: PIXI.Texture | null;

  constructor(
    stage: Stage,
    texturePath: string,
    x: number,
    y: number,
    z: number,
    hasCollision = true,
    center?: { x: number; y: number }
  ) {
    this.stage = stage;
    this.loadTextures(texturePath);
    this.position = { x, y, z };
    this.hasCollision = hasCollision;
    this.texture = null;
    this.sprite = new PIXI.Sprite();

    this.loadTextures(texturePath);
    this.sprite.anchor.set(center?.x || 0.5, center?.y || 1);

    this.updateSpritePosition();
  }

  private async loadTextures(texturePath: string): Promise<void> {
    this.texture = await PIXI.Assets.load(texturePath);
    if (this.texture) {
      this.sprite.texture = this.texture;
    }
  }

  public getSprite(): PIXI.Sprite {
    return this.sprite;
  }

  public getPosition(): { x: number; y: number; z: number } {
    return { ...this.position };
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position = { x, y, z };
    this.updateSpritePosition();
  }

  public hasCollisionEnabled(): boolean {
    return this.hasCollision;
  }

  public setCollisionEnabled(enabled: boolean): void {
    this.hasCollision = enabled;
  }

  public updateSpritePosition(): void {
    const screenPosition = this.stage.isometricToScreen(this.position.x, this.position.y);
    this.sprite.x = screenPosition.x;
    this.sprite.y = screenPosition.y - (this.position.z * this.stage.getTileHeight()) / 2; // 高さに応じて調整
    this.sprite.zIndex = this.position.y; // 深度ソート用
  }
}
