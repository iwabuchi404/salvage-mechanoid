import { Entity } from './Entity';
import { TransformComponent } from './components/Transform';
import { SpriteComponent } from './components/Sprite';
import { HealthComponent } from './components/Health';
import { Vector3, ObstacleType, PlacedObstacle } from '../types';

/**
 * 障害物エンティティクラス
 * 遮蔽物、破壊可能オブジェクト、インタラクティブオブジェクトを表現
 */
export class Obstacle extends Entity {
  private obstacleType: ObstacleType;
  private destructible: boolean;

  /**
   * コンストラクタ
   * @param placedObstacle 配置された障害物データ
   */
  constructor(placedObstacle: PlacedObstacle) {
    super(placedObstacle.id, 'obstacle');

    // タグを追加
    this.addTag('obstacle');
    this.addTag(placedObstacle.type);

    this.obstacleType = placedObstacle.type;
    this.destructible = placedObstacle.destructible;

    // Transform コンポーネントを追加
    this.addComponent(new TransformComponent(placedObstacle.x, placedObstacle.y, 0));

    // 破壊可能な場合は Health コンポーネントを追加
    if (this.destructible && placedObstacle.health) {
      const healthComponent = new HealthComponent(
        placedObstacle.health,
        placedObstacle.health,
        0, // 無敵時間なし
        0 // 防御力なし
      );
      this.addComponent(healthComponent);
    }
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    // スプライトコンポーネントを追加
    // アンカーを { x: 0.5, y: 1.0 } に設定して、スプライトの下端がタイルの位置に合うようにする
    // 深度ソートを正しく行うため、キャラクターと同じレイヤー（characters）に配置
    const texturePath = this.getTexturePath();
    const spriteComponent = new SpriteComponent(texturePath, 'characters', { x: 0.5, y: 1.0 });
    this.addComponent(spriteComponent);

    // 親クラスの initialize() を呼び出してコンポーネントを初期化
    await super.initialize();
  }

  /**
   * 障害物タイプに応じたテクスチャパスを取得
   */
  private getTexturePath(): string {
    // 障害物タイプごとのテクスチャマッピング
    // 現在はobj01.pngのみ使用（obj02.pngはポータル専用）
    return './obj01.png';
  }

  /**
   * 障害物タイプを取得
   */
  getObstacleType(): ObstacleType {
    return this.obstacleType;
  }

  /**
   * 破壊可能かどうかを取得
   */
  isDestructible(): boolean {
    return this.destructible;
  }

  /**
   * 障害物を破壊
   */
  destroy(): void {
    if (this.destructible) {
      const health = this.getComponent<HealthComponent>('health');
      if (health) {
        health.takeDamage(health.currentHp);
      }
      this.active = false;
      console.log(`Obstacle destroyed: ${this.id}`);
    }
  }

  /**
   * 更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // 親クラスのupdate()を呼び出してコンポーネントを更新
    super.update(deltaTime);

    // 破壊可能な障害物の体力チェック
    if (this.destructible) {
      const health = this.getComponent<HealthComponent>('health');
      if (health && health.currentHp <= 0) {
        this.active = false;
      }
    }
  }
}
