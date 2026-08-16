import { System } from '../System';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { WorldSystem } from '../world/WorldSystem';
import { TransformComponent } from '../entity/components/Transform';
import { HealthComponent } from '../entity/components/Health';
import { MovementComponent } from '../entity/components/Movement';
import { Enemy } from '../entity/Enemy';
import { Player } from '../entity/Player';
import { Direction } from '../types';

/**
 * 戦闘システム - 攻撃・ダメージ計算を管理
 * プレイヤーと敵の戦闘処理を統括
 */
export class CombatSystem implements System {
  // エンジンへの参照
  private engine: Engine | null = null;

  // エンティティシステムへの参照
  private entitySystem: EntitySystem | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  // ワールドシステムへの参照
  private worldSystem: WorldSystem | null = null;

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.worldSystem = engine.getSystem<WorldSystem>('world') || null;

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('CombatSystem initialized');
  }

  /**
   * 毎フレームの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // 戦闘システムは基本的にイベント駆動なので、ここでは特に処理なし
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) {
      console.warn('EventSystem not found, combat events will not be processed');
      return;
    }

    // プレイヤー攻撃要求
    this.eventSystem.on('player_attack_requested', (data) => {
      console.log('Player attack requested');
      this.handlePlayerAttack(data.playerId);
    });

    // 敵攻撃要求
    this.eventSystem.on('enemy_attack_requested', (data) => {
      console.log('Enemy attack requested:', data.enemyId);
      this.handleEnemyAttack(data.enemyId, data.targetId);
    });

    console.log('CombatSystem event listeners registered');
  }

  /**
   * プレイヤーの攻撃を処理
   * @param playerId プレイヤーID
   */
  private async handlePlayerAttack(playerId: string): Promise<void> {
    const player = this.entitySystem?.getEntity(playerId);
    if (!player) {
      console.warn(`Player not found: ${playerId}`);
      return;
    }

    console.log('Processing player attack...');

    // 1. プレイヤーの向きを取得（仮実装：移動コンポーネントから）
    const direction = this.getEntityDirection(playerId);
    console.log(`Player facing direction: ${direction}`);

    // 2. ターゲットを検出
    const targetId = this.findAttackTarget(playerId, direction);

    if (targetId) {
      console.log(`Attack target found: ${targetId}`);

      // 3. ダメージを計算
      const damage = this.calculateDamage(playerId, targetId);
      console.log(`Calculated damage: ${damage}`);

      // 4. ダメージを適用
      await this.applyDamage(targetId, damage, playerId);

      // 5. 攻撃エフェクトを再生
      this.eventSystem?.emit('attack_performed', { entityId: playerId });

      // 6. サウンドを再生
      this.eventSystem?.emit('player_attack', {});
    } else {
      console.log('No target found, attack missed');

      // 空振りでもエフェクトとサウンドは再生
      this.eventSystem?.emit('attack_performed', { entityId: playerId });
      this.eventSystem?.emit('player_attack', {});
    }

    // 7. ターンアクション完了を通知
    this.eventSystem?.emit('turn_action_completed', { entityId: playerId });
  }

  /**
   * 敵の攻撃を処理
   * @param enemyId 敵ID
   * @param targetId ターゲットID（通常はプレイヤー）
   */
  private async handleEnemyAttack(enemyId: string, targetId: string): Promise<void> {
    const enemy = this.entitySystem?.getEntity(enemyId);
    const target = this.entitySystem?.getEntity(targetId);

    if (!enemy || !target) {
      console.warn(`Enemy or target not found: ${enemyId}, ${targetId}`);
      return;
    }

    console.log(`Enemy ${enemyId} attacking ${targetId}...`);

    // 1. ダメージを計算
    const damage = this.calculateDamage(enemyId, targetId);
    console.log(`Enemy damage: ${damage}`);

    // 2. ダメージを適用
    await this.applyDamage(targetId, damage, enemyId);

    // 3. 攻撃エフェクトを再生
    this.eventSystem?.emit('attack_performed', { entityId: enemyId });
  }

  /**
   * 攻撃ターゲットを検出
   * @param attackerId 攻撃者ID
   * @param direction 攻撃方向
   * @returns ターゲットID（見つからない場合はnull）
   */
  private findAttackTarget(attackerId: string, direction: Direction): string | null {
    const attacker = this.entitySystem?.getEntity(attackerId);
    if (!attacker) return null;

    const transform = attacker.getComponent<TransformComponent>('transform');
    if (!transform) return null;

    // 攻撃者の向きに基づいてターゲット位置を計算
    const targetPos = this.getPositionInDirection(transform.position, direction);
    console.log(`Looking for target at position: (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`);

    // ターゲット位置にいる敵を検索
    const enemies = this.entitySystem?.getEntitiesByTag('enemy') || [];
    for (const enemy of enemies) {
      const enemyTransform = enemy.getComponent<TransformComponent>('transform');
      if (enemyTransform) {
        const pos = enemyTransform.position;
        if (pos.x === targetPos.x && pos.y === targetPos.y && pos.z === targetPos.z) {
          console.log(`Found enemy at target position: ${enemy.id}`);
          return enemy.id;
        }
      }
    }

    // プレイヤーが攻撃者でない場合、プレイヤーもチェック
    if (!attackerId.startsWith('player')) {
      const players = this.entitySystem?.getEntitiesByTag('player') || [];
      for (const player of players) {
        const playerTransform = player.getComponent<TransformComponent>('transform');
        if (playerTransform) {
          const pos = playerTransform.position;
          if (pos.x === targetPos.x && pos.y === targetPos.y && pos.z === targetPos.z) {
            console.log(`Found player at target position: ${player.id}`);
            return player.id;
          }
        }
      }
    }

    console.log('No target found at attack position');
    return null;
  }

  /**
   * ダメージを計算
   * @param attackerId 攻撃者ID
   * @param targetId ターゲットID
   * @returns ダメージ量
   */
  private calculateDamage(attackerId: string, targetId: string): number {
    const attacker = this.entitySystem?.getEntity(attackerId);
    const target = this.entitySystem?.getEntity(targetId);

    if (!attacker || !target) {
      return 0;
    }

    // C2: 攻撃側のステータスから基本ダメージを算出する
    // Player は getAttackPower() (strength) + 固定ボーナス、Enemy は getStats().attackPower
    // 実際の Player/Enemy インスタンスでない場合はタグで判定し、デフォルト値を使用する
    let baseDamage: number;
    if (attacker instanceof Player) {
      baseDamage = attacker.getAttackPower() + 5; // strength(10) + 5 = 15（旧ロジックと同じ）
    } else if (attacker instanceof Enemy) {
      baseDamage = attacker.getStats().attackPower;
    } else if (attacker.hasTag('player')) {
      baseDamage = 15; // Player のデフォルト（strength 10 + bonus 5）
    } else if (attacker.hasTag('enemy')) {
      baseDamage = 10; // Enemy のデフォルト
    } else {
      baseDamage = 10; // フォールバック
    }

    // C2: 防御側のステータスからダメージ軽減を適用する
    // 旧ロジックは defense を無視していたが、C2 では参照する
    // ただし影響を最小限にするため、defense の 1/2 を減算する
    const targetHealth = target.getComponent<HealthComponent>('health');
    const defense = targetHealth?.defense ?? 0;
    const defenseReduction = Math.floor(defense * 0.5);

    // ランダム要素を追加（±20%）
    const randomFactor = 0.8 + Math.random() * 0.4;
    const rawDamage = Math.floor(baseDamage * randomFactor);
    const finalDamage = Math.max(1, rawDamage - defenseReduction);

    console.log(
      `Damage calculation: base=${baseDamage}, defense=${defense}, random=${randomFactor.toFixed(
        2
      )}, final=${finalDamage}`
    );

    return finalDamage;
  }

  /**
   * ダメージを適用
   * @param targetId ターゲットID
   * @param damage ダメージ量
   * @param attackerId 攻撃者ID
   */
  private async applyDamage(targetId: string, damage: number, attackerId: string): Promise<void> {
    const target = this.entitySystem?.getEntity(targetId);
    if (!target) {
      console.warn(`Target not found: ${targetId}`);
      return;
    }

    const healthComponent = target.getComponent<HealthComponent>('health');
    if (!healthComponent) {
      console.warn(`HealthComponent not found for target: ${targetId}`);
      return;
    }

    // ダメージ適用前に位置を保存（HealthComponentで即座に削除されるため）
    const transform = target.getComponent<TransformComponent>('transform');
    const savedPosition = transform ? { ...transform.position } : null;
    const wasAlive = healthComponent.currentHp > 0;

    // ダメージを適用（HealthComponent内でエンティティが削除される可能性がある）
    healthComponent.takeDamage(damage);
    console.log(
      `Applied ${damage} damage to ${targetId}, remaining HP: ${healthComponent.currentHp}`
    );

    // ダメージエフェクトを再生（エンティティが既に削除されている場合もある）
    this.eventSystem?.emit('damage_taken', {
      entityId: targetId,
      damage: damage,
      attackerId: attackerId,
    });

    // シェイクエフェクトを再生
    this.eventSystem?.emit('shake_requested', {
      entityId: targetId,
    });

    // 撃破判定（HealthComponentで削除されるので、保存した位置を使用）
    if (wasAlive && healthComponent.currentHp <= 0) {
      console.log(`Entity ${targetId} was defeated!`);
      this.handleEntityDestroyedWithPosition(targetId, savedPosition);
    }
  }

  /**
   * エンティティ撃破処理（位置情報付き）
   * @param entityId エンティティID
   * @param position 保存された位置情報（エンティティが削除済みの場合に使用）
   */
  private handleEntityDestroyedWithPosition(
    entityId: string,
    position: { x: number; y: number; z: number } | null
  ): void {
    console.log(`[CombatSystem] handleEntityDestroyedWithPosition: ${entityId}`);

    if (position) {
      console.log(`[CombatSystem] Emitting enemy_destroyed at position:`, position);
      // 爆発エフェクトを再生
      this.eventSystem?.emit('enemy_destroyed', {
        entityId: entityId,
        position: position,
      });
    } else {
      console.warn(`[CombatSystem] No position for destroyed entity: ${entityId}`);
    }

    // エンティティは既にHealthComponentで削除されているので、ここでは削除しない
    // すべての敵が倒されたかチェック
    setTimeout(() => {
      const remainingEnemies = this.entitySystem?.getEntitiesByTag('enemy') || [];
      if (remainingEnemies.length === 0) {
        console.log('All enemies defeated!');
        this.eventSystem?.emit('all_enemies_defeated', {});
      }
    }, 100);
  }

  /**
   * エンティティの向きを取得
   * @param entityId エンティティID
   * @returns 向き
   */
  private getEntityDirection(entityId: string): Direction {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return 'down';

    const movementComponent = entity.getComponent<MovementComponent>('movement');
    if (movementComponent) {
      // MovementComponentのdirectionプロパティから向きを取得
      return movementComponent.direction;
    }

    return 'down';
  }

  /**
   * 指定方向の位置を取得
   * @param position 現在の位置
   * @param direction 方向
   * @returns 指定方向の位置
   */
  private getPositionInDirection(
    position: { x: number; y: number; z: number },
    direction: Direction
  ): { x: number; y: number; z: number } {
    const { x, y, z } = position;
    switch (direction) {
      case 'up':
        return { x, y: y - 1, z };
      case 'down':
        return { x, y: y + 1, z };
      case 'left':
        return { x: x - 1, y, z };
      case 'right':
        return { x: x + 1, y, z };
      default:
        return { x, y, z };
    }
  }

  /**
   * 指定位置にエンティティが存在するかチェック
   * @param position 位置
   * @param tag タグ（オプション）
   * @returns エンティティID（見つからない場合はnull）
   */
  private getEntityAtPosition(
    position: { x: number; y: number; z: number },
    tag?: string
  ): string | null {
    if (!this.entitySystem) return null;

    // D1: 位置インデックス経由で O(1) 検索
    const entities = this.entitySystem.getEntitiesAtPosition(position.x, position.y, position.z);
    for (const entity of entities) {
      if (!tag || entity.hasTag(tag)) {
        return entity.id;
      }
    }

    return null;
  }
}
