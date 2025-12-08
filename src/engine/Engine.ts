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
  private constructor() {
    console.log('Engine created');
  }

  /**
   * システムをエンジンに登録する
   * @param name システムの一意の識別子
   * @param system 登録するシステムのインスタンス
   */
  registerSystem(name: string, system: System): void {
    if (this.systems.has(name)) {
      console.warn(`System with name "${name}" already registered, overwriting`);
    }
    this.systems.set(name, system);
    console.log(`System "${name}" registered`);
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
    console.log('Initializing engine...');

    // すべてのシステムを非同期的に初期化
    for (const [name, system] of this.systems.entries()) {
      console.log(`Initializing system "${name}"...`);
      await system.initialize(this);
    }

    console.log('Engine initialization complete');
  }

  /**
   * エンジンのメインループを開始する
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Engine is already running');
      return;
    }

    console.log('Starting engine...');
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

    console.log('Stopping engine...');
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
   * エンジンの状態をリセットする
   * 主にテスト用または状態のリセットが必要な場合に使用
   */
  reset(): void {
    console.log('Resetting engine...');
    this.stop();
    this.systems.clear();
  }
}
