import { Entity } from './Entity';
import { TransformComponent } from './components/Transform';
import { SpriteComponent } from './components/Sprite';
import { HealthComponent } from './components/Health';
import { MovementComponent } from './components/Movement';
import { Vector3, EnemyType, EnemyBehavior, PlacedEnemy } from '../types';

/**
 * 敵エンティティクラス
 * 様々なタイプと行動パターンを持つ敵を表現
 */
export class Enemy extends Entity {
  private enemyType: EnemyType;
  private behavior: EnemyBehavior;
  private level: number;
  private patrolRoute: Vector3[] | undefined;
  private triggerCondition: string | undefined;
  private patrolIndex = 0;
  private patrolDirection = 1;
  private waitTime = 0;

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

    // Movement コンポーネントを追加
    const movementComponent = new MovementComponent(
      stats.moveSpeed,
      250 // 移動間隔
    );
    this.addComponent(movementComponent);
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    // スプライトコンポーネントを追加
    const texturePath = this.getTexturePath();
    const spriteComponent = new SpriteComponent(texturePath, 'characters', { x: 0.5, y: 1.0 });
    this.addComponent(spriteComponent);

    console.log(`Enemy initialized: ${this.id} (${this.enemyType}, Lv.${this.level})`);
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
          defense: 0.05,
          moveSpeed: 6,
          attackPower: Math.floor(5 * levelMultiplier),
        };

      case EnemyType.SOLDIER:
        return {
          maxHealth: Math.floor(50 * levelMultiplier),
          defense: 0.1,
          moveSpeed: 4,
          attackPower: Math.floor(10 * levelMultiplier),
        };

      case EnemyType.HEAVY:
        return {
          maxHealth: Math.floor(100 * levelMultiplier),
          defense: 0.2,
          moveSpeed: 2,
          attackPower: Math.floor(15 * levelMultiplier),
        };

      case EnemyType.TURRET:
        return {
          maxHealth: Math.floor(80 * levelMultiplier),
          defense: 0.15,
          moveSpeed: 0, // 固定
          attackPower: Math.floor(12 * levelMultiplier),
        };

      case EnemyType.BOSS:
        return {
          maxHealth: Math.floor(200 * levelMultiplier),
          defense: 0.25,
          moveSpeed: 3,
          attackPower: Math.floor(20 * levelMultiplier),
        };

      default:
        return {
          maxHealth: 50,
          defense: 0.1,
          moveSpeed: 4,
          attackPower: 10,
        };
    }
  }

  /**
   * 敵タイプに応じたテクスチャパスを取得
   */
  private getTexturePath(): string {
    // 敵タイプごとのテクスチャマッピング
    // TODO: 敵タイプごとの専用画像を用意
    switch (this.enemyType) {
      case EnemyType.SCOUT:
      case EnemyType.SOLDIER:
      case EnemyType.HEAVY:
      case EnemyType.TURRET:
      case EnemyType.BOSS:
      default:
        return './teki_l.png'; // 暫定的に同じ画像を使用
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
   * AI更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   * @param playerPosition プレイヤーの位置
   */
  updateAI(deltaTime: number, playerPosition: Vector3): void {
    const health = this.getComponent<HealthComponent>('health');
    if (health && health.currentHp <= 0) {
      this.active = false;
      return;
    }

    switch (this.behavior) {
      case EnemyBehavior.STATIC:
        // 静止
        break;

      case EnemyBehavior.PATROL:
        this.updatePatrol(deltaTime);
        break;

      case EnemyBehavior.GUARD:
        this.updateGuard(deltaTime, playerPosition);
        break;

      case EnemyBehavior.AGGRESSIVE:
        this.updateAggressive(deltaTime, playerPosition);
        break;
    }
  }

  /**
   * 巡回行動の更新
   */
  private updatePatrol(deltaTime: number): void {
    if (!this.patrolRoute || this.patrolRoute.length === 0) {
      return;
    }

    // 待機時間がある場合は待機
    if (this.waitTime > 0) {
      this.waitTime -= deltaTime;
      return;
    }

    const transform = this.getComponent<TransformComponent>('transform');
    if (!transform) return;

    const currentPos = transform.position;
    const targetPos = this.patrolRoute[this.patrolIndex];

    // 目標地点に到達したか確認
    const distance = Math.abs(currentPos.x - targetPos.x) + Math.abs(currentPos.y - targetPos.y);
    if (distance < 0.5) {
      // 次の地点へ
      this.patrolIndex += this.patrolDirection;

      // 巡回ルートの端に到達したら折り返す
      if (this.patrolIndex >= this.patrolRoute.length) {
        this.patrolIndex = this.patrolRoute.length - 2;
        this.patrolDirection = -1;
      } else if (this.patrolIndex < 0) {
        this.patrolIndex = 1;
        this.patrolDirection = 1;
      }

      // 待機時間を設定
      this.waitTime = 1000; // 1秒待機
    }
  }

  /**
   * 警戒行動の更新
   */
  private updateGuard(deltaTime: number, playerPosition: Vector3): void {
    const transform = this.getComponent<TransformComponent>('transform');
    if (!transform) return;

    const currentPos = transform.position;
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - currentPos.x, 2) + Math.pow(playerPosition.y - currentPos.y, 2)
    );

    // プレイヤーが一定距離内に入ったら追跡モードに
    const detectionRange = 8;
    if (distance < detectionRange) {
      // TODO: 追跡行動の実装
      console.log(`Enemy ${this.id} detected player!`);
    }
  }

  /**
   * 積極的行動の更新
   */
  private updateAggressive(deltaTime: number, playerPosition: Vector3): void {
    // 常にプレイヤーを追跡
    // TODO: 追跡行動の実装
  }

  /**
   * 更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // 体力チェック
    const health = this.getComponent<HealthComponent>('health');
    if (health && health.currentHp <= 0) {
      this.active = false;
      console.log(`Enemy defeated: ${this.id}`);
    }
  }
}
