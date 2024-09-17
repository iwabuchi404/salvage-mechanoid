import * as PIXI from 'pixi.js';
import { Direction, EnemyType } from './types';
import { CharacterBase } from './CharacterBase';
import { Stage } from './Stage';
import { RandomMoveBehavior, AggressiveBehavior } from './EnemyBehavior';
import { TurnManager } from './TurnManager';

export class Enemy extends CharacterBase {
  private type: EnemyType;
  private isDeleted = false;
  private hp: number;
  // private attack: number;

  constructor(id: string, type: EnemyType, level = 1) {
    super(id, type.name, type.textures, type.center);

    this.type = type;

    this.hp = this.calculateHp(level);
    // this.attack = this.calculateAttack(level);
  }

  private calculateHp(level: number): number {
    return Math.floor(this.type.baseHp * (1 + 0.1 * (level - 1)));
  }

  private calculateAttack(level: number): number {
    return Math.floor(this.type.baseAttack * (1 + 0.1 * (level - 1)));
  }

  public getSprite(): PIXI.Sprite {
    return this.sprite;
  }

  public getHp(): number {
    return this.hp;
  }

  public getAttack(): number {
    return this.type.baseAttack;
  }

  public attack(): number {
    this.applyEffect('attack');
    // 基本攻撃力を返す
    return this.getAttack();
  }
  public takeDamage(damage: number): void {
    this.hp = Math.max(0, this.hp - damage);
    this.applyEffect('damage');
  }

  public isAlive(): boolean {
    return this.hp > 0 && !this.isDeleted;
  }

  public setClickHandler(handler: () => void) {
    this.sprite?.on('pointerdown', handler);
  }

  public async act(stage: Stage): Promise<void> {
    await this.type.behavior.act(this, stage);
  }

  public moveRandomly(stage: Stage): Promise<void> {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    const randomDirection = directions[Math.floor(Math.random() * directions.length)];

    const currentPosition = this.getPosition();
    let newX = currentPosition.x;
    let newY = currentPosition.y;

    switch (randomDirection) {
      case 'up':
        newY--;
        break;
      case 'down':
        newY++;
        break;
      case 'left':
        newX--;
        break;
      case 'right':
        newX++;
        break;
    }

    this.setDirection(randomDirection);

    if (stage.isValidMove(newX, newY, currentPosition.z)) {
      return stage.moveCharacter(this, newX, newY, currentPosition.z);
    } else {
      // 移動できない場合は何もしない
      return Promise.resolve();
    }
  }

  public deleteEnemy(): void {
    console.log(`Deleting enemy: ${this.getName()}`);
    if (this.isDeleted) return;
    this.isDeleted = true;

    // スプライトの削除
    if (this.sprite && this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }

    // クリックハンドラの削除
    if (this.sprite) {
      this.sprite.removeAllListeners();
    }

    // その他のクリーンアップ処理
    // 例: タイマーの解除、サブスクリプションの解除など
    TurnManager.getInstance().removeCharacter(this);
    console.log(`Enemy ${this.getName()} deleted successfully`);
  }
}

// 敵のタイプを定義
const EnemyTypes: { [key: string]: EnemyType } = {
  SLIME: {
    name: 'slime',
    baseHp: 50,
    baseAttack: 5,
    textures: {
      up: '/robo02bk_l.png',
      down: '/robo02_l.png',
      left: '/robo02bk_r.png',
      right: '/robo02_r.png',
    },
    center: { x: 0.5, y: 0.0 },
    behavior: new RandomMoveBehavior(),
  },
  GOBLIN: {
    name: 'goblin',
    baseHp: 80,
    baseAttack: 8,
    textures: {
      up: '/robo03bk_r.png',
      down: '/robo03_l.png',
      left: '/robo03bk_l.png',
      right: '/robo03_r.png',
    },
    behavior: new AggressiveBehavior(),
  },
};

// 敵を生成するファクトリークラス
export class EnemyFactory {
  static async createEnemy(id: string, type: string, level = 1): Promise<Enemy> {
    const enemyType = EnemyTypes[type];
    if (!enemyType) {
      throw new Error(`Unknown enemy type: ${type}`);
    }
    const enemy = new Enemy(id, enemyType, level);
    return enemy;
  }

  static addEnemyType(type: string, enemyType: EnemyType): void {
    EnemyTypes[type] = enemyType;
  }
}
