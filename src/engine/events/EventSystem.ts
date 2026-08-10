import { System } from '../System';
import { Engine } from '../Engine';

/**
 * イベントシステム - 観察者パターンを実装
 * コンポーネント間の疎結合通信を可能にする
 */
export class EventSystem implements System {
  // イベント名とリスナーのマップ
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  // バッファに格納された遅延イベント
  private eventBuffer: Array<{ name: string; data: any }> = [];

  // イベントバッファリングの有効・無効
  private bufferingEnabled = false;

  /**
   * システムの初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    console.log('EventSystem initialized');
    // 必要な初期化処理があればここに追加
  }

  /**
   * 各フレームでシステムを更新
   * バッファに格納されたイベントを処理する
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // バッファに格納されたイベントを処理
    if (this.bufferingEnabled && this.eventBuffer.length > 0) {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      for (const event of events) {
        this.processEvent(event.name, event.data);
      }
    }
  }

  /**
   * イベントリスナーを登録する
   * @param eventName 監視するイベントの名前
   * @param callback イベント発生時に呼び出されるコールバック関数
   */
  on(eventName: string, callback: (data: any) => void): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback);
  }

  /**
   * イベントリスナーを削除する
   * @param eventName 監視を解除するイベントの名前
   * @param callback 削除するコールバック関数
   */
  off(eventName: string, callback: (data: any) => void): void {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName)!.delete(callback);

      // リスナーが空になった場合はマップからエントリを削除
      if (this.listeners.get(eventName)!.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  /**
   * イベントを発行する
   * @param eventName 発行するイベントの名前
   * @param data イベントに付随するデータ
   */
  emit(eventName: string, data: any = {}): void {
    // バッファリングが有効な場合はイベントをバッファに追加
    if (this.bufferingEnabled) {
      this.eventBuffer.push({ name: eventName, data });
      return;
    }

    // 即時にイベントを処理
    this.processEvent(eventName, data);
  }

  /**
   * イベントを処理する内部メソッド
   * @param eventName 処理するイベントの名前
   * @param data イベントに付随するデータ
   */
  private processEvent(eventName: string, data: any): void {
    if (this.listeners.has(eventName)) {
      for (const callback of this.listeners.get(eventName)!) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${eventName}":`, error);
        }
      }
    }
  }

  /**
   * イベントバッファリングを有効または無効にする
   * バッファリングを有効にすると、イベントは即時処理されず、次の更新サイクルまでバッファに格納される
   * @param enabled バッファリングを有効にするかどうか
   */
  setBuffering(enabled: boolean): void {
    this.bufferingEnabled = enabled;

    // バッファリングを無効にする場合、バッファに格納されたイベントを即時処理
    if (!enabled && this.eventBuffer.length > 0) {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      for (const event of events) {
        this.processEvent(event.name, event.data);
      }
    }
  }

  /**
   * 特定のイベントのリスナー数を取得する
   * @param eventName イベント名
   * @returns リスナーの数
   */
  getListenerCount(eventName: string): number {
    return this.listeners.has(eventName) ? this.listeners.get(eventName)!.size : 0;
  }

  /**
   * 登録済みリスナーと未配送イベントを破棄する
   */
  destroy(): void {
    this.listeners.clear();
    this.eventBuffer = [];
    this.bufferingEnabled = false;
  }
}
