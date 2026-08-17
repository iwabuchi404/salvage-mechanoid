import { createPinia, setActivePinia } from 'pinia';
import { Engine } from '@/engine/Engine';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { HealthComponent } from '@/engine/entity/components/Health';
import { EnergyComponent } from '@/engine/entity/components/Energy';
import { StatsComponent } from '@/engine/entity/components/Stats';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { MovementComponent } from '@/engine/entity/components/Movement';
import { Player } from '@/engine/entity/Player';
import { StatsProjection } from '@/game/StatsProjection';
import { useGameStore } from '@/stores/gameStore';
import { useGameViewStateStore } from '@/stores/gameViewStateStore';

/**
 * 結合テスト I-6: ドメイン変化 → StatsProjection → gameViewStateStore の往復
 *
 * docs/TESTING_STRATEGY.md §8 段階2:
 * - I-6: ドメイン変化 → StatsProjection → gameViewStateStore の往復
 *
 * 防ぐ不具合 #5: gameStore 往復で攻撃力が累積。
 * ドメインイベント → StatsProjection → ストア への投影が正しく行われ、
 * 累積や欠落がないことを検証する。
 */
describe('結合テスト I-6: ドメイン変化 → StatsProjection → ストアの往復', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let player: Player;
  let projection: StatsProjection;
  let gameStore: ReturnType<typeof useGameStore>;
  let viewStore: ReturnType<typeof useGameViewStateStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());

    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    Engine.instance.registerSystem('event', events);
    Engine.instance.registerSystem('entity', entities);

    const engine = Engine.instance;
    await entities.initialize(engine);

    // プレイヤーを作成して登録
    player = new Player(
      'player',
      { x: 5, y: 5, z: 0 },
      {
        maxHp: 100,
        hp: 100,
        maxEnergy: 200,
        energy: 200,
        defense: 5,
        attackPower: 15,
        viewRadius: 4,
        level: 1,
      }
    );
    await player.initialize();
    entities.registerEntity(player);

    // StatsProjection を初期化
    projection = new StatsProjection();
    projection.initialize();

    gameStore = useGameStore();
    viewStore = useGameViewStateStore();
  });

  afterEach(() => {
    projection.destroy();
    Engine.instance.reset();
  });

  /**
   * I-6: HP 変更イベント → gameStore + viewStore への投影
   */
  it('I-6: health_changed が gameStore と viewStore の両方へ投影される', () => {
    const health = player.getComponent<HealthComponent>('health')!;
    health.takeDamage(30, true, true);

    expect(gameStore.player.status.hp).toBe(70);
    expect(viewStore.player.hp).toBe(70);
  });

  /**
   * I-6: エネルギー変更イベント → gameStore + viewStore への投影
   *
   * energy_changed は Player.consumeEnergy() 経由で発行されるため、
   * ここではイベントを直接発行して投影を検証する。
   */
  it('I-6: energy_changed が gameStore と viewStore の両方へ投影される', () => {
    events.emit('energy_changed', {
      entityId: 'player',
      currentEnergy: 150,
      maxEnergy: 200,
      percentage: 75,
    });

    expect(gameStore.player.status.energy).toBe(150);
    expect(viewStore.player.energy).toBe(150);
  });

  /**
   * I-6: 位置変更イベント → gameStore + viewStore への投影
   */
  it('I-6: move_completed が gameStore と viewStore の両方へ投影される', () => {
    events.emit('move_completed', {
      entityId: 'player',
      position: { x: 7, y: 8, z: 0 },
      direction: 'right',
    });

    expect(gameStore.player.position).toEqual({ x: 7, y: 8, z: 0 });
    expect(viewStore.player.position).toEqual({ x: 7, y: 8 });
  });

  /**
   * I-6: 方向変更イベント → viewStore への投影（gameStore には投影しない）
   */
  it('I-6: direction_changed が viewStore へ投影される', () => {
    events.emit('direction_changed', {
      entityId: 'player',
      direction: 'right',
    });

    expect(viewStore.player.direction).toBe('right');
  });

  /**
   * I-6: ターン進行イベント → viewStore.progress への投影
   */
  it('I-6: turn_started が viewStore.progress.turn へ投影される', () => {
    events.emit('turn_started', { turn: 5 });
    expect(viewStore.progress.turn).toBe(5);
  });

  /**
   * I-6: player_turn_started / enemy_turn_started → isPlayerTurn の切り替え
   */
  it('I-6: player_turn_started / enemy_turn_started で isPlayerTurn が切り替わる', () => {
    events.emit('player_turn_started', {});
    expect(viewStore.progress.isPlayerTurn).toBe(true);

    events.emit('enemy_turn_started', {});
    expect(viewStore.progress.isPlayerTurn).toBe(false);

    events.emit('player_turn_started', {});
    expect(viewStore.progress.isPlayerTurn).toBe(true);
  });

  /**
   * I-6: 攻撃力変更が累積しない（投影層の回帰防止）
   *
   * StatsProjection が stats_changed を受けて gameStore へ投影する際、
   * 上書き代入であり累積しないことを検証する。
   * ※ リトライ経路の累積は RetryAttackPowerAccumulation.spec.ts で実経路検証する。
   */
  it('I-6: stats_changed を複数回発行しても attackPower が累積しない', () => {
    const fullStats = {
      maxHp: 100,
      maxEnergy: 200,
      defense: 5,
      attackPower: 15,
      viewRadius: 4,
      moveSpeed: 4,
      carryCapacity: 10,
      level: 1,
    };

    // stats_changed を3回発行（同じ値）
    for (let i = 0; i < 3; i++) {
      events.emit('stats_changed', {
        entityId: 'player',
        stats: fullStats,
        previous: fullStats,
      });
    }

    // 累積されていないことを確認
    expect(gameStore.player.status.attackPower).toBe(15);
    expect(gameStore.player.status.defense).toBe(5);
    expect(gameStore.player.status.maxHp).toBe(100);
  });

  /**
   * I-6: stats_changed で viewStore の maxHp / maxEnergy / level が更新される
   */
  it('I-6: stats_changed で viewStore の maxHp / maxEnergy / level が更新される', () => {
    const fullStats = {
      maxHp: 120,
      maxEnergy: 250,
      defense: 8,
      attackPower: 20,
      viewRadius: 5,
      moveSpeed: 5,
      carryCapacity: 12,
      level: 3,
    };

    events.emit('stats_changed', {
      entityId: 'player',
      stats: fullStats,
      previous: fullStats,
    });

    expect(viewStore.player.maxHp).toBe(120);
    expect(viewStore.player.maxEnergy).toBe(250);
    expect(viewStore.player.level).toBe(3);
  });
});
