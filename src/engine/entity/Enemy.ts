import { Entity } from './Entity';
import { TransformComponent } from './components/Transform';
import { HealthComponent } from './components/Health';
import { MovementComponent } from './components/Movement';
import { Vector3, EnemyType, EnemyBehavior, PlacedEnemy, Direction } from '../types';
import { EnemyBehaviorStrategy } from './ai/EnemyBehaviorStrategy';
import { EnemyBehaviorStrategyFactory } from './ai/EnemyBehaviorStrategyFactory';
import { EnemyActionContext } from './ai/EnemyActionContext';
import { EnemyActionContextImpl } from './ai/EnemyActionContextImpl';

/**
 * 敵エンティティクラス
 * 様々なタイプと行動パターンを持つ敵を表現
 *
 * AI ロジックは EnemyBehaviorStrategy へ委譲し、Enemy 本体は
 * ゲーム状態とコンポーネント管理に専念する。
 */
export class Enemy extends Entity {
  private enemyType: EnemyType;
  private behavior: EnemyBehavior;
  private level: number;
  private patrolRoute: Vector3[] | undefined;
  private triggerCondition: string | undefined;

  private strategy: EnemyBehaviorStrategy;
  private actionContext: EnemyActionContext;

  /**
   * コンストラクタ
   * @param placedEnemy 配置された敵データ
   */
  constructor(placedEnemy: PlacedEnemy) {
    super(placedEnemy.id, 'enemy');

    // タグを追加
    this.addTag('enemy');
    this.addTag(placedEnemy.type);
    this.addTag(`behavior_${placedEnemy.behavior}`);

    this.enemyType = placedEnemy.type;
    this.behavior = placedEnemy.behavior;
    this.level = placedEnemy.level;
    this.patrolRoute = placedEnemy.patrolRoute;
    this.triggerCondition = placedEnemy.triggerCondition;

    // Transform コンポーネントを追加
    this.addComponent(new TransformComponent(placedEnemy.x, placedEnemy.y, 0));

    // 敵タイプに応じたステータスを設定
    const stats = this.getEnemyStats();

    // Health コンポーネントを追加
    const healthComponent = new HealthComponent(
      stats.maxHealth,
      stats.maxHealth,
      500, // 無敵時間
      stats.defense
    );
    this.addComponent(healthComponent);

    // Movement コンポーネントを追加（敵は150msで移動、プレイヤーより速い）
    const movementComponent = new MovementComponent(
      stats.moveSpeed,
      150 // 移動アニメーション時間
    );
    this.addComponent(movementComponent);

    // 行動パターンに応じた Strategy を生成
    this.strategy = EnemyBehaviorStrategyFactory.create(
      placedEnemy.behavior,
      placedEnemy.patrolRoute
    );
    this.actionContext = new EnemyActionContextImpl();
  }

  /**
   * 現在の方向を取得
   */
  getDirection(): Direction {
    const movement = this.getComponent<MovementComponent>('movement');
    return movement ? movement.direction : 'down';
  }

  /**
   * 方向を設定
   * MovementComponent の方向を変更する（direction_changed イベント経由で
   * Presentation がテクスチャを切替する）
   * @param direction 新しい方向
   */
  setDirection(direction: Direction): void {
    const movement = this.getComponent<MovementComponent>('movement');
    if (movement) {
      movement.direction = direction;
    }
  }

  /**
   * 敵タイプに応じたステータスを取得
   */
  private getEnemyStats(): {
    maxHealth: number;
    defense: number;
    moveSpeed: number;
    attackPower: number;
  } {
    const levelMultiplier = 1 + (this.level - 1) * 0.2;

    switch (this.enemyType) {
      case EnemyType.SCOUT:
        return {
          maxHealth: Math.floor(30 * levelMultiplier),
          defense: Math.floor(3 * levelMultiplier),
          moveSpeed: 6,
          attackPower: Math.floor(5 * levelMultiplier),
        };

      case EnemyType.SOLDIER:
        return {
          maxHealth: Math.floor(50 * levelMultiplier),
          defense: Math.floor(5 * levelMultiplier),
          moveSpeed: 4,
          attackPower: Math.floor(10 * levelMultiplier),
        };

      case EnemyType.HEAVY:
        return {
          maxHealth: Math.floor(100 * levelMultiplier),
          defense: Math.floor(10 * levelMultiplier),
          moveSpeed: 2,
          attackPower: Math.floor(15 * levelMultiplier),
        };

      default:
        return {
          maxHealth: 50,
          defense: 5,
          moveSpeed: 4,
          attackPower: 10,
        };
    }
  }

  /**
   * 敵タイプを取得
   */
  getEnemyType(): EnemyType {
    return this.enemyType;
  }

  /**
   * 行動パターンを取得
   */
  getBehavior(): EnemyBehavior {
    return this.behavior;
  }

  /**
   * レベルを取得
   */
  getLevel(): number {
    return this.level;
  }

  /**
   * 巡回ルートを取得
   */
  getPatrolRoute(): Vector3[] | undefined {
    return this.patrolRoute;
  }

  /**
   * 更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // 親クラスのupdate()を呼び出してコンポーネントを更新
    super.update(deltaTime);

    // 体力チェック
    const health = this.getComponent<HealthComponent>('health');
    if (health && health.currentHp <= 0) {
      this.active = false;
    }
  }

  /**
   * ターンシステムから呼び出される行動メソッド
   * 行動パターンに応じた Strategy へ委譲する
   */
  async act(): Promise<void> {
    // 体力チェック
    const health = this.getComponent<HealthComponent>('health');
    if (health && health.currentHp <= 0) {
      this.active = false;
      return;
    }

    // Strategy へ委譲
    await this.strategy.act(this, this.actionContext);
  }
}
