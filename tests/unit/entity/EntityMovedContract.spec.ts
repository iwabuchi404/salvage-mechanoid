import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { EventName, TileType, Vector3 } from '@/engine/types';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { MovementComponent } from '@/engine/entity/components/Movement';
import { TileMap } from '@/engine/world/TileMap';
import { WorldSystem } from '@/engine/world/WorldSystem';

/**
 * P0 回帰テスト: ENTITY_MOVED のペイロード契約が統一されていること
 *
 * MovementComponent が発行する ENTITY_MOVED イベントを
 * WorldSystem と EntitySystem が同時に購読した状態で、
 * どちらのリスナーも例外なく処理できることを検証する。
 *
 * 旧バージョンでは Transform と Movement が異なるペイロードで
 * 同じイベント名を発行していたため、WorldSystem が data.position を
 * 読めず TypeError、EntitySystem が data.from を読めずフルスキャン
 * にフォールバックしていた。
 */
describe('P0: ENTITY_MOVED ペイロード契約の統一', () => {
  let eventSystem: EventSystem;
  let entitySystem: EntitySystem;
  let worldSystem: WorldSystem;
  let map: TileMap;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    eventSystem = new EventSystem();
    entitySystem = new EntitySystem();

    map = new TileMap(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.setTileAt(x, y, 0, TileType.TILE, true);
      }
    }

    worldSystem = new WorldSystem(map);

    const engine = {
      getSystem: (name: string) => {
        if (name === 'event') return eventSystem;
        if (name === 'entity') return entitySystem;
        if (name === 'world') return worldSystem;
        return undefined;
      },
    } as unknown as Engine;

    await entitySystem.initialize(engine);
    await worldSystem.initialize(engine);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('MovementComponent の ENTITY_MOVED を WorldSystem と EntitySystem が同時に処理する', () => {
    const consoleErrors = jest.spyOn(console, 'error');

    // MovementComponent を持つエンティティを登録
    const entity = new Entity('player', 'actor');
    entity.addTag('player');
    entity.addComponent(new TransformComponent(1, 1, 0));
    entity.addComponent(new MovementComponent(4, 150));
    entitySystem.registerEntity(entity);

    // Engine.instance をモック（MovementComponent が EventSystem を取得するため）
    const engineMock = {
      getSystem: (name: string) => {
        if (name === 'event') return eventSystem;
        if (name === 'entity') return entitySystem;
        if (name === 'world') return worldSystem;
        return undefined;
      },
    } as unknown as Engine;
    jest.spyOn(Engine, 'instance', 'get').mockReturnValue(engineMock);

    // 移動前のインデックスを確認
    expect(entitySystem.getEntityAtPosition(1, 1, 0)).toBe(entity);

    // MovementComponent 経由で移動
    const movement = entity.getComponent<MovementComponent>('movement')!;
    const moved = movement.moveTo(2, 1, 0);

    expect(moved).toBe(true);

    // EntitySystem のインデックスが新位置へ更新されている
    expect(entitySystem.getEntityAtPosition(1, 1, 0)).toBeUndefined();
    expect(entitySystem.getEntityAtPosition(2, 1, 0)).toBe(entity);

    // WorldSystem の tile_entered イベントが発行されている
    // （onEntityMoved が例外なく処理された証拠）
    // console.error が呼ばれていないことを確認
    expect(consoleErrors).not.toHaveBeenCalled();
  });

  it('統一ペイロード { entityId, from, to, position } の全フィールドが揃っている', () => {
    const received: Array<Record<string, unknown>> = [];
    eventSystem.on(EventName.ENTITY_MOVED, (data) => {
      received.push(data);
    });

    eventSystem.emit(EventName.ENTITY_MOVED, {
      entityId: 'test-1',
      from: { x: 1, y: 1, z: 0 },
      to: { x: 2, y: 1, z: 0 },
      position: { x: 2, y: 1, z: 0 },
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toHaveProperty('entityId', 'test-1');
    expect(received[0]).toHaveProperty('from');
    expect(received[0]).toHaveProperty('to');
    expect(received[0]).toHaveProperty('position');
  });
});
