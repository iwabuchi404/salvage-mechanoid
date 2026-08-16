import * as PIXI from 'pixi.js';
import { Engine } from '@/engine/Engine';
import { Enemy } from '@/engine/entity/Enemy';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { HealthComponent } from '@/engine/entity/components/Health';
import { SpriteComponent } from '@/engine/entity/components/Sprite';
import { CoordinateSystem } from '@/engine/graphics/CoordinateSystem';
import { RendererSystem } from '@/engine/graphics/RendererSystem';
import { EnemyPresentationFactory } from '@/engine/presentation/enemy/EnemyPresentationFactory';
import { resolveEnemyStats } from '@/engine/entity/enemy/EnemyStatProfile';
import { EnemyBehavior, EnemyType, LayerName, PlacedEnemy } from '@/engine/types';

/**
 * Enemy 描画境界の契約テスト
 * ピクセル比較ではなく、Enemy が描画アダプタへ渡す要求を固定する。
 */
describe('Enemy rendering boundary', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let renderer: RendererSystem;
  let renderEntitySpy: jest.SpyInstance;
  let removeSpriteSpy: jest.SpyInstance;
  let assetsLoadSpy: jest.SpyInstance;
  let charactersLayer: PIXI.Container;

  const createPlacedEnemy = (overrides: Partial<PlacedEnemy> = {}): PlacedEnemy => ({
    id: 'enemy-render-1',
    type: EnemyType.SOLDIER,
    x: 3,
    y: 5,
    level: 1,
    behavior: EnemyBehavior.STATIC,
    ...overrides,
  });

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // PIXI.Assets.load をモック（実際のアセット読み込みを回避）
    assetsLoadSpy = jest.spyOn(PIXI.Assets, 'load').mockResolvedValue(PIXI.Texture.EMPTY as any);

    // Engine シングルトンをリセットしてモックシステムを登録
    Engine.instance.reset();
    events = new EventSystem();
    entities = new EntitySystem();
    charactersLayer = new PIXI.Container();

    // モック RendererSystem
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

  const createAndInitEnemy = async (overrides: Partial<PlacedEnemy> = {}): Promise<Enemy> => {
    const enemyData = createPlacedEnemy(overrides);
    const enemy = new Enemy(enemyData, resolveEnemyStats(enemyData.type, enemyData.level));
    entities.registerEntity(enemy);
    await enemy.initialize();
    await EnemyPresentationFactory.create(enemy, enemyData.type);
    return enemy;
  };

  it('初期化時に Enemy 種別に対応した描画要求を characters レイヤーへ登録する', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });

    const sprite = enemy.getComponent<SpriteComponent>('sprite')?.getSprite();
    expect(sprite).not.toBeNull();
    expect(renderEntitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sprite,
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

    await createAndInitEnemy({ id: 'scout', type: EnemyType.SCOUT });
    await createAndInitEnemy({ id: 'soldier', type: EnemyType.SOLDIER });
    await createAndInitEnemy({ id: 'heavy', type: EnemyType.HEAVY });

    expect(loadCalls).toContain('./robo04_l.png'); // SCOUT
    expect(loadCalls).toContain('./robo03_l.png'); // SOLDIER
    expect(loadCalls).toContain('./robo02_l.png'); // HEAVY
  });

  it('方向変更で対応するテクスチャへ切り替える', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });
    const sprite = enemy.getComponent<SpriteComponent>('sprite')!;
    const changeTextureSpy = jest.spyOn(sprite, 'changeTexture');

    events.emit('direction_changed', { entityId: enemy.id, direction: 'right' });

    expect(changeTextureSpy).toHaveBeenCalledWith('./robo03_r.png');

    events.emit('direction_changed', { entityId: enemy.id, direction: 'left' });
    expect(changeTextureSpy).toHaveBeenCalledWith('./robo03_l.png');
  });

  it('別 Entity 宛ての方向変更イベントを無視する', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });
    const sprite = enemy.getComponent<SpriteComponent>('sprite')!;
    const changeTextureSpy = jest.spyOn(sprite, 'changeTexture');

    events.emit('direction_changed', { entityId: 'other-enemy', direction: 'right' });

    expect(changeTextureSpy).not.toHaveBeenCalled();
  });

  it('FOV 外でスプライトを非表示にし、FOV 内で再表示する', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });
    const sprite = enemy.getComponent<SpriteComponent>('sprite')!.getSprite()!;

    // 初期状態は視野内（SpriteComponent のデフォルト _inPlayerFOV = true）
    expect(sprite.visible).toBe(true);

    events.emit('entity_visibility_changed', { entityId: enemy.id, inFOV: false });
    expect(sprite.visible).toBe(false);

    events.emit('entity_visibility_changed', { entityId: enemy.id, inFOV: true });
    expect(sprite.visible).toBe(true);
  });

  it('別 Entity 宛ての可視性変更イベントを無視する', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });
    const sprite = enemy.getComponent<SpriteComponent>('sprite')!.getSprite()!;

    events.emit('entity_visibility_changed', { entityId: 'other-enemy', inFOV: false });

    expect(sprite.visible).toBe(true);
  });

  it('非アクティブ状態で可視性イベント受信時にスプライトを非表示にする', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });
    const sprite = enemy.getComponent<SpriteComponent>('sprite')!.getSprite()!;

    enemy.active = false;
    // Entity.update() は非アクティブ時には早期リターンするため、
    // 可視性イベント経由で SpriteComponent.setInFOV が呼ばれた時に active を参照する
    events.emit('entity_visibility_changed', { entityId: enemy.id, inFOV: true });

    expect(sprite.visible).toBe(false);
  });

  it('死亡時にエンティティが破棄されスプライトがレイヤーから外れる', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });
    const sprite = enemy.getComponent<SpriteComponent>('sprite')!.getSprite()!;
    const health = enemy.getComponent<HealthComponent>('health')!;

    // takeDamage で HP が 0 になると HealthComponent が entitySystem.removeEntity を呼ぶ
    health.takeDamage(health.maxHp, true, true);

    expect(removeSpriteSpy).toHaveBeenCalledWith(sprite, LayerName.CHARACTERS);
    expect(entities.getEntity(enemy.id)).toBeUndefined();
  });

  it('破棄時に描画オブジェクトをレイヤーから外す', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });
    const sprite = enemy.getComponent<SpriteComponent>('sprite')!.getSprite()!;

    enemy.destroy();

    expect(removeSpriteSpy).toHaveBeenCalledWith(sprite, LayerName.CHARACTERS);
  });

  it('破棄後に方向変更イベントへ反応しない', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });
    const spriteComp = enemy.getComponent<SpriteComponent>('sprite')!;
    const changeTextureSpy = jest.spyOn(spriteComp, 'changeTexture');

    enemy.destroy();

    changeTextureSpy.mockClear();
    events.emit('direction_changed', { entityId: enemy.id, direction: 'right' });

    expect(changeTextureSpy).not.toHaveBeenCalled();
  });

  it('破棄後に可視性変更イベントへ反応しない', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });
    const sprite = enemy.getComponent<SpriteComponent>('sprite')!.getSprite()!;

    enemy.destroy();

    // 破棄後は sprite が null になっているため、イベントを発行しても例外や変更なし
    expect(() => {
      events.emit('entity_visibility_changed', { entityId: enemy.id, inFOV: false });
    }).not.toThrow();
    expect(sprite.visible).toBe(true); // 破棄前の最終状態（destroy は visible を変更しない）
  });

  it('破棄時に direction_changed リスナーを EventSystem から解除する', async () => {
    const listenerCountBefore = events.getListenerCount('direction_changed');

    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });

    // Enemy が direction_changed リスナーを1つ追加している
    expect(events.getListenerCount('direction_changed')).toBe(listenerCountBefore + 1);

    enemy.destroy();

    // 破棄後にリスナー数が元に戻っている（解除されている）
    expect(events.getListenerCount('direction_changed')).toBe(listenerCountBefore);
  });

  it('破棄時に entity_visibility_changed リスナーを EventSystem から解除する', async () => {
    const listenerCountBefore = events.getListenerCount('entity_visibility_changed');

    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });

    // SpriteComponent が entity_visibility_changed リスナーを追加する（Enemy 自身は追加しない）
    const listenerCountAfterInit = events.getListenerCount('entity_visibility_changed');
    expect(listenerCountAfterInit).toBe(listenerCountBefore + 1);

    enemy.destroy();

    // 破棄後に SpriteComponent のリスナーが解除されている（-1）
    const listenerCountAfterDestroy = events.getListenerCount('entity_visibility_changed');
    expect(listenerCountAfterDestroy).toBe(listenerCountBefore);
  });

  it('複数Enemy破棄時にリスナーが累積しない', async () => {
    const initialListenerCount = events.getListenerCount('direction_changed');

    // 3体のEnemyを作成
    const enemies: Enemy[] = [];
    for (let i = 0; i < 3; i++) {
      enemies.push(await createAndInitEnemy({ id: `enemy-${i}`, type: EnemyType.SOLDIER }));
    }

    // リスナーが3つ追加されている（各Enemyが1つずつ追加）
    expect(events.getListenerCount('direction_changed')).toBe(initialListenerCount + 3);

    // 全て破棄
    for (const enemy of enemies) {
      enemy.destroy();
    }

    // リスナー数が初期値に戻っている（累積していない）
    expect(events.getListenerCount('direction_changed')).toBe(initialListenerCount);
  });

  it('破棄後にスプライト参照を残さない', async () => {
    const enemy = await createAndInitEnemy({ type: EnemyType.SOLDIER });

    enemy.destroy();

    const spriteComp = enemy.getComponent<SpriteComponent>('sprite');
    // destroy でコンポーネントが削除されるため、getComponent は undefined を返す
    expect(spriteComp).toBeUndefined();
  });
});
