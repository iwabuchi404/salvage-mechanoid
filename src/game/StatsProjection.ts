import { useGameStore } from '../stores/gameStore';
import { EventSystem } from '../engine/events/EventSystem';
import { Engine } from '../engine/Engine';
import { isPlayerEntityId } from '../engine/entity/EntityKind';
import { EntitySystem } from '../engine/entity/EntitySystem';

/**
 * BU-2 段階7: ドメイン状態から gameStore への投影モジュール。
 *
 * Player が gameStore を直接参照しなくなったため、
 * ドメインイベントを受けて gameStore の表示用状態を更新する。
 *
 * 以下のイベントを購読する:
 * - health_changed → player.status.hp
 * - stats_changed → player.status.maxHp/maxEnergy/defense/strength/level/viewRadius
 * - energy_changed → player.status.energy/maxEnergy
 * - move_completed → player.position
 */
export class StatsProjection {
  private eventSystem: EventSystem | null = null;

  initialize(): void {
    this.eventSystem = Engine.instance.getSystem<EventSystem>('event') || null;
    if (!this.eventSystem) {
      console.warn('StatsProjection: EventSystem not found');
      return;
    }

    const gameStore = useGameStore();
    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity') || null;

    // HP 変更
    this.eventSystem.on('health_changed', (data) => {
      if (isPlayerEntityId(data.entityId, entitySystem)) {
        gameStore.player.status.hp = data.currentHp;
      }
    });

    // ステータス変更
    this.eventSystem.on('stats_changed', (data) => {
      if (isPlayerEntityId(data.entityId, entitySystem)) {
        gameStore.player.status.maxHp = data.stats.maxHp;
        gameStore.player.status.maxEnergy = data.stats.maxEnergy;
        gameStore.player.status.defense = data.stats.defense;
        // P0-3: gameStore のフィールドも attackPower にリネームし、
        // 往復が恒等になるようにした（+5 変換なし）
        gameStore.player.status.attackPower = data.stats.attackPower;
        gameStore.player.status.viewRadius = data.stats.viewRadius;
        // level は gameStore では別途管理される場合があるが、
        // StatsComponent の level と同期する
        gameStore.player.status.level = data.stats.level;
      }
    });

    // エネルギー変更
    this.eventSystem.on('energy_changed', (data) => {
      if (isPlayerEntityId(data.entityId, entitySystem)) {
        gameStore.player.status.energy = data.currentEnergy;
        gameStore.player.status.maxEnergy = data.maxEnergy;
      }
    });

    // 位置変更
    this.eventSystem.on('move_completed', (data) => {
      if (isPlayerEntityId(data.entityId, entitySystem)) {
        gameStore.player.position = { ...data.position };
      }
    });
  }

  destroy(): void {
    // リスナーの解除は Engine.reset() の EventSystem.destroy() で一括して行われる。
    // Game.reset() は this.statsProjection = null にするため再初期化時に
    // 新しいリスナーが登録される。このメソッドは参照を捨てるだけ。
    this.eventSystem = null;
  }
}
