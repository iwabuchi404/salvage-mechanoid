import { Enemy } from './Enemy';
import { Stage } from './Stage';
import { Direction } from './types';
import { EnemyBehavior } from './types';
import { SoundManager } from './SoundManager';

function moveRandomly(enemy: Enemy, stage: Stage): void {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  const randomDirection = directions[Math.floor(Math.random() * directions.length)];
  const currentPosition = enemy.getPosition();
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

  enemy.setDirection(randomDirection);

  if (stage.isValidMove(newX, newY, currentPosition.z)) {
    stage.moveCharacter(enemy, newX, newY, currentPosition.z);
  } else {
    // 移動できない場合は何もしない
  }
}

export class RandomMoveBehavior implements EnemyBehavior {
  async act(enemy: Enemy, stage: Stage): Promise<void> {
    moveRandomly(enemy, stage);
  }
}

export class AggressiveBehavior implements EnemyBehavior {
  private chaseDistance: number;
  private soundManager = SoundManager.getInstance();

  constructor(chaseDistance = 6) {
    this.chaseDistance = chaseDistance;
  }

  async act(enemy: Enemy, stage: Stage): Promise<void> {
    const player = stage.getPlayer();
    if (player) {
      const enemyPos = enemy.getPosition();
      const playerPos = player.getPosition();
      const distance = stage.getDistance(enemyPos, playerPos);

      if (distance <= this.chaseDistance) {
        const path = stage.findPath(enemyPos, playerPos);
        console.log('path.length', path.length);
        if (path.length > 2) {
          const nextStep = path[1]; // path[0]は現在の位置なので、path[1]を使用
          await stage.moveCharacter(enemy, nextStep.x, nextStep.y, nextStep.z);
        } else if (path.length === 2) {
          // プレイヤーに隣接している場合、攻撃
          console.log('enemy.attack');
          this.soundManager.playSE('attack');
          player.takeDamage(await enemy.attack());
        }
      } else {
        // ランダムな方向に移動
        await this.moveRandomly(enemy, stage);
      }
    }
  }

  private async moveRandomly(enemy: Enemy, stage: Stage): Promise<void> {
    const directions = ['up', 'down', 'left', 'right'];
    const randomDirection = directions[Math.floor(Math.random() * directions.length)];
    const currentPosition = enemy.getPosition();
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

    if (stage.isWalkable(newX, newY, currentPosition.z)) {
      await stage.moveCharacter(enemy, newX, newY, currentPosition.z);
    }
  }
  private isAdjacent(
    pos1: { x: number; y: number; z: number },
    pos2: { x: number; y: number; z: number }
  ): boolean {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    const dz = Math.abs(pos1.z - pos2.z);
    return dx + dy + dz === 1;
  }

  private facePlayer(
    enemy: Enemy,
    enemyPos: { x: number; y: number; z: number },
    playerPos: { x: number; y: number; z: number }
  ) {
    if (playerPos.x > enemyPos.x) {
      enemy.setDirection('right');
    } else if (playerPos.x < enemyPos.x) {
      enemy.setDirection('left');
    } else if (playerPos.y > enemyPos.y) {
      enemy.setDirection('down');
    } else if (playerPos.y < enemyPos.y) {
      enemy.setDirection('up');
    }
  }
}

export class DefensiveBehavior implements EnemyBehavior {
  async act(enemy: Enemy, stage: Stage): Promise<void> {
    const player = stage.getPlayer();
    if (player) {
      const distance = stage.getDistance(enemy.getPosition(), player.getPosition());
      if (distance < 3) {
        moveRandomly(enemy, stage);
      } else {
        // その場で待機
      }
    }
  }
}
