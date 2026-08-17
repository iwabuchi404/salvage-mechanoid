import { setActivePinia, createPinia } from 'pinia';
import { useUIPanelStore } from '@/stores/uiPanelStore';

/**
 * BU-4 段階4: パネル管理機構のテスト
 *
 * 設計 docs/design/UI_BOUNDARY_DESIGN.md §4.3, §7.2
 */
describe('BU-4 段階4: UIPanelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('初期状態', () => {
    it('スタックは空', () => {
      const store = useUIPanelStore();
      expect(store.stack).toEqual([]);
      expect(store.top).toBeNull();
      expect(store.inputBlocked).toBe(false);
    });

    it('isOpen は false', () => {
      const store = useUIPanelStore();
      expect(store.isOpen('action_menu')).toBe(false);
      expect(store.isOpen('item_list')).toBe(false);
    });
  });

  describe('open / close', () => {
    it('パネルを開くとスタックに追加される', () => {
      const store = useUIPanelStore();
      store.open('status_window');
      expect(store.isOpen('status_window')).toBe(true);
      expect(store.top).toBe('status_window');
    });

    it('パネルを閉じるとスタックから削除される', () => {
      const store = useUIPanelStore();
      store.open('status_window');
      store.close('status_window');
      expect(store.isOpen('status_window')).toBe(false);
      expect(store.top).toBeNull();
    });

    it('closeTop は最前面のパネルを閉じる', () => {
      const store = useUIPanelStore();
      store.open('status_window');
      store.open('item_list');
      store.closeTop();
      expect(store.isOpen('item_list')).toBe(false);
      expect(store.top).toBe('status_window');
    });

    it('closeAll は全パネルを閉じる', () => {
      const store = useUIPanelStore();
      store.open('status_window');
      store.open('item_list');
      store.open('skill_menu');
      store.closeAll();
      expect(store.stack).toEqual([]);
      expect(store.top).toBeNull();
    });
  });

  describe('スタック動作（stack パネル）', () => {
    it('stack パネルは重ねられる', () => {
      const store = useUIPanelStore();
      store.open('status_window');
      store.open('item_list');
      expect(store.stack.length).toBe(2);
      expect(store.top).toBe('item_list');
    });

    it('既に開いているパネルを再度 open すると最前面へ移動', () => {
      const store = useUIPanelStore();
      store.open('status_window');
      store.open('item_list');
      store.open('status_window');
      expect(store.top).toBe('status_window');
      expect(store.stack.length).toBe(2);
    });
  });

  describe('排他動作（exclusive パネル）', () => {
    it('exclusive パネルを開くと既存パネルが閉じる', () => {
      const store = useUIPanelStore();
      store.open('status_window');
      store.open('item_list');
      // action_menu は exclusive
      store.open('action_menu');
      expect(store.stack.length).toBe(1);
      expect(store.top).toBe('action_menu');
      expect(store.isOpen('status_window')).toBe(false);
      expect(store.isOpen('item_list')).toBe(false);
    });
  });

  describe('inputBlocked', () => {
    it('モーダルでないパネルでは inputBlocked は false', () => {
      const store = useUIPanelStore();
      store.open('action_menu'); // modal: false
      expect(store.inputBlocked).toBe(false);
    });

    it('モーダルパネルが開いていると inputBlocked は true', () => {
      const store = useUIPanelStore();
      store.open('item_list'); // modal: true
      expect(store.inputBlocked).toBe(true);
    });

    it('モーダルパネルを閉じると inputBlocked は false に戻る', () => {
      const store = useUIPanelStore();
      store.open('item_list');
      store.close('item_list');
      expect(store.inputBlocked).toBe(false);
    });

    it('複数パネルで1つでもモーダルなら inputBlocked は true', () => {
      const store = useUIPanelStore();
      store.open('status_window'); // modal: false
      store.open('skill_menu'); // modal: true
      expect(store.inputBlocked).toBe(true);
    });
  });

  describe('payload', () => {
    it('payload を保持・取得できる', () => {
      const store = useUIPanelStore();
      const payload = { item: { id: 'item-1' }, position: { x: 5, y: 3 } };
      store.open('item_pickup', payload);
      expect(store.getPayload('item_pickup')).toEqual(payload);
    });

    it('開いていないパネルの payload は null', () => {
      const store = useUIPanelStore();
      expect(store.getPayload('item_pickup')).toBeNull();
    });

    it('既存パネルを再度 open すると payload が更新される', () => {
      const store = useUIPanelStore();
      store.open('item_pickup', { item: 'old' });
      store.open('item_pickup', { item: 'new' });
      expect(store.getPayload('item_pickup')).toEqual({ item: 'new' });
    });
  });

  describe('toggle', () => {
    it('閉じているパネルを toggle すると開く', () => {
      const store = useUIPanelStore();
      store.toggle('status_window');
      expect(store.isOpen('status_window')).toBe(true);
    });

    it('開いているパネルを toggle すると閉じる', () => {
      const store = useUIPanelStore();
      store.open('status_window');
      store.toggle('status_window');
      expect(store.isOpen('status_window')).toBe(false);
    });
  });

  describe('拡張性の契約テスト', () => {
    it('新しい PanelId を追加しても既存パネルへ影響しない', () => {
      // このテストは PanelId 型の拡張が既存パネルへ影響しないことを確認する契約
      // 新しいパネルを追加する際は PanelId 型と PANEL_DEFINITIONS へ追加するだけでよい
      const store = useUIPanelStore();
      store.open('status_window');
      store.open('item_list');

      // 新しいパネル（例: 'settings'）を追加する場合、
      // 既存の status_window / item_list はそのまま残るべき
      // （exclusive でない限り）
      expect(store.isOpen('status_window')).toBe(true);
      expect(store.isOpen('item_list')).toBe(true);
    });
  });
});
