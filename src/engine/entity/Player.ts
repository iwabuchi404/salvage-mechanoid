import { Entity } from '../../engine/entity/Entity';
import { Component } from './Component';
import { TransformComponent } from '../../engine/entity/components/Transform';
import { SpriteComponent } from '../../engine/entity/components/Sprite';
import { MovementComponent } from '../../engine/entity/components/Movement';
import { HealthComponent } from '../../engine/entity/components/Health';
import { Vector3, Direction } from '../../engine/types';
import { Camera } from '../../engine/graphics/Camera';
import { Engine } from '../../engine/Engine';
import { EventSystem } from '../../engine/events/EventSystem';
import { EntitySystem } from '../../engine/entity/EntitySystem';
import { useGameStore } from '../../stores/gameStore';
import { RENDER_CONFIG } from '../../engine/graphics/RenderConfig';
import { RendererSystem } from '../../engine/graphics/RendererSystem';
import { WorldSystem } from '../../engine/world/WorldSystem';

/**
 * プレイヤークラス - プレイヤーのエンティティ
 */
export class Player extends Entity {
  // カメラ参照
  private camera: Camera | null = null;

  // エネルギー
  private currentEnergy: number;
  private maxEnergy: number;

  // 視野半径（何マス先まで見えるか）
  private _viewRadius = 8;

  // ゲームストア
  private gameStore = useGameStore();

  // 方向別テクスチャパス
  private static readonly TEXTURE_PATHS: Record<Direction, string> = {
    up: './robo01bk_r.png',
    down: './robo01_l.png',
    left: './robo01bk_l.png',
    right: './robo01_r.png',
  };

  /**
   * コンストラクタ
   * @param id エンティティID
   * @param startPosition 開始位置
   */
  constructor(id: string, startPosition: Vector3) {
    super(id, 'player');

    // タグを追加
    this.addTag('player');

    // エネルギー設定
    this.maxEnergy = this.gameStore.player.status.maxEnergy;
    this.currentEnergy = this.gameStore.player.status.energy;

    // 視野半径設定
    const storeViewRadius = this.gameStore.player.status.viewRadius;
    this._viewRadius = storeViewRadius !== undefined ? storeViewRadius : 8;
    console.log(
      `Player: Initialized with viewRadius: ${this._viewRadius} (from store: ${storeViewRadius})`
    );

    // コンポーネントを追加
    this.addComponent(new TransformComponent(startPosition.x, startPosition.y, startPosition.z));
    this.gameStore.player.position = { ...startPosition };
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    // テクスチャの読み込み
    const direction: Direction = 'down'; // デフォルト方向
    const texturePath = Player.TEXTURE_PATHS[direction];

    const spriteComponent = new SpriteComponent(texturePath, 'characters', { x: 0.5, y: 1.0 });
    this.addComponent(spriteComponent);

    // 移動コンポーネントを追加
    const movementComponent = new MovementComponent(4, 250);
    this.addComponent(movementComponent);

    // 体力コンポーネントを追加
    const healthComponent = new HealthComponent(
      this.gameStore.player.status.maxHp,
      this.gameStore.player.status.hp,
      500, // 無敵時間（ミリ秒）
      this.gameStore.player.status.defense, // 防御力（整数値）
      0 // HP自動回復なし
    );
    this.addComponent(healthComponent);

    // エネルギーコンポーネントを追加
    const energyComponent = new EnergyComponent(this.maxEnergy, this.currentEnergy);
    this.addComponent(energyComponent);

    // 親クラスの initialize() を呼び出してコンポーネントを初期化
    await super.initialize();

    // イベントリスナーを設定
    this.setupEventListeners();
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (!eventSystem) return;

    // 移動完了イベント
    eventSystem.on('move_completed', (data) => {
      if (data.entityId === this.id) {
        // ゲームストアの位置を更新
        this.gameStore.player.position = { ...data.position };

        // 移動時のエネルギー消費
        this.consumeEnergy(1);

        // 現在のタイルのイベントをチェック
        this.checkTileEvent(data.position);

        // アイテム衝突判定
        this.checkItemCollision(data.position);
      }
    });

    // 方向変更イベント - テクスチャを変更
    eventSystem.on('direction_changed', (data) => {
      if (data.entityId === this.id) {
        this.updateDirectionTexture(data.direction as Direction);
      }
    });

    // 体力変更イベント
    eventSystem.on('health_changed', (data) => {
      if (data.entityId === this.id) {
        // ゲームストアのHPを更新
        this.gameStore.player.status.hp = data.currentHp;

        // HPがゼロになった場合
        if (data.currentHp <= 0) {
          this.onDeath();
        }
      }
    });

    // エネルギー変更イベント
    eventSystem.on('energy_changed', (data) => {
      if (data.entityId === this.id) {
        // ゲームストアのエネルギーを更新
        this.gameStore.player.status.energy = data.currentEnergy;

        // エネルギー状態に応じた効果
        this.updateEnergyEffects(data.percentage);
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

    const texturePath = Player.TEXTURE_PATHS[direction];
    if (texturePath) {
      sprite.changeTexture(texturePath);
    }
  }

  /**
   * 指定方向に移動
   * @param direction 移動方向
   * @returns 移動が成功したかどうか
   */
  move(direction: Direction): boolean {
    // エネルギーチェック
    if (this.currentEnergy <= 0) {
      this.handleEmergencyShutdown();
      return false;
    }

    // 移動コンポーネントを取得
    const movement = this.getComponent<MovementComponent>('movement');
    if (!movement) {
      return false;
    }

    // 指定方向に移動
    return movement.moveInDirection(direction);
  }

  /**
   * 方向転換（1ターン消費、エネルギー消費なし）
   * @param direction 新しい方向
   * @returns 方向転換が成功したかどうか
   */
  turn(direction: Direction): boolean {
    // 移動コンポーネントを取得
    const movement = this.getComponent<MovementComponent>('movement');
    if (!movement) {
      return false;
    }

    // 現在の方向と同じ場合は何もしない
    if (movement.direction === direction) {
      return false;
    }

    // 方向を変更
    movement.direction = direction;

    // ターン終了イベントを発行（1ターン消費）
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('player_turn_ended', {
        playerId: this.id,
      });
    }

    return true;
  }

  /**
   * 現在の方向を取得
   * @returns 現在の方向
   */
  getDirection(): Direction {
    const movement = this.getComponent<MovementComponent>('movement');
    return movement ? movement.direction : 'down';
  }

  /**
   * 攻撃
   */
  async attack(): Promise<number> {
    // エネルギーチェック
    if (!this.consumeEnergy(2)) {
      return 0;
    }

    // 攻撃アニメーション
    const sprite = this.getComponent<SpriteComponent>('sprite');
    if (sprite) {
      sprite.setTint(0xff0000);
      await new Promise((resolve) => setTimeout(resolve, 100));
      sprite.setTint(0xffffff);
    }

    // 攻撃方向の敵を検索
    const transform = this.getComponent<TransformComponent>('transform');
    const movement = this.getComponent<MovementComponent>('movement');

    if (!transform || !movement) return 0;

    const position = transform.position;
    const direction = movement.direction;

    // 攻撃方向のタイルを計算
    let targetX = position.x;
    let targetY = position.y;

    switch (direction) {
      case 'up':
        targetY--;
        break;
      case 'down':
        targetY++;
        break;
      case 'left':
        targetX--;
        break;
      case 'right':
        targetX++;
        break;
    }

    // 攻撃力を計算
    const attackPower = this.gameStore.player.status.strength;

    // 攻撃イベントを発行
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('player_attacked', {
        attackerId: this.id,
        position: { x: targetX, y: targetY, z: position.z },
        power: attackPower,
      });
    }

    return attackPower;
  }

  /**
   * エネルギーを消費
   * @param amount 消費量
   * @returns 消費が成功したかどうか
   */
  consumeEnergy(amount: number): boolean {
    // エネルギーコンポーネントを取得
    const energy = this.getComponent<EnergyComponent>('energy');
    if (!energy) return false;

    // エネルギーを消費
    const success = energy.consume(amount);

    if (success) {
      // ゲームストアを更新
      this.gameStore.player.status.energy = energy.getCurrentEnergy();

      // エネルギー状態に応じた効果
      this.updateEnergyEffects(energy.getEnergyPercentage());
    }

    return success;
  }

  /**
   * エネルギーを回復
   * @param amount 回復量
   */
  restoreEnergy(amount: number): void {
    // エネルギーコンポーネントを取得
    const energy = this.getComponent<EnergyComponent>('energy');
    if (!energy) return;

    // エネルギーを回復
    energy.restore(amount);

    // ゲームストアを更新
    this.gameStore.player.status.energy = energy.getCurrentEnergy();

    // エネルギー状態に応じた効果
    this.updateEnergyEffects(energy.getEnergyPercentage());
  }

  /**
   * エネルギー状態に応じた効果を更新（旧システムから流用）
   * @param _percentage エネルギーのパーセンテージ（0〜100）
   */
  private updateEnergyEffects(_percentage: number): void {
    const energy = this.currentEnergy;
    const maxEnergy = this.maxEnergy;

    // エネルギーが0の場合は緊急シャットダウン
    if (energy === 0) {
      this.handleEmergencyShutdown();
      return;
    }

    // エネルギーが15%以下の場合はクリティカルモード
    if (energy <= maxEnergy * 0.15) {
      // HP減少効果（1ダメージ）
      const health = this.getComponent<HealthComponent>('health');
      if (health) {
        health.takeDamage(1);

        // HPが0になった場合はゲームオーバー
        if (health.currentHp <= 0) {
          this.onDeath();
        }
      }
    }
  }

  /**
   * 緊急シャットダウン処理（旧システムから流用）
   * エネルギーが0になった場合の処理
   * 3ターン行動不能 + 強制帰還（実装予定）
   */
  private handleEmergencyShutdown(): void {
    // 3ターン行動不能の処理
    // ゲームオーバーイベントを発行
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('game_over', { score: 100 });
    }
  }
  /**
   * 死亡時の処理
   */
  private onDeath(): void {
    // ゲームオーバーイベントを発行
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('game_over', { score: 100 });
    }
  }

  /**
   * カメラの追跡対象に設定
   * @param camera 追跡するカメラ
   */
  setCameraTarget(camera: Camera): void {
    this.camera = camera;

    // カメラのスムージング係数を設定（0.15 = 適度なスムーズさ）
    camera.setSmoothingFactor(0.15);

    // プレイヤーが移動したときにカメラを更新
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem && camera) {
      eventSystem.on('move_completed', (data) => {
        if (data.entityId === this.id && this.camera) {
          // 座標変換システムを使用してスクリーン座標を取得
          const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
          if (rendererSystem) {
            const coordSystem = rendererSystem.getCoordinateSystem();
            const screenPos = coordSystem.isometricToScreen(
              data.position.x,
              data.position.y,
              data.position.z
            );

            // カメラをスムーズに移動（setTargetPositionを使用）
            // これにより、カメラがプレイヤーに滑らかに追従する
            this.camera.setTargetPosition(
              screenPos.x - RENDER_CONFIG.SCREEN_WIDTH / 2,
              screenPos.y - RENDER_CONFIG.SCREEN_HEIGHT / 2
            );
          }
        }
      });

      // 移動中もカメラを追従させる（アニメーション中のスムーズな追従）
      eventSystem.on('move_started', (data) => {
        if (data.entityId === this.id && this.camera) {
          const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
          if (rendererSystem) {
            const coordSystem = rendererSystem.getCoordinateSystem();
            const screenPos = coordSystem.isometricToScreen(data.to.x, data.to.y, data.to.z);

            // 移動先に向かってカメラをスムーズに移動開始
            this.camera.setTargetPosition(
              screenPos.x - RENDER_CONFIG.SCREEN_WIDTH / 2,
              screenPos.y - RENDER_CONFIG.SCREEN_HEIGHT / 2
            );
          }
        }
      });
    }
  }

  /**
   * 現在地のタイルイベントをチェック
   * @param position 位置
   */
  private checkTileEvent(position: Vector3): void {
    const worldSystem = Engine.instance.getSystem<WorldSystem>('world');
    if (!worldSystem) return;

    const tileMap = worldSystem.getTileMap();
    if (!tileMap) return;

    const tile = tileMap.getTile(position.x, position.y, position.z);
    if (!tile) return;

    // タイルタイプに応じたイベント処理
    // 注意: ポータルはエンティティとして実装されているため、
    // TileType.PORTALのタイルイベントは処理しない
    switch (tile.type) {
      case TileType.HEAL: {
        // 回復イベント
        const health = this.getComponent<HealthComponent>('health');
        if (health) {
          health.heal(20);
        }
        break;
      }

      case TileType.DAMAGE: {
        // ダメージイベント
        const healthComp = this.getComponent<HealthComponent>('health');
        if (healthComp) {
          healthComp.takeDamage(10);
        }
        break;
      }
    }
  }

  /**
   * アイテム衝突判定
   * @param position プレイヤーの位置
   */
  private checkItemCollision(position: Vector3): void {
    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity');
    if (!entitySystem) {
      return;
    }

    // 同じ座標のアイテムエンティティを探す
    const entities = entitySystem.getEntities();

    for (const entity of entities) {
      if (entity.hasTag('item')) {
        const transform = entity.getComponent('transform') as TransformComponent;
        if (
          transform &&
          transform.position.x === position.x &&
          transform.position.y === position.y
        ) {
          // アイテム発見イベントを発行
          const eventSystem = Engine.instance.getSystem<EventSystem>('event');
          if (eventSystem) {
            eventSystem.emit('item_found', {
              playerId: this.id,
              itemEntity: entity,
              position: { ...position },
            });
          }
        }
      }
    }
  }

  /**
   * プレイヤーの位置を取得
   */
  getPosition(): Vector3 {
    const transform = this.getComponent<TransformComponent>('transform');
    return transform ? transform.position : { x: 0, y: 0, z: 0 };
  }

  /**
   * 現在のHPを取得
   */
  getStatus(): any {
    return {
      hp: this.gameStore.player.status.hp,
      maxHp: this.gameStore.player.status.maxHp,
      energy: this.gameStore.player.status.energy,
      maxEnergy: this.gameStore.player.status.maxEnergy,
      strength: this.gameStore.player.status.strength,
      defense: this.gameStore.player.status.defense,
      level: this.gameStore.player.status.level,
    };
  }

  /**
   * 現在のエネルギーを取得
   */
  getEnergy(): number {
    return this.gameStore.player.status.energy;
  }

  /**
   * 最大エネルギーを取得
   */
  getMaxEnergy(): number {
    return this.gameStore.player.status.maxEnergy;
  }

  /**
   * 視野半径を取得
   */
  get viewRadius(): number {
    return this._viewRadius;
  }

  /**
   * 視野半径を設定
   * @param radius 視野半径（マス数）
   */
  setViewRadius(radius: number): void {
    this._viewRadius = Math.max(1, radius);

    // 視野再計算イベントを発行
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('fov_update_requested', { entityId: this.id });
    }
  }

  /**
   * 更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // 親クラスのupdate()を呼び出してコンポーネントを更新
    super.update(deltaTime);
  }
}

/**
 * エネルギーコンポーネント - エネルギー管理
 */
class EnergyComponent implements Component {
  type = 'energy';
  entity: Entity | null = null;

  private _currentEnergy: number;
  private _maxEnergy: number;

  /**
   * コンストラクタ
   * @param maxEnergy 最大エネルギー
   * @param currentEnergy 現在のエネルギー
   */
  constructor(maxEnergy: number, currentEnergy: number = maxEnergy) {
    this._maxEnergy = Math.max(1, maxEnergy);
    this._currentEnergy = Math.min(Math.max(0, currentEnergy), this._maxEnergy);
  }

  /**
   * 初期化
   */
  initialize(): void {
    // 初期化時にエネルギー変更イベントを発行
    this.emitEnergyChangedEvent();
  }

  /**
   * 更新
   */
  update(_deltaTime: number): void {
    // EnergyComponentはComponentインターフェースを実装しているだけなので
    // 親クラスのupdate()は呼び出さない
    // 自動回復などの処理を追加可能
  }

  /**
   * エネルギーを消費
   * @param amount 消費量
   * @returns 消費が成功したかどうか
   */
  consume(amount: number): boolean {
    if (amount <= 0) return true;
    if (this._currentEnergy < amount) return false;

    this._currentEnergy -= amount;
    this.emitEnergyChangedEvent();
    return true;
  }

  /**
   * エネルギーを回復
   * @param amount 回復量
   * @returns 実際に回復した量
   */
  restore(amount: number): number {
    if (amount <= 0) return 0;

    const oldEnergy = this._currentEnergy;
    this._currentEnergy = Math.min(this._currentEnergy + amount, this._maxEnergy);

    const restored = this._currentEnergy - oldEnergy;
    if (restored > 0) {
      this.emitEnergyChangedEvent();
    }

    return restored;
  }

  /**
   * 現在のエネルギーを取得
   */
  getCurrentEnergy(): number {
    return this._currentEnergy;
  }

  /**
   * 最大エネルギーを取得
   */
  getMaxEnergy(): number {
    return this._maxEnergy;
  }

  /**
   * エネルギーパーセンテージを取得
   */
  getEnergyPercentage(): number {
    return (this._currentEnergy / this._maxEnergy) * 100;
  }

  /**
   * エネルギー変更イベントを発行
   */
  private emitEnergyChangedEvent(): void {
    if (!this.entity) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('energy_changed', {
        entityId: this.entity.id,
        currentEnergy: this._currentEnergy,
        maxEnergy: this._maxEnergy,
        percentage: this.getEnergyPercentage(),
      });
    }
  }
}

// TileTypeを使用するためのインポート
import { TileType } from '../../engine/types';
