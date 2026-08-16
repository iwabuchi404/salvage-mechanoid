import { Player } from '../entity/Player';
import { PlayerPresentationFactory } from '../presentation/player/PlayerPresentationFactory';
import { Vector3 } from '../types';

/**
 * Player エンティティの生成と組み立てを集約する Factory
 *
 * Game はこの Factory へ ID と開始位置を渡すだけでよく、
 * Player 本体と Presentation の組み立て詳細を知る必要がない。
 * 初期化失敗時には生成済み Entity を破棄して例外を再送する。
 *
 * C1: Player / Item の描画ライフサイクルを Presentation へ移す
 */
export class PlayerFactory {
  /**
   * Player を生成・初期化する
   * @param id エンティティID
   * @param startPosition 開始位置
   * @returns 初期化済みの Player（Presentation 含む）
   * @throws 初期化失敗時に生成済みリソースを破棄して例外を再送
   */
  static async create(id: string, startPosition: Vector3): Promise<Player> {
    const player = new Player(id, startPosition);

    try {
      await player.initialize();
      await PlayerPresentationFactory.create(player);
      return player;
    } catch (error) {
      try {
        player.destroy();
      } catch (destroyError) {
        console.error(`Failed to destroy player ${id}:`, destroyError);
      }
      throw error;
    }
  }
}
