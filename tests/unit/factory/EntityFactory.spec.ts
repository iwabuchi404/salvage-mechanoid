import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { CoordinateSystem } from '@/engine/graphics/CoordinateSystem';
import { RendererSystem } from '@/engine/graphics/RendererSystem';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';
import {
  EnemyBehavior,
  EnemyType,
  ItemType,
  ItemRarity,
  LayerName,
  ObstacleType,
  PlacedEnemy,
  PlacedItem,
  PlacedObstacle,
  TileType,
} from '@/engine/types';
import { EnemyFactory } from '@/engine/factory/EnemyFactory';
import { ItemFactory, mapItemTypeToInventoryType } from '@/engine/factory/ItemFactory';
import { ObstacleFactory } from '@/engine/factory/ObstacleFactory';
import { Enemy } from '@/engine/entity/Enemy';
import { Item } from '@/engine/entity/Item';
import { Obstacle } from '@/engine/entity/Obstacle';
import { SpriteComponent } from '@/engine/entity/components/Sprite';
import { EnemyPresentation } from '@/engine/presentation/enemy/EnemyPresentation';

/**
 * Entity Factory の単体テスト
 *
 * 各 Factory が PlacedXxx から正しい Entity を生成・初期化し、
 * 初期化失敗時にロールバックすることを検証する。
 */
describe('Entity Factory', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let renderer: RendererSystem;
  let assetsLoadSpy: jest.SpyInstance;
  let charactersLayer: PIXI.Container;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    assetsLoadSpy = jest.spyOn(PIXI.Assets, 'load').mockResolvedValue(PIXI.Texture.EMPTY as any);

    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    charactersLayer = new PIXI.Container();

    const coordSystem = new CoordinateSystem(160, 120);
    renderer = {
      getCoordinateSystem: () => coordSystem,
      getLayer: (name: string) => (name === LayerName.CHARACTERS ? charactersLayer : undefined),
      renderEntity: jest.fn(),
      removeSprite: jest.fn(),
    } as unknown as RendererSystem;

    Engine.instance.registerSystem('event', events);
    Engine.instance.registerSystem('entity', entities);
    Engine.instance.registerSystem('renderer', renderer);

    // WorldSystem（Enemy AI の findPath 用）
    const map = new TileMap(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.setTileAt(x, y, 0, TileType.TILE, true);
      }
    }
    const world = new WorldSystem(map);
    Engine.instance.registerSystem('world', world);

    const engine = Engine.instance;
    await entities.initialize(engine);
    await world.initialize(engine);
  });

  afterEach(() => {
    Engine.instance.reset();
    assetsLoadSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('EnemyFactory', () => {
    const createPlacedEnemy = (overrides: Partial<PlacedEnemy> = {}): PlacedEnemy => ({
      id: 'factory-enemy-1',
      type: EnemyType.SOLDIER,
      x: 3,
      y: 5,
      level: 1,
      behavior: EnemyBehavior.STATIC,
      ...overrides,
    });

    it('Enemy を生成・初期化する', async () => {
      const enemy = await EnemyFactory.create(createPlacedEnemy());

      expect(enemy).toBeInstanceOf(Enemy);
      expect(enemy.id).toBe('factory-enemy-1');
      expect(enemy.getEnemyType()).toBe(EnemyType.SOLDIER);
      expect(enemy.getBehavior()).toBe(EnemyBehavior.STATIC);
    });

    it('Presentation を含めて組み立てる', async () => {
      const enemy = await EnemyFactory.create(createPlacedEnemy());

      const presentation = enemy.getComponent<EnemyPresentation>('enemy-presentation');
      expect(presentation).toBeDefined();

      const sprite = enemy.getComponent<SpriteComponent>('sprite');
      expect(sprite).toBeDefined();
    });

    it('初期化失敗時に生成済み Enemy を破棄して例外を再送する', async () => {
      // renderEntity を失敗させることで Presentation 初期化を失敗させる
      const renderEntitySpy = jest.spyOn(renderer, 'renderEntity');
      renderEntitySpy.mockImplementationOnce(() => {
        throw new Error('render failed');
      });

      await expect(EnemyFactory.create(createPlacedEnemy())).rejects.toThrow('render failed');

      // 例外後でも Presentation のリスナーが残らない
      expect(events.getListenerCount('direction_changed')).toBe(0);

      renderEntitySpy.mockRestore();
    });
  });

  describe('ItemFactory', () => {
    const createPlacedItem = (overrides: Partial<PlacedItem> = {}): PlacedItem => ({
      id: 'factory-item-1',
      type: ItemType.HEALTH,
      x: 2,
      y: 3,
      rarity: ItemRarity.COMMON,
      ...overrides,
    });

    it('Item を生成・初期化する', async () => {
      const item = await ItemFactory.create(createPlacedItem());

      expect(item).toBeInstanceOf(Item);
      expect(item.id).toBe('factory-item-1');
    });

    it('ItemType.HEALTH → InventoryItemType.HEALTH_PACK を自動設定する', async () => {
      const item = await ItemFactory.create(createPlacedItem({ type: ItemType.HEALTH }));

      // toInventoryItem で InventoryItemType が反映されていることを確認
      const invItem = item.toInventoryItem();
      expect(invItem).not.toBeNull();
      expect(invItem!.type).toBe('health_pack');
    });

    it('ItemType.ENERGY → InventoryItemType.ENERGY_CELL を自動設定する', async () => {
      const item = await ItemFactory.create(createPlacedItem({ type: ItemType.ENERGY }));

      const invItem = item.toInventoryItem();
      expect(invItem).not.toBeNull();
      expect(invItem!.type).toBe('energy_cell');
    });

    it('ItemType.KEY → InventoryItemType.KEY_ITEM を自動設定する', async () => {
      const item = await ItemFactory.create(createPlacedItem({ type: ItemType.KEY }));

      const invItem = item.toInventoryItem();
      expect(invItem).not.toBeNull();
      expect(invItem!.type).toBe('key_item');
    });

    it('ItemType.CONSUMABLE は InventoryItemType を設定しない', async () => {
      const item = await ItemFactory.create(createPlacedItem({ type: ItemType.CONSUMABLE }));

      // CONSUMABLE は InventoryItemType に該当なし → toInventoryItem は null
      expect(item.toInventoryItem()).toBeNull();
    });
  });

  describe('ObstacleFactory', () => {
    const createPlacedObstacle = (overrides: Partial<PlacedObstacle> = {}): PlacedObstacle => ({
      id: 'factory-obstacle-1',
      type: ObstacleType.WALL,
      x: 1,
      y: 1,
      destructible: false,
      blocksVision: true,
      ...overrides,
    });

    it('Obstacle を生成・初期化する', async () => {
      const obstacle = await ObstacleFactory.create(createPlacedObstacle());

      expect(obstacle).toBeInstanceOf(Obstacle);
      expect(obstacle.id).toBe('factory-obstacle-1');
      expect(obstacle.getObstacleType()).toBe(ObstacleType.WALL);
    });

    it('破壊可能な Obstacle に Health コンポーネントが追加される', async () => {
      const obstacle = await ObstacleFactory.create(
        createPlacedObstacle({ destructible: true, health: 50 })
      );

      const health = obstacle.getComponent('health');
      expect(health).toBeDefined();
    });

    it('破壊不可能な Obstacle には Health コンポーネントがない', async () => {
      const obstacle = await ObstacleFactory.create(createPlacedObstacle({ destructible: false }));

      const health = obstacle.getComponent('health');
      expect(health).toBeUndefined();
    });
  });

  describe('mapItemTypeToInventoryType', () => {
    it('HEALTH → HEALTH_PACK', () => {
      expect(mapItemTypeToInventoryType(ItemType.HEALTH)).toBe('health_pack');
    });

    it('ENERGY → ENERGY_CELL', () => {
      expect(mapItemTypeToInventoryType(ItemType.ENERGY)).toBe('energy_cell');
    });

    it('WEAPON → WEAPON_UPGRADE', () => {
      expect(mapItemTypeToInventoryType(ItemType.WEAPON)).toBe('weapon_upgrade');
    });

    it('UPGRADE → WEAPON_UPGRADE', () => {
      expect(mapItemTypeToInventoryType(ItemType.UPGRADE)).toBe('weapon_upgrade');
    });

    it('ARMOR → ARMOR_UPGRADE', () => {
      expect(mapItemTypeToInventoryType(ItemType.ARMOR)).toBe('armor_upgrade');
    });

    it('KEY → KEY_ITEM', () => {
      expect(mapItemTypeToInventoryType(ItemType.KEY)).toBe('key_item');
    });

    it('CONSUMABLE → null', () => {
      expect(mapItemTypeToInventoryType(ItemType.CONSUMABLE)).toBeNull();
    });
  });
});
