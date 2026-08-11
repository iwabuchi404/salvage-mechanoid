import { Engine } from '../../Engine';
import { EventSystem } from '../../events/EventSystem';
import { EntitySystem } from '../EntitySystem';
import { WorldSystem } from '../../world/WorldSystem';
import { TransformComponent } from '../components/Transform';
import { Vector3 } from '../../types';
import { EnemyActionContext } from './EnemyActionContext';

/**
 * EnemyActionContext の具象実装
 *
 * Engine.instance 経由で WorldSystem・EntitySystem・EventSystem へアクセスし、
 * Strategy 側へは Engine.instance への直接参照を隠蔽する。
 */
export class EnemyActionContextImpl implements EnemyActionContext {
  getPlayerPosition(): Vector3 | null {
    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity');
    if (!entitySystem) return null;

    const players = entitySystem.getEntitiesByTag('player');
    if (players.length === 0) return null;

    const player = players[0];
    const transform = player.getComponent<TransformComponent>('transform');
    return transform ? transform.position : null;
  }

  findPath(from: Vector3, to: Vector3, maxSteps = 20, excludeEntityId?: string): Vector3[] {
    const worldSystem = Engine.instance.getSystem<WorldSystem>('world');
    if (!worldSystem) return [];
    return worldSystem.findPath(from, to, maxSteps, excludeEntityId);
  }

  getDistance(from: Vector3, to: Vector3): number {
    const worldSystem = Engine.instance.getSystem<WorldSystem>('world');
    if (!worldSystem) {
      // フォールバック: マンハッタン距離
      return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    }
    return worldSystem.getDistance(from, to);
  }

  requestAttack(enemyId: string, targetId: string): void {
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    eventSystem?.emit('enemy_attack_requested', {
      enemyId,
      targetId,
    });
  }
}
