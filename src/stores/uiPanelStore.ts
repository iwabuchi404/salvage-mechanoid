/**
 * BU-4 段階4: パネル管理機構
 *
 * 設計 docs/design/UI_BOUNDARY_DESIGN.md §4.3
 *
 * パネルをスタックで管理し、重なり順・排他制御・入力ブロックを表現する。
 * - modal: 下位パネルとゲーム入力をブロック
 * - stacking: 'stack' は重ねる、'exclusive' は他を閉じる
 *
 * inputBlocked は InputSystem と操作ボタンが参照する。
 */
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

/** パネルの識別子 */
export type PanelId =
  | 'action_menu'
  | 'item_list'
  | 'status_window'
  | 'skill_menu'
  | 'inventory'
  | 'item_pickup';

/** パネルの性質定義 */
export interface PanelDefinition {
  readonly id: PanelId;
  /** モーダルなら、下位パネルとゲーム入力をブロックする */
  readonly modal: boolean;
  /** 同時に開けるパネルの制限（'stack' は重ねる、'exclusive' は他を閉じる） */
  readonly stacking: 'stack' | 'exclusive';
}

/** パネルの定義テーブル */
const PANEL_DEFINITIONS: Readonly<Record<PanelId, PanelDefinition>> = Object.freeze({
  action_menu: { id: 'action_menu', modal: false, stacking: 'exclusive' },
  item_list: { id: 'item_list', modal: true, stacking: 'stack' },
  status_window: { id: 'status_window', modal: false, stacking: 'stack' },
  skill_menu: { id: 'skill_menu', modal: true, stacking: 'stack' },
  inventory: { id: 'inventory', modal: true, stacking: 'stack' },
  item_pickup: { id: 'item_pickup', modal: true, stacking: 'stack' },
});

/** スタック内のパネルエントリ */
interface PanelEntry {
  readonly id: PanelId;
  readonly payload: unknown;
}

export const useUIPanelStore = defineStore('uiPanel', () => {
  /** パネルのスタック（末尾が最前面） */
  const stack = ref<PanelEntry[]>([]);

  /** 最前面のパネル */
  const top = computed<PanelId | null>(() => {
    const last = stack.value[stack.value.length - 1];
    return last ? last.id : null;
  });

  /** ゲーム入力をブロックすべきか（モーダルパネルが開いているか） */
  const inputBlocked = computed<boolean>(() => {
    return stack.value.some((entry) => PANEL_DEFINITIONS[entry.id].modal);
  });

  /** 指定パネルが開いているか */
  function isOpen(id: PanelId): boolean {
    return stack.value.some((entry) => entry.id === id);
  }

  /** 指定パネルの payload を取得 */
  function getPayload<T = unknown>(id: PanelId): T | null {
    const entry = stack.value.find((e) => e.id === id);
    return entry ? (entry.payload as T) : null;
  }

  /** パネルを開く */
  function open(id: PanelId, payload: unknown = null): void {
    const def = PANEL_DEFINITIONS[id];

    // 既に開いている場合は payload を更新して最前面へ
    const existingIndex = stack.value.findIndex((entry) => entry.id === id);
    if (existingIndex >= 0) {
      stack.value = stack.value.filter((entry) => entry.id !== id);
      stack.value.push({ id, payload });
      return;
    }

    // exclusive の場合は既存パネルをすべて閉じる
    if (def.stacking === 'exclusive') {
      stack.value = [{ id, payload }];
      return;
    }

    // stack の場合は上に重ねる
    stack.value.push({ id, payload });
  }

  /** 指定パネルを閉じる */
  function close(id: PanelId): void {
    stack.value = stack.value.filter((entry) => entry.id !== id);
  }

  /** 最前面のパネルを閉じる */
  function closeTop(): void {
    if (stack.value.length === 0) return;
    stack.value = stack.value.slice(0, -1);
  }

  /** すべてのパネルを閉じる */
  function closeAll(): void {
    stack.value = [];
  }

  /** 指定パネルの開閉をトグル */
  function toggle(id: PanelId, payload: unknown = null): void {
    if (isOpen(id)) {
      close(id);
    } else {
      open(id, payload);
    }
  }

  return {
    stack,
    top,
    inputBlocked,
    isOpen,
    getPayload,
    open,
    close,
    closeTop,
    closeAll,
    toggle,
  };
});
