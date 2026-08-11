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

/**
 * Enemy AI の行動テスト
 * act() を通じて各 behavior の行動選択とイベント発行を検証する。
 */
describe('Enemy AI', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let world: WorldSystem;
  let player: Entity;
  let playerTransform: TransformComponent;

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
    const enemy = new Enemy(createPlacedEnemy(overrides));
    entities.registerEntity(enemy);
    return enemy;
  };

  /**
   * act() を実行し、内部の waitForMovement/waitForAttack のタイムアウトを解決する。
   * フェイクタイマーを使用して 500ms のタイムアウトを即座に進める。
   * また、移動アニメーションを完了させるため MovementComponent.update() を呼ぶ。
   */
  const runAct = async (enemy: Enemy): Promise<void> => {
    jest.useFakeTimers();
    const actPromise = enemy.act();
    // waitForMovement (最大500ms) と waitForAttack (200ms) のタイムアウトを解決
    jest.advanceTimersByTime(700);
    await actPromise;
    jest.useRealTimers();

    // 移動アニメーションを完了させる（update を呼んで isMoving を false にする）
    const movement = enemy.getComponent<MovementComponent>('movement');
    if (movement && movement.isMoving) {
      // moveDuration 以上の deltaTime を与えて移動を完了させる
      movement.update(1000);
    }
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

    await runAct(enemy);

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
    const enemy = await createHeadlessEnemy({
      id: 'patrol-enemy',
      x: 3,
      y: 5,
      behavior: EnemyBehavior.PATROL,
      patrolRoute,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;

    // プレイヤーを遠くに配置して干渉しないようにする
    playerTransform.setPosition(0, 0, 0);

    await runAct(enemy);

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
    const enemy = await createHeadlessEnemy({
      id: 'patrol-bounce-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.PATROL,
      patrolRoute,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;

    // プレイヤーを遠くに配置
    playerTransform.setPosition(0, 0, 0);

    // 1回目の act: 開始位置 (5,5) は patrolRoute[0] と一致するため、
    // patrolIndex が 0→1 に進む（移動はしない）
    await runAct(enemy);
    expect(transform.position.x).toBe(5);

    // 2回目の act: patrolRoute[1] (7,5) に向かって移動（1マス移動）
    await runAct(enemy);
    expect(transform.position.x).toBe(6);
    expect(enemy.getDirection()).toBe('right');

    // 3回目の act: (7,5) に向かって移動（1マス移動）
    await runAct(enemy);
    expect(transform.position.x).toBe(7);

    // 4回目の act: (7,5) に到達したので patrolIndex が 1→2 に進み、
    // patrolIndex >= length(2) のため patrolIndex=0, patrolDirection=-1 に反転
    // この act 内では到達判定のみで移動はしない
    await runAct(enemy);

    // 5回目の act: patrolRoute[0] (5,5) に向かって移動（左方向）
    await runAct(enemy);
    // 折り返して左方向に移動する（x が減少）
    expect(transform.position.x).toBeLessThan(7);
    expect(enemy.getDirection()).toBe('left');

    // 6回目の act: (5,5) に向かって移動
    await runAct(enemy);
    expect(transform.position.x).toBeLessThanOrEqual(6);

    // 7回目の act: さらに (5,5) に向かって移動
    await runAct(enemy);
    expect(transform.position.x).toBeLessThanOrEqual(5);

    // 8回目の act: (5,5) に到達したので patrolIndex が反転し、
    // patrolDirection=1 に反転して right 方向に向かう
    await runAct(enemy);
    // patrolDirection が 1 に反転し、right 方向に移動
    expect(enemy.getDirection()).toBe('right');
  });

  it('PATROL は巡回ルートがない場合にランダム移動へフォールバックする', async () => {
    const enemy = await createHeadlessEnemy({
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
    await runAct(enemy);

    // ランダム移動で位置が変化する
    expect(transform.position).not.toEqual(initialPos);
    randomSpy.mockRestore();
  });

  it('GUARD は感知範囲内のプレイヤーを追跡する', async () => {
    // プレイヤーを近く（距離3）に配置
    playerTransform.setPosition(5, 2, 0);
    const enemy = await createHeadlessEnemy({
      id: 'guard-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.GUARD,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;

    await runAct(enemy);

    // プレイヤーに向かって移動する（Y座標が減少）
    expect(transform.position.y).toBe(4);
    expect(enemy.getDirection()).toBe('up');
  });

  it('GUARD は感知範囲外のプレイヤーを追跡しない', async () => {
    // プレイヤーを遠く（距離 > 8）に配置
    playerTransform.setPosition(0, 0, 0);
    const enemy = await createHeadlessEnemy({
      id: 'guard-far',
      x: 9,
      y: 9,
      behavior: EnemyBehavior.GUARD,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;
    const initialPos = transform.position;

    await runAct(enemy);

    // 移動せず、プレイヤーの方向を向くだけ
    expect(transform.position).toEqual(initialPos);
    // (0,0) から (9,9) への方向は左上、dx=-9, dy=-9, abs(dx) == abs(dy) なので dy 優先で 'up'
    expect(enemy.getDirection()).toBe('up');
  });

  it('AGGRESSIVE は常にプレイヤーを追跡する', async () => {
    // プレイヤーを同じ行の遠くに配置（方向を一意にするため）
    playerTransform.setPosition(0, 5, 0);
    const enemy = await createHeadlessEnemy({
      id: 'aggressive-enemy',
      x: 9,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;

    await runAct(enemy);

    // プレイヤーに向かって左へ移動する（距離が遠くても常に追跡）
    expect(transform.position.x).toBe(8);
    expect(enemy.getDirection()).toBe('left');
  });

  it('プレイヤー不在時に何もしない', async () => {
    // プレイヤーを削除
    entities.removeEntity('player');

    const enemy = await createHeadlessEnemy({
      id: 'no-player-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;
    const initialPos = transform.position;

    await runAct(enemy);

    expect(transform.position).toEqual(initialPos);
  });

  it('死亡済み Enemy は行動せず非アクティブになる', async () => {
    const enemy = await createHeadlessEnemy({
      id: 'dead-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const health = enemy.getComponent<HealthComponent>('health')!;
    const transform = enemy.getComponent<TransformComponent>('transform')!;
    const initialPos = transform.position;

    // HP を 0 にする（destroyOnDeath を false にしてエンティティが削除されないようにする）
    health.takeDamage(health.maxHp, true, true);

    // HealthComponent の takeDamage が entitySystem.removeEntity を呼ぶため、
    // エンティティが削除されている可能性がある。削除されていない場合は act() を検証。
    // 代わりに: 直接 HP を 0 に設定して act() を呼ぶ
    const enemy2 = await createHeadlessEnemy({
      id: 'dead-enemy-2',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const health2 = enemy2.getComponent<HealthComponent>('health')!;
    // destroyOnDeath = false の HealthComponent に差し替え
    const newHealth = new HealthComponent(50, 0, 0, 5, 0, false);
    newHealth.entity = enemy2;
    enemy2.addComponent(newHealth);

    const initialPos2 = enemy2.getComponent<TransformComponent>('transform')!.position;

    await runAct(enemy2);

    expect(enemy2.active).toBe(false);
    expect(enemy2.getComponent<TransformComponent>('transform')!.position).toEqual(initialPos2);
  });

  it('プレイヤー隣接時に移動せず攻撃を要求する', async () => {
    // プレイヤーを隣接（1マス上）に配置
    playerTransform.setPosition(5, 4, 0);
    const enemy = await createHeadlessEnemy({
      id: 'adjacent-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const transform = enemy.getComponent<TransformComponent>('transform')!;
    const initialPos = transform.position;

    const attackHandler = jest.fn();
    events.on('enemy_attack_requested', attackHandler);

    await runAct(enemy);

    // 移動していない
    expect(transform.position).toEqual(initialPos);
    // 攻撃要求を発行
    expect(attackHandler).toHaveBeenCalledWith({
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

    const enemy = await createHeadlessEnemy({
      id: 'no-path-enemy',
      x: 9,
      y: 9,
      behavior: EnemyBehavior.AGGRESSIVE,
    });
    const movement = enemy.getComponent<MovementComponent>('movement')!;
    const transform = enemy.getComponent<TransformComponent>('transform')!;

    // moveInDirection の呼び出しを監視
    const moveInDirectionSpy = jest.spyOn(movement, 'moveInDirection');

    // ランダム移動を制御（'up' 方向を選択）
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    await runAct(enemy);

    // フォールバック処理として moveInDirection が呼ばれていることを確認
    // 経路が見つからない場合、getDirectionToTarget → moveInDirection が呼ばれる
    expect(moveInDirectionSpy).toHaveBeenCalled();

    randomSpy.mockRestore();
  });

  it('移動待ちがタイムアウトしてターンを停止させない', async () => {
    const enemy = await createHeadlessEnemy({
      id: 'timeout-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.PATROL,
      patrolRoute: [{ x: 7, y: 5, z: 0 }],
    });
    playerTransform.setPosition(0, 0, 0);

    // act() がタイムアウト内に完了することを確認
    const startTime = Date.now();
    await runAct(enemy);
    const elapsed = Date.now() - startTime;

    // フェイクタイマー使用時は実時間はごく短い
    expect(elapsed).toBeLessThan(1000);
    // act() が正常に完了したこと自体が、ターンが停止しないことを示す
    expect(enemy.active).toBe(true);
  });

  it('攻撃待ちがタイムアウトしてターンを停止させない', async () => {
    // プレイヤーを隣接に配置して攻撃を発生させる
    playerTransform.setPosition(5, 4, 0);
    const enemy = await createHeadlessEnemy({
      id: 'attack-timeout-enemy',
      x: 5,
      y: 5,
      behavior: EnemyBehavior.AGGRESSIVE,
    });

    events.on('enemy_attack_requested', jest.fn());

    const startTime = Date.now();
    await runAct(enemy);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(1000);
    expect(enemy.active).toBe(true);
  });
});
