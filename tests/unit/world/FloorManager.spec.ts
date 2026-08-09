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
import { StageType } from '@/engine/types';

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

    assetsLoadSpy = jest
      .spyOn(PIXI.Assets, 'load')
      .mockResolvedValue(PIXI.Texture.EMPTY as any);

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
});
