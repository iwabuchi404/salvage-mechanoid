import * as PIXI from 'pixi.js';
import { Direction } from './types';
import { EffectManager } from './EffectManager';
export abstract class CharacterBase {
  protected id: string;
  protected name: string;
  protected sprite: PIXI.Sprite;
  protected position: { x: number; y: number; z: number };
  protected direction: Direction;
  protected isMoving = false;

  protected textures: { [key: string]: PIXI.Texture };

  protected status: {
    level: number;
    hp: number;
    maxHp: number;
    strength: number;
    defense: number;
  };

  constructor(
    id: string,
    name: string,
    textureUrls: { [key: string]: string },
    center?: { x: number; y: number }
  ) {
    this.id = id;
    this.name = name;
    this.sprite = new PIXI.Sprite();
    this.position = { x: 0, y: 0, z: 0 };
    this.direction = 'down';
    this.status = {
      level: 1,
      hp: 100,
      maxHp: 100,
      strength: 10,
      defense: 5,
    };
    this.textures = {};

    this.sprite.interactive = true;
    this.sprite.cursor = 'pointer';

    this.loadTextures(textureUrls);
    this.sprite.anchor.set(center?.x || 0.5, center?.y || 1);
  }

  private async loadTextures(textureUrls: { [key: string]: string }): Promise<void> {
    for (const [direction, url] of Object.entries(textureUrls)) {
      this.textures[direction] = await PIXI.Assets.load(url);
    }
    this.setDirection('down'); // デフォルトの向きを設定
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getMoveState(): boolean {
    return this.isMoving;
  }

  public getSprite(): PIXI.Sprite {
    return this.sprite;
  }

  public getPosition(): { x: number; y: number; z: number } {
    return { ...this.position };
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position = { x, y, z };
    // this.updateSpritePosition();
  }

  public getDirection(): Direction {
    return this.direction;
  }

  public setDirection(direction: Direction): void {
    this.direction = direction;
    if (this.textures[direction]) {
      this.sprite.texture = this.textures[direction];
    }
  }
  public getStatus(): typeof this.status {
    return { ...this.status };
  }

  protected updateSpritePosition(targetX: number, targetY: number): void {
    // this.sprite.x = this.position.x;
    // this.sprite.y = this.position.y - this.position.z * 5; // 高さに応じて調整

    // スプライトの位置を更新（isometricToScreen変換は Stage クラスで行う）
    this.sprite.x = targetX;
    this.sprite.y = targetY;
  }

  public async move(
    targetX: number,
    targetY: number,
    targetZ: number,
    duration = 200
  ): Promise<void> {
    if (this.isMoving) return;

    this.isMoving = true;
    const startX = this.sprite.x;
    const startY = this.sprite.y;
    const startTime = Date.now();
    return new Promise<void>((resolve) => {
      const animate = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        this.sprite.x = startX + (targetX - startX) * progress;
        this.sprite.y = startY + (targetY - startY) * progress;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.updateSpritePosition(targetX, targetY);
          this.isMoving = false;
          resolve();
        }
      };

      animate();
    });
  }

  public setClickHandler(handler: () => void): void {
    this.sprite.eventMode = 'static';
    this.sprite.on('pointerdown', handler);
  }
  public async takeDamage(damage: number): Promise<void> {
    this.status.hp = Math.max(0, this.status.hp - damage);
    console.log(
      `${this.name} taking damage. Current position: (${this.sprite.x}, ${this.sprite.y})`
    );
    await EffectManager.applyEffect(this.sprite, 'damage');
    console.log(
      `${this.name} after damage effect. Current position: (${this.sprite.x}, ${this.sprite.y})`
    );
  }

  public async attack(): Promise<number> {
    console.log(`${this.name} attacking. Current position: (${this.sprite.x}, ${this.sprite.y})`);
    await EffectManager.applyEffect(this.sprite, 'attack');
    console.log(
      `${this.name} after attack effect. Current position: (${this.sprite.x}, ${this.sprite.y})`
    );
    return this.status.strength;
  }

  public isAlive(): boolean {
    return this.status.hp > 0;
  }

  public async applyEffect(effectName: string): Promise<void> {
    this.isMoving = true;
    EffectManager.applyEffect(this.sprite, effectName);
    this.isMoving = false;
  }
}
