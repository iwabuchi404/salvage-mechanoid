import { Action, ActionCost, ActionKind, ActionResult } from '@/engine/turn/Action';
import { DEFAULT_ACTION_COSTS, getActionCost } from '@/engine/turn/ActionCostTable';

/**
 * BU-3 段階2: Action 型とコストテーブルの単体テスト
 */
describe('BU-3 段階2: Action と ActionCostTable', () => {
  describe('DEFAULT_ACTION_COSTS', () => {
    it('移動は timeCost 1 / energyCost 1（現行挙動と一致）', () => {
      expect(DEFAULT_ACTION_COSTS.move).toEqual({ timeCost: 1, energyCost: 1 });
    });

    it('攻撃は timeCost 1 / energyCost 2（現行挙動と一致）', () => {
      expect(DEFAULT_ACTION_COSTS.attack).toEqual({ timeCost: 1, energyCost: 2 });
    });

    it('方向転換は timeCost 1 / energyCost 0（現行挙動と一致）', () => {
      expect(DEFAULT_ACTION_COSTS.turn).toEqual({ timeCost: 1, energyCost: 0 });
    });

    it('インタラクションは timeCost 0（自動発火・行動権を消費しない）', () => {
      expect(DEFAULT_ACTION_COSTS.interact.timeCost).toBe(0);
    });

    it('待機は timeCost 1 / energyCost 0', () => {
      expect(DEFAULT_ACTION_COSTS.wait).toEqual({ timeCost: 1, energyCost: 0 });
    });

    it('アイテム使用は timeCost 1 / energyCost 0', () => {
      expect(DEFAULT_ACTION_COSTS.use_item).toEqual({ timeCost: 1, energyCost: 0 });
    });

    it('スキル使用は timeCost 1 / energyCost 0（実コストは Skill 側が持つ）', () => {
      expect(DEFAULT_ACTION_COSTS.use_skill).toEqual({ timeCost: 1, energyCost: 0 });
    });

    it('すべての ActionKind が定義されている', () => {
      const kinds: ActionKind[] = [
        'move',
        'turn',
        'attack',
        'use_item',
        'use_skill',
        'interact',
        'wait',
      ];
      for (const kind of kinds) {
        expect(DEFAULT_ACTION_COSTS[kind]).toBeDefined();
      }
    });

    it('Object.freeze されている（不変）', () => {
      expect(Object.isFrozen(DEFAULT_ACTION_COSTS)).toBe(true);
    });
  });

  describe('getActionCost', () => {
    it('種別に対応するコストを返す', () => {
      expect(getActionCost('move')).toEqual({ timeCost: 1, energyCost: 1 });
      expect(getActionCost('attack')).toEqual({ timeCost: 1, energyCost: 2 });
      expect(getActionCost('turn')).toEqual({ timeCost: 1, energyCost: 0 });
    });
  });

  describe('Action / ActionResult の型利用', () => {
    it('Action を構築できる', () => {
      const action: Action = {
        kind: 'move',
        actorId: 'player',
        cost: getActionCost('move'),
        params: { direction: 'up' },
      };
      expect(action.kind).toBe('move');
      expect(action.actorId).toBe('player');
      expect(action.cost.timeCost).toBe(1);
      expect(action.params?.direction).toBe('up');
    });

    it('ActionResult の成功パターンを構築できる', () => {
      const result: ActionResult = { success: true, consumedTime: 1 };
      expect(result.success).toBe(true);
      expect(result.consumedTime).toBe(1);
    });

    it('ActionResult の失敗パターンを構築できる', () => {
      const result: ActionResult = {
        success: false,
        consumedTime: 0,
        reason: 'blocked',
      };
      expect(result.success).toBe(false);
      expect(result.consumedTime).toBe(0);
      expect(result.reason).toBe('blocked');
    });

    it('timeCost 0 の Action は行動権を消費しないことを型で表現できる', () => {
      const freeAction: ActionCost = { timeCost: 0, energyCost: 0 };
      expect(freeAction.timeCost).toBe(0);
    });
  });
});
