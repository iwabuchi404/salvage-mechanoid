import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { Engine } from '@/engine/Engine';
import {
  isPlayerEntity,
  isEnemyEntity,
  isPlayerEntityId,
  isEnemyEntityId,
} from '@/engine/entity/EntityKind';

/**
 * EntityKind の純粋関数テスト
 *
 * C3: Entity 種別の判定規則を 1 つにする
 * ID プレフィックス判定がタグベースへ統一されていることを検証する。
 */
describe('EntityKind', () => {
  let entities: EntitySystem;

  beforeEach(async () => {
    entities = new EntitySystem();
    const engine = {
      getSystem: (name: string) => {
        if (name === 'entity') return entities;
        if (name === 'event') return new EventSystem();
        return undefined;
      },
    } as unknown as Engine;
    await entities.initialize(engine);
  });

  describe('isPlayerEntity', () => {
    it('player タグを持つ Entity をプレイヤーと判定する', () => {
      const entity = new Entity('player-1', 'player');
      entity.addTag('player');
      expect(isPlayerEntity(entity)).toBe(true);
    });

    it('player タグを持たない Entity をプレイヤー以外と判定する', () => {
      const entity = new Entity('enemy-1', 'enemy');
      entity.addTag('enemy');
      expect(isPlayerEntity(entity)).toBe(false);
    });

    it('ID が player で始まってもタグがなければプレイヤー以外', () => {
      const entity = new Entity('player-like-npc', 'npc');
      expect(isPlayerEntity(entity)).toBe(false);
    });
  });

  describe('isEnemyEntity', () => {
    it('enemy タグを持つ Entity を敵と判定する', () => {
      const entity = new Entity('enemy-1', 'enemy');
      entity.addTag('enemy');
      expect(isEnemyEntity(entity)).toBe(true);
    });

    it('enemy タグを持たない Entity を敵以外と判定する', () => {
      const entity = new Entity('player-1', 'player');
      entity.addTag('player');
      expect(isEnemyEntity(entity)).toBe(false);
    });
  });

  describe('isPlayerEntityId', () => {
    it('player タグを持つ Entity の ID をプレイヤーと判定する', () => {
      const entity = new Entity('player-1', 'player');
      entity.addTag('player');
      entities.registerEntity(entity);

      expect(isPlayerEntityId('player-1', entities)).toBe(true);
    });

    it('未登録の ID はプレイヤー以外', () => {
      expect(isPlayerEntityId('player-unknown', entities)).toBe(false);
    });

    it('entitySystem が null の場合は false', () => {
      expect(isPlayerEntityId('player-1', null)).toBe(false);
    });
  });

  describe('isEnemyEntityId', () => {
    it('enemy タグを持つ Entity の ID を敵と判定する', () => {
      const entity = new Entity('enemy-1', 'enemy');
      entity.addTag('enemy');
      entities.registerEntity(entity);

      expect(isEnemyEntityId('enemy-1', entities)).toBe(true);
    });

    it('未登録の ID は敵以外', () => {
      expect(isEnemyEntityId('enemy-unknown', entities)).toBe(false);
    });
  });
});
