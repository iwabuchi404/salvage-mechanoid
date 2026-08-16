import { Enemy } from '@/engine/entity/Enemy';
import { MovementComponent } from '@/engine/entity/components/Movement';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { resolveEnemyStats } from '@/engine/entity/enemy/EnemyStatProfile';
import { EnemyBehavior, EnemyType, PlacedEnemy, Vector3 } from '@/engine/types';
import { EnemyActionContext } from '@/engine/entity/ai/EnemyActionContext';
import { EnemyBehaviorStrategy } from '@/engine/entity/ai/EnemyBehaviorStrategy';
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
  let playerPosition: Vector3 | null;
  const strategies = new WeakMap<Enemy, EnemyBehaviorStrategy>();

  const createManhattanPath = (from: Vector3, to: Vector3): Vector3[] => {
    const path: Vector3[] = [{ ...from }];
    const current = { ...from };

    while (current.y !== to.y) {
      current.y += Math.sign(to.y - current.y);
      path.push({ ...current });
    }
    while (current.x !== to.x) {
      current.x += Math.sign(to.x - current.x);
      path.push({ ...current });
    }

    return path;
  };

  /**
   * モック ActionContext を生成する
   */
  const createMockContext = (
    overrides: Partial<EnemyActionContext> = {}
  ): jest.Mocked<EnemyActionContext> => {
    return {
      getPlayerPosition: jest.fn(() => playerPosition),
      findPath: jest.fn((from: Vector3, to: Vector3) => createManhattanPath(from, to)),
      getDistance: jest.fn(
        (from: Vector3, to: Vector3) => Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
      ),
      requestAttack: jest.fn(),
      ...overrides,
    } as jest.Mocked<EnemyActionContext>;
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
    const placedEnemy = createPlacedEnemy(overrides);
    const enemy = new Enemy(placedEnemy, resolveEnemyStats(placedEnemy.type, placedEnemy.level));
    strategies.set(
      enemy,
      EnemyBehaviorStrategyFactory.create(placedEnemy.behavior, placedEnemy.patrolRoute)
    );
    return enemy;
  };

  const getTransform = (enemy: Enemy): TransformComponent => {
    const transform = enemy.getComponent<TransformComponent>('transform');
    if (!transform) throw new Error(`Transform is not registered for ${enemy.id}`);
    return transform;
  };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    playerPosition = { x: 2, y: 2, z: 0 };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /**
   * act() を実行し、内部のタイムアウトを解決する
   * 同じ Strategy インスタンスを直接呼び出す（Strategy 状態が維持される）
   */
  const runAct = async (enemy: Enemy, context: EnemyActionContext): Promise<void> => {
    const strategy = strategies.get(enemy);
    if (!strategy) throw new Error(`Strategy is not registered for ${enemy.id}`);

    jest.useFakeTimers();
    const actPromise = strategy.act(enemy, context);
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
      playerPosition = { x: 8, y: 5, z: 0 };
      const enemy = createEnemy({
        id: 'static-1',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.STATIC,
      });
      const transform = getTransform(enemy);
      const initialPos = transform.position;

      const context = createMockContext();
      await runAct(enemy, context);

      expect(enemy.getDirection()).toBe('right');
      expect(transform.position).toEqual(initialPos);
      expect(context.getPlayerPosition).toHaveBeenCalledTimes(1);
    });

    it('プレイヤー不在時に何もしない', async () => {
      playerPosition = null;
      const enemy = createEnemy({
        id: 'static-no-player',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.STATIC,
      });
      const transform = getTransform(enemy);
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
      const transform = getTransform(enemy);

      playerPosition = { x: 0, y: 0, z: 0 };

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
      const transform = getTransform(enemy);

      playerPosition = { x: 0, y: 0, z: 0 };

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
      const transform = getTransform(enemy);
      const initialPos = transform.position;

      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

      playerPosition = { x: 0, y: 0, z: 0 };
      await runAct(enemy, createMockContext());

      expect(transform.position).not.toEqual(initialPos);
      randomSpy.mockRestore();
    });

    it('プレイヤー不在時に何もしない', async () => {
      playerPosition = null;
      const enemy = createEnemy({
        id: 'patrol-no-player',
        x: 3,
        y: 5,
        behavior: EnemyBehavior.PATROL,
        patrolRoute: [{ x: 5, y: 5, z: 0 }],
      });
      const transform = getTransform(enemy);
      const initialPos = transform.position;

      await runAct(enemy, createMockContext());

      expect(transform.position).toEqual(initialPos);
    });
  });

  describe('GuardBehavior', () => {
    it('感知範囲内のプレイヤーを追跡する', async () => {
      playerPosition = { x: 5, y: 2, z: 0 };
      const enemy = createEnemy({
        id: 'guard-1',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.GUARD,
      });
      const transform = getTransform(enemy);

      const context = createMockContext();
      await runAct(enemy, context);

      expect(transform.position.y).toBe(4);
      expect(enemy.getDirection()).toBe('up');
      expect(context.findPath).toHaveBeenCalled();
    });

    it('感知範囲外のプレイヤーを追跡しない', async () => {
      playerPosition = { x: 0, y: 0, z: 0 };
      const enemy = createEnemy({
        id: 'guard-far',
        x: 9,
        y: 9,
        behavior: EnemyBehavior.GUARD,
      });
      const transform = getTransform(enemy);
      const initialPos = transform.position;

      await runAct(enemy, createMockContext());

      expect(transform.position).toEqual(initialPos);
      expect(enemy.getDirection()).toBe('up');
    });
  });

  describe('AggressiveBehavior', () => {
    it('常にプレイヤーを追跡する', async () => {
      playerPosition = { x: 0, y: 5, z: 0 };
      const enemy = createEnemy({
        id: 'aggressive-1',
        x: 9,
        y: 5,
        behavior: EnemyBehavior.AGGRESSIVE,
      });
      const transform = getTransform(enemy);

      await runAct(enemy, createMockContext());

      expect(transform.position.x).toBe(8);
      expect(enemy.getDirection()).toBe('left');
    });

    it('プレイヤー隣接時に攻撃を要求する', async () => {
      playerPosition = { x: 5, y: 4, z: 0 };
      const enemy = createEnemy({
        id: 'aggressive-adjacent',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.AGGRESSIVE,
      });
      const transform = getTransform(enemy);
      const initialPos = transform.position;

      const context = createMockContext();
      await runAct(enemy, context);

      expect(transform.position).toEqual(initialPos);
      expect(context.requestAttack).toHaveBeenCalledWith('aggressive-adjacent', 'player');
    });

    it('プレイヤー不在時に何もしない', async () => {
      playerPosition = null;
      const enemy = createEnemy({
        id: 'aggressive-no-player',
        x: 5,
        y: 5,
        behavior: EnemyBehavior.AGGRESSIVE,
      });
      const transform = getTransform(enemy);
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
