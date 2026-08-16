import { System } from '../System';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';

/**
 * ターンフェーズ
 */
export enum TurnPhase {
  PLAYER,
  ENEMY,
  END,
}

/**
 * ターン管理システム - ECS版
 * プレイヤーと敵のターン制御、フェーズ管理を行う
 *
 * BU-3 段階1: turnNumber を導入し、startNewTurn() でインクリメントして
 * turn_started イベントを発行する。継続効果・クールダウンはこの turn を参照する。
 */
export class TurnSystem implements System {
  // エンジンへの参照
  private engine: Engine | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  // エンティティシステムへの参照
  private entitySystem: EntitySystem | null = null;

  // 現在のターンフェーズ
  private currentPhase: TurnPhase = TurnPhase.PLAYER;

  // ターン処理中フラグ
  private processingTurn = false;

  // 現在処理中の敵のインデックス
  private currentEnemyIndex = 0;

  // BU-3 段階1: ターン番号（プレイヤー行動完了ごとに +1、単調増加）
  private turnNumber = 0;

  /**
   * コンストラクタ
   */
  constructor() {
    // TurnSystem created
  }

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;

    // イベントリスナーを設定
    this.setupEventListeners();
  }

  /**
   * 毎フレームの更新処理
   * @param _deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(_deltaTime: number): void {
    // ターン管理は基本的にイベント駆動なので、ここでは特に処理なし
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) {
      return;
    }

    // プレイヤー移動完了（move_completed イベントをリッスン）
    this.eventSystem.on('move_completed', (data) => {
      // プレイヤーの移動完了のみ処理
      if (data.entityId === 'player' && this.currentPhase === TurnPhase.PLAYER) {
        this.switchToEnemyTurn();
      }
    });

    // プレイヤー攻撃完了
    this.eventSystem.on('player_turn_ended', () => {
      if (this.currentPhase === TurnPhase.PLAYER) {
        this.switchToEnemyTurn();
      }
    });

    // プレイヤー攻撃イベント
    this.eventSystem.on('player_attacked', () => {
      if (this.currentPhase === TurnPhase.PLAYER) {
        this.switchToEnemyTurn();
      }
    });

    // CombatSystemからのターンアクション完了イベント
    this.eventSystem.on('turn_action_completed', (data) => {
      if (data.entityId === 'player' && this.currentPhase === TurnPhase.PLAYER) {
        this.switchToEnemyTurn();
      }
    });
  }

  /**
   * 新しいターンを開始
   *
   * BU-3 段階1: ターン番号をインクリメントし turn_started を発行する。
   * 既存の player_turn_started は併存させる（UI・InputSystem・SkillSystem が購読中）。
   */
  startNewTurn(): void {
    this.currentPhase = TurnPhase.PLAYER;
    this.turnNumber += 1;

    // ターン番号の進行を通知（継続効果・クールダウンの基準）
    this.eventSystem?.emit('turn_started', { turn: this.turnNumber });

    // プレイヤーターン開始イベントを発行（既存リスナー互換）
    this.eventSystem?.emit('player_turn_started', {});
  }

  /**
   * BU-3 段階1: 現在のターン番号を取得する
   */
  getTurnNumber(): number {
    return this.turnNumber;
  }

  /**
   * 敵ターンに切り替え
   */
  private switchToEnemyTurn(): void {
    // 既にターン処理中なら無視
    if (this.processingTurn) {
      return;
    }

    this.currentPhase = TurnPhase.ENEMY;
    this.currentEnemyIndex = 0;

    // 敵ターン開始イベントを発行
    this.eventSystem?.emit('enemy_turn_started', {});

    // すべての敵の行動を順番に処理
    this.processAllEnemies();
  }

  /**
   * すべての敵の行動を順番に処理
   * 注意: 敵同士の衝突を避けるため、順次処理で実行
   */
  private async processAllEnemies(): Promise<void> {
    if (!this.entitySystem) {
      this.startNewTurn();
      return;
    }

    this.processingTurn = true;

    const enemies = this.entitySystem.getEntitiesByTag('enemy');
    const aliveEnemies = enemies.filter((enemy) => {
      const health = enemy.getComponent('health');
      if (health && 'currentHp' in health) {
        return (health as { currentHp: number }).currentHp > 0;
      }
      return enemy.active;
    });

    if (aliveEnemies.length === 0) {
      // 敵が全滅している場合、プレイヤーターンに戻る
      this.processingTurn = false;
      this.startNewTurn();
      return;
    }

    // 敵を順番に行動させる（敵同士の衝突を避けるため）
    for (const enemy of aliveEnemies) {
      // 敵がまだ生存しているか確認
      const health = enemy.getComponent('health');
      if (health && 'currentHp' in health && (health as { currentHp: number }).currentHp <= 0) {
        continue;
      }

      // 敵の行動イベントを発行
      this.eventSystem?.emit('enemy_action_started', {
        enemyId: enemy.id,
      });

      // 敵のAI行動を実行（Enemyエンティティのactメソッドを呼び出す）
      if ('act' in enemy && typeof (enemy as any).act === 'function') {
        try {
          await (enemy as any).act();
        } catch (error) {
          console.error(`Error during enemy ${enemy.id} action:`, error);
        }
      }
    }

    // すべての敵の行動が完了したらプレイヤーターンに戻る
    this.processingTurn = false;
    this.startNewTurn();
  }

  /**
   * 現在のフェーズを取得
   * @returns 現在のターンフェーズ
   */
  getCurrentPhase(): TurnPhase {
    return this.currentPhase;
  }
}
