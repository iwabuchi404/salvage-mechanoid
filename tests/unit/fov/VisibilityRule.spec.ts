import { Entity } from '@/engine/entity/Entity';
import { TransformComponent } from '@/engine/entity/components/Transform';
import {
  isPlayerEntity,
  getEntityTilePosition,
  isEntityVisible,
  diffEntityVisibility,
  diffTileVisibility,
} from '@/engine/fov/VisibilityRule';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * VisibilityRule - Entity 可視性判定の純粋関数テスト
 */
describe('VisibilityRule', () => {
  const makeEntity = (id: string, x: number, y: number, ...tags: string[]): Entity => {
    const entity = new Entity(id, 'test');
    entity.addComponent(new TransformComponent(x, y, 0));
    tags.forEach((tag) => entity.addTag(tag));
    return entity;
  };

  describe('isPlayerEntity', () => {
    it('player タグを持つ Entity をプレイヤーと判定する', () => {
      expect(isPlayerEntity(makeEntity('player', 0, 0, 'player'))).toBe(true);
      expect(isPlayerEntity(makeEntity('enemy', 0, 0, 'enemy'))).toBe(false);
    });
  });

  describe('getEntityTilePosition', () => {
    it('Transform からタイル座標を取得する（小数は四捨五入）', () => {
      expect(getEntityTilePosition(makeEntity('e', 1.4, 2.4))).toEqual({ x: 1, y: 2 });
      expect(getEntityTilePosition(makeEntity('e', 1.6, 2.6))).toEqual({ x: 2, y: 3 });
    });

    it('Transform を持たない場合は null を返す', () => {
      const entity = new Entity('e', 'test');
      expect(getEntityTilePosition(entity)).toBeNull();
    });
  });

  describe('isEntityVisible', () => {
    it('プレイヤーは常に可視', () => {
      const player = makeEntity('player', 0, 0, 'player');
      const visible = new Set<string>();
      expect(isEntityVisible(player, visible)).toBe(true);
    });

    it('位置が可視タイル上なら可視', () => {
      const enemy = makeEntity('enemy', 2, 3, 'enemy');
      const visible = new Set(['2,3']);
      expect(isEntityVisible(enemy, visible)).toBe(true);
    });

    it('位置の隣接マスだけが可視でも Entity 自身のタイルが不可視なら不可視', () => {
      const enemy = makeEntity('enemy', 2, 3, 'enemy');
      expect(isEntityVisible(enemy, new Set(['1,3']))).toBe(false);
      expect(isEntityVisible(enemy, new Set(['3,3']))).toBe(false);
      expect(isEntityVisible(enemy, new Set(['2,2']))).toBe(false);
      expect(isEntityVisible(enemy, new Set(['2,4']))).toBe(false);
    });

    it('位置も隣接マスも不可視なら不可視', () => {
      const enemy = makeEntity('enemy', 2, 3, 'enemy');
      expect(isEntityVisible(enemy, new Set(['0,0']))).toBe(false);
      expect(isEntityVisible(enemy, new Set())).toBe(false);
    });

    it('Transform を持たない Entity は不可視（プレイヤー以外）', () => {
      const entity = new Entity('e', 'test');
      entity.addTag('enemy');
      expect(isEntityVisible(entity, new Set(['0,0']))).toBe(false);
    });
  });

  describe('diffEntityVisibility', () => {
    it('可視状態が変化した Entity のみを返す', () => {
      const e1 = makeEntity('e1', 1, 1, 'enemy');
      const e2 = makeEntity('e2', 5, 5, 'enemy');
      const visible = new Set(['1,1']);

      const prev = new Map<string, boolean>([
        ['e1', false],
        ['e2', false],
      ]);

      const changes = diffEntityVisibility([e1, e2], visible, prev);
      expect(changes).toEqual([{ entityId: 'e1', inFOV: true }]);
    });

    it('可視状態が変わらない Entity は返さない', () => {
      const e1 = makeEntity('e1', 1, 1, 'enemy');
      const visible = new Set(['1,1']);
      const prev = new Map([['e1', true]]);

      expect(diffEntityVisibility([e1], visible, prev)).toEqual([]);
    });

    it('プレイヤーは差分対象から除外する', () => {
      const player = makeEntity('player', 0, 0, 'player');
      const visible = new Set(['0,0']);
      const prev = new Map<string, boolean>();

      expect(diffEntityVisibility([player], visible, prev)).toEqual([]);
    });

    it('前回状態になく今回可視になった Entity も通知する', () => {
      const e1 = makeEntity('e1', 1, 1, 'enemy');
      const visible = new Set(['1,1']);
      const prev = new Map<string, boolean>();

      expect(diffEntityVisibility([e1], visible, prev)).toEqual([{ entityId: 'e1', inFOV: true }]);
    });

    it('前回可視で今回不可視になった Entity を通知する', () => {
      const e1 = makeEntity('e1', 1, 1, 'enemy');
      const visible = new Set<string>();
      const prev = new Map([['e1', true]]);

      expect(diffEntityVisibility([e1], visible, prev)).toEqual([{ entityId: 'e1', inFOV: false }]);
    });
  });

  describe('diffTileVisibility', () => {
    it('新規可視タイルを visible:true で返す', () => {
      const current = new Set(['1,1', '2,2']);
      const prev = new Set(['1,1']);
      const changes = diffTileVisibility(current, prev);
      expect(changes).toContainEqual({ x: 2, y: 2, visible: true });
    });

    it('不可視化されたタイルを visible:false で返す', () => {
      const current = new Set(['1,1']);
      const prev = new Set(['1,1', '3,3']);
      const changes = diffTileVisibility(current, prev);
      expect(changes).toContainEqual({ x: 3, y: 3, visible: false });
    });

    it('変化がない場合は空配列を返す', () => {
      const current = new Set(['1,1']);
      const prev = new Set(['1,1']);
      expect(diffTileVisibility(current, prev)).toEqual([]);
    });

    it('両方空の場合は空配列を返す', () => {
      expect(diffTileVisibility(new Set(), new Set())).toEqual([]);
    });
  });
});
