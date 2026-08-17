import { useGameStore } from '../stores/gameStore';
import { useGameViewStateStore } from '../stores/gameViewStateStore';
import { EventSystem } from '../engine/events/EventSystem';
import { Engine } from '../engine/Engine';
import { isPlayerEntityId } from '../engine/entity/EntityKind';
import { EntitySystem } from '../engine/entity/EntitySystem';

/**
 * BU-2 段階7 / BU-4 段階2: ドメイン状態からストアへの投影モジュール。
 *
 * Player が gameStore を直接参照しなくなったため、
 * ドメインイベントを受けて表示用状態を更新する。
 *
 * 投影先:
 * - gameStore: 永続的なゲームデータ（HP/エネルギー/ステータス/位置 は BU-2 から継続）
 * - gameViewStateStore: 実行中の表示状態（HP/エネルギー/方向/位置/進行）
 *
 * 以下のイベントを購読する:
 * - health_changed → player.status.hp / viewState.player.hp
 * - stats_changed → player.status.* / viewState.player.*
 * - energy_changed → player.status.energy / viewState.player.energy
 * - move_completed → player.position / viewState.player.position
 * - direction_changed → viewState.player.direction
 * - turn_started → viewState.progress.turn
 * - player_turn_started → viewState.progress.isPlayerTurn = true
 * - enemy_turn_started → viewState.progress.isPlayerTurn = false
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
    const viewStore = useGameViewStateStore();
    const entitySystem = Engine.instance.getSystem<EntitySystem>('entity') || null;

    // HP 変更
    this.eventSystem.on('health_changed', (data) => {
      if (isPlayerEntityId(data.entityId, entitySystem)) {
        gameStore.player.status.hp = data.currentHp;
        viewStore.setPlayer({ hp: data.currentHp });
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
        viewStore.setPlayer({
          maxHp: data.stats.maxHp,
          maxEnergy: data.stats.maxEnergy,
          level: data.stats.level,
        });
      }
    });

    // エネルギー変更
    this.eventSystem.on('energy_changed', (data) => {
      if (isPlayerEntityId(data.entityId, entitySystem)) {
        gameStore.player.status.energy = data.currentEnergy;
        gameStore.player.status.maxEnergy = data.maxEnergy;
        viewStore.setPlayer({
          energy: data.currentEnergy,
          maxEnergy: data.maxEnergy,
        });
      }
    });

    // 位置変更
    this.eventSystem.on('move_completed', (data) => {
      if (isPlayerEntityId(data.entityId, entitySystem)) {
        gameStore.player.position = { ...data.position };
        viewStore.setPlayer({
          position: { x: data.position.x, y: data.position.y },
        });
      }
    });

    // 方向変更（BU-4 段階2: viewState へ投影）
    this.eventSystem.on('direction_changed', (data) => {
      if (isPlayerEntityId(data.entityId, entitySystem)) {
        viewStore.setPlayer({ direction: data.direction });
      }
    });

    // ターン進行（BU-4 段階2: viewState.progress へ投影）
    this.eventSystem.on('turn_started', (data) => {
      viewStore.setProgress({ turn: data.turn });
    });

    // プレイヤーターン開始
    this.eventSystem.on('player_turn_started', () => {
      viewStore.setProgress({ isPlayerTurn: true });
    });

    // 敵ターン開始
    this.eventSystem.on('enemy_turn_started', () => {
      viewStore.setProgress({ isPlayerTurn: false });
    });
  }

  destroy(): void {
    // リスナーの解除は Engine.reset() の EventSystem.destroy() で一括して行われる。
    // Game.reset() は this.statsProjection = null にするため再初期化時に
    // 新しいリスナーが登録される。このメソッドは参照を捨てるだけ。
    this.eventSystem = null;
  }
}
