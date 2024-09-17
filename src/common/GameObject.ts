import * as PIXI from 'pixi.js';
import { Stage } from './Stage';
export class GameObject {
  private sprite: PIXI.Sprite;
  private position: { x: number; y: number; z: number };
  private stage: Stage;
  constructor(
    stage: Stage,
    texturePath: string,
    x: number,
    y: number,
    z: number,
    center?: { x: number; y: number }
  ) {
    this.stage = stage;
    this.sprite = PIXI.Sprite.from(texturePath);
    this.position = { x, y, z };

    this.loadTextures(texturePath);
    this.sprite.anchor.set(center?.x || 0.5, center?.y || 1);

    this.updateSpritePosition();
  }

  private async loadTextures(texturePath: string): Promise<void> {
    this.sprite = await PIXI.Assets.load(texturePath);
  }

  public getSprite(): PIXI.Sprite {
    return this.sprite;
  }

  public getPosition(): { x: number; y: number; z: number } {
    return { ...this.position };
  }

  public updateSpritePosition(): void {
    const screenPosition = this.stage.isometricToScreen(this.position.x, this.position.y);
    this.sprite.x = screenPosition.x;
    this.sprite.y = screenPosition.y - (this.position.z * this.stage.getTileHeight()) / 2; // 高さに応じて調整
    this.sprite.zIndex = this.position.y; // 深度ソート用
  }
}
