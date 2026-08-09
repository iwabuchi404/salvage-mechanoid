import { System } from '../System';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { Player } from '../entity/Player';
import { Direction } from '../types';

/**
 * 入力システム - キーボード/マウス入力を管理
 * プレイヤーの操作をイベントに変換する
 */
export class InputSystem implements System {
  // エンジンへの参照
  private engine: Engine | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  // エンティティシステムへの参照
  private entitySystem: EntitySystem | null = null;

  // キーの押下状態
  private keysPressed: Set<string> = new Set();

  // 入力が有効かどうか
  private inputEnabled = true;

  // 入力待機中フラグ
  private waitingForInput = false;

  // キャンバス要素
  private canvas: HTMLCanvasElement | null = null;

  // 登録したリスナーの参照（destroy 時に解除するため保持）
  private keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private keyupListener: ((event: KeyboardEvent) => void) | null = null;
  private clickListener: ((event: MouseEvent) => void) | null = null;
  private mousemoveListener: ((event: MouseEvent) => void) | null = null;

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;

    // キーボードイベントリスナーを設定
    this.setupKeyboardListeners();

    // イベントリスナーを設定
    this.setupEventListeners();
  }

  /**
   * キャンバス要素を設定してマウスイベントを登録
   * @param canvas キャンバス要素
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.setupMouseListeners();
  }

  /**
   * 毎フレームの更新処理
   * @param _deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(_deltaTime: number): void {
    // 入力システムは基本的にイベント駆動
  }

  /**
   * キーボードイベントリスナーを設定
   */
  private setupKeyboardListeners(): void {
    // キーダウンイベント
    this.keydownListener = (event: KeyboardEvent) => {
      if (!this.inputEnabled) return;

      const key = event.key.toLowerCase();
      this.keysPressed.add(key);

      // プレイヤーターン中のみ入力を受け付ける
      if (!this.waitingForInput) return;

      this.handleKeyPress(key, event);
    };
    window.addEventListener('keydown', this.keydownListener);

    // キーアップイベント
    this.keyupListener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      this.keysPressed.delete(key);
    };
    window.addEventListener('keyup', this.keyupListener);
  }

  /**
   * マウスイベントリスナーを設定
   */
  private setupMouseListeners(): void {
    if (!this.canvas) return;

    // クリックイベント
    this.clickListener = (event: MouseEvent) => {
      if (!this.inputEnabled) return;

      this.handleMouseClick(event);
    };
    this.canvas.addEventListener('click', this.clickListener);

    // ホバーイベント
    this.mousemoveListener = (event: MouseEvent) => {
      if (!this.inputEnabled) return;

      this.handleMouseMove(event);
    };
    this.canvas.addEventListener('mousemove', this.mousemoveListener);
  }

  /**
   * システムを破棄（登録したリスナーをすべて解除）
   */
  destroy(): void {
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.keyupListener) {
      window.removeEventListener('keyup', this.keyupListener);
      this.keyupListener = null;
    }
    if (this.clickListener && this.canvas) {
      this.canvas.removeEventListener('click', this.clickListener);
      this.clickListener = null;
    }
    if (this.mousemoveListener && this.canvas) {
      this.canvas.removeEventListener('mousemove', this.mousemoveListener);
      this.mousemoveListener = null;
    }
    this.canvas = null;
    this.engine = null;
    this.eventSystem = null;
    this.entitySystem = null;
  }

  /**
   * マウスクリックを処理
   * @param event マウスイベント
   */
  private handleMouseClick(event: MouseEvent): void {
    if (!this.canvas) return;

    // キャンバス相対座標を取得
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // スクリーン座標でのクリックイベントを発行
    // InteractionSystemで座標変換とエンティティ/タイル検索を行う
    this.eventSystem?.emit('screen_clicked', {
      screenX: x,
      screenY: y,
    });

    console.log(`Screen clicked at: (${x}, ${y})`);
  }

  /**
   * マウス移動を処理
   * @param event マウスイベント
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.canvas) return;

    // マウスがボタンやUIエレメント上にある場合はスキップ
    const target = event.target as HTMLElement;
    if (target && target !== this.canvas) {
      // ハイライトを非表示にするイベントを発行
      this.eventSystem?.emit('screen_hovered', {
        screenX: -1,
        screenY: -1,
      });
      return;
    }

    // キャンバス相対座標を取得
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // キャンバス外の場合もスキップ
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      this.eventSystem?.emit('screen_hovered', {
        screenX: -1,
        screenY: -1,
      });
      return;
    }

    // スクリーン座標でのホバーイベントを発行
    // InteractionSystemで座標変換とタイル検索を行う
    this.eventSystem?.emit('screen_hovered', {
      screenX: x,
      screenY: y,
    });
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) {
      return;
    }

    // プレイヤーターン開始時に入力を有効化
    this.eventSystem.on('player_turn_started', () => {
      this.waitingForInput = true;
    });

    // プレイヤーターン終了時に入力を無効化
    this.eventSystem.on('player_turn_ended', () => {
      this.waitingForInput = false;
    });

    // 敵ターン開始時に入力を無効化
    this.eventSystem.on('enemy_turn_started', () => {
      this.waitingForInput = false;
    });
  }

  /**
   * キー押下を処理
   * @param key 押されたキー
   * @param event キーボードイベント
   */
  private handleKeyPress(key: string, event: KeyboardEvent): void {
    const player = this.getPlayer();
    if (!player) {
      return;
    }

    // デフォルトの動作を防ぐ（スクロールなど）
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'enter'].includes(key)) {
      event.preventDefault();
    }

    // 移動キー
    if (key === 'arrowup' || key === 'w') {
      this.requestPlayerMove(player, 'up');
    } else if (key === 'arrowdown' || key === 's') {
      this.requestPlayerMove(player, 'down');
    } else if (key === 'arrowleft' || key === 'a') {
      this.requestPlayerMove(player, 'left');
    } else if (key === 'arrowright' || key === 'd') {
      this.requestPlayerMove(player, 'right');
    }
    // 攻撃キー
    else if (key === ' ' || key === 'enter') {
      this.requestPlayerAttack(player);
    }
    // スキップキー
    else if (key === 'shift') {
      this.requestPlayerSkip(player);
    }
  }

  /**
   * プレイヤーを取得
   * @returns プレイヤーエンティティ
   */
  private getPlayer(): Player | null {
    const players = this.entitySystem?.getEntitiesByTag('player') || [];
    return (players[0] as Player) || null;
  }

  /**
   * プレイヤーの移動をリクエスト
   * @param player プレイヤー
   * @param direction 移動方向
   */
  private requestPlayerMove(player: Player, direction: Direction): void {
    // プレイヤーの移動メソッドを呼び出す
    player.move(direction);

    // 入力を一時的に無効化（移動完了まで）
    this.waitingForInput = false;
  }

  /**
   * プレイヤーの攻撃をリクエスト
   * @param player プレイヤー
   */
  private requestPlayerAttack(player: Player): void {
    // プレイヤーの攻撃メソッドを呼び出す
    player.attack();

    // 入力を一時的に無効化（攻撃完了まで）
    this.waitingForInput = false;
  }

  /**
   * プレイヤーのスキップをリクエスト
   * @param _player プレイヤー
   */
  private requestPlayerSkip(_player: Player): void {
    // ターン終了イベントを発行
    this.eventSystem?.emit('player_turn_ended', {});

    // 入力を一時的に無効化
    this.waitingForInput = false;
  }

  /**
   * 入力を有効化
   */
  enableInput(): void {
    this.inputEnabled = true;
  }

  /**
   * 入力を無効化
   */
  disableInput(): void {
    this.inputEnabled = false;
    this.waitingForInput = false;
  }

  /**
   * キーが押されているかチェック
   * @param key キー
   * @returns 押されていればtrue
   */
  isKeyPressed(key: string): boolean {
    return this.keysPressed.has(key.toLowerCase());
  }

  /**
   * 入力が有効かチェック
   * @returns 有効ならtrue
   */
  isInputEnabled(): boolean {
    return this.inputEnabled && this.waitingForInput;
  }
}
