import { System } from './System';

/**
 * ゲームエンジンのコアクラス
 * シングルトンパターンを使用し、全システムを管理する中央ハブとして機能する
 */
export class Engine {
  // シングルトンインスタンス
  private static _instance: Engine | null = null;

  // システムのマップ - 名前とシステムのインスタンスを関連付ける
  private systems: Map<string, System> = new Map();

  // エンジンが実行中かどうかのフラグ
  private isRunning = false;

  // 前回のフレーム時間（ミリ秒）
  private lastTime = 0;

  /**
   * シングルトンインスタンスを取得する
   */
  static get instance(): Engine {
    if (!Engine._instance) {
      Engine._instance = new Engine();
    }
    return Engine._instance;
  }

  /**
   * private コンストラクタ - シングルトンパターンの一部
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /**
   * システムをエンジンに登録する
   * 同名のシステムが既に登録されている場合は、旧システムの destroy() を呼んでから上書きする
   * @param name システムの一意の識別子
   * @param system 登録するシステムのインスタンス
   */
  registerSystem(name: string, system: System): void {
    const existing = this.systems.get(name);
    if (existing) {
      console.warn(`System with name "${name}" already registered, destroying old instance`);
      try {
        existing.destroy?.();
      } catch (error) {
        console.error(`Error destroying old system "${name}":`, error);
      }
    }
    this.systems.set(name, system);
  }

  /**
   * 指定した名前のシステムを取得する
   * @param name 取得するシステムの名前
   * @returns 指定した名前のシステム、または undefined
   */
  getSystem<T extends System>(name: string): T | undefined {
    return this.systems.get(name) as T;
  }

  /**
   * エンジンのすべてのシステムを初期化する
   */
  async initialize(): Promise<void> {
    for (const [, system] of this.systems.entries()) {
      await system.initialize(this);
    }
  }

  /**
   * エンジンのメインループを開始する
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Engine is already running');
      return;
    }

    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  /**
   * エンジンを停止する
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Engine is not running');
      return;
    }

    this.isRunning = false;
  }

  /**
   * メインゲームループ - 各フレームで実行される
   * @param timestamp 現在のタイムスタンプ（requestAnimationFrameから提供）
   */
  private gameLoop(timestamp: number): void {
    if (!this.isRunning) return;

    // デルタタイム（前回のフレームからの経過時間）を計算
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // レンダリングシステムを最後に更新するために一時的に保持
    const rendererSystem = this.systems.get('renderer');

    // まずレンダリング以外のシステムを更新
    for (const [name, system] of this.systems.entries()) {
      if (name === 'renderer') continue;
      try {
        system.update(deltaTime);
      } catch (error) {
        console.error(`Error updating system "${name}":`, error);
      }
    }

    // 最後にレンダリングシステムを更新
    if (rendererSystem) {
      try {
        rendererSystem.update(deltaTime);
      } catch (error) {
        console.error('Error updating system "renderer":', error);
      }
    }

    // 次のフレームをスケジュール
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  /**
   * システムをエンジンから削除する
   * @param name 削除するシステムの名前
   */
  removeSystem(name: string): void {
    const system = this.systems.get(name);
    if (!system) {
      console.warn(`System "${name}" not found, cannot remove`);
      return;
    }
    system.destroy?.();
    this.systems.delete(name);
  }

  /**
   * エンジンの状態をリセットする
   * 全システムのdestroy()を呼び出してからクリアする
   */
  reset(): void {
    this.stop();
    for (const [, system] of this.systems) {
      system.destroy?.();
    }
    this.systems.clear();
  }
}
