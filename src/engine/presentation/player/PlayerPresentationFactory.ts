import { Entity } from '../../entity/Entity';
import { PlayerPresentation } from './PlayerPresentation';

/**
 * Player の Presentation を生成するファクトリ
 *
 * Player 本体（ドメイン）と Presentation（描画）の組み立てを分離し、
 * Player が PixiJS や RendererSystem を知らなくて済むようにする。
 *
 * C1: Player / Item の描画ライフサイクルを Presentation へ移す
 */
export class PlayerPresentationFactory {
  /**
   * Player の Presentation を生成・初期化する
   * @param entity 対象の Player エンティティ
   * @returns 初期化済みの PlayerPresentation
   */
  static async create(entity: Entity): Promise<PlayerPresentation> {
    const existing = entity.getComponent<PlayerPresentation>('player-presentation');
    if (existing) return existing;

    const presentation = new PlayerPresentation();
    entity.addComponent(presentation);

    try {
      await presentation.initialize();
      return presentation;
    } catch (error) {
      entity.removeComponent(presentation.type);
      throw error;
    }
  }
}
