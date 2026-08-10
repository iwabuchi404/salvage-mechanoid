import { createPinia, setActivePinia } from 'pinia';
import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { HealthComponent } from '@/engine/entity/components/Health';
import { EnergyComponent } from '@/engine/entity/components/Energy';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { Player } from '@/engine/entity/Player';
import { FloorManager } from '@/engine/world/FloorManager';
import { WorldSystem } from '@/engine/world/WorldSystem';
import { TileMap } from '@/engine/world/TileMap';
import { TileType, StageType } from '@/engine/types';

/**
 * FloorManager の境界テスト
 * フロア移動、状態保持、イベント発行を検証する。
 */
describe('FloorManager', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let floorManager: FloorManager;
  let player: Player;
  let assetsLoadSpy: jest.SpyInstance;

  beforeEach(async () => {
    setActivePinia(createPinia());
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    assetsLoadSpy = jest.spyOn(PIXI.Assets, 'load').mockResolvedValue(PIXI.Texture.EMPTY as any);

    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    Engine.instance.registerSystem('event', events);
    Engine.instance.registerSystem('entity', entities);

    const engine = Engine.instance;
    await entities.initialize(engine);

    // プレイヤーを作成して登録
    player = new Player('player', { x: 5, y: 5, z: 0 });
    await player.initialize();
    entities.registerEntity(player);

    floorManager = new FloorManager(engine, 10);
  });

  afterEach(() => {
    Engine.instance.reset();
    assetsLoadSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('初期階が 1 である', () => {
    expect(floorManager.getCurrentFloor()).toBe(1);
  });

  it('最大フロア数を取得できる', () => {
    expect(floorManager.getMaxFloors()).toBe(10);
  });

  it('1階より前へ移動できない', async () => {
    const result = await floorManager.moveToPreviousFloor();

    expect(result).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(1);
  });

  it('最終階より先へ移動できない', async () => {
    // 最終階へ一気に移動
    await floorManager.moveToFloor(10);

    const result = await floorManager.moveToNextFloor();

    expect(result).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(10);
  });

  it('範囲外の指定階へ移動できない', async () => {
    const tooLow = await floorManager.moveToFloor(0);
    expect(tooLow).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(1);

    const tooHigh = await floorManager.moveToFloor(11);
    expect(tooHigh).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(1);

    const negative = await floorManager.moveToFloor(-1);
    expect(negative).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(1);
  });

  it('現在と同じ階への移動を拒否する', async () => {
    const result = await floorManager.moveToFloor(1);

    expect(result).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(1);
  });

  it('有効な階層移動で floor_changed を発行する', async () => {
    const handler = jest.fn();
    events.on('floor_changed', handler);

    await floorManager.moveToNextFloor();

    expect(handler).toHaveBeenCalledWith({
      floor: 2,
      maxFloors: 10,
    });
    expect(floorManager.getCurrentFloor()).toBe(2);
  });

  it('実際のフロア生成完了後に floor_changed を発行する', async () => {
    const order: string[] = [];
    let completeGeneration!: () => void;
    const generationGate = new Promise<void>((resolve) => {
      completeGeneration = resolve;
    });

    const generationHandler = jest.fn(async () => {
      order.push('generation-started');
      await generationGate;
      order.push('generation-completed');
    });
    floorManager.setFloorGenerationHandler(generationHandler);
    events.on('floor_generated', () => order.push('floor-generated'));
    events.on('floor_changed', () => order.push('floor-changed'));

    const movement = floorManager.moveToNextFloor();
    await Promise.resolve();

    expect(order).toEqual(['generation-started']);

    completeGeneration();
    await movement;

    expect(generationHandler).toHaveBeenCalledWith({
      floor: 2,
      stageType: StageType.CLASSIC,
      difficulty: 1.2,
    });
    expect(order).toEqual([
      'generation-started',
      'generation-completed',
      'floor-generated',
      'floor-changed',
    ]);
  });

  it('前の階への移動でも floor_changed を発行する', async () => {
    await floorManager.moveToNextFloor(); // 1 -> 2

    const handler = jest.fn();
    events.on('floor_changed', handler);

    await floorManager.moveToPreviousFloor(); // 2 -> 1

    expect(handler).toHaveBeenCalledWith({
      floor: 1,
      maxFloors: 10,
    });
  });

  it('指定階への移動でも floor_changed を発行する', async () => {
    const handler = jest.fn();
    events.on('floor_changed', handler);

    await floorManager.moveToFloor(5);

    expect(handler).toHaveBeenCalledWith({
      floor: 5,
      maxFloors: 10,
    });
  });

  it('フロア番号に応じた stageType と difficulty を floor_generated で発行する', async () => {
    const handler = jest.fn();
    events.on('floor_generated', handler);

    await floorManager.moveToNextFloor(); // floor 2

    expect(handler).toHaveBeenCalledWith({
      floor: 2,
      stageType: StageType.CLASSIC, // floor <= 3
      difficulty: 1.2, // 1 + (2-1) * 0.2
    });
  });

  it('フロア4-6は ENERGY_MANAGEMENT ステージになる', async () => {
    const handler = jest.fn();
    events.on('floor_generated', handler);

    await floorManager.moveToFloor(4);

    expect(handler).toHaveBeenCalledWith({
      floor: 4,
      stageType: StageType.ENERGY_MANAGEMENT,
      difficulty: 1.6, // 1 + (4-1) * 0.2
    });
  });

  it('フロア7-9は TACTICAL_COMBAT ステージになる', async () => {
    const handler = jest.fn();
    events.on('floor_generated', handler);

    await floorManager.moveToFloor(7);

    expect(handler).toHaveBeenCalledWith({
      floor: 7,
      stageType: StageType.TACTICAL_COMBAT,
      difficulty: 2.2, // 1 + (7-1) * 0.2
    });
  });

  it('最終階は RESOURCE_CONTROL ステージになる', async () => {
    const handler = jest.fn();
    events.on('floor_generated', handler);

    await floorManager.moveToFloor(10);

    expect(handler).toHaveBeenCalledWith({
      floor: 10,
      stageType: StageType.RESOURCE_CONTROL,
      difficulty: 2.8, // min(1 + 9*0.2, 3) = min(2.8, 3) = 2.8
    });
  });

  it('プレイヤーが存在しない場合に安全に失敗する', async () => {
    // プレイヤーを削除
    entities.removeEntity('player');

    const result = await floorManager.moveToNextFloor();

    expect(result).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(1);
  });

  it('フロア生成時にプレイヤー以外のエンティティを削除する', async () => {
    // 敵、アイテム、障害物を追加
    const enemy = new Entity('enemy-1', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(new TransformComponent(3, 3, 0));
    entities.registerEntity(enemy);

    const item = new Entity('item-1', 'item');
    item.addTag('item');
    item.addComponent(new TransformComponent(4, 4, 0));
    entities.registerEntity(item);

    const obstacle = new Entity('obstacle-1', 'obstacle');
    obstacle.addTag('obstacle');
    obstacle.addComponent(new TransformComponent(6, 6, 0));
    entities.registerEntity(obstacle);

    expect(entities.getEntityCount()).toBe(4); // player + 3

    await floorManager.moveToNextFloor();

    // プレイヤー以外は削除される
    expect(entities.getEntity('enemy-1')).toBeUndefined();
    expect(entities.getEntity('item-1')).toBeUndefined();
    expect(entities.getEntity('obstacle-1')).toBeUndefined();
    expect(entities.getEntity('player')).toBeDefined();
  });

  it('階層移動後も現在 HP を保持する', async () => {
    const health = player.getComponent<HealthComponent>('health')!;
    health.takeDamage(30, true, true); // HP = 100 - 30 = 70
    // 注: takeDamage は destroyOnDeath=true だが HP が残っているので削除されない
    const expectedHp = health.currentHp;

    await floorManager.moveToNextFloor();

    const restoredHealth = player.getComponent<HealthComponent>('health')!;
    expect(restoredHealth.currentHp).toBe(expectedHp);
  });

  it('階層移動後も最大 HP を保持する', async () => {
    const health = player.getComponent<HealthComponent>('health')!;
    const expectedMaxHp = health.maxHp;

    await floorManager.moveToNextFloor();

    const restoredHealth = player.getComponent<HealthComponent>('health')!;
    expect(restoredHealth.maxHp).toBe(expectedMaxHp);
  });

  it('階層移動後にエネルギーが +20 回復する（最大値未満）', async () => {
    const energy = player.getComponent<EnergyComponent>('energy')!;
    energy.consume(50); // 200 - 50 = 150
    const energyBefore = energy.currentEnergy;
    const expectedEnergy = Math.min(energyBefore + 20, energy.maxEnergy); // 150 + 20 = 170

    await floorManager.moveToNextFloor();

    const restoredEnergy = player.getComponent<EnergyComponent>('energy')!;
    expect(restoredEnergy.currentEnergy).toBe(expectedEnergy);
  });

  it('階層移動時にエネルギーが最大値を超えない', async () => {
    const energy = player.getComponent<EnergyComponent>('energy')!;
    // 最大値に近い状態から移動（+20 すると最大値を超える）
    energy.consume(10); // 200 - 10 = 190
    const energyBefore = energy.currentEnergy;
    const expectedEnergy = Math.min(energyBefore + 20, energy.maxEnergy); // min(210, 200) = 200

    await floorManager.moveToNextFloor();

    const restoredEnergy = player.getComponent<EnergyComponent>('energy')!;
    expect(restoredEnergy.currentEnergy).toBe(expectedEnergy);
    expect(restoredEnergy.currentEnergy).toBeLessThanOrEqual(restoredEnergy.maxEnergy);
  });

  it('階層移動後も最大エネルギーを保持する', async () => {
    const energy = player.getComponent<EnergyComponent>('energy')!;
    const expectedMaxEnergy = energy.maxEnergy;

    await floorManager.moveToNextFloor();

    const restoredEnergy = player.getComponent<EnergyComponent>('energy')!;
    expect(restoredEnergy.maxEnergy).toBe(expectedMaxEnergy);
  });

  it('階層移動でプレイヤーを削除しない', async () => {
    await floorManager.moveToNextFloor();

    expect(entities.getEntity('player')).toBeDefined();
    expect(entities.getEntitiesByTag('player')).toHaveLength(1);
  });

  it('reset で階層を 1 に戻す', async () => {
    await floorManager.moveToFloor(5);
    expect(floorManager.getCurrentFloor()).toBe(5);

    await floorManager.reset();

    expect(floorManager.getCurrentFloor()).toBe(1);
  });

  // ===== フロア生成失敗契約テスト（R0）=====

  /**
   * WorldSystem をセットアップして FloorManager に登録するヘルパー
   */
  async function setupWorldSystem(): Promise<WorldSystem> {
    const map = new TileMap(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.setTileAt(x, y, 0, TileType.TILE, true);
      }
    }
    const worldSystem = new WorldSystem(map);
    Engine.instance.registerSystem('world', worldSystem);
    await worldSystem.initialize(Engine.instance);
    return worldSystem;
  }

  it('生成ハンドラーが例外を投げた場合は false を返す', async () => {
    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });

    const result = await floorManager.moveToNextFloor();

    expect(result).toBe(false);
  });

  it('生成失敗時に現在階が元の階に戻る', async () => {
    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });

    await floorManager.moveToNextFloor();

    expect(floorManager.getCurrentFloor()).toBe(1);
  });

  it('生成失敗時に floor_changed を発行しない', async () => {
    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });
    const handler = jest.fn();
    events.on('floor_changed', handler);

    await floorManager.moveToNextFloor();

    expect(handler).not.toHaveBeenCalled();
  });

  it('生成失敗時に floor_generated を発行しない', async () => {
    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });
    const handler = jest.fn();
    events.on('floor_generated', handler);

    await floorManager.moveToNextFloor();

    expect(handler).not.toHaveBeenCalled();
  });

  it('生成失敗時にプレイヤー以外の旧エンティティが保持される', async () => {
    const enemy = new Entity('enemy-1', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(new TransformComponent(3, 3, 0));
    entities.registerEntity(enemy);

    const item = new Entity('item-1', 'item');
    item.addTag('item');
    item.addComponent(new TransformComponent(4, 4, 0));
    entities.registerEntity(item);

    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });

    await floorManager.moveToNextFloor();

    // 旧エンティティが削除されずに残っている
    expect(entities.getEntity('enemy-1')).toBeDefined();
    expect(entities.getEntity('item-1')).toBeDefined();
    expect(entities.getEntity('player')).toBeDefined();
  });

  it('生成失敗時にプレイヤーの HP が変わらない', async () => {
    const health = player.getComponent<HealthComponent>('health')!;
    health.takeDamage(30, true, true);
    const hpBefore = health.currentHp;

    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });

    await floorManager.moveToNextFloor();

    expect(health.currentHp).toBe(hpBefore);
  });

  it('生成失敗時にプレイヤーのエネルギーが変わらない（+20 ボーナスなし）', async () => {
    const energy = player.getComponent<EnergyComponent>('energy')!;
    energy.consume(50);
    const energyBefore = energy.currentEnergy;

    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });

    await floorManager.moveToNextFloor();

    expect(energy.currentEnergy).toBe(energyBefore);
  });

  it('生成失敗時にプレイヤーの位置が元に戻る', async () => {
    await setupWorldSystem();

    const transform = player.getComponent<TransformComponent>('transform')!;
    const originalPos = { x: 5, y: 5, z: 0 };
    transform.setPosition(originalPos.x, originalPos.y, originalPos.z);

    floorManager.setFloorGenerationHandler(async () => {
      // ハンドラー内でプレイヤー位置を変更してから例外を投げる
      transform.setPosition(9, 9, 0);
      throw new Error('Generation failed');
    });

    await floorManager.moveToNextFloor();

    const pos = transform.position;
    expect(pos.x).toBe(originalPos.x);
    expect(pos.y).toBe(originalPos.y);
  });

  it('生成失敗時に WorldSystem の現在階が元の階に戻る', async () => {
    const worldSystem = await setupWorldSystem();

    // 1階のデータを登録済み（setupWorldSystem で初期マップが1階として登録される）
    expect(worldSystem.getCurrentFloor()).toBe(1);

    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });

    await floorManager.moveToNextFloor();

    // FloorManager と WorldSystem の現在階が一致して 1 のまま
    expect(floorManager.getCurrentFloor()).toBe(1);
    expect(worldSystem.getCurrentFloor()).toBe(1);
  });

  it('生成失敗後に再試行で成功できる', async () => {
    let attempt = 0;
    floorManager.setFloorGenerationHandler(async () => {
      attempt++;
      if (attempt === 1) {
        throw new Error('First attempt failed');
      }
      // 2回目は成功
    });

    // 1回目: 失敗
    const result1 = await floorManager.moveToNextFloor();
    expect(result1).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(1);

    // 2回目: 成功
    const result2 = await floorManager.moveToNextFloor();
    expect(result2).toBe(true);
    expect(floorManager.getCurrentFloor()).toBe(2);
  });

  it('moveToPreviousFloor でも生成失敗時にロールバックする', async () => {
    // まず3階へ移動
    floorManager.setFloorGenerationHandler(async () => {
      // no-op: 成功するハンドラー
    });
    await floorManager.moveToFloor(3);
    expect(floorManager.getCurrentFloor()).toBe(3);

    // 失敗するハンドラーに切り替え
    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });

    const result = await floorManager.moveToPreviousFloor();

    expect(result).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(3);
  });

  it('moveToFloor でも生成失敗時にロールバックする', async () => {
    floorManager.setFloorGenerationHandler(async () => {
      throw new Error('Generation failed');
    });

    const result = await floorManager.moveToFloor(5);

    expect(result).toBe(false);
    expect(floorManager.getCurrentFloor()).toBe(1);
  });
});
