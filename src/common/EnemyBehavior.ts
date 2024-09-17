import { Enemy } from './Enemy';
import { Stage } from './Stage';
import { Direction } from './types';
import { EnemyBehavior } from './types';

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

// export class AggressiveBehavior implements EnemyBehavior {
//   async act(enemy: Enemy, stage: Stage): Promise<void> {
//     const player = stage.getPlayer();
//     if (player) {
//       const path = stage.findPath(enemy.getPosition(), player.getPosition());
//       if (path.length > 4) {
//         await stage.moveCharacter(enemy, path[0].x, path[0].y, path[0].z);
//       }
//     }
//   }
// }
export class AggressiveBehavior implements EnemyBehavior {
  private chaseDistance: number;

  constructor(chaseDistance = 5) {
    this.chaseDistance = chaseDistance;
  }

  async act(enemy: Enemy, stage: Stage): Promise<void> {
    const player = stage.getPlayer();
    if (player) {
      const enemyPos = enemy.getPosition();
      const playerPos = player.getPosition();
      const distance = stage.getDistance(enemyPos, playerPos);

      if (distance <= this.chaseDistance) {
        // プレイヤーが追跡範囲内にいる場合
        if (this.isAdjacent(enemyPos, playerPos)) {
          // プレイヤーに隣接している場合
          this.facePlayer(enemy, enemyPos, playerPos);
          await enemy.attack();
        } else {
          // プレイヤーに隣接していない場合、追いかける
          const path = stage.findPath(enemyPos, playerPos);
          if (path.length > 1) {
            const nextStep = path[1]; // path[0]は現在の位置なので、path[1]を使用
            await stage.moveCharacter(enemy, nextStep.x, nextStep.y, nextStep.z);
          }
        }
      } else {
        // プレイヤーが追跡範囲外の場合、ランダムに移動
        moveRandomly(enemy, stage);
        // await enemy.moveRandomly(stage);
      }
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
