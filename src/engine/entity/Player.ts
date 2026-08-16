import { Entity } from '../../engine/entity/Entity';
import { TransformComponent } from '../../engine/entity/components/Transform';
import { MovementComponent } from '../../engine/entity/components/Movement';
import { HealthComponent } from '../../engine/entity/components/Health';
import { BlockingComponent } from '../../engine/entity/components/Blocking';
import { AttackPowerComponent } from '../../engine/entity/components/AttackPower';
import { StatsComponent } from '../../engine/entity/components/Stats';
import { EnergyComponent, EnergySnapshot } from './components/Energy';
import { Vector3, Direction, TileType } from '../../engine/types';
import { Engine } from '../../engine/Engine';
import { EventSystem } from '../../engine/events/EventSystem';
import { EntitySystem } from '../../engine/entity/EntitySystem';
import { useGameStore } from '../../stores/gameStore';
import { WorldSystem } from '../../engine/world/WorldSystem';
import { EffectiveStats } from '../../engine/entity/stats/StatTypes';

/**
 * プレイヤークラス - プレイヤーのエンティティ
 */
export class Player extends Entity {
  // 視野半径（何マス先まで見えるか）
  private _viewRadius = 4;

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

    // 視野半径設定
    const storeViewRadius = this.gameStore.player.status.viewRadius;
    this._viewRadius = storeViewRadius !== undefined ? storeViewRadius : 4;
    console.log(
      `Player: Initialized with viewRadius: ${this._viewRadius} (from store: ${storeViewRadius})`
    );

    // コンポーネントを追加
    this.addComponent(new TransformComponent(startPosition.x, startPosition.y, startPosition.z));
    // C3: 衝突判定を Entity 側で宣言する
    this.addComponent(new BlockingComponent());
    // BU-2: 実効ステータスの正本。基礎値は gameStore 初期値と同じ。
    // 段階3以降で PartsSystem が StatSource として登録される。
    const baseStats: EffectiveStats = {
      maxHp: this.gameStore.player.status.maxHp,
      maxEnergy: this.gameStore.player.status.maxEnergy,
      defense: this.gameStore.player.status.defense,
      attackPower: this.gameStore.player.status.strength + 5,
      viewRadius: this._viewRadius,
      moveSpeed: 4,
      carryCapacity: 10,
      strength: this.gameStore.player.status.strength,
      level: this.gameStore.player.status.level,
    };
    this.addComponent(new StatsComponent(baseStats));
    // P1-fix: 攻撃力を Component として宣言する（CombatSystem が instanceof しない）
    this.addComponent(new AttackPowerComponent(this.gameStore.player.status.strength + 5));
    this.addComponent(
      new EnergyComponent(
        this.gameStore.player.status.maxEnergy,
        this.gameStore.player.status.energy
      )
    );
    this.gameStore.player.position = { ...startPosition };
  }

  /**
   * 初期化
   * C1: 描画ライフサイクルは PlayerPresentation が担当するため、
   * ドメインコンポーネントの初期化のみを行う
   */
  async initialize(): Promise<void> {
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

    // 親クラスの initialize() を呼び出してコンポーネントを初期化
    await super.initialize();

    // イベントリスナーを設定
    this.setupEventListeners();

    // EnergyComponentの状態をUI表示用ストアへ投影
    this.syncEnergyState();
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

    // C1: 方向変更時のテクスチャ切替は PlayerPresentation が行う

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
  }

  /**
   * 指定方向に移動
   * @param direction 移動方向
   * @returns 移動が成功したかどうか
   */
  move(direction: Direction): boolean {
    // エネルギーチェック
    if (this.getEnergy() <= 0) {
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
   * 攻撃力を取得
   * P1-fix: AttackPowerComponent から読む（gameStore の strength + 固定ボーナス）
   * CombatSystem は Component 経由で参照するため、このメソッドはドメイン参照用
   */
  getAttackPower(): number {
    const attack = this.getComponent<AttackPowerComponent>('attack_power');
    return attack ? attack.baseAttackPower : this.gameStore.player.status.strength + 5;
  }

  /**
   * 攻撃
   */
  async attack(): Promise<number> {
    // エネルギーチェック
    if (!this.consumeEnergy(2)) {
      return 0;
    }

    // C1: 攻撃アニメーション（tint）は PlayerPresentation が
    // 既存の player_attacked イベント経由で処理する

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
      this.syncEnergyState(energy, true);
    }

    return success;
  }

  /**
   * エネルギーを回復
   * @param amount 回復量
   */
  restoreEnergy(amount: number): number {
    // エネルギーコンポーネントを取得
    const energy = this.getComponent<EnergyComponent>('energy');
    if (!energy) return 0;

    // エネルギーを回復
    const restored = energy.restore(amount);
    this.syncEnergyState(energy, true);
    return restored;
  }

  /**
   * エネルギー状態に応じた効果を更新（旧システムから流用）
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

  // C1: カメラ追従は PlayerPresentation が担当する

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
      energy: this.getEnergy(),
      maxEnergy: this.getMaxEnergy(),
      strength: this.gameStore.player.status.strength,
      defense: this.gameStore.player.status.defense,
      level: this.gameStore.player.status.level,
    };
  }

  /**
   * 現在のエネルギーを取得
   */
  getEnergy(): number {
    return this.getComponent<EnergyComponent>('energy')?.currentEnergy ?? 0;
  }

  /**
   * 最大エネルギーを取得
   */
  getMaxEnergy(): number {
    return this.getComponent<EnergyComponent>('energy')?.maxEnergy ?? 0;
  }

  /**
   * エネルギー状態のスナップショットを取得
   */
  getEnergySnapshot(): EnergySnapshot | null {
    return this.getComponent<EnergyComponent>('energy')?.createSnapshot() ?? null;
  }

  /**
   * 保存済みのエネルギー状態を復元
   */
  restoreEnergySnapshot(snapshot: EnergySnapshot): boolean {
    const energy = this.getComponent<EnergyComponent>('energy');
    if (!energy) return false;

    energy.restoreSnapshot(snapshot);
    this.syncEnergyState(energy);
    return true;
  }

  /**
   * 最大エネルギーを増加させる（現在値は維持する）
   */
  increaseMaxEnergy(amount: number): boolean {
    if (amount <= 0) return false;

    const energy = this.getComponent<EnergyComponent>('energy');
    if (!energy) return false;

    energy.setMaxEnergy(energy.maxEnergy + amount);
    this.syncEnergyState(energy);
    return true;
  }

  /**
   * EnergyComponentの状態をUI表示用ストアへ投影する。
   */
  private syncEnergyState(
    energy: EnergyComponent | undefined = this.getComponent<EnergyComponent>('energy'),
    applyEffects = false
  ): void {
    if (!energy) return;

    this.gameStore.player.status.energy = energy.currentEnergy;
    this.gameStore.player.status.maxEnergy = energy.maxEnergy;
    if (applyEffects) {
      this.updateEnergyEffects(energy.percentage);
    }
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
