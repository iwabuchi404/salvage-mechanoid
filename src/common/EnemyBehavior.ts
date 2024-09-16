import { Enemy } from './Enemy';
import { Stage } from './Stage';

import { EnemyBehavior } from './types';

export class RandomMoveBehavior implements EnemyBehavior {
  async act(enemy: Enemy, stage: Stage): Promise<void> {
    await enemy.moveRandomly(stage);
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
      const distance = stage.getDistance(enemy.getPosition(), player.getPosition());

      if (distance <= this.chaseDistance) {
        // プレイヤーが追跡範囲内にいる場合、追いかける
        const path = stage.findPath(enemy.getPosition(), player.getPosition());
        // console.log(path);
        if (path.length > 1) {
          // パスの最初のステップに移動
          const nextStep = path[1]; // path[0]は現在の位置なので、path[1]を使用
          await stage.moveCharacter(enemy, nextStep.x, nextStep.y, nextStep.z);
        } else if (path.length === 1) {
          // プレイヤーに隣接している場合、攻撃を行う
          await enemy.attack();
        }
      } else {
        // プレイヤーが追跡範囲外の場合、ランダムに移動
        await enemy.moveRandomly(stage);
      }
    }
  }
}

export class DefensiveBehavior implements EnemyBehavior {
  async act(enemy: Enemy, stage: Stage): Promise<void> {
    const player = stage.getPlayer();
    if (player) {
      const distance = stage.getDistance(enemy.getPosition(), player.getPosition());
      if (distance < 3) {
        await enemy.moveRandomly(stage);
      } else {
        // その場で待機
      }
    }
  }
}
