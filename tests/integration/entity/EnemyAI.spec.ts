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
import { resolveEnemyStats } from '@/engine/entity/enemy/EnemyStatProfile';
import { EnemyBehavior, EnemyType, PlacedEnemy, TileType, Vector3 } from '@/engine/types';
import { Action } from '@/engine/turn/Action';

/**
 * Enemy AI の行動テスト
 *
 * BU-3 段階6: act() から decideAction() へ移行。
 * decideAction() が返す Action を検証し、Action をインラインで適用して
 * 位置・方向・攻撃要求を確認する。
 */
describe('Enemy AI', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let world: WorldSystem;
  let player: Entity;
  let playerTransform: TransformComponent;
  let attackRequests: { enemyId: string; targetId: string }[];

  const createPlacedEnemy = (overrides: Partial<PlacedEnemy> = {}): PlacedEnemy => ({
    id: 'enemy-ai-1',
    type: EnemyType.SOLDIER,
    x: 5,
    y: 5,
    level: 1,
    behavior: EnemyBehavior.STATIC,
    ...overrides,
  });

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    attackRequests = [];

    // enemy_attack_requested をキャプチャ
    events.on('enemy_attack_requested', (payload) => {
      attackRequests.push(payload);
    });

    // 10x10 の全面通行可能マップ
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

    // プレイヤーを登録
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

  const createHeadlessEnemy = (overrides: Partial<PlacedEnemy> = {}): Enemy => {
    const placed = createPlacedEnemy(overrides);
    const enemy = new Enemy(placed, resolveEnemyStats(placed.type, placed.level));
    entities.registerEntity(enemy);
    return enemy;
  };

  /**
   * decideAction() を呼び、返された Action をインラインで適用する。
   * move: movement.moveInDirection + update で即座に移動完了
   * turn: movement.direction を設定
   * attack: enemy_attack_requested イベントを発行
   */
  const runDecideAction = async (enemy: Enemy): Promise<Action | null> => {
    const action = await enemy.decideAction();
    if (!action) return null;

    const movement = enemy.getComponent<MovementComponent>('movement');
    if (!movement) return action;

    const direction = action.params?.direction;
    if (direction) {
      movement.direction = direction;
    }

    switch (action.kind) {
      case 'move':
        if (direction) {
          movement.moveInDirection(direction);
          // 移動アニメーションを即座に完了させる
          movement.update(1000);
        }
        break;
      case 'turn':
        // direction 設定済み
        break;
      case 'attack':
        // ActionExecutor の代わりにイベントを発行
        events.emit('enemy_attack_requested', {
          enemyId: enemy.id,
          targetId: 'player',
        });
        break;
      case 'wait':
        break;
    }

    return action;
  };

  it('Renderer / PixiJS の初期化なしで Enemy を初期化できる', async () => {
    const enemy = createHeadlessEnemy();

    await enemy.initialize();

    expect(Engine.instance.getSystem('renderer')).toBeUndefined();
    expect(enemy.getComponent('sprite')).toBeUndefined();
    expect(enemy.getComponent('enemy-presentation')).toBeUndefined();
    expect(enemy.getComponent('movement')).toBeDefined();
  });

  it('STATIC は移動せずプレイヤーの方向を向く', async () => {
    // プレイヤーを右側に配置
    playerTransform.setPosition(8, 5, 0);
    const enemy = createHeadlessEnemy({
      id: 'static-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.STATIC,
    });
    const movement = enemy.getComponent<MovementComponent>('movement')!;
    const transform = enemy.getComponent<TransformComponent>('transform')!;
    const initialPos = transform.position;

    const action = await runDecideAction(enemy);

    expect(action).not.toBeNull();
    expect(action!.kind).toBe('turn');
    expect(action!.params?.direction).toBe('right');
    expect(enemy.getDirection()).toBe('right');
    expect(transform.position).toEqual(initialPos);
    expect(movement.isMoving).toBe(false);
  });

  it('PATROL は巡回ルートに沿って移動する', async () => {
    const patrolRoute: Vector3[] = [
      { x: 5, y: 5, z: 0 },
      { x: 7, y: 5, z: 0 },
    ];
    // 開始位置を巡回ルートの最初の点と異なる位置に設定
    const enemy = createHeadlessEnemy({
      id: 'patrol-enemy',
      x: 3,
      y: 5,
      behavior: EnemyBehavior.PATROL,
      patrolRoute,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;

    // プレイヤーを遠くに配置して干渉しないようにする
    playerTransform.setPosition(0, 0, 0);

    const action = await runDecideAction(enemy);

    expect(action).not.toBeNull();
    expect(action!.kind).toBe('move');
    // 巡回ルートの最初の点 (5,5) に向かって移動する
    expect(transform.position.x).toBe(4);
    expect(enemy.getDirection()).toBe('right');
  });

  it('PATROL は巡回ルートの端で折り返す', async () => {
    // 巡回ルート: (5,5) → (7,5) の2点
    const patrolRoute: Vector3[] = [
      { x: 5, y: 5, z: 0 },
      { x: 7, y: 5, z: 0 },
    ];
    // 開始位置を巡回ルートの最初の点に設定（patrolIndex=0 から開始）
    const enemy = createHeadlessEnemy({
      id: 'patrol-bounce-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.PATROL,
      patrolRoute,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;

    // プレイヤーを遠くに配置
    playerTransform.setPosition(0, 0, 0);

    // 1回目: 開始位置 (5,5) は patrolRoute[0] と一致するため、
    // patrolIndex が 0→1 に進む（移動はしない）
    await runDecideAction(enemy);
    expect(transform.position.x).toBe(5);

    // 2回目: patrolRoute[1] (7,5) に向かって移動（1マス移動）
    await runDecideAction(enemy);
    expect(transform.position.x).toBe(6);
    expect(enemy.getDirection()).toBe('right');

    // 3回目: (7,5) に向かって移動（1マス移動）
    await runDecideAction(enemy);
    expect(transform.position.x).toBe(7);

    // 4回目: (7,5) に到達したので patrolIndex が 1→2 に進み、
    // patrolIndex >= length(2) のため patrolIndex=0, patrolDirection=-1 に反転
    // この decideAction 内では到達判定のみで移動はしない
    await runDecideAction(enemy);

    // 5回目: patrolRoute[0] (5,5) に向かって移動（左方向）
    await runDecideAction(enemy);
    // 折り返して左方向に移動する（x が減少）
    expect(transform.position.x).toBeLessThan(7);
    expect(enemy.getDirection()).toBe('left');

    // 6回目: (5,5) に向かって移動
    await runDecideAction(enemy);
    expect(transform.position.x).toBeLessThanOrEqual(6);

    // 7回目: さらに (5,5) に向かって移動
    await runDecideAction(enemy);
    expect(transform.position.x).toBeLessThanOrEqual(5);

    // 8回目: (5,5) に到達したので patrolIndex が反転し、
    // patrolDirection=1 に反転して right 方向に向かう
    await runDecideAction(enemy);
    // patrolDirection が 1 に反転し、right 方向に移動
    expect(enemy.getDirection()).toBe('right');
  });

  it('PATROL は巡回ルートがない場合にランダム移動へフォールバックする', async () => {
    const enemy = createHeadlessEnemy({
      id: 'patrol-no-route',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.PATROL,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;
    const initialPos = transform.position;

    // ランダム移動を制御するため Math.random をモック
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0); // 常に最初の方向 'up'

    playerTransform.setPosition(0, 0, 0);
    const action = await runDecideAction(enemy);

    expect(action).not.toBeNull();
    expect(action!.kind).toBe('move');
    // ランダム移動で位置が変化する
    expect(transform.position).not.toEqual(initialPos);
    randomSpy.mockRestore();
  });

  it('GUARD は感知範囲内のプレイヤーを追跡する', async () => {
    // プレイヤーを近く（距離3）に配置
    playerTransform.setPosition(5, 2, 0);
    const enemy = createHeadlessEnemy({
      id: 'guard-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.GUARD,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;

    const action = await runDecideAction(enemy);

    expect(action).not.toBeNull();
    expect(action!.kind).toBe('move');
    // プレイヤーに向かって移動する（Y座標が減少）
    expect(transform.position.y).toBe(4);
    expect(enemy.getDirection()).toBe('up');
  });

  it('GUARD は感知範囲外のプレイヤーを追跡しない', async () => {
    // プレイヤーを遠く（距離 > 8）に配置
    playerTransform.setPosition(0, 0, 0);
    const enemy = createHeadlessEnemy({
      id: 'guard-far',
      x: 9,
      y: 9,
      behavior: EnemyBehavior.GUARD,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;
    const initialPos = transform.position;

    const action = await runDecideAction(enemy);

    expect(action).not.toBeNull();
    expect(action!.kind).toBe('turn');
    // 移動せず、プレイヤーの方向を向くだけ
    expect(transform.position).toEqual(initialPos);
    // (0,0) から (9,9) への方向は左上、dx=-9, dy=-9, abs(dx) == abs(dy) なので dy 優先で 'up'
    expect(enemy.getDirection()).toBe('up');
  });

  it('AGGRESSIVE は常にプレイヤーを追跡する', async () => {
    // プレイヤーを同じ行の遠くに配置（方向を一意にするため）
    playerTransform.setPosition(0, 5, 0);
    const enemy = createHeadlessEnemy({
      id: 'aggressive-enemy',
      x: 9,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;

    const action = await runDecideAction(enemy);

    expect(action).not.toBeNull();
    expect(action!.kind).toBe('move');
    // プレイヤーに向かって左へ移動する（距離が遠くても常に追跡）
    expect(transform.position.x).toBe(8);
    expect(enemy.getDirection()).toBe('left');
  });

  it('プレイヤー不在時に何もしない', async () => {
    // プレイヤーを削除
    entities.removeEntity('player');

    const enemy = createHeadlessEnemy({
      id: 'no-player-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;
    const initialPos = transform.position;

    const action = await runDecideAction(enemy);

    expect(action).toBeNull();
    expect(transform.position).toEqual(initialPos);
  });

  it('死亡済み Enemy は行動せず非アクティブになる', async () => {
    const enemy = createHeadlessEnemy({
      id: 'dead-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    // destroyOnDeath = false の HealthComponent に差し替え
    const newHealth = new HealthComponent(50, 0, 0, 5, 0, false);
    newHealth.entity = enemy;
    enemy.addComponent(newHealth);

    const initialPos = enemy.getComponent<TransformComponent>('transform')!.position;

    const action = await runDecideAction(enemy);

    expect(action).toBeNull();
    expect(enemy.active).toBe(false);
    expect(enemy.getComponent<TransformComponent>('transform')!.position).toEqual(initialPos);
  });

  it('プレイヤー隣接時に移動せず攻撃 Action を返す', async () => {
    // プレイヤーを隣接（1マス上）に配置
    playerTransform.setPosition(5, 4, 0);
    const enemy = createHeadlessEnemy({
      id: 'adjacent-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;
    const initialPos = transform.position;

    const action = await runDecideAction(enemy);

    expect(action).not.toBeNull();
    expect(action!.kind).toBe('attack');
    expect(action!.params?.direction).toBe('up');
    // 移動していない
    expect(transform.position).toEqual(initialPos);
    // 攻撃要求を発行
    expect(attackRequests).toContainEqual({
      enemyId: 'adjacent-enemy',
      targetId: 'player',
    });
  });

  it('経路が見つからない場合にフォールバックで移動を試みる', async () => {
    // プレイヤーを到達不可能な位置に配置（壁で囲む）
    playerTransform.setPosition(0, 0, 0);
    // プレイヤーの周囲を壁で囲む
    const map = world.getTileMap();
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.setTileAt(x, y, 0, TileType.MOUNTAIN, false);
      }
    }
    // 敵の位置だけ通行可能
    map.setTileAt(9, 9, 0, TileType.TILE, true);
    // プレイヤーの位置も通行可能（プレイヤーはいる）
    map.setTileAt(0, 0, 0, TileType.TILE, true);
    // 敵の隣も通行可能にして、フォールバック移動が成功するようにする
    map.setTileAt(9, 8, 0, TileType.TILE, true); // 上
    map.setTileAt(8, 9, 0, TileType.TILE, true); // 左

    const enemy = createHeadlessEnemy({
      id: 'no-path-enemy',
      x: 9,
      y: 9,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const movement = enemy.getComponent<MovementComponent>('movement')!;

    // moveInDirection の呼び出しを監視
    const moveInDirectionSpy = jest.spyOn(movement, 'moveInDirection');

    // ランダム移動を制御（'up' 方向を選択）
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const action = await runDecideAction(enemy);

    // フォールバック処理として move Action が返る
    expect(action).not.toBeNull();
    expect(action!.kind).toBe('move');
    // moveInDirection が呼ばれていることを確認
    expect(moveInDirectionSpy).toHaveBeenCalled();

    randomSpy.mockRestore();
  });

  it('decideAction() が即座に完了する（タイムアウトなし）', async () => {
    const enemy = createHeadlessEnemy({
      id: 'timeout-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.PATROL,
      patrolRoute: [{ x: 7, y: 5, z: 0 }],
    });
    playerTransform.setPosition(0, 0, 0);

    // decideAction() がタイムアウト内に完了することを確認
    const startTime = Date.now();
    await runDecideAction(enemy);
    const elapsed = Date.now() - startTime;

    // アニメーション待ちがないので実時間はごく短い
    expect(elapsed).toBeLessThan(1000);
    expect(enemy.active).toBe(true);
  });

  it('攻撃 Action が即座に完了する（タイムアウトなし）', async () => {
    // プレイヤーを隣接に配置して攻撃を発生させる
    playerTransform.setPosition(5, 4, 0);
    const enemy = createHeadlessEnemy({
      id: 'attack-timeout-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });

    const startTime = Date.now();
    await runDecideAction(enemy);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(1000);
    expect(enemy.active).toBe(true);
    expect(attackRequests).toHaveLength(1);
  });

  it('SCOUT / SOLDIER / HEAVY に actionSpeed の差がある', async () => {
    const scout = createHeadlessEnemy({
      id: 'scout-1',
      type: EnemyType.SCOUT,
      behavior: EnemyBehavior.STATIC,
    });
    const soldier = createHeadlessEnemy({
      id: 'soldier-1',
      type: EnemyType.SOLDIER,
      behavior: EnemyBehavior.STATIC,
    });
    const heavy = createHeadlessEnemy({
      id: 'heavy-1',
      type: EnemyType.HEAVY,
      behavior: EnemyBehavior.STATIC,
    });

    const scoutActor =
      scout.getComponent<import('@/engine/entity/components/Actor').ActorComponent>('actor')!;
    const soldierActor =
      soldier.getComponent<import('@/engine/entity/components/Actor').ActorComponent>('actor')!;
    const heavyActor =
      heavy.getComponent<import('@/engine/entity/components/Actor').ActorComponent>('actor')!;

    expect(scoutActor.speed).toBe(150);
    expect(soldierActor.speed).toBe(100);
    expect(heavyActor.speed).toBe(50);
  });
});
