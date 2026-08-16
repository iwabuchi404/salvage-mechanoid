import { EventSystem } from '@/engine/events/EventSystem';
import { EventMap } from '@/engine/events/EventMap';

/**
 * BU-1 段階2: EventSystem の型付きシグネチャの動作確認
 *
 * EventMap に宣言済みのイベント名について:
 * - 正しいペイロードで emit / on できること
 * - 誤ったペイロードでコンパイルエラーになること（@ts-expect-error で検証）
 *
 * 未宣言のイベント名は Record<string, unknown> に流れること
 *
 * 単一シグネチャ + 条件型方式のため、ヘルパー関数なしで
 * 直接 events.emit / events.on を呼び出して型検査を検証する。
 */
describe('BU-1 段階2: EventSystem のジェネリック化', () => {
  let events: EventSystem;

  beforeEach(() => {
    events = new EventSystem();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    events.destroy();
    jest.restoreAllMocks();
  });

  // ===== 実行時テスト =====

  it('型付き emit / on で正しいペイロードを送受信できる', () => {
    const received: EventMap['entity_moved'][] = [];
    events.on('entity_moved', (data) => {
      received.push(data);
    });

    events.emit('entity_moved', {
      entityId: 'player',
      from: { x: 1, y: 2, z: 0 },
      to: { x: 2, y: 2, z: 0 },
      position: { x: 2, y: 2, z: 0 },
    });

    expect(received).toHaveLength(1);
    expect(received[0].entityId).toBe('player');
    expect(received[0].from.x).toBe(1);
    expect(received[0].to.x).toBe(2);
  });

  it('未宣言のイベント名は Record<string, unknown> で動作する', () => {
    const spy = jest.fn();
    events.on('undeclared_event_name', spy);
    events.emit('undeclared_event_name', { custom: 'data' });
    expect(spy).toHaveBeenCalledWith({ custom: 'data' });
  });

  it('off で型付きリスナーを削除できる', () => {
    const spy = jest.fn();
    events.on('health_changed', spy);
    events.emit('health_changed', {
      entityId: 'player',
      currentHp: 80,
      maxHp: 100,
      percentage: 80,
    });
    expect(spy).toHaveBeenCalledTimes(1);

    events.off('health_changed', spy);
    events.emit('health_changed', {
      entityId: 'player',
      currentHp: 70,
      maxHp: 100,
      percentage: 70,
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  // ===== コンパイル時テスト（@ts-expect-error で検証） =====
  // 単一シグネチャ方式のため、直接 events.emit / events.on を呼んで
  // 型エラーが発生することを検証する。

  it('誤ったペイロードで emit するとコンパイルエラーになる（型テスト）', () => {
    events.emit('entity_moved', {
      // @ts-expect-error: entityId は string だが number を渡す
      entityId: 123,
      from: { x: 1, y: 2, z: 0 },
      to: { x: 2, y: 2, z: 0 },
      position: { x: 2, y: 2, z: 0 },
    });

    // @ts-expect-error: 必須フィールド from が欠落
    events.emit('entity_moved', {
      entityId: 'player',
      to: { x: 2, y: 2, z: 0 },
      position: { x: 2, y: 2, z: 0 },
    });

    // @ts-expect-error: health_changed に percentage が無い
    events.emit('health_changed', { entityId: 'player', currentHp: 80, maxHp: 100 });

    // この行が実行されることで、上記の @ts-expect-error がすべて
    // 正しくコンパイルエラーを引き起こしたことを確認
    expect(true).toBe(true);
  });

  it('誤ったペイロードで on するとコンパイルエラーになる（型テスト）', () => {
    // @ts-expect-error: callback の data 型が EventMap['entity_moved'] と不一致
    events.on('entity_moved', (data: string) => data.length);

    expect(true).toBe(true);
  });

  it('ペイロードを省略して emit するとコンパイルエラーになる（型テスト）', () => {
    // @ts-expect-error: data は必須（Record<string, never> でも {} を渡す必要がある）
    events.emit('all_enemies_defeated');

    expect(true).toBe(true);
  });
});
