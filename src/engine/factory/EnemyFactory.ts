import { Enemy } from '../entity/Enemy';
import { EnemyPresentationFactory } from '../presentation/enemy/EnemyPresentationFactory';
import { resolveEnemyStats } from '../entity/enemy/EnemyStatProfile';
import { PlacedEnemy } from '../types';

/**
 * Enemy エンティティの生成と組み立てを集約する Factory
 *
 * Game はこの Factory へ PlacedEnemy を渡すだけでよく、
 * Enemy 本体と Presentation の組み立て詳細を知る必要がない。
 * 初期化失敗時には生成済み Entity を破棄して例外を再送する。
 */
export class EnemyFactory {
  /**
   * Enemy を生成・初期化する
   * @param placedEnemy 配置された敵データ
   * @returns 初期化済みの Enemy（Presentation 含む）
   * @throws 初期化失敗時に生成済みリソースを破棄して例外を再送
   */
  static async create(placedEnemy: PlacedEnemy): Promise<Enemy> {
    // C2: ステータスを純データプロファイルから解決して注入する
    const stats = resolveEnemyStats(placedEnemy.type, placedEnemy.level);
    const enemy = new Enemy(placedEnemy, stats);

    try {
      await enemy.initialize();
      await EnemyPresentationFactory.create(enemy, placedEnemy.type);
      return enemy;
    } catch (error) {
      // 初期化失敗時は生成済み Enemy を破棄して例外を再送
      try {
        enemy.destroy();
      } catch (destroyError) {
        console.error(`Failed to destroy enemy ${placedEnemy.id}:`, destroyError);
      }
      throw error;
    }
  }
}
