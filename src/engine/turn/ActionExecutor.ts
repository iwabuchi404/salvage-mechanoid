import { Action, ActionResult } from './Action';
import { getActionCost } from './ActionCostTable';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { Player } from '../entity/Player';
import { EnergyComponent } from '../entity/components/Energy';
import { Direction } from '../types';

/**
 * 行動実行器。
 *
 * BU-3 段階3: Action を受け取って実行し、ActionResult を返す。
 * ゲームエネルギー消費を Player からここへ集約する。
 * Player.move() / attack() / turn() は内部実装として残し、
 * ここから呼ぶ。エネルギーチェック・消費は ActionExecutor が行う。
 *
 * まだスケジューラは無く、InputSystem からの直接呼び出し経由で使う。
 */
export class ActionExecutor {
  private entitySystem: EntitySystem | null = null;

  initialize(): void {
    this.entitySystem = Engine.instance.getSystem<EntitySystem>('entity') || null;
  }

  /**
   * 行動を実行する。
   *
   * 1. エネルギーチェック・消費
   * 2. Player の内部メソッドへ委譲
   * 3. 結果を返す
   */
  async execute(action: Action): Promise<ActionResult> {
    const player = this.findPlayer(action.actorId);
    if (!player) {
      return { success: false, consumedTime: 0, reason: 'actor_not_found' };
    }

    // ゲームエネルギーのチェック・消費
    if (action.cost.energyCost > 0) {
      const energy = player.getComponent<EnergyComponent>('energy');
      if (!energy) {
        return { success: false, consumedTime: 0, reason: 'no_energy_component' };
      }
      if (energy.currentEnergy < action.cost.energyCost) {
        return { success: false, consumedTime: 0, reason: 'insufficient_energy' };
      }
      // 消費
      energy.consume(action.cost.energyCost);
      // energy_changed イベントを発行（Player の emitEnergyChanged と同等）
      const eventSystem = Engine.instance.getSystem('event');
      if (eventSystem && typeof (eventSystem as any).emit === 'function') {
        (eventSystem as any).emit('energy_changed', {
          entityId: player.id,
          currentEnergy: energy.currentEnergy,
          maxEnergy: energy.maxEnergy,
          percentage: energy.percentage,
        });
      }
    }

    // 種別ごとの実行
    switch (action.kind) {
      case 'move':
        return this.executeMove(player, action);
      case 'turn':
        return this.executeTurn(player, action);
      case 'attack':
        return this.executeAttack(player, action);
      case 'wait':
        return this.executeWait(player, action);
      default:
        return { success: false, consumedTime: 0, reason: 'unsupported_kind' };
    }
  }

  /** 移動を実行する */
  private executeMove(player: Player, action: Action): ActionResult {
    const direction = action.params?.direction;
    if (!direction) {
      return { success: false, consumedTime: 0, reason: 'no_direction' };
    }
    const ok = player.move(direction);
    return {
      success: ok,
      consumedTime: ok ? action.cost.timeCost : 0,
      reason: ok ? undefined : 'blocked',
    };
  }

  /** 方向転換を実行する */
  private executeTurn(player: Player, action: Action): ActionResult {
    const direction = action.params?.direction;
    if (!direction) {
      return { success: false, consumedTime: 0, reason: 'no_direction' };
    }
    const ok = player.turn(direction);
    return {
      success: ok,
      consumedTime: ok ? action.cost.timeCost : 0,
      reason: ok ? undefined : 'same_direction',
    };
  }

  /** 攻撃を実行する */
  private async executeAttack(player: Player, action: Action): Promise<ActionResult> {
    const power = await player.attack();
    const ok = power > 0;
    return {
      success: ok,
      consumedTime: ok ? action.cost.timeCost : 0,
      reason: ok ? undefined : 'no_target',
    };
  }

  /** 待機を実行する */
  private executeWait(_player: Player, action: Action): ActionResult {
    return { success: true, consumedTime: action.cost.timeCost };
  }

  /** アクターIDから Player を検索する */
  private findPlayer(actorId: string): Player | null {
    if (!this.entitySystem) return null;
    const players = this.entitySystem.getEntitiesByTag('player');
    const found = players.find((p) => p.id === actorId);
    return (found as Player) || null;
  }
}

/**
 * Action を構築するヘルパ。
 * InputSystem / Game が使う。
 */
export function createMoveAction(actorId: string, direction: Direction): Action {
  return {
    kind: 'move',
    actorId,
    cost: getActionCost('move'),
    params: { direction },
  };
}

export function createTurnAction(actorId: string, direction: Direction): Action {
  return {
    kind: 'turn',
    actorId,
    cost: getActionCost('turn'),
    params: { direction },
  };
}

export function createAttackAction(actorId: string): Action {
  return {
    kind: 'attack',
    actorId,
    cost: getActionCost('attack'),
  };
}

export function createWaitAction(actorId: string): Action {
  return {
    kind: 'wait',
    actorId,
    cost: getActionCost('wait'),
  };
}
