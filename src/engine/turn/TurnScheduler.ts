import { Action, ActionResult } from './Action';
import { ActionExecutor } from './ActionExecutor';
import { ActorComponent } from '../entity/components/Actor';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { HealthComponent } from '../entity/components/Health';
import { Entity } from '../entity/Entity';

/**
 * 行動権を得るために必要なスケジューラエネルギー。
 * 1 行動あたり timeCost * ACTION_THRESHOLD を消費する。
 * speed 100 なら 1 tick で1回行動可能、speed 200 なら2回行動可能。
 */
export const ACTION_THRESHOLD = 100;

/**
 * BU-3 案B: エネルギー式スケジューラ
 *
 * 設計ドキュメント docs/design/TURN_MODEL_DESIGN.md の案 B を実装する。
 *
 * 全アクター（プレイヤー・敵）を1つのキューで管理し、
 * schedulerEnergy += speed を毎 tick 蓄積する。
 * schedulerEnergy >= ACTION_THRESHOLD のアクターが行動権を得る。
 * 行動後は consumedTime * ACTION_THRESHOLD を消費する。
 *
 * 同速時の順序保証:
 * - プレイヤーが先（登録順でプレイヤーが先に登録されるため）
 * - 敵は登録順
 * - 同値の schedulerEnergy は安定ソートで登録順を維持
 *
 * リスク対策:
 * 1. 世代カウンタ（runId）で停止後の古いループを無効化
 * 2. stop() 時に入力 Promise を null で解決
 * 3. 失敗行動は最低1時間単位を消費（無限ループ防止）
 */
export class TurnScheduler {
  private eventSystem: EventSystem | null = null;
  private entitySystem: EntitySystem | null = null;
  private executor: ActionExecutor | null = null;

  /** ループが動作中か */
  private running = false;

  /** stop() 要求で立てるフラグ */
  private stopping = false;

  /** 世代カウンタ（stop/start ごとに更新。古いループを無効化する） */
  private runId = 0;

  /** プレイヤーの入力待ち Promise の resolver */
  private playerInputResolver: ((action: Action | null) => void) | null = null;

  /** 現在入力待ち中のプレイヤーID（canAct の判定用） */
  private waitingPlayerId: string | null = null;

  /** 現在のターン番号（プレイヤー行動完了ごとに +1） */
  private turnNumber = 0;

  /** 論理時刻（tick 単位、単調増加） */
  private currentTime = 0;

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

  /** 論理時刻（tick 単位） */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /** 動作中か */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 指定アクターが今まさに行動権を持ち、入力待ちか。
   * InputSystem はこれを使って入力可否を判定する。
   */
  canAct(entityId: string): boolean {
    return this.waitingPlayerId === entityId;
  }

  /**
   * スケジューラを開始する（多重起動しない）。
   * 全アクターの schedulerEnergy をリセットし、ループを開始する。
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopping = false;
    this.runId += 1;
    this.turnNumber = 0;
    this.currentTime = 0;
    this.consecutiveFailures = 0;
    this.idleTickCount = 0;
    this.playerTurnStartedEmitted = false;

    // 全アクターの schedulerEnergy をリセット
    this.resetAllSchedulerEnergy();

    // ループを開始
    this.runLoop(this.runId);
  }

  /**
   * スケジューラを停止する。
   * - 実行中のループを止める（runId で無効化）
   * - 保留中のプレイヤー入力 Promise を null で解決する
   */
  stop(): void {
    this.stopping = true;
    this.running = false;
    this.runId += 1; // 古いループを無効化
    if (this.playerInputResolver) {
      const resolve = this.playerInputResolver;
      this.playerInputResolver = null;
      this.waitingPlayerId = null;
      resolve(null);
    }
  }

  /**
   * プレイヤー行動を外部（InputSystem）から投入する。
   * 入力待ちでなければ false を返す。
   */
  submitPlayerAction(action: Action): boolean {
    if (this.playerInputResolver) {
      const resolve = this.playerInputResolver;
      const playerId = this.waitingPlayerId;
      this.playerInputResolver = null;
      this.waitingPlayerId = null;

      // player_input_resolved を発行
      if (playerId) {
        this.eventSystem?.emit('player_input_resolved', {
          playerId,
          turn: this.turnNumber,
        });
      }

      resolve(action);
      return true;
    }
    return false;
  }

  /** プレイヤーが入力待ち状態か（後方互換用） */
  isWaitingForPlayerInput(): boolean {
    return this.waitingPlayerId !== null;
  }

  // ===== 内部実装 =====

  /** 連続失敗カウンタ（無限ループ防止） */
  private consecutiveFailures = 0;
  private static readonly MAX_CONSECUTIVE_FAILURES = 10;

  /**
   * 現ターンで player_turn_started を発行済みか。
   * プレイヤーが高速化等で1ターンに複数回行動権を得ても、
   * player_turn_started は最初の1回のみ発行する（SkillSystem / UI の整合性）。
   */
  private playerTurnStartedEmitted = false;

  /** 候補が空の tick が連続した回数（actionSpeed 0 による同期スピン防止） */
  private idleTickCount = 0;
  /** 候補が空の tick の上限。到達したら強制的に行動権を与える */
  private static readonly MAX_IDLE_TICKS = 200;

  /**
   * 全アクターの schedulerEnergy をリセットする。
   */
  private resetAllSchedulerEnergy(): void {
    if (!this.entitySystem) return;
    const actors = this.getAllActors();
    for (const { actor } of actors) {
      actor.schedulerEnergy = 0;
    }
  }

  /**
   * 全アクターを取得する（プレイヤー先、敵は登録順）。
   * 同速時の順序保証のためにこの順序を維持する。
   */
  private getAllActors(): { entity: Entity; actor: ActorComponent }[] {
    if (!this.entitySystem) return [];

    const result: { entity: Entity; actor: ActorComponent }[] = [];

    // プレイヤー先
    const players = this.entitySystem.getEntitiesByTag('player');
    for (const p of players) {
      const actor = p.getComponent<ActorComponent>('actor');
      if (actor) result.push({ entity: p, actor });
    }

    // 敵は登録順
    const enemies = this.entitySystem.getEntitiesByTag('enemy');
    for (const e of enemies) {
      const actor = e.getComponent<ActorComponent>('actor');
      if (actor) result.push({ entity: e, actor });
    }

    return result;
  }

  /**
   * 案Bのメインループ。
   * runId が一致する間のみ継続する（stop() で無効化）。
   */
  private async runLoop(myRunId: number): Promise<void> {
    while (this.running && !this.stopping && myRunId === this.runId) {
      // 全アクターを取得
      const actors = this.getAllActors();
      if (actors.length === 0) {
        // アクターがいない場合は停止
        break;
      }

      // 候補 = schedulerEnergy >= ACTION_THRESHOLD のアクター
      const candidates = actors.filter(({ actor, entity }) => {
        // 死亡チェック
        const health = entity.getComponent<HealthComponent>('health');
        if (health && health.currentHp <= 0) return false;
        return actor.schedulerEnergy >= ACTION_THRESHOLD;
      });

      if (candidates.length === 0) {
        // 候補が空: 全アクターの schedulerEnergy += speed、currentTime += 1
        // P2 対策: actionSpeed が 0 のアクターがいると await なしの同期ループになる。
        // 空振り回数をカウントし、上限に達したら強制的に await を挟んでブラウザ固まりを防ぐ。
        // また actionSpeed が全員 0 以下だと永久に候補が生まれないため、
        // 空振り上限に達したら強制的に ACTION_THRESHOLD を与えて行動権を発生させる。
        this.idleTickCount += 1;
        if (this.idleTickCount >= TurnScheduler.MAX_IDLE_TICKS) {
          // 全アクターの actionSpeed が 0 以下の可能性がある。
          // 強制的に ACTION_THRESHOLD を与えて行動権を発生させ、
          // さらに await を挟んでイベントループへ制御を返す。
          for (const { actor } of actors) {
            actor.addSchedulerEnergy(ACTION_THRESHOLD);
          }
          this.currentTime += 1;
          this.idleTickCount = 0;
          await Promise.resolve();
          continue;
        }
        for (const { actor } of actors) {
          // actionSpeed の下限を 0 として扱う（負数は加算しない）
          const speed = Math.max(0, actor.speed);
          actor.addSchedulerEnergy(speed);
        }
        this.currentTime += 1;
        // 同期スピン防止: 毎 tick で必ず1回はイベントループへ制御を返す
        await Promise.resolve();
        continue;
      }
      // 候補が見つかったのでアイドルカウントをリセット
      this.idleTickCount = 0;

      // 候補のうち schedulerEnergy 最大（同値なら登録順で安定ソート）
      // getAllActors が既に登録順（プレイヤー先）で返しているので、
      // filter で順序が保たれる。最大値を探す。
      let best = candidates[0];
      for (let i = 1; i < candidates.length; i++) {
        if (candidates[i].actor.schedulerEnergy > best.actor.schedulerEnergy) {
          best = candidates[i];
        }
      }

      // このアクターを行動させる
      const shouldContinue = await this.processActorTurn(best.entity, best.actor, myRunId);
      if (!shouldContinue) break;
    }
  }

  /**
   * 1アクターの行動を処理する。
   * @returns ループを継続するか
   */
  private async processActorTurn(
    entity: Entity,
    actor: ActorComponent,
    myRunId: number
  ): Promise<boolean> {
    if (this.stopping || !this.running || myRunId !== this.runId) return false;

    // 行動前に生存確認
    const health = entity.getComponent<HealthComponent>('health');
    if (health && health.currentHp <= 0) return true;

    // actor_turn_started を発行
    this.eventSystem?.emit('actor_turn_started', {
      actorId: entity.id,
      time: this.currentTime,
    });

    // 既存の enemy_turn_started / enemy_action_started も併存（UI が購読中）
    if (!actor.inputControlled) {
      this.eventSystem?.emit('enemy_turn_started', {});
      this.eventSystem?.emit('enemy_action_started', { enemyId: entity.id });
    }

    let action: Action | null;

    if (actor.inputControlled) {
      // プレイヤー: 入力待ち
      this.waitingPlayerId = entity.id;

      // player_input_requested を発行（InputSystem がこれで入力を有効化する）
      this.eventSystem?.emit('player_input_requested', {
        playerId: entity.id,
        turn: this.turnNumber,
      });

      // 既存の player_turn_started も併存（UI が購読中）
      // P2 対策: 1ターンにつき最初の行動権時のみ発行する。
      // turnNumber が進むと playerTurnStartedEmitted が false にリセットされる。
      // プレイヤーが高速化等で1ターンに複数回行動権を得ても、
      // 2回目以降は player_input_requested のみ発行される。
      if (!this.playerTurnStartedEmitted) {
        this.playerTurnStartedEmitted = true;
        this.eventSystem?.emit('player_turn_started', {});
      }

      action = await this.waitForPlayerAction(myRunId);

      if (this.stopping || !this.running || myRunId !== this.runId) return false;
      if (action === null) return false; // stop() で中断
    } else {
      // 敵: AI に行動を決めさせる
      try {
        action = await actor.decideAction();
      } catch (error) {
        console.error(`TurnScheduler: actor ${entity.id} decideAction error`, error);
        action = null;
      }

      if (this.stopping || !this.running || myRunId !== this.runId) return false;
    }

    // 行動を実行
    let result: ActionResult;
    if (action && this.executor) {
      // Action が返された場合は ActionExecutor 経由で実行
      result = await this.executor.execute(action);
    } else {
      // null の場合は decideAction 内で副作用実行済み（従来互換）
      result = { success: true, consumedTime: 1 };
    }

    if (this.stopping || !this.running || myRunId !== this.runId) return false;

    // プレイヤー行動失敗時の処理:
    // - エネルギーを消費しない（プレイヤーが即座に再試行できる）
    // - ターン番号を進めない
    // - 連続失敗カウントをインクリメント
    // - 連続失敗が上限に達したら強制的にエネルギーを消費してターンを進める
    if (actor.inputControlled && !result.success) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= TurnScheduler.MAX_CONSECUTIVE_FAILURES) {
        // 連続失敗上限: 強制的にエネルギーを消費してターンを進める
        this.consecutiveFailures = 0;
        actor.consumeSchedulerEnergy(ACTION_THRESHOLD);
        this.turnNumber += 1;
        this.playerTurnStartedEmitted = false;
        this.eventSystem?.emit('turn_started', { turn: this.turnNumber });
      }
      // 失敗時はエネルギー消費・ターン進行なし（再試行できる）
      return true;
    }

    // 敵行動失敗時の処理（設計 §5 リスク3）:
    // - 最低 ACTION_THRESHOLD を消費して行動権を放棄する
    // - 消費しないと schedulerEnergy が閾値を超えたままになり、
    //   同じ敵が毎 tick 選ばれ続けて無限ループになる
    if (!actor.inputControlled && !result.success) {
      const failCost = Math.max(result.consumedTime, 1);
      actor.consumeSchedulerEnergy(failCost * ACTION_THRESHOLD);
      return true;
    }

    // 成功時: エネルギーを消費し、プレイヤーならターン番号を進める
    const consumedTime = result.consumedTime;
    actor.consumeSchedulerEnergy(consumedTime * ACTION_THRESHOLD);

    if (actor.inputControlled && consumedTime > 0) {
      this.turnNumber += 1;
      this.consecutiveFailures = 0;
      this.playerTurnStartedEmitted = false;
      this.eventSystem?.emit('turn_started', { turn: this.turnNumber });
    }

    return true;
  }

  /**
   * プレイヤー行動を待つ Promise を返す。
   * stop() で null が返る。
   * runId が不一致になった場合も null を返す（古いループの無効化）。
   */
  private waitForPlayerAction(myRunId: number): Promise<Action | null> {
    return new Promise<Action | null>((resolve) => {
      this.playerInputResolver = (action) => {
        if (myRunId !== this.runId) {
          resolve(null);
          return;
        }
        resolve(action);
      };
    });
  }
}
