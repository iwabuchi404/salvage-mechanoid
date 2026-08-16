import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { CoordinateSystem } from '@/engine/graphics/CoordinateSystem';
import { RendererSystem } from '@/engine/graphics/RendererSystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { Item } from '@/engine/entity/Item';
import { ItemFactory } from '@/engine/factory/ItemFactory';
import { LootSystem } from '@/engine/loot/LootSystem';
import { InventoryItemType, ItemRarity, ItemType, LayerName } from '@/engine/types';

const flushPromises = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('LootSystem', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let loot: LootSystem;
  let objectsLayer: PIXI.Container;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    loot = new LootSystem();
    objectsLayer = new PIXI.Container();

    const coordinateSystem = new CoordinateSystem(160, 120);
    const renderer = {
      getCoordinateSystem: () => coordinateSystem,
      getLayer: (name: string) => (name === LayerName.OBJECTS ? objectsLayer : undefined),
    } as unknown as RendererSystem;

    Engine.instance.registerSystem('event', events);
    Engine.instance.registerSystem('entity', entities);
    Engine.instance.registerSystem('renderer', renderer);
    Engine.instance.registerSystem('loot', loot);

    await events.initialize(Engine.instance);
    await entities.initialize(Engine.instance);
    await loot.initialize(Engine.instance);
    loot.setDropChance(1);
  });

  afterEach(() => {
    Engine.instance.reset();
    jest.restoreAllMocks();
  });

  it('ドロップアイテムを ItemFactory で初期化してから登録する', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const droppedListener = jest.fn();
    events.on('item_dropped', droppedListener);

    const position = { x: 12, y: 8, z: 0 };
    events.emit('enemy_destroyed', { entityId: 'enemy', position });
    await flushPromises();

    const droppedItems = entities.getEntitiesByType('item');
    expect(droppedItems).toHaveLength(1);

    const item = droppedItems[0] as Item;
    expect(item.getItemType()).toBe(ItemType.ENERGY);
    expect(item.toInventoryItem()?.type).toBe(InventoryItemType.ENERGY_CELL);
    expect(objectsLayer.children).toHaveLength(1);
    expect(events.getListenerCount('entity_visibility_changed')).toBe(1);
    expect(droppedListener).toHaveBeenCalledWith({
      itemId: item.id,
      itemType: ItemType.ENERGY,
      position,
    });
  });

  it('ItemFactory の生成失敗を捕捉し、不完全な Item を登録しない', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    jest.spyOn(ItemFactory, 'create').mockRejectedValueOnce(new Error('item init failed'));
    const droppedListener = jest.fn();
    events.on('item_dropped', droppedListener);

    events.emit('enemy_destroyed', { entityId: 'enemy', position: { x: 1, y: 2, z: 0 } });
    await flushPromises();

    expect(entities.getEntitiesByType('item')).toHaveLength(0);
    expect(droppedListener).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to spawn dropped item:',
      expect.objectContaining({ message: 'item init failed' })
    );
  });

  it('破棄時に enemy_destroyed の購読を解除する', () => {
    expect(events.getListenerCount('enemy_destroyed')).toBe(1);

    loot.destroy();

    expect(events.getListenerCount('enemy_destroyed')).toBe(0);
  });

  it('非同期生成中に再初期化された場合は旧ライフサイクルの Item を登録しない', async () => {
    let resolveCreate: ((item: Item) => void) | undefined;
    const item = new Item({
      id: 'pending-drop',
      type: ItemType.ENERGY,
      rarity: ItemRarity.COMMON,
      x: 3,
      y: 4,
      properties: {},
    });
    const destroySpy = jest.spyOn(item, 'destroy');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    jest.spyOn(ItemFactory, 'create').mockReturnValueOnce(
      new Promise<Item>((resolve) => {
        resolveCreate = resolve;
      })
    );

    events.emit('enemy_destroyed', { entityId: 'enemy', position: { x: 3, y: 4, z: 0 } });
    loot.destroy();
    await loot.initialize(Engine.instance);
    resolveCreate?.(item);
    await flushPromises();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(entities.getEntity(item.id)).toBeUndefined();
  });
});
