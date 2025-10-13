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

/**
 * プレイヤークラス - プレイヤーのエンティティ
 */
export class Player extends Entity {
  // カメラ参照
  private camera: Camera | null = null;

  // エネルギー
  private currentEnergy: number;
  private maxEnergy: number;

  // ゲームストア
  private gameStore = useGameStore();

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

    // コンポーネントを追加
    this.addComponent(new TransformComponent(startPosition.x, startPosition.y, startPosition.z));
    this.gameStore.player.position = { ...startPosition };
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    // スプライトコンポーネントを追加
    const texturePaths = {
      up: './robo01bk_r.png',
      down: './robo01_l.png',
      left: './robo01bk_l.png',
      right: './robo01_r.png',
    };

    // テクスチャの読み込み
    const direction = 'down'; // デフォルト方向
    const texturePath = texturePaths[direction];

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
      0.1 // 防御力
    );
    this.addComponent(healthComponent);

    // エネルギーコンポーネントを追加
    const energyComponent = new EnergyComponent(this.maxEnergy, this.currentEnergy);
    this.addComponent(energyComponent);

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
      console.log('move_completed event received', data.entityId, this.id);
      if (data.entityId === this.id) {
        console.log('Processing move_completed for player at', data.position);
        // ゲームストアの位置を更新
        this.gameStore.player.position = { ...data.position };

        // 移動時のエネルギー消費
        this.consumeEnergy(1);

        // 現在のタイルのイベントをチェック
        this.checkTileEvent(data.position);

        // アイテム衝突判定
        console.log('Calling checkItemCollision');
        this.checkItemCollision(data.position);
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
   * 指定方向に移動
   * @param direction 移動方向
   * @returns 移動が成功したかどうか
   */
  move(direction: Direction): boolean {
    console.log(`Player.move() called with direction: ${direction}`);
    console.log(`Current energy: ${this.currentEnergy}`);

    // エネルギーチェック
    if (this.currentEnergy <= 0) {
      console.log('Energy is 0, triggering emergency shutdown');
      this.handleEmergencyShutdown();
      return false;
    }

    // 移動コンポーネントを取得
    const movement = this.getComponent<MovementComponent>('movement');
    console.log('MovementComponent:', movement);
    if (!movement) {
      console.warn('MovementComponent not found!');
      return false;
    }

    // 指定方向に移動
    console.log('Calling movement.moveInDirection()');
    return movement.moveInDirection(direction);
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
   * エネルギー状態に応じた効果を更新
   * @param percentage エネルギーのパーセンテージ（0〜100）
   */
  private updateEnergyEffects(percentage: number): void {
    // エネルギーが0の場合は緊急シャットダウン
    if (percentage <= 0) {
      this.handleEmergencyShutdown();
      return;
    }

    // エネルギーが15%以下の場合はクリティカルモード
    if (percentage <= 15) {
      // HP減少効果
      const health = this.getComponent<HealthComponent>('health');
      if (health) {
        health.takeDamage(1, true, true);
      }
    }
  }

  /**
   * 緊急シャットダウン処理
   */
  private handleEmergencyShutdown(): void {
    console.log('Emergency Shutdown!');

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
    console.log('Player died');

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

    // トランスフォームコンポーネントの更新時にカメラも更新するように設定
    const transform = this.getComponent<TransformComponent>('transform');
    if (transform && camera) {
      const eventSystem = Engine.instance.getSystem<EventSystem>('event');
      if (eventSystem) {
        eventSystem.on('entity_moved', (data) => {
          if (data.entityId === this.id && this.camera) {
            const screenX = (-data.position.x * 160) / 2;
            const screenY = (-data.position.y * 120) / 3;
            this.camera.setTargetPosition(screenX, screenY);
          }
        });
      }
    }
  }

  /**
   * 現在地のタイルイベントをチェック
   * @param position 位置
   */
  private checkTileEvent(position: Vector3): void {
    const worldSystem = Engine.instance.getSystem<any>('world');
    if (!worldSystem) return;

    const tileMap = worldSystem.getTileMap();
    if (!tileMap) return;

    const tile = tileMap.getTile(position.x, position.y, position.z);
    if (!tile) return;

    // タイルタイプに応じたイベント処理
    switch (tile.type) {
      case TileType.PORTAL:
        // ポータルイベント
        this.gameStore.setPortalActive(true);
        break;

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
      console.warn('EntitySystem not found');
      return;
    }

    // 同じ座標のアイテムエンティティを探す
    const entities = entitySystem.getEntities();
    console.log(
      `Checking item collision at (${position.x}, ${position.y}), total entities: ${entities.length}`
    );

    let itemCount = 0;
    for (const entity of entities) {
      if (entity.hasTag('item')) {
        itemCount++;
        const transform = entity.getComponent('transform') as TransformComponent;
        if (transform) {
          console.log(
            `Item found at (${transform.position.x}, ${transform.position.y}), player at (${position.x}, ${position.y})`
          );
        }
        if (
          transform &&
          transform.position.x === position.x &&
          transform.position.y === position.y
        ) {
          console.log('Item collision detected! Emitting item_found event');
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
    console.log(`Total items on map: ${itemCount}`);
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
  update(deltaTime: number): void {
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
