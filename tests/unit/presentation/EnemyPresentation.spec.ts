import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { SpriteComponent } from '@/engine/entity/components/Sprite';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { CoordinateSystem } from '@/engine/graphics/CoordinateSystem';
import { RendererSystem } from '@/engine/graphics/RendererSystem';
import { EnemyType, LayerName } from '@/engine/types';
import { EnemyPresentation } from '@/engine/presentation/enemy/EnemyPresentation';
import { EnemyPresentationFactory } from '@/engine/presentation/enemy/EnemyPresentationFactory';

/**
 * EnemyPresentation の単体テスト
 * Presentation が SpriteComponent 生成・direction_changed 購読・テクスチャ切替・
 * destroy を正しく行うことを検証する。
 */
describe('EnemyPresentation', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let renderer: RendererSystem;
  let renderEntitySpy: jest.SpyInstance;
  let removeSpriteSpy: jest.SpyInstance;
  let assetsLoadSpy: jest.SpyInstance;
  let charactersLayer: PIXI.Container;

  const createEntity = (id: string, enemyType: string): Entity => {
    const entity = new Entity(id, 'enemy');
    entity.addTag('enemy');
    entity.addTag(enemyType);
    entity.addComponent(new TransformComponent(3, 5, 0));
    return entity;
  };

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

    renderEntitySpy = jest.spyOn(renderer, 'renderEntity');
    removeSpriteSpy = jest.spyOn(renderer, 'removeSprite');

    const engine = Engine.instance;
    await entities.initialize(engine);
  });

  afterEach(() => {
    Engine.instance.reset();
    assetsLoadSpy.mockRestore();
    jest.restoreAllMocks();
  });

  const createAndInitPresentation = async (
    enemyType: EnemyType = EnemyType.SOLDIER,
    id = 'enemy-pres-1'
  ): Promise<{ entity: Entity; presentation: EnemyPresentation }> => {
    const entity = createEntity(id, enemyType);
    entities.registerEntity(entity);
    const presentation = new EnemyPresentation(entity, enemyType);
    await presentation.initialize();
    return { entity, presentation };
  };

  it('初期化時に SpriteComponent を Entity に追加する', async () => {
    const { entity } = await createAndInitPresentation();

    const sprite = entity.getComponent<SpriteComponent>('sprite');
    expect(sprite).toBeDefined();
  });

  it('初期化時に characters レイヤーへ描画要求を登録する', async () => {
    await createAndInitPresentation();

    expect(renderEntitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        layer: LayerName.CHARACTERS,
        anchor: { x: 0.5, y: 1.0 },
      })
    );
  });

  it('敵タイプごとに初期テクスチャパスが異なる', async () => {
    const loadCalls: string[] = [];
    assetsLoadSpy.mockImplementation((src: string) => {
      loadCalls.push(src);
      return Promise.resolve(PIXI.Texture.EMPTY as any);
    });

    await createAndInitPresentation(EnemyType.SCOUT, 'scout');
    await createAndInitPresentation(EnemyType.SOLDIER, 'soldier');
    await createAndInitPresentation(EnemyType.HEAVY, 'heavy');

    expect(loadCalls).toContain('./robo04_l.png'); // SCOUT
    expect(loadCalls).toContain('./robo03_l.png'); // SOLDIER
    expect(loadCalls).toContain('./robo02_l.png'); // HEAVY
  });

  it('direction_changed イベントでテクスチャを切り替える', async () => {
    const { entity } = await createAndInitPresentation(EnemyType.SOLDIER);
    const sprite = entity.getComponent<SpriteComponent>('sprite')!;
    const changeTextureSpy = jest.spyOn(sprite, 'changeTexture');

    events.emit('direction_changed', { entityId: entity.id, direction: 'right' });
    expect(changeTextureSpy).toHaveBeenCalledWith('./robo03_r.png');

    events.emit('direction_changed', { entityId: entity.id, direction: 'left' });
    expect(changeTextureSpy).toHaveBeenCalledWith('./robo03_l.png');
  });

  it('別 Entity 宛ての direction_changed イベントを無視する', async () => {
    const { entity } = await createAndInitPresentation();
    const sprite = entity.getComponent<SpriteComponent>('sprite')!;
    const changeTextureSpy = jest.spyOn(sprite, 'changeTexture');

    events.emit('direction_changed', { entityId: 'other-enemy', direction: 'right' });

    expect(changeTextureSpy).not.toHaveBeenCalled();
  });

  it('destroy で direction_changed リスナーを解除する', async () => {
    const listenerCountBefore = events.getListenerCount('direction_changed');

    const { presentation } = await createAndInitPresentation();

    expect(events.getListenerCount('direction_changed')).toBe(listenerCountBefore + 1);

    presentation.destroy();

    expect(events.getListenerCount('direction_changed')).toBe(listenerCountBefore);
  });

  it('destroy 後に direction_changed イベントへ反応しない', async () => {
    const { entity, presentation } = await createAndInitPresentation();
    const sprite = entity.getComponent<SpriteComponent>('sprite')!;
    const changeTextureSpy = jest.spyOn(sprite, 'changeTexture');

    presentation.destroy();
    changeTextureSpy.mockClear();

    events.emit('direction_changed', { entityId: entity.id, direction: 'right' });

    expect(changeTextureSpy).not.toHaveBeenCalled();
  });

  it('複数 Presentation 破棄時にリスナーが累積しない', async () => {
    const initialListenerCount = events.getListenerCount('direction_changed');

    const presentations: EnemyPresentation[] = [];
    for (let i = 0; i < 3; i++) {
      const entity = createEntity(`enemy-${i}`, EnemyType.SOLDIER);
      entities.registerEntity(entity);
      const presentation = new EnemyPresentation(entity, EnemyType.SOLDIER);
      await presentation.initialize();
      presentations.push(presentation);
    }

    expect(events.getListenerCount('direction_changed')).toBe(initialListenerCount + 3);

    for (const presentation of presentations) {
      presentation.destroy();
    }

    expect(events.getListenerCount('direction_changed')).toBe(initialListenerCount);
  });

  it('EnemyPresentationFactory.create で初期化済み Presentation を取得できる', async () => {
    const entity = createEntity('factory-test', EnemyType.SCOUT);
    entities.registerEntity(entity);

    const presentation = await EnemyPresentationFactory.create(entity, EnemyType.SCOUT);

    expect(presentation).toBeDefined();
    expect(entity.getComponent<SpriteComponent>('sprite')).toBeDefined();

    presentation.destroy();
  });

  it('FOV 外でスプライトを非表示にし、FOV 内で再表示する', async () => {
    const { entity } = await createAndInitPresentation();
    const sprite = entity.getComponent<SpriteComponent>('sprite')!.getSprite()!;

    expect(sprite.visible).toBe(true);

    events.emit('entity_visibility_changed', { entityId: entity.id, inFOV: false });
    expect(sprite.visible).toBe(false);

    events.emit('entity_visibility_changed', { entityId: entity.id, inFOV: true });
    expect(sprite.visible).toBe(true);
  });

  it('別 Entity 宛ての可視性変更イベントを無視する', async () => {
    const { entity } = await createAndInitPresentation();
    const sprite = entity.getComponent<SpriteComponent>('sprite')!.getSprite()!;

    events.emit('entity_visibility_changed', { entityId: 'other-enemy', inFOV: false });

    expect(sprite.visible).toBe(true);
  });
});
