import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { InteractableComponent } from '@/engine/entity/components/Interactable';
import { InteractionExecutor } from '@/engine/interaction/InteractionExecutor';
import { findInteractionCandidates } from '@/engine/interaction/InteractionQuery';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * InteractionExecutor - 効果実行のテスト
 *
 * InteractionQuery が抽出した候補に対して interact() を呼び、
 * interaction_completed イベントを発行する境界を検証する。
 */
describe('InteractionExecutor', () => {
  let entitySystem: EntitySystem;
  let eventSystem: EventSystem;
  let executor: InteractionExecutor;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation();
    eventSystem = new EventSystem();
    entitySystem = new EntitySystem();
    executor = new InteractionExecutor(entitySystem, eventSystem);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeEventObject = (
    id: string,
    x: number,
    y: number,
    onInteract: (playerId: string) => void,
    oneTimeUse = false
  ): Entity => {
    const entity = new Entity(id, 'event_object');
    entity.addComponent(new TransformComponent(x, y, 0));
    entity.addComponent(new InteractableComponent(onInteract, oneTimeUse));
    entity.addTag('event_object');
    entitySystem.registerEntity(entity);
    return entity;
  };

  describe('execute', () => {
    it('候補に対して interact() を呼ぶ', () => {
      const onInteract = jest.fn();
      const e = makeEventObject('portal-1', 2, 3, onInteract);

      const [candidate] = findInteractionCandidates([e], { x: 2, y: 3, z: 0 });
      const result = executor.execute(candidate, 'player');

      expect(result).toBe(true);
      expect(onInteract).toHaveBeenCalledWith('player');
    });

    it('成功時に interaction_completed イベントを発行する', () => {
      makeEventObject('portal-1', 2, 3, jest.fn());
      const handler = jest.fn();
      eventSystem.on('interaction_completed', handler);

      const e = entitySystem.getEntity('portal-1')!;
      const interactable = e.getComponent<InteractableComponent>('interactable')!;
      const candidate = {
        entityId: 'portal-1',
        position: { x: 2, y: 3, z: 0 },
        canInteract: interactable.canInteract(),
      };
      executor.execute(candidate, 'player');

      expect(handler).toHaveBeenCalledWith({
        playerId: 'player',
        objectId: 'portal-1',
        position: { x: 2, y: 3, z: 0 },
      });
    });

    it('canInteract=false の候補は実行せず false を返す', () => {
      const onInteract = jest.fn();
      const e = makeEventObject('one-time', 2, 3, onInteract, true);
      // 1回使用済みにする
      e.getComponent<InteractableComponent>('interactable')!.interact('player');
      onInteract.mockClear();

      const candidate = {
        entityId: 'one-time',
        position: { x: 2, y: 3, z: 0 },
        canInteract: false,
      };
      const result = executor.execute(candidate, 'player');

      expect(result).toBe(false);
      expect(onInteract).not.toHaveBeenCalled();
    });

    it('存在しない entityId は false を返す', () => {
      const candidate = {
        entityId: 'missing',
        position: { x: 0, y: 0, z: 0 },
        canInteract: true,
      };
      expect(executor.execute(candidate, 'player')).toBe(false);
    });

    it('候補抽出後に Entity が非 active になった場合は実行しない', () => {
      const onInteract = jest.fn();
      const entity = makeEventObject('inactive', 2, 3, onInteract);
      const [candidate] = findInteractionCandidates([entity], { x: 2, y: 3, z: 0 });
      entity.active = false;

      expect(executor.execute(candidate, 'player')).toBe(false);
      expect(onInteract).not.toHaveBeenCalled();
    });
  });

  describe('executeAll', () => {
    it('最初に成功した候補で打ち切る', () => {
      const onInteract1 = jest.fn(() => {
        throw new Error('fail');
      });
      const onInteract2 = jest.fn();
      makeEventObject('e1', 2, 3, onInteract1);
      makeEventObject('e2', 2, 3, onInteract2);

      const entities = entitySystem.getEntities();
      const candidates = findInteractionCandidates(entities, { x: 2, y: 3, z: 0 });
      const result = executor.executeAll(candidates, 'player');

      expect(result).toBe(true);
      // e1 は例外で失敗、e2 が成功
      expect(onInteract2).toHaveBeenCalledWith('player');
    });

    it('全候補失敗時は false を返す', () => {
      const onInteract = jest.fn(() => {
        throw new Error('fail');
      });
      makeEventObject('e1', 2, 3, onInteract);

      const entities = entitySystem.getEntities();
      const candidates = findInteractionCandidates(entities, { x: 2, y: 3, z: 0 });
      const result = executor.executeAll(candidates, 'player');

      expect(result).toBe(false);
    });

    it('空配列は false を返す', () => {
      expect(executor.executeAll([], 'player')).toBe(false);
    });
  });

  describe('executeAtPosition', () => {
    it('指定位置の候補を抽出して実行する', () => {
      const onInteract = jest.fn();
      makeEventObject('portal-1', 2, 3, onInteract);

      const result = executor.executeAtPosition(
        entitySystem.getEntities(),
        { x: 2, y: 3, z: 0 },
        'player'
      );

      expect(result).toBe(true);
      expect(onInteract).toHaveBeenCalledWith('player');
    });

    it('候補が存在しない位置では false を返す', () => {
      makeEventObject('portal-1', 2, 3, jest.fn());

      const result = executor.executeAtPosition(
        entitySystem.getEntities(),
        { x: 9, y: 9, z: 0 },
        'player'
      );

      expect(result).toBe(false);
    });
  });

  describe('executeById', () => {
    it('ID を直接指定して実行する', () => {
      const onInteract = jest.fn();
      makeEventObject('portal-1', 2, 3, onInteract);

      const result = executor.executeById('portal-1', 'player');

      expect(result).toBe(true);
      expect(onInteract).toHaveBeenCalledWith('player');
    });

    it('存在しない ID は false を返す', () => {
      expect(executor.executeById('missing', 'player')).toBe(false);
    });

    it('非 active の ID は直接指定でも実行しない', () => {
      const onInteract = jest.fn();
      const entity = makeEventObject('inactive', 2, 3, onInteract);
      entity.active = false;

      expect(executor.executeById('inactive', 'player')).toBe(false);
      expect(onInteract).not.toHaveBeenCalled();
    });

    it('使用済み oneTimeUse は false を返す', () => {
      const onInteract = jest.fn();
      makeEventObject('one-time', 2, 3, onInteract, true);
      executor.executeById('one-time', 'player');
      onInteract.mockClear();

      expect(executor.executeById('one-time', 'player')).toBe(false);
      expect(onInteract).not.toHaveBeenCalled();
    });
  });
});
