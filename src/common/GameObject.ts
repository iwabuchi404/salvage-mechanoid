import * as PIXI from 'pixi.js';

export class GameObject {
  private sprite: PIXI.Sprite;
  private position: { x: number; y: number; z: number };

  constructor(
    texturePath: string,
    x: number,
    y: number,
    z: number,
    center?: { x: number; y: number }
  ) {
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

  private updateSpritePosition(): void {
    // この方法は仮のものです。実際の位置計算はStageクラスのisometricToScreenメソッドを使用すべきです
    this.sprite.x = this.position.x;
    this.sprite.y = this.position.y - this.position.z * 5; // 高さに応じて調整
  }
}
