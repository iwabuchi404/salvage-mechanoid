import { Obstacle } from '../entity/Obstacle';
import { PlacedObstacle } from '../types';

/**
 * Obstacle エンティティの生成と組み立てを集約する Factory
 *
 * Game はこの Factory へ PlacedObstacle を渡すだけでよく、
 * Obstacle の内部構成（Health/Sprite/Transform）を知る必要がない。
 * 初期化失敗時には生成済み Entity を破棄して例外を再送する。
 */
export class ObstacleFactory {
  /**
   * Obstacle を生成・初期化する
   * @param placedObstacle 配置された障害物データ
   * @returns 初期化済みの Obstacle
   * @throws 初期化失敗時に生成済み Entity を破棄して例外を再送
   */
  static async create(placedObstacle: PlacedObstacle): Promise<Obstacle> {
    const obstacle = new Obstacle(placedObstacle);

    try {
      await obstacle.initialize();
      return obstacle;
    } catch (error) {
      try {
        obstacle.destroy();
      } catch (destroyError) {
        console.error(`Failed to destroy obstacle ${placedObstacle.id}:`, destroyError);
      }
      throw error;
    }
  }
}
