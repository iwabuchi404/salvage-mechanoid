import { Action, ActionResult } from './Action';
import { getActionCost } from './ActionCostTable';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { Entity } from '../entity/Entity';
import { MovementComponent } from '../entity/components/Movement';
import { TransformComponent } from '../entity/components/Transform';
import { StatsComponent } from '../entity/components/Stats';
import { EnergyComponent } from '../entity/components/Energy';
import { EventSystem } from '../events/EventSystem';
import { Direction } from '../types';

/**
 * 行動実行器。
 *
 * BU-3 段階3: Action を受け取って実行し、ActionResult を返す。
 * ゲームエネルギー消費を Player からここへ集約する。
 *
 * BU-3 P2 / 段階6 修正: プレイヤー専用から汎用化。
 * - action.actorId で任意のアクター（プレイヤー・敵）を解決する
 * - instanceof を使わず、MovementComponent / TransformComponent / StatsComponent 経由で実行する
 * - 攻撃は player タグ / enemy タグでイベント発行先を切り替える
 * - 敵の Action も ActionExecutor 経由で実行できる
 */
export class ActionExecutor {
  private entitySystem: EntitySystem | null = null;

  initialize(): void {
    this.entitySystem = Engine.instance.getSystem<EntitySystem>('entity') || null;
  }

  /**
   * 行動を実行する。
   *
   * 1. アクターを actorId で解決（プレイヤー・敵どちらでも可）
   * 2. ゲームエネルギーチェック・消費（EnergyComponent がある場合のみ）
   * 3. 種別ごとの実行へ委譲（コンポーネント経由）
   * 4. 結果を返す
   */
  async execute(action: Action): Promise<ActionResult> {
    const actor = this.findActor(action.actorId);
    if (!actor) {
      return { success: false, consumedTime: 0, reason: 'actor_not_found' };
    }

    // ゲームエネルギーのチェック・消費（EnergyComponent がある場合のみ = プレイヤー）
    if (action.cost.energyCost > 0) {
      const energy = actor.getComponent<EnergyComponent>('energy');
      if (energy) {
        if (energy.currentEnergy < action.cost.energyCost) {
          return { success: false, consumedTime: 0, reason: 'insufficient_energy' };
        }
        energy.consume(action.cost.energyCost);
        const eventSystem = Engine.instance.getSystem<EventSystem>('event');
        eventSystem?.emit('energy_changed', {
          entityId: actor.id,
          currentEnergy: energy.currentEnergy,
          maxEnergy: energy.maxEnergy,
          percentage: energy.percentage,
        });
      }
    }

    switch (action.kind) {
      case 'move':
        return this.executeMove(actor, action);
      case 'turn':
        return this.executeTurn(actor, action);
      case 'attack':
        return await this.executeAttack(actor, action);
      case 'wait':
        return this.executeWait(actor, action);
      default:
        return { success: false, consumedTime: 0, reason: 'unsupported_kind' };
    }
  }

  /** 移動を実行する（MovementComponent 経由・プレイヤー・敵共通） */
  private executeMove(actor: Entity, action: Action): ActionResult {
    const direction = action.params?.direction;
    if (!direction) {
      return { success: false, consumedTime: 0, reason: 'no_direction' };
    }
    const movement = actor.getComponent<MovementComponent>('movement');
    if (!movement) {
      return { success: false, consumedTime: 0, reason: 'no_movement_component' };
    }
    // 方向を設定してから移動
    movement.direction = direction;
    const ok = movement.moveInDirection(direction);
    return {
      success: ok,
      consumedTime: ok ? action.cost.timeCost : 0,
      reason: ok ? undefined : 'blocked',
    };
  }

  /** 方向転換を実行する（MovementComponent 経由・プレイヤー・敵共通） */
  private executeTurn(actor: Entity, action: Action): ActionResult {
    const direction = action.params?.direction;
    if (!direction) {
      return { success: false, consumedTime: 0, reason: 'no_direction' };
    }
    const movement = actor.getComponent<MovementComponent>('movement');
    if (!movement) {
      return { success: false, consumedTime: 0, reason: 'no_movement_component' };
    }
    if (movement.direction === direction) {
      return { success: false, consumedTime: 0, reason: 'same_direction' };
    }
    movement.direction = direction;
    return {
      success: true,
      consumedTime: action.cost.timeCost,
    };
  }

  /**
   * 攻撃を実行する。
   *
   * プレイヤー: player_attacked イベントを発行（CombatSystem が処理）
   * 敵: enemy_attack_requested イベントを発行（CombatSystem が処理）
   *
   * どちらもタグで判定し、instanceof を使わない。
   * direction が指定されていれば、攻撃前に方向を設定する。
   */
  private async executeAttack(actor: Entity, action: Action): Promise<ActionResult> {
    const movement = actor.getComponent<MovementComponent>('movement');
    const transform = actor.getComponent<TransformComponent>('transform');
    if (!movement || !transform) {
      return { success: false, consumedTime: 0, reason: 'no_components' };
    }

    // direction が指定されていれば方向を設定
    const direction = action.params?.direction;
    if (direction) {
      movement.direction = direction;
    }

    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (!eventSystem) {
      return { success: false, consumedTime: 0, reason: 'no_event_system' };
    }

    if (actor.hasTag('player')) {
      // プレイヤー攻撃: player_attacked イベントを発行
      const position = transform.position;
      const dir = movement.direction;
      let targetX = position.x;
      let targetY = position.y;
      switch (dir) {
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

      const stats = actor.getComponent<StatsComponent>('stats');
      const attackPower = stats ? stats.getValue('attackPower') : 0;

      eventSystem.emit('player_attacked', {
        attackerId: actor.id,
        position: { x: targetX, y: targetY, z: position.z },
        power: attackPower,
      });
      return {
        success: attackPower > 0,
        consumedTime: attackPower > 0 ? action.cost.timeCost : 0,
        reason: attackPower > 0 ? undefined : 'no_power',
      };
    }

    if (actor.hasTag('enemy')) {
      // 敵攻撃: enemy_attack_requested イベントを発行
      eventSystem.emit('enemy_attack_requested', {
        enemyId: actor.id,
        targetId: 'player',
      });
      return {
        success: true,
        consumedTime: action.cost.timeCost,
      };
    }

    return { success: false, consumedTime: 0, reason: 'actor_not_attackable' };
  }

  /** 待機を実行する */
  private executeWait(_actor: Entity, action: Action): ActionResult {
    return { success: true, consumedTime: action.cost.timeCost };
  }

  /**
   * actorId からアクターを検索する。
   * プレイヤー・敵どちらでも解決可能（P2 汎用化）。
   */
  private findActor(actorId: string): Entity | null {
    if (!this.entitySystem) return null;
    const players = this.entitySystem.getEntitiesByTag('player');
    const foundPlayer = players.find((p) => p.id === actorId);
    if (foundPlayer) return foundPlayer;
    const enemies = this.entitySystem.getEntitiesByTag('enemy');
    const foundEnemy = enemies.find((e) => e.id === actorId);
    if (foundEnemy) return foundEnemy;
    return null;
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
