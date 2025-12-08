import { Entity } from './Entity';
import { TransformComponent } from './components/Transform';
import { SpriteComponent } from './components/Sprite';
import { HealthComponent } from './components/Health';
import { MovementComponent } from './components/Movement';
import { Vector3, EnemyType, EnemyBehavior, PlacedEnemy, Direction } from '../types';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { EntitySystem } from './EntitySystem';
import { WorldSystem } from '../world/WorldSystem';
import { RendererSystem } from '../graphics/RendererSystem';
import * as PIXI from 'pixi.js';

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

  // TURRETタイプ用のグラフィックス
  private turretGraphics: PIXI.Graphics | null = null;

  // 方向別テクスチャパス（敵タイプごとに異なる）
  private texturePaths: Record<Direction, string> = {
    up: './robo02_r.png',
    down: './robo02_l.png',
    left: './robo02_l.png',
    right: './robo02_r.png',
  };

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
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    // 敵タイプに応じたテクスチャパスを設定
    this.setupTexturePathsForType();

    // TURRETタイプの場合は赤い丸で表示
    if (this.enemyType === EnemyType.TURRET) {
      this.createTurretGraphics();
    } else {
      // スプライトコンポーネントを追加
      const texturePath = this.getTexturePath();
      const spriteComponent = new SpriteComponent(texturePath, 'characters', { x: 0.5, y: 1.0 });
      this.addComponent(spriteComponent);
    }

    // 親クラスの initialize() を呼び出してコンポーネントを初期化
    await super.initialize();

    // イベントリスナーを設定
    this.setupEventListeners();
  }

  /**
   * TURRETタイプ用のグラフィックスを作成
   */
  private createTurretGraphics(): void {
    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (!rendererSystem) return;

    const transform = this.getComponent<TransformComponent>('transform');
    if (!transform) return;

    // 赤い丸を描画（アイテムより大きい）
    const graphics = new PIXI.Graphics();
    graphics.circle(0, 0, 16); // 半径16（アイテムは8）
    graphics.fill(0xff0000); // 赤色
    graphics.stroke({ width: 3, color: 0x880000 }); // 暗い赤の枠線

    // 座標変換
    const coordSystem = rendererSystem.getCoordinateSystem();
    const camera = rendererSystem.getCamera();
    const pos = transform.position;
    const screenPos = coordSystem.isometricToScreen(pos.x, pos.y, pos.z);

    // ベーススクリーン座標を保存
    (graphics as any).__baseScreenX = screenPos.x;
    (graphics as any).__baseScreenY = screenPos.y - 16; // 少し上にオフセット

    // カメラオフセットを適用
    graphics.x = screenPos.x - camera.x;
    graphics.y = screenPos.y - camera.y - 16;

    // 深度ソート用のzIndex（SpriteComponentと同じ計算式）
    const baseZIndex = (pos.y + pos.x) * 1000;
    graphics.zIndex = baseZIndex + pos.z * 100;

    // グラフィックスを保存
    this.turretGraphics = graphics;

    // characters レイヤーに追加
    const layer = rendererSystem.getLayer('characters');
    if (layer) {
      layer.addChild(graphics);
    }
  }

  /**
   * 敵タイプに応じたテクスチャパスを設定
   */
  private setupTexturePathsForType(): void {
    switch (this.enemyType) {
      case EnemyType.SCOUT:
        this.texturePaths = {
          up: './robo02_r.png',
          down: './robo02_l.png',
          left: './robo02_l.png',
          right: './robo02_r.png',
        };
        break;
      case EnemyType.SOLDIER:
        this.texturePaths = {
          up: './robo03_r.png',
          down: './robo03_l.png',
          left: './robo03_l.png',
          right: './robo03_r.png',
        };
        break;
      case EnemyType.HEAVY:
        this.texturePaths = {
          up: './robo02_r.png',
          down: './robo02_l.png',
          left: './robo02_l.png',
          right: './robo02_r.png',
        };
        break;
      case EnemyType.TURRET:
        this.texturePaths = {
          up: './robo03_r.png',
          down: './robo03_l.png',
          left: './robo03_l.png',
          right: './robo03_r.png',
        };
        break;
      case EnemyType.BOSS:
        this.texturePaths = {
          up: './robo02_r.png',
          down: './robo02_l.png',
          left: './robo02_l.png',
          right: './robo02_r.png',
        };
        break;
      default:
        // デフォルトは robo02
        break;
    }
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (!eventSystem) return;

    // 方向変更イベント - テクスチャを変更
    eventSystem.on('direction_changed', (data) => {
      if (data.entityId === this.id) {
        this.updateDirectionTexture(data.direction as Direction);
      }
    });
  }

  /**
   * 方向に応じてテクスチャを更新
   * @param direction 新しい方向
   */
  private updateDirectionTexture(direction: Direction): void {
    const sprite = this.getComponent<SpriteComponent>('sprite');
    if (!sprite) return;

    const texturePath = this.texturePaths[direction];
    if (texturePath) {
      sprite.changeTexture(texturePath);
    }
  }

  /**
   * 現在の方向を取得
   */
  getDirection(): Direction {
    const movement = this.getComponent<MovementComponent>('movement');
    return movement ? movement.direction : 'down';
  }

  /**
   * 方向を設定（テクスチャも更新）
   * @param direction 新しい方向
   */
  setDirection(direction: Direction): void {
    const movement = this.getComponent<MovementComponent>('movement');
    if (movement) {
      movement.direction = direction;
    }
    this.updateDirectionTexture(direction);
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
    switch (this.enemyType) {
      case EnemyType.SCOUT:
        return './robo02_l.png';
      case EnemyType.SOLDIER:
        return './robo03_l.png';
      case EnemyType.HEAVY:
        return './robo02_l.png';
      case EnemyType.TURRET:
        return './robo03_l.png';
      case EnemyType.BOSS:
        return './robo02_l.png';
      default:
        return './robo02_l.png';
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
   * @param _deltaTime 前回のフレームからの経過時間（ミリ秒）
   * @param _playerPosition プレイヤーの位置
   */
  updateAI(_deltaTime: number, _playerPosition: Vector3): void {
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
        this.updatePatrol(_deltaTime);
        break;

      case EnemyBehavior.GUARD:
        this.updateGuard(_deltaTime, _playerPosition);
        break;

      case EnemyBehavior.AGGRESSIVE:
        this.updateAggressive();
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
  private updateGuard(_deltaTime: number, _playerPosition: Vector3): void {
    const transform = this.getComponent<TransformComponent>('transform');
    if (!transform) return;

    // プレイヤーが一定距離内に入ったら追跡モードに
    // この処理はact()で行うため、ここでは何もしない
  }

  /**
   * 積極的行動の更新
   */
  private updateAggressive(): void {
    // 常にプレイヤーを追跡
    // この処理はact()で行うため、ここでは何もしない
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

    // TURRETグラフィックスの可視性を更新
    if (this.turretGraphics) {
      this.turretGraphics.visible = this.active;
    }
  }

  /**
   * 破棄処理
   */
  override destroy(): void {
    // TURRETグラフィックスを削除
    if (this.turretGraphics && this.turretGraphics.parent) {
      this.turretGraphics.parent.removeChild(this.turretGraphics);
      this.turretGraphics.destroy();
      this.turretGraphics = null;
    }

    super.destroy();
  }

  /**
   * ターンシステムから呼び出される行動メソッド
   * 敵のAI行動を実行する
   */
  async act(): Promise<void> {
    // 体力チェック
    const health = this.getComponent<HealthComponent>('health');
    if (health && health.currentHp <= 0) {
      this.active = false;
      return;
    }

    // プレイヤーの位置を取得
    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) {
      return;
    }

    // 行動パターンに応じた行動を実行
    switch (this.behavior) {
      case EnemyBehavior.STATIC:
        // 静止 - 移動しないがプレイヤーの方向を向く
        this.faceTowardsPlayer(playerPosition);
        break;

      case EnemyBehavior.PATROL:
        await this.executePatrolAction();
        break;

      case EnemyBehavior.GUARD:
        await this.executeGuardAction(playerPosition);
        break;

      case EnemyBehavior.AGGRESSIVE:
        await this.executeAggressiveAction(playerPosition);
        break;

      default:
        break;
    }
  }

  /**
   * プレイヤーの位置を取得
   */
  private getPlayerPosition(): Vector3 | null {
    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity');
    if (!entitySystem) return null;

    const players = entitySystem.getEntitiesByTag('player');
    if (players.length === 0) return null;

    const player = players[0];
    const transform = player.getComponent<TransformComponent>('transform');
    return transform ? transform.position : null;
  }

  /**
   * 巡回行動を実行
   */
  private async executePatrolAction(): Promise<void> {
    const transform = this.getComponent<TransformComponent>('transform');
    const movement = this.getComponent<MovementComponent>('movement');
    if (!transform || !movement) return;

    // パトロールルートがない場合はランダム移動
    if (!this.patrolRoute || this.patrolRoute.length === 0) {
      await this.moveRandomly(movement);
      return;
    }

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
    } else {
      // 目標地点に向かって移動
      const direction = this.getDirectionToTarget(currentPos, targetPos);
      if (direction) {
        // 移動前にスプライト方向を更新
        this.setDirection(direction);
        movement.moveInDirection(direction);
        // 移動アニメーションを待つ
        await this.waitForMovement(movement);
      }
    }
  }

  /**
   * 警戒行動を実行
   */
  private async executeGuardAction(playerPosition: Vector3): Promise<void> {
    const transform = this.getComponent<TransformComponent>('transform');
    const movement = this.getComponent<MovementComponent>('movement');
    if (!transform || !movement) return;

    const currentPos = transform.position;
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - currentPos.x, 2) + Math.pow(playerPosition.y - currentPos.y, 2)
    );

    // プレイヤーが一定距離内に入ったら追跡
    const detectionRange = 8;
    if (distance < detectionRange) {
      await this.moveTowardsPlayer(currentPos, playerPosition, movement);
    } else {
      // 範囲外でもプレイヤーの方向を向く
      const direction = this.getDirectionToTarget(currentPos, playerPosition);
      if (direction) {
        this.setDirection(direction);
      }
    }
  }

  /**
   * 積極的行動を実行
   */
  private async executeAggressiveAction(playerPosition: Vector3): Promise<void> {
    const transform = this.getComponent<TransformComponent>('transform');
    const movement = this.getComponent<MovementComponent>('movement');
    if (!transform || !movement) return;

    const currentPos = transform.position;
    await this.moveTowardsPlayer(currentPos, playerPosition, movement);
  }

  /**
   * プレイヤーの方向を向く（移動しない）
   */
  private faceTowardsPlayer(playerPosition: Vector3): void {
    const transform = this.getComponent<TransformComponent>('transform');
    if (!transform) return;

    const currentPos = transform.position;
    const direction = this.getDirectionToTarget(currentPos, playerPosition);
    if (direction) {
      this.setDirection(direction);
    }
  }

  /**
   * プレイヤーに向かって移動（A*パスファインディングを使用）
   */
  private async moveTowardsPlayer(
    currentPos: Vector3,
    playerPosition: Vector3,
    movement: MovementComponent
  ): Promise<void> {
    // WorldSystemからA*パスファインディングを使用
    const worldSystem = Engine.instance.getSystem<WorldSystem>('world');
    if (!worldSystem) {
      // WorldSystemがない場合は単純な方向計算を使用
      const direction = this.getDirectionToTarget(currentPos, playerPosition);
      if (direction) {
        const moved = movement.moveInDirection(direction);
        if (moved) {
          await this.waitForMovement(movement);
        }
      }
      return;
    }

    // プレイヤーとの距離をチェック（整数座標で計算）
    const intCurrentPos = {
      x: Math.round(currentPos.x),
      y: Math.round(currentPos.y),
      z: Math.round(currentPos.z),
    };
    const intPlayerPos = {
      x: Math.round(playerPosition.x),
      y: Math.round(playerPosition.y),
      z: Math.round(playerPosition.z),
    };

    const distance = worldSystem.getDistance(intCurrentPos, intPlayerPos);

    // 隣接している場合は攻撃（移動しない）
    if (distance <= 1) {
      // プレイヤーの方向を向く
      const direction = this.getDirectionToTarget(intCurrentPos, intPlayerPos);
      if (direction) {
        // 方向を変更（テクスチャ更新のため）
        this.setDirection(direction);
      }
      // 攻撃リクエストを発行
      const eventSystem = Engine.instance.getSystem<EventSystem>('event');
      eventSystem?.emit('enemy_attack_requested', {
        enemyId: this.id,
        targetId: 'player',
      });
      // 攻撃処理の完了を待つ（アニメーション・ダメージ適用のため）
      await this.waitForAttack();
      return;
    }

    // プレイヤーの隣接マスをゴールとして探索（プレイヤー自身の位置は他エンティティとして判定されるため）
    const adjacentPositions = [
      { x: intPlayerPos.x - 1, y: intPlayerPos.y, z: intPlayerPos.z },
      { x: intPlayerPos.x + 1, y: intPlayerPos.y, z: intPlayerPos.z },
      { x: intPlayerPos.x, y: intPlayerPos.y - 1, z: intPlayerPos.z },
      { x: intPlayerPos.x, y: intPlayerPos.y + 1, z: intPlayerPos.z },
    ];

    // 最も近い到達可能な隣接マスを探す
    let bestPath: Vector3[] = [];
    let bestDistance = Infinity;

    for (const adjPos of adjacentPositions) {
      // 自分自身とプレイヤーを除外してパスを探索
      const path = worldSystem.findPath(intCurrentPos, adjPos, 20, this.id);
      if (path.length > 1 && path.length < bestDistance) {
        bestPath = path;
        bestDistance = path.length;
      }
    }

    if (bestPath.length > 1) {
      // path[0]は現在の位置なので、path[1]を使用
      const nextStep = bestPath[1];
      const direction = this.getDirectionFromPositions(intCurrentPos, nextStep);

      if (direction) {
        // 移動前にスプライト方向を更新
        this.setDirection(direction);
        const moved = movement.moveInDirection(direction);
        if (moved) {
          await this.waitForMovement(movement);
        }
      }
    } else {
      // パスが見つからない場合、単純な方向計算で移動を試みる
      const direction = this.getDirectionToTarget(intCurrentPos, intPlayerPos);
      if (direction) {
        // 移動前にスプライト方向を更新
        this.setDirection(direction);
        const moved = movement.moveInDirection(direction);
        if (moved) {
          await this.waitForMovement(movement);
        } else {
          // 移動できない場合はランダムに移動
          await this.moveRandomly(movement);
        }
      }
    }
  }

  /**
   * ランダムに移動
   */
  private async moveRandomly(movement: MovementComponent): Promise<void> {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    const randomDirection = directions[Math.floor(Math.random() * directions.length)];

    // 移動前にスプライト方向を更新
    this.setDirection(randomDirection);
    const moved = movement.moveInDirection(randomDirection);
    if (moved) {
      await this.waitForMovement(movement);
    }
  }

  /**
   * 2つの位置から方向を取得
   */
  private getDirectionFromPositions(from: Vector3, to: Vector3): Direction | null {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (dx > 0) return 'right';
    if (dx < 0) return 'left';
    if (dy > 0) return 'down';
    if (dy < 0) return 'up';

    return null;
  }

  /**
   * ターゲットへの方向を取得（単純な方向計算）
   */
  private getDirectionToTarget(from: Vector3, to: Vector3): Direction | null {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // 距離が最も大きい方向に移動
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else if (Math.abs(dy) > 0) {
      return dy > 0 ? 'down' : 'up';
    }

    return null;
  }

  /**
   * 移動完了を待つ
   */
  private async waitForMovement(movement: MovementComponent): Promise<void> {
    // 移動アニメーションが完了するまで待つ（最大500msでタイムアウト）
    const maxWaitTime = 500;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkMovement = () => {
        const elapsed = Date.now() - startTime;

        if (!movement.isMoving) {
          resolve();
        } else if (elapsed > maxWaitTime) {
          resolve();
        } else {
          setTimeout(checkMovement, 16); // 約60fpsでチェック
        }
      };
      setTimeout(checkMovement, 16);
    });
  }

  /**
   * 攻撃処理の完了を待つ
   */
  private async waitForAttack(): Promise<void> {
    // 攻撃アニメーション・ダメージ処理の完了を待つ（200ms固定）
    return new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
  }
}
