import { Entity } from '../../engine/entity/Entity';
import { TransformComponent } from '../../engine/entity/components/Transform';
import { MovementComponent } from '../../engine/entity/components/Movement';
import { HealthComponent } from '../../engine/entity/components/Health';
import { BlockingComponent } from '../../engine/entity/components/Blocking';
import { StatsComponent } from '../../engine/entity/components/Stats';
import { EnergyComponent, EnergySnapshot } from './components/Energy';
import { Vector3, Direction, TileType } from '../../engine/types';
import { Engine } from '../../engine/Engine';
import { EventSystem } from '../../engine/events/EventSystem';
import { EntitySystem } from '../../engine/entity/EntitySystem';
import { WorldSystem } from '../../engine/world/WorldSystem';
import { EffectiveStats } from '../../engine/entity/stats/StatTypes';
import { PlayerInitialConfig } from './PlayerInitialConfig';

/**
 * プレイヤークラス - プレイヤーのエンティティ
 *
 * BU-2: gameStore への直接依存を廃止し、初期値は PlayerInitialConfig で受け取る。
 * gameStore への投影は StatsProjection が行う（イベント経由）。
 */
export class Player extends Entity {
  // 初期値設定
  private config: PlayerInitialConfig;

  /**
   * コンストラクタ
   * @param id エンティティID
   * @param startPosition 開始位置
   * @param config 初期ステータス設定
   */
  constructor(id: string, startPosition: Vector3, config: PlayerInitialConfig) {
    super(id, 'player');

    // タグを追加
    this.addTag('player');

    this.config = config;

    console.log(`Player: Initialized with viewRadius: ${config.viewRadius}`);

    // コンポーネントを追加
    this.addComponent(new TransformComponent(startPosition.x, startPosition.y, startPosition.z));
    // C3: 衝突判定を Entity 側で宣言する
    this.addComponent(new BlockingComponent());
    // BU-2: 実効ステータスの正本。
    // parts 由来の値（maxHp/maxEnergy/defense/carryCapacity）は基礎値 0 とし、
    // PartsSystem が StatSource として add 修飾子で提供する。
    // それ以外の値は config 初期値を基礎値とする。
    const baseStats: EffectiveStats = {
      maxHp: 0,
      maxEnergy: 0,
      defense: 0,
      attackPower: config.attackPower,
      viewRadius: config.viewRadius,
      moveSpeed: 4,
      carryCapacity: 0,
      level: config.level,
    };
    this.addComponent(new StatsComponent(baseStats));
    // BU-2 P1: Player から AttackPowerComponent を削除。
    // CombatSystem は StatsComponent.getValue('attackPower') を優先する。
    // Enemy 側は AttackPowerComponent を使うため、コンポーネント自体は残す。
    this.addComponent(new EnergyComponent(config.maxEnergy, config.energy));
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
      this.config.maxHp,
      this.config.hp,
      500, // 無敵時間（ミリ秒）
      this.config.defense, // 防御力（整数値）
      0 // HP自動回復なし
    );
    this.addComponent(healthComponent);

    // 親クラスの initialize() を呼び出してコンポーネントを初期化
    await super.initialize();

    // イベントリスナーを設定
    this.setupEventListeners();

    // BU-2: エネルギー状態の初期投影イベントを発行
    this.emitEnergyChanged();
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
        // BU-2: gameStore への位置書き込みは StatsProjection が行う

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
        // BU-2: gameStore へのHP書き込みは StatsProjection が行う

        // HPがゼロになった場合
        if (data.currentHp <= 0) {
          this.onDeath();
        }
      }
    });

    // BU-2: ステータス変更イベント — StatsComponent の実効値を
    // HealthComponent / EnergyComponent の最大値へ反映する
    eventSystem.on('stats_changed', (data) => {
      if (data.entityId === this.id) {
        const health = this.getComponent<HealthComponent>('health');
        if (health) {
          health.setMaxHp(data.stats.maxHp);
          health.defense = data.stats.defense;
        }

        const energy = this.getComponent<EnergyComponent>('energy');
        if (energy) {
          energy.setMaxEnergy(data.stats.maxEnergy);
          // 最大エネルギー変更後に投影イベントを発行
          this.emitEnergyChanged();
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
    // BU-2: StatsComponent から攻撃力を取得する
    const stats = this.getComponent<StatsComponent>('stats');
    if (stats) return stats.getValue('attackPower');
    return this.config.attackPower;
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

    // 攻撃力を計算（BU-2: StatsComponent から取得）
    const stats = this.getComponent<StatsComponent>('stats');
    const attackPower = stats ? stats.getValue('attackPower') : this.config.attackPower;

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
      this.emitEnergyChanged(energy, true);
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
    this.emitEnergyChanged(energy, true);
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
    // BU-2: gameStore ではなくドメインコンポーネントから取得する
    const health = this.getComponent<HealthComponent>('health');
    const stats = this.getComponent<StatsComponent>('stats');
    return {
      hp: health?.currentHp ?? 0,
      maxHp: health?.maxHp ?? 0,
      energy: this.getEnergy(),
      maxEnergy: this.getMaxEnergy(),
      attackPower: stats?.getValue('attackPower') ?? this.config.attackPower,
      defense: stats?.getValue('defense') ?? this.config.defense,
      level: stats?.getValue('level') ?? this.config.level,
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
    this.emitEnergyChanged(energy);
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
    this.emitEnergyChanged(energy);
    return true;
  }

  /**
   * BU-2: HP 回復（HealthComponent 経由）
   * アイテム効果の heal をドメイン層へ委譲するためのメソッド。
   * @param amount 回復量
   * @returns 実際に回復した量
   */
  heal(amount: number): number {
    const health = this.getComponent<HealthComponent>('health');
    if (!health) return 0;
    return health.heal(amount);
  }

  /**
   * BU-2: ステータスブースト（StatsComponent 経由）
   * アイテム効果の stat_boost をドメイン層へ委譲するためのメソッド。
   * 永続的な強化は基礎値へ反映する（セーブ対象になるため）。
   *
   * P0-1修正: 実効値（getValue）ではなく基礎値（getBase）に加算する。
   * 実効値を使うと修飾子の分が基礎値に混入し、二重計上が起きる。
   *
   * P0-2修正: strength を廃止し attackPower に一本化した。
   * statType 'strength' は attackPower へマップする（旧アイテムの互換性）。
   * @param statType ステータスの種類
   * @param value 増加量
   * @returns 成功したかどうか
   */
  applyStatBoost(
    statType: 'attackPower' | 'defense' | 'maxHp' | 'maxEnergy',
    value: number
  ): boolean {
    const stats = this.getComponent<StatsComponent>('stats');
    if (!stats) return false;

    // P0-1: 基礎値に加算する（実効値ではない）
    const currentBase = stats.getBase()[statType];
    stats.setBaseValue(statType, currentBase + value);

    return true;
  }

  /**
   * BU-2: エネルギー状態の変更を energy_changed イベントで通知する。
   * StatsProjection がこのイベントを受けて gameStore へ投影する。
   */
  private emitEnergyChanged(
    energy: EnergyComponent | undefined = this.getComponent<EnergyComponent>('energy'),
    applyEffects = false
  ): void {
    if (!energy) return;

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('energy_changed', {
        entityId: this.id,
        currentEnergy: energy.currentEnergy,
        maxEnergy: energy.maxEnergy,
        percentage: energy.percentage,
      });
    }

    if (applyEffects) {
      this.updateEnergyEffects(energy.percentage);
    }
  }

  /**
   * 視野半径を取得（StatsComponent から）
   */
  get viewRadius(): number {
    const stats = this.getComponent<StatsComponent>('stats');
    return stats ? stats.getValue('viewRadius') : this.config.viewRadius;
  }

  /**
   * 視野半径を設定（StatsComponent の基礎値を更新）
   * @param radius 視野半径（マス数）
   */
  setViewRadius(radius: number): void {
    const stats = this.getComponent<StatsComponent>('stats');
    if (stats) {
      stats.setBaseValue('viewRadius', Math.max(1, radius));
    }

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
