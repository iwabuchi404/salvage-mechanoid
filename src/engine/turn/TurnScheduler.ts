import { Action, ActionResult } from './Action';
import { ActionExecutor } from './ActionExecutor';
import { ActorComponent } from '../entity/components/Actor';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { HealthComponent } from '../entity/components/Health';

/**
 * 行動に必要なスケジューラエネルギーの閾値。
 * 1 行動あたり timeCost 1 を消費し、speed だけ毎 tick 蓄積する。
 * speed 100 なら 1 tick で1回行動可能、speed 200 なら2回行動可能。
 */
const ACTION_THRESHOLD = 100;

/**
 * BU-3 段階5: エネルギー式スケジューラ（案 B）
 *
 * 設計ドキュメント docs/design/TURN_MODEL_DESIGN.md の案 B を実装する。
 *
 * 責務:
 * - アクターの行動順序を決める（speed ベース）
 * - プレイヤー行動を入力から受け取り、敵行動を ActorComponent.decideAction() から受け取る
 * - 行動の実行は ActionExecutor へ委譲する
 * - ターン番号を進める
 * - stop() でループと入力待ち Promise を両方解決する
 * - フロア遷移で古いループを止め、再開しない
 *
 * 同速時の順序保証（設計要件）:
 * - プレイヤーが先
 * - 敵は登録順
 *
 * この時点では既存のフェーズベース挙動と併存させ、
 * TurnSystem の processAllEnemies() を段階的に置き換える。
 */
export class TurnScheduler {
  private eventSystem: EventSystem | null = null;
  private entitySystem: EntitySystem | null = null;
  private executor: ActionExecutor | null = null;

  /** ループが動作中か */
  private running = false;

  /** stop() 要求で立てるフラグ */
  private stopping = false;

  /** プレイヤーの入力待ち Promise の resolver */
  private playerInputResolver: ((action: Action | null) => void) | null = null;

  /** 現在のターン番号 */
  private turnNumber = 0;

  /** 連続失敗カウンタ（無限ループ防止） */
  private consecutiveFailures = 0;

  /** 失敗とみなす連続回数の上限 */
  private static readonly MAX_CONSECUTIVE_FAILURES = 10;

  initialize(engine: Engine): void {
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;
    this.executor = new ActionExecutor();
    this.executor.initialize();
  }

  /** 現在のターン番号 */
  getTurnNumber(): number {
    return this.turnNumber;
  }

  /** 動作中か */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * スケジューラを開始する。
   * 最初のターンを開始し、プレイヤー入力を待つ状態になる。
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopping = false;
    this.consecutiveFailures = 0;
    this.turnNumber = 0;
    this.beginTurn();
  }

  /**
   * スケジューラを停止する。
   * - 実行中のループを止める
   * - 保留中のプレイヤー入力 Promise を null で解決する
   */
  stop(): void {
    this.stopping = true;
    this.running = false;
    if (this.playerInputResolver) {
      const resolve = this.playerInputResolver;
      this.playerInputResolver = null;
      resolve(null);
    }
  }

  /**
   * プレイヤー行動を外部（InputSystem）から投入する。
   * スケジューラがプレイヤー入力を待っている場合のみ受け付ける。
   */
  submitPlayerAction(action: Action): void {
    if (this.playerInputResolver) {
      const resolve = this.playerInputResolver;
      this.playerInputResolver = null;
      resolve(action);
    }
  }

  /** プレイヤーが入力待ち状態か */
  isWaitingForPlayerInput(): boolean {
    return this.playerInputResolver !== null;
  }

  /**
   * 1ターンを開始する。
   * turn_started と player_turn_started を発行し、プレイヤー入力を待つ。
   */
  private beginTurn(): void {
    if (this.stopping || !this.running) return;

    this.turnNumber += 1;
    this.consecutiveFailures = 0;

    this.eventSystem?.emit('turn_started', { turn: this.turnNumber });
    this.eventSystem?.emit('player_turn_started', {});

    // プレイヤー行動を待つ
    this.waitForPlayerAction()
      .then((action) => {
        if (this.stopping || !this.running) return;
        if (action) {
          this.handlePlayerAction(action);
        }
      })
      .catch((err) => {
        console.error('TurnScheduler: player action error', err);
      });
  }

  /**
   * プレイヤー行動を処理する。
   * 失敗時は再入力を待つ（行動権を消費しない）。
   * 連続失敗が上限に達したら強制的に敵ターンへ進む。
   */
  private async handlePlayerAction(action: Action): Promise<void> {
    if (this.stopping || !this.running) return;

    const result = await this.runActorTurn(action);

    if (this.stopping || !this.running) return;

    if (!result.success) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= TurnScheduler.MAX_CONSECUTIVE_FAILURES) {
        // 連続失敗上限: 強制的に敵ターンへ進む
        this.consecutiveFailures = 0;
        await this.runEnemyTurns();
        return;
      }
      // 再入力を待つ
      this.waitForPlayerAction()
        .then((nextAction) => {
          if (this.stopping || !this.running) return;
          if (nextAction) {
            this.handlePlayerAction(nextAction);
          }
        })
        .catch((err) => {
          console.error('TurnScheduler: player action retry error', err);
        });
      return;
    }

    this.consecutiveFailures = 0;
    await this.runEnemyTurns();
  }

  /**
   * プレイヤー行動を待つ Promise を返す。
   * stop() で null が返る。
   */
  private waitForPlayerAction(): Promise<Action | null> {
    return new Promise<Action | null>((resolve) => {
      this.playerInputResolver = resolve;
    });
  }

  /**
   * 1アクターの行動を実行し、結果を返す。
   */
  private async runActorTurn(action: Action): Promise<ActionResult> {
    if (!this.executor) return { success: false, consumedTime: 0, reason: 'no_executor' };
    return this.executor.execute(action);
  }

  /**
   * 敵ターンを処理する。
   * 同速時は登録順、速度差は段階7で有効化する。
   * この段階では従来通り1回ずつ順番に実行する。
   */
  private async runEnemyTurns(): Promise<void> {
    if (this.stopping || !this.running) return;
    if (!this.entitySystem) {
      this.beginTurn();
      return;
    }

    this.eventSystem?.emit('enemy_turn_started', {});

    const enemies = this.entitySystem.getEntitiesByTag('enemy');
    const aliveEnemies = enemies.filter((enemy) => {
      const health = enemy.getComponent<HealthComponent>('health');
      if (health) return health.currentHp > 0;
      return enemy.active;
    });

    for (const enemy of aliveEnemies) {
      if (this.stopping || !this.running) return;

      // 行動前に生存確認
      const health = enemy.getComponent<HealthComponent>('health');
      if (health && health.currentHp <= 0) continue;

      this.eventSystem?.emit('enemy_action_started', { enemyId: enemy.id });

      const actor = enemy.getComponent<ActorComponent>('actor');
      if (actor) {
        try {
          await actor.decideAction();
        } catch (error) {
          console.error(`TurnScheduler: enemy ${enemy.id} action error`, error);
        }
      }
    }

    if (this.stopping || !this.running) return;
    this.beginTurn();
  }
}
