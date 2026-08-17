import { System } from '../System';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { TurnScheduler } from './TurnScheduler';

/**
 * ターンフェーズ（後方互換用）
 *
 * BU-3 案B: TurnSystem は TurnScheduler への薄い委譲になった。
 * 旧来の currentPhase / processAllEnemies() / 4つのイベントリスナーは撤去された。
 * ターン進行の正本は TurnScheduler に1つだけ存在する。
 */
export enum TurnPhase {
  PLAYER,
  ENEMY,
  END,
}

/**
 * ターン管理システム - TurnScheduler への薄い委譲
 *
 * BU-3 P0-3 修正: 旧TurnSystem の以下を撤去した:
 * - 4つのイベントリスナー（move_completed / player_turn_ended / player_attacked / turn_action_completed）
 * - processAllEnemies()
 * - currentPhase / processingTurn / currentEnemyIndex
 * - switchToEnemyTurn() / startNewTurn()
 *
 * TurnSystem は Engine.registerSystem('turn', ...) の登録先として残り、
 * getTurnNumber() などの公開APIを TurnScheduler へ委譲する。
 */
export class TurnSystem implements System {
  private eventSystem: EventSystem | null = null;
  private scheduler: TurnScheduler | null = null;

  constructor() {
    // TurnScheduler は Game が setScheduler() で注入する
  }

  async initialize(engine: Engine): Promise<void> {
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    // TurnScheduler は Game が別途初期化して setScheduler() で注入する
  }

  update(_deltaTime: number): void {
    // ターン進行は TurnScheduler が行うため、ここでは何もしない
  }

  /** TurnScheduler を注入する（Game が呼ぶ） */
  setScheduler(scheduler: TurnScheduler): void {
    this.scheduler = scheduler;
  }

  /**
   * 現在のターン番号を取得する（TurnScheduler へ委譲）
   */
  getTurnNumber(): number {
    return this.scheduler?.getTurnNumber() ?? 0;
  }

  /**
   * 現在のフェーズを取得する（後方互換用）
   * TurnScheduler が入力待ち中なら PLAYER、そうでなければ ENEMY。
   */
  getCurrentPhase(): TurnPhase {
    if (!this.scheduler) return TurnPhase.PLAYER;
    if (this.scheduler.isWaitingForPlayerInput()) return TurnPhase.PLAYER;
    return TurnPhase.ENEMY;
  }

  destroy(): void {
    this.scheduler = null;
    this.eventSystem = null;
  }
}
