import { Entity } from '../../entity/Entity';
import { EnemyType } from '../../types';
import { EnemyPresentation } from './EnemyPresentation';

/**
 * Enemy の Presentation を生成するファクトリ
 *
 * Enemy 本体（ドメイン）と Presentation（描画）の組み立てを分離し、
 * Enemy が PixiJS や RendererSystem を知らなくて済むようにする。
 */
export class EnemyPresentationFactory {
  /**
   * Enemy の Presentation を生成・初期化する
   * @param entity 対象の Enemy エンティティ
   * @param enemyType 敵タイプ
   * @returns 初期化済みの EnemyPresentation
   */
  static async create(entity: Entity, enemyType: EnemyType): Promise<EnemyPresentation> {
    const existing = entity.getComponent<EnemyPresentation>('enemy-presentation');
    if (existing) return existing;

    const presentation = new EnemyPresentation(enemyType);
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
