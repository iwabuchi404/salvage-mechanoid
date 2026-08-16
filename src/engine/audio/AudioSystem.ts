import { System } from '../System';
import { Engine } from '../Engine';
import { SoundManager } from '../../common/SoundManager';
import { EventSystem } from '../events/EventSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { isPlayerEntityId } from '../entity/EntityKind';

/**
 * オーディオシステム - 旧SoundManagerをECSに統合
 * BGM・SEの再生を管理し、ゲームイベントに応じて自動的にサウンドを再生
 */
export class AudioSystem implements System {
  // SoundManagerのインスタンス（Singleton）
  private soundManager: SoundManager;

  // エンジンへの参照
  private engine: Engine | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  /**
   * コンストラクタ
   */
  constructor() {
    // 既存のSoundManagerをそのまま使用
    this.soundManager = SoundManager.getInstance();
  }

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;

    // サウンドファイルを読み込み
    this.soundManager.loadSounds();

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('AudioSystem initialized');
  }

  /**
   * 毎フレームの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // サウンドシステムは特に更新処理が不要
    // 必要に応じてフェードイン/アウトなどを実装可能
  }

  /**
   * イベントリスナーを設定
   * ゲーム内のイベントに応じて自動的にサウンドを再生
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) {
      console.warn('EventSystem not found, audio events will not be processed');
      return;
    }

    // プレイヤー攻撃時のSE（attack_performed に統一）
    // attack_performed は敵の攻撃時にも発行されるため、isPlayerEntityId でフィルタする
    this.eventSystem.on('attack_performed', (data) => {
      const entitySystem = this.engine?.getSystem<EntitySystem>('entity') || null;
      if (isPlayerEntityId(data.entityId, entitySystem)) {
        this.playSE('attack');
      }
    });

    // 敵撃破時のSE
    this.eventSystem.on('enemy_destroyed', () => {
      this.playSE('explosion');
    });

    // ダメージを受けた時のSE（オプション）
    this.eventSystem.on('damage_taken', (data) => {
      // 必要に応じてダメージSEを追加
      // this.playSE('damage');
    });

    // ゲームクリア時のBGM変更（オプション）
    this.eventSystem.on('all_enemies_defeated', () => {
      // this.playBGM('bgm_victory');
    });

    // ゲームオーバー時のBGM停止（オプション）
    this.eventSystem.on('game_over', () => {
      this.stopBGM();
    });

    console.log('AudioSystem event listeners registered');
  }

  /**
   * BGMを再生
   * @param key サウンドキー（'bgm01', 'bgm02', 'bgm03'）
   */
  playBGM(key: string): void {
    this.soundManager.playBGM(key);
    console.log(`Playing BGM: ${key}`);
  }

  /**
   * BGMを停止
   */
  stopBGM(): void {
    this.soundManager.stopBGM();
    console.log('BGM stopped');
  }

  /**
   * SEを再生
   * @param key サウンドキー（'attack', 'explosion'など）
   */
  playSE(key: string): void {
    this.soundManager.playSE(key);
    console.log(`Playing SE: ${key}`);
  }

  /**
   * ボリュームを設定
   * @param volume ボリューム（0.0 〜 1.0）
   */
  setVolume(volume: number): void {
    this.soundManager.setVolume(volume);
    console.log(`Volume set to: ${volume}`);
  }

  /**
   * ミュート
   */
  mute(): void {
    this.soundManager.mute();
    console.log('Audio muted');
  }

  /**
   * ミュート解除
   */
  unmute(): void {
    this.soundManager.unmute();
    console.log('Audio unmuted');
  }

  /**
   * SoundManagerのインスタンスを取得（外部からのアクセス用）
   * @returns SoundManagerのインスタンス
   */
  getSoundManager(): SoundManager {
    return this.soundManager;
  }
}
