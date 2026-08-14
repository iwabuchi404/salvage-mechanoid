import { Entity } from '@/engine/entity/Entity';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { InteractableComponent } from '@/engine/entity/components/Interactable';
import {
  findInteractionCandidates,
  findEntityAtTilePosition,
  prioritizeExecutable,
  Position3D,
} from '@/engine/interaction/InteractionQuery';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * InteractionQuery - インタラクション候補抽出の純粋関数テスト
 */
describe('InteractionQuery', () => {
  const makeEventObject = (
    id: string,
    x: number,
    y: number,
    z: number,
    interactable: InteractableComponent
  ): Entity => {
    const entity = new Entity(id, 'event_object');
    entity.addComponent(new TransformComponent(x, y, z));
    entity.addComponent(interactable);
    entity.addTag('event_object');
    return entity;
  };

  describe('findInteractionCandidates', () => {
    const pos = (x: number, y: number, z = 0): Position3D => ({ x, y, z });

    it('指定位置の event_object を候補として返す', () => {
      const interactable = new InteractableComponent(jest.fn());
      const e = makeEventObject('portal-1', 2, 3, 0, interactable);

      const candidates = findInteractionCandidates([e], pos(2, 3));
      expect(candidates).toHaveLength(1);
      expect(candidates[0].entityId).toBe('portal-1');
      expect(candidates[0].position).toEqual({ x: 2, y: 3, z: 0 });
      expect(candidates[0].canInteract).toBe(true);
    });

    it('位置が一致しない event_object は候補に入れない', () => {
      const interactable = new InteractableComponent(jest.fn());
      const e = makeEventObject('portal-1', 2, 3, 0, interactable);

      expect(findInteractionCandidates([e], pos(5, 5))).toHaveLength(0);
    });

    it('z 座標も一致する必要がある', () => {
      const interactable = new InteractableComponent(jest.fn());
      const e = makeEventObject('portal-1', 2, 3, 1, interactable);

      expect(findInteractionCandidates([e], pos(2, 3, 0))).toHaveLength(0);
      expect(findInteractionCandidates([e], pos(2, 3, 1))).toHaveLength(1);
    });

    it('event_object タグを持たない Entity は候補に入れない', () => {
      const interactable = new InteractableComponent(jest.fn());
      const entity = new Entity('not-event', 'test');
      entity.addComponent(new TransformComponent(2, 3, 0));
      entity.addComponent(interactable);
      // event_object タグを付けない

      expect(findInteractionCandidates([entity], pos(2, 3))).toHaveLength(0);
    });

    it('Interactable を持たない event_object は候補に入れない', () => {
      const entity = new Entity('no-interact', 'event_object');
      entity.addComponent(new TransformComponent(2, 3, 0));
      entity.addTag('event_object');
      // InteractableComponent を追加しない

      expect(findInteractionCandidates([entity], pos(2, 3))).toHaveLength(0);
    });

    it('使用済み oneTimeUse の canInteract は false になる', () => {
      const interactable = new InteractableComponent(jest.fn(), true);
      interactable.interact('player');
      const e = makeEventObject('one-time', 2, 3, 0, interactable);

      const candidates = findInteractionCandidates([e], pos(2, 3));
      expect(candidates).toHaveLength(1);
      expect(candidates[0].canInteract).toBe(false);
    });

    it('複数の候補を同位置で返すことができる', () => {
      const e1 = makeEventObject('e1', 2, 3, 0, new InteractableComponent(jest.fn()));
      const e2 = makeEventObject('e2', 2, 3, 0, new InteractableComponent(jest.fn()));

      expect(findInteractionCandidates([e1, e2], pos(2, 3))).toHaveLength(2);
    });

    it('非 active の Entity は候補に入れない', () => {
      const entity = makeEventObject('inactive', 2, 3, 0, new InteractableComponent(jest.fn()));
      entity.active = false;

      expect(findInteractionCandidates([entity], pos(2, 3))).toEqual([]);
    });

    it('maxRange=1 で上下左右の隣接候補を取得できる', () => {
      const adjacent = makeEventObject('adjacent', 3, 3, 0, new InteractableComponent(jest.fn()));
      const diagonal = makeEventObject('diagonal', 3, 4, 0, new InteractableComponent(jest.fn()));

      const candidates = findInteractionCandidates([adjacent, diagonal], pos(2, 3), {
        maxRange: 1,
      });

      expect(candidates.map((candidate) => candidate.entityId)).toEqual(['adjacent']);
    });

    it('minRange=1 と maxRange=1 で同一マスを除外して隣接だけを取得できる', () => {
      const sameTile = makeEventObject('same', 2, 3, 0, new InteractableComponent(jest.fn()));
      const adjacent = makeEventObject('adjacent', 2, 4, 0, new InteractableComponent(jest.fn()));

      const candidates = findInteractionCandidates([sameTile, adjacent], pos(2, 3), {
        minRange: 1,
        maxRange: 1,
      });

      expect(candidates.map((candidate) => candidate.entityId)).toEqual(['adjacent']);
    });
  });

  describe('findEntityAtTilePosition', () => {
    it('タイル座標が一致する最初の Entity を返す', () => {
      const e1 = new Entity('e1', 'test');
      e1.addComponent(new TransformComponent(1.4, 2.4, 0));
      const e2 = new Entity('e2', 'test');
      e2.addComponent(new TransformComponent(5, 5, 0));

      expect(findEntityAtTilePosition([e1, e2], 1, 2)).toBe(e1);
      expect(findEntityAtTilePosition([e1, e2], 5, 5)).toBe(e2);
    });

    it('一致する Entity がない場合は null を返す', () => {
      const e1 = new Entity('e1', 'test');
      e1.addComponent(new TransformComponent(1, 2, 0));

      expect(findEntityAtTilePosition([e1], 5, 5)).toBeNull();
      expect(findEntityAtTilePosition([], 0, 0)).toBeNull();
    });

    it('Transform を持たない Entity は無視する', () => {
      const e1 = new Entity('e1', 'test');
      // Transform を追加しない

      expect(findEntityAtTilePosition([e1], 0, 0)).toBeNull();
    });
  });

  describe('prioritizeExecutable', () => {
    it('canInteract=true の候補を先頭に並べる', () => {
      const candidates = [
        { entityId: 'a', position: { x: 0, y: 0, z: 0 }, canInteract: false },
        { entityId: 'b', position: { x: 0, y: 0, z: 0 }, canInteract: true },
        { entityId: 'c', position: { x: 0, y: 0, z: 0 }, canInteract: true },
      ];

      const sorted = prioritizeExecutable(candidates);
      expect(sorted[0].entityId).toBe('b');
      expect(sorted[1].entityId).toBe('c');
      expect(sorted[2].entityId).toBe('a');
    });

    it('全員 canInteract=false の場合は順序を維持する', () => {
      const candidates = [
        { entityId: 'a', position: { x: 0, y: 0, z: 0 }, canInteract: false },
        { entityId: 'b', position: { x: 0, y: 0, z: 0 }, canInteract: false },
      ];

      const sorted = prioritizeExecutable(candidates);
      expect(sorted.map((c) => c.entityId)).toEqual(['a', 'b']);
    });

    it('空配列は空配列を返す', () => {
      expect(prioritizeExecutable([])).toEqual([]);
    });
  });
});
