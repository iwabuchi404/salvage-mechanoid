import { Engine } from '@/engine/Engine';
import { Enemy } from '@/engine/entity/Enemy';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { HealthComponent } from '@/engine/entity/components/Health';
import { MovementComponent } from '@/engine/entity/components/Movement';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { EnemyBehavior, EnemyType, PlacedEnemy, TileType, Vector3 } from '@/engine/types';
import { EnemyActionContext } from '@/engine/entity/ai/EnemyActionContext';
import { EnemyBehaviorStrategyFactory } from '@/engine/entity/ai/EnemyBehaviorStrategyFactory';
import { StaticBehavior } from '@/engine/entity/ai/StaticBehavior';
import { PatrolBehavior } from '@/engine/entity/ai/PatrolBehavior';
import { GuardBehavior } from '@/engine/entity/ai/GuardBehavior';
import { AggressiveBehavior } from '@/engine/entity/ai/AggressiveBehavior';
import { getDirectionFromPositions, getDirectionToTarget } from '@/engine/entity/ai/EnemyAIUtils';

/**
 * Enemy AI Strategy の単体テスト
 *
 * 各 Strategy が EnemyActionContext（モック）経由で
 * 正しい行動を選択することを検証する。
 * Engine.instance や PixiJS に依存しない純粋なロジックテスト。
 */
describe('Enemy AI Strategy', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let world: WorldSystem;
  let player: Entity;
  let playerTransform: TransformComponent;

  /**
   * モック ActionContext を生成する
   */
  const createMockContext = (overrides: Partial<EnemyActionContext> = {}): EnemyActionContext => {
    return {
      getPlayerPosition: () => {
        const transform = player.getComponent<TransformComponent>('transform');
        return transform ? transform.position : null;
      },
      findPath: (from: Vector3, to: Vector3, _maxSteps?: number, _excludeEntityId?: string) => {
        return world.findPath(from, to, 20, _excludeEntityId);
      },
      getDistance: (from: Vector3, to: Vector3) => world.getDistance(from, to),
      requestAttack: (enemyId: string, targetId: string) => {
        events.emit('enemy_attack_requested', { enemyId, targetId });
      },
      ...overrides,
    };
  };

  const createPlacedEnemy = (overrides: Partial<PlacedEnemy> = {}): PlacedEnemy => ({
    id: 'enemy-strategy-1',
    type: EnemyType.SOLDIER,
    x: 5,
    y: 5,
    level: 1,
    behavior: EnemyBehavior.STATIC,
    ...overrides,
  });

  const createEnemy = (overrides: Partial<PlacedEnemy> = {}): Enemy => {
    const enemy = new Enemy(createPlacedEnemy(overrides));
    entities.registerEntity(enemy);
    return enemy;
  };

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();

    const map = new TileMap(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.setTileAt(x, y, 0, TileType.TILE, true);
      }
    }
    world = new WorldSystem(map);

    Engine.instance.registerSystem('event', events);
    Engine.instance.registerSystem('entity', entities);
    Engine.instance.registerSystem('world', world);

    const engine = Engine.instance;
    await entities.initialize(engine);
    await world.initialize(engine);

    player = new Entity('player', 'player');
    player.addTag('player');
    playerTransform = new TransformComponent(2, 2, 0);
    player.addComponent(playerTransform);
    entities.registerEntity(player);
  });

  afterEach(() => {
    Engine.instance.reset();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /**
   * act() を実行し、内部のタイムアウトを解決する
   * Enemy.act() 経由で Strategy を呼び出す（Strategy 状態が維持される）
   */
  const runAct = async (enemy: Enemy, _context: EnemyActionContext): Promise<void> => {
    jest.useFakeTimers();
    const actPromise = enemy.act();
    jest.advanceTimersByTime(700);
    await actPromise;
    jest.useRealTimers();

    const movement = enemy.getComponent<MovementComponent>('movement');
    if (movement && movement.isMoving) {
      movement.update(1000);
    }
  };

  describe('StaticBehavior', () => {
    it('移動せずプレイヤーの方向を向く', async () => {
      playerTransform.setPosition(8, 5, 0);
      const enemy = createEnemy({
        id: 'static-1',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.STATIC,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;
      const initialPos = transform.position;

      await runAct(enemy, createMockContext());

      expect(enemy.getDirection()).toBe('right');
      expect(transform.position).toEqual(initialPos);
    });

    it('プレイヤー不在時に何もしない', async () => {
      entities.removeEntity('player');
      const enemy = createEnemy({
        id: 'static-no-player',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.STATIC,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;
      const initialPos = transform.position;

      await runAct(enemy, createMockContext());

      expect(transform.position).toEqual(initialPos);
    });
  });

  describe('PatrolBehavior', () => {
    it('巡回ルートに沿って移動する', async () => {
      const patrolRoute: Vector3[] = [
        { x: 5, y: 5, z: 0 },
        { x: 7, y: 5, z: 0 },
      ];
      const enemy = createEnemy({
        id: 'patrol-1',
        x: 3,
        y: 5,
        behavior: EnemyBehavior.PATROL,
        patrolRoute,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;

      playerTransform.setPosition(0, 0, 0);

      await runAct(enemy, createMockContext());

      expect(transform.position.x).toBe(4);
      expect(enemy.getDirection()).toBe('right');
    });

    it('巡回ルートの端で折り返す', async () => {
      const patrolRoute: Vector3[] = [
        { x: 5, y: 5, z: 0 },
        { x: 7, y: 5, z: 0 },
      ];
      const enemy = createEnemy({
        id: 'patrol-bounce',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.PATROL,
        patrolRoute,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;

      playerTransform.setPosition(0, 0, 0);

      // 1回目: 到達判定 → patrolIndex 0→1
      await runAct(enemy, createMockContext());
      expect(transform.position.x).toBe(5);

      // 2回目: (7,5) へ移動
      await runAct(enemy, createMockContext());
      expect(transform.position.x).toBe(6);
      expect(enemy.getDirection()).toBe('right');

      // 3回目: (7,5) へ移動
      await runAct(enemy, createMockContext());
      expect(transform.position.x).toBe(7);

      // 4回目: 到達 → patrolIndex 反転
      await runAct(enemy, createMockContext());

      // 5回目: 折り返して左へ
      await runAct(enemy, createMockContext());
      expect(transform.position.x).toBeLessThan(7);
      expect(enemy.getDirection()).toBe('left');
    });

    it('巡回ルートがない場合にランダム移動へフォールバックする', async () => {
      const enemy = createEnemy({
        id: 'patrol-no-route',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.PATROL,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;
      const initialPos = transform.position;

      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

      playerTransform.setPosition(0, 0, 0);
      await runAct(enemy, createMockContext());

      expect(transform.position).not.toEqual(initialPos);
      randomSpy.mockRestore();
    });
  });

  describe('GuardBehavior', () => {
    it('感知範囲内のプレイヤーを追跡する', async () => {
      playerTransform.setPosition(5, 2, 0);
      const enemy = createEnemy({
        id: 'guard-1',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.GUARD,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;

      await runAct(enemy, createMockContext());

      expect(transform.position.y).toBe(4);
      expect(enemy.getDirection()).toBe('up');
    });

    it('感知範囲外のプレイヤーを追跡しない', async () => {
      playerTransform.setPosition(0, 0, 0);
      const enemy = createEnemy({
        id: 'guard-far',
        x: 9,
        y: 9,
        behavior: EnemyBehavior.GUARD,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;
      const initialPos = transform.position;

      await runAct(enemy, createMockContext());

      expect(transform.position).toEqual(initialPos);
      expect(enemy.getDirection()).toBe('up');
    });
  });

  describe('AggressiveBehavior', () => {
    it('常にプレイヤーを追跡する', async () => {
      playerTransform.setPosition(0, 5, 0);
      const enemy = createEnemy({
        id: 'aggressive-1',
        x: 9,
        y: 5,
        behavior: EnemyBehavior.AGGRESSIVE,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;

      await runAct(enemy, createMockContext());

      expect(transform.position.x).toBe(8);
      expect(enemy.getDirection()).toBe('left');
    });

    it('プレイヤー隣接時に攻撃を要求する', async () => {
      playerTransform.setPosition(5, 4, 0);
      const enemy = createEnemy({
        id: 'aggressive-adjacent',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.AGGRESSIVE,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;
      const initialPos = transform.position;

      const attackHandler = jest.fn();
      events.on('enemy_attack_requested', attackHandler);

      await runAct(enemy, createMockContext());

      expect(transform.position).toEqual(initialPos);
      expect(attackHandler).toHaveBeenCalledWith({
        enemyId: 'aggressive-adjacent',
        targetId: 'player',
      });
    });

    it('プレイヤー不在時に何もしない', async () => {
      entities.removeEntity('player');
      const enemy = createEnemy({
        id: 'aggressive-no-player',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.AGGRESSIVE,
      });
      const transform = enemy.getComponent<TransformComponent>('transform')!;
      const initialPos = transform.position;

      await runAct(enemy, createMockContext());

      expect(transform.position).toEqual(initialPos);
    });
  });

  describe('EnemyBehaviorStrategyFactory', () => {
    it('STATIC 行動を生成する', () => {
      const strategy = EnemyBehaviorStrategyFactory.create(EnemyBehavior.STATIC);
      expect(strategy).toBeInstanceOf(StaticBehavior);
    });

    it('PATROL 行動を生成する', () => {
      const route: Vector3[] = [{ x: 1, y: 1, z: 0 }];
      const strategy = EnemyBehaviorStrategyFactory.create(EnemyBehavior.PATROL, route);
      expect(strategy).toBeInstanceOf(PatrolBehavior);
    });

    it('GUARD 行動を生成する', () => {
      const strategy = EnemyBehaviorStrategyFactory.create(EnemyBehavior.GUARD);
      expect(strategy).toBeInstanceOf(GuardBehavior);
    });

    it('AGGRESSIVE 行動を生成する', () => {
      const strategy = EnemyBehaviorStrategyFactory.create(EnemyBehavior.AGGRESSIVE);
      expect(strategy).toBeInstanceOf(AggressiveBehavior);
    });

    it('未知の行動には STATIC をフォールバックする', () => {
      const strategy = EnemyBehaviorStrategyFactory.create('unknown' as EnemyBehavior);
      expect(strategy).toBeInstanceOf(StaticBehavior);
    });
  });

  describe('EnemyAIUtils', () => {
    it('getDirectionFromPositions: 右方向', () => {
      expect(getDirectionFromPositions({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe('right');
    });

    it('getDirectionFromPositions: 左方向', () => {
      expect(getDirectionFromPositions({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe('left');
    });

    it('getDirectionFromPositions: 下方向', () => {
      expect(getDirectionFromPositions({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe('down');
    });

    it('getDirectionFromPositions: 上方向', () => {
      expect(getDirectionFromPositions({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 })).toBe('up');
    });

    it('getDirectionFromPositions: 同じ位置は null', () => {
      expect(getDirectionFromPositions({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBeNull();
    });

    it('getDirectionToTarget: X軸優先', () => {
      expect(getDirectionToTarget({ x: 0, y: 0, z: 0 }, { x: 3, y: 1, z: 0 })).toBe('right');
    });

    it('getDirectionToTarget: Y軸優先', () => {
      expect(getDirectionToTarget({ x: 0, y: 0, z: 0 }, { x: 1, y: 3, z: 0 })).toBe('down');
    });

    it('getDirectionToTarget: 同じ位置は null', () => {
      expect(getDirectionToTarget({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBeNull();
    });
  });
});
