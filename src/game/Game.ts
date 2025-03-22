import { Engine } from '../engine/Engine';
import { RendererSystem } from '../engine/graphics/RendererSystem';
import { EntitySystem } from '../engine/entity/EntitySystem';
import { EventSystem } from '../engine/events/EventSystem';
import { TileMap } from '../engine/world/TileMap';
import { MapGenerator } from '../engine/world/MapGenerator';
import { Player } from '../engine/entity/Player';
import { Vector3, EventName, TileType } from '../engine/types';
import { useGameStore } from '../stores/gameStore';

/**
 * ゲームクラス - ゲームの主要な機能を統合
 */
export class Game {
  // エンジンのインスタンス
  private engine: Engine;

  // タイルマップ
  private tileMap: TileMap | null = null;

  // プレイヤーエンティティ
  private player: Player | null = null;

  // ゲームが初期化済みかどうか
  private initialized = false;

  // ゲームストア（Pinia）
  private gameStore = useGameStore();

  // UIコールバック
  private onGameOver: ((score: number) => void) | null = null;
  private onTileSelect: ((tileInfo: any) => void) | null = null;
  private onEnemySelect: ((enemy: any) => void) | null = null;
  private onCharacterSelect: ((character: any) => void) | null = null;

  /**
   * コンストラクタ
   */
  constructor() {
    this.engine = Engine.instance;
    console.log('Game instance created');
  }

  /**
   * ゲームを初期化
   * @param canvas 描画先のキャンバス要素
   */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (this.initialized) {
      console.warn('Game is already initialized');
      return;
    }

    console.log('Initializing game...');

    // システムを初期化
    await this.initializeSystems(canvas);

    // マップを生成
    await this.generateMap();

    // プレイヤーを作成
    await this.createPlayer();

    // 敵を配置
    await this.spawnEnemies();

    // アイテムを配置
    await this.spawnItems();

    // イベントリスナーを設定
    this.setupEventListeners();

    // エンジンを開始
    this.engine.start();

    this.initialized = true;
    console.log('Game initialization complete');
  }

  /**
   * システムを初期化
   * @param canvas 描画先のキャンバス要素
   */
  private async initializeSystems(canvas: HTMLCanvasElement): Promise<void> {
    console.log('Initializing systems...');

    // レンダリングシステム
    const rendererSystem = new RendererSystem(160, 120);
    rendererSystem.setCanvas(canvas);
    this.engine.registerSystem('renderer', rendererSystem);

    // エンティティシステム
    const entitySystem = new EntitySystem();
    this.engine.registerSystem('entity', entitySystem);

    // イベントシステム
    const eventSystem = new EventSystem();
    this.engine.registerSystem('event', eventSystem);

    // すべてのシステムを初期化
    await this.engine.initialize();

    console.log('Systems initialized');
  }

  /**
   * マップを生成
   */
  private async generateMap(): Promise<void> {
    console.log('Generating map...');

    // マップジェネレーターを使用
    const mapGenerator = new MapGenerator(50, 50, 4, 8);
    const mapData = mapGenerator.generateMap();

    // タイルマップを作成
    this.tileMap = new TileMap(50, 50);
    this.tileMap.importMapData(mapData);

    // WorldSystemを作成してエンジンに登録（タイルマップを使用）
    const worldSystem = new WorldSystem(this.tileMap);
    this.engine.registerSystem('world', worldSystem);

    console.log('Map generated');
  }

  /**
   * プレイヤーを作成
   */
  private async createPlayer(): Promise<void> {
    console.log('Creating player...');

    // 開始位置を見つける（ランダムな部屋の中央）
    const startPosition = this.findStartPosition();

    if (!startPosition) {
      throw new Error('Failed to find valid start position for player');
    }

    // ゲームストアのデータをリセット
    this.gameStore.player.status.hp = this.gameStore.player.status.maxHp;
    this.gameStore.player.status.energy = this.gameStore.player.status.maxEnergy;

    // プレイヤーエンティティを作成
    this.player = new Player('player', startPosition);
    await this.player.initialize();

    // エンティティシステムに登録
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (entitySystem) {
      entitySystem.registerEntity(this.player);
    }

    // カメラでプレイヤーを追跡
    const rendererSystem = this.engine.getSystem<RendererSystem>('renderer');
    if (rendererSystem) {
      const camera = rendererSystem.getCamera();
      this.player.setCameraTarget(camera);
    }

    console.log(
      `Player created at position: (${startPosition.x}, ${startPosition.y}, ${startPosition.z})`
    );
  }

  /**
   * 開始位置を見つける（ランダムな歩行可能マス）
   */
  private findStartPosition(): Vector3 | null {
    // WorldSystemがあればそれを使用
    const worldSystem = this.engine.getSystem<WorldSystem>('world');
    if (worldSystem) {
      return worldSystem.getRandomWalkableTile();
    }

    // WorldSystemがなければデフォルトの位置を返す
    return { x: 1, y: 1, z: 0 };
  }

  /**
   * 敵を配置
   */
  private async spawnEnemies(): Promise<void> {
    console.log('Spawning enemies...');

    // WorldSystemを使って敵を配置
    const worldSystem = this.engine.getSystem<WorldSystem>('world');
    if (!worldSystem) {
      console.warn('WorldSystem not found, skipping enemy spawning');
      return;
    }

    // 敵の数を決定（マップのサイズに基づく）
    const tileMap = worldSystem.getTileMap();
    const mapSize = tileMap.getSize();
    const enemyCount = Math.floor(Math.sqrt(mapSize.width * mapSize.height) / 3);

    // 敵を配置
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');

    for (let i = 0; i < enemyCount; i++) {
      // ランダムな歩行可能な位置を取得
      const position = worldSystem.getRandomWalkableTile();
      if (!position) continue;

      // プレイヤーの近くには配置しない
      if (this.player) {
        const playerPos = this.player.getPosition();
        const distance = Math.abs(position.x - playerPos.x) + Math.abs(position.y - playerPos.y);
        if (distance < 5) continue;
      }

      // 敵のタイプをランダムに決定
      const enemyType = Math.random() < 0.7 ? 'slime' : 'goblin';

      // 敵エンティティを作成
      const enemy = await this.createEnemy(enemyType, position);
      if (enemy && entitySystem) {
        entitySystem.registerEntity(enemy);
      }
    }

    console.log(`${enemyCount} enemies spawned`);
  }

  /**
   * 敵エンティティを作成
   * @param type 敵のタイプ
   * @param position 位置
   */
  private async createEnemy(type: string, position: Vector3): Promise<any> {
    // ここでは実際の敵クラスではなくプレースホルダーを返す
    // 実際の実装では、Enemy クラスのインスタンスを返す

    const enemy = {
      id: `enemy_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: 'enemy',
      position: { ...position },
    };

    return enemy;
  }

  /**
   * アイテムを配置
   */
  private async spawnItems(): Promise<void> {
    console.log('Spawning items...');

    // WorldSystemを使ってアイテムを配置
    const worldSystem = this.engine.getSystem<WorldSystem>('world');
    if (!worldSystem) {
      console.warn('WorldSystem not found, skipping item spawning');
      return;
    }

    // アイテムの数を決定
    const itemCount = Math.floor(Math.random() * 10) + 5;

    // アイテムを配置
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');

    for (let i = 0; i < itemCount; i++) {
      // ランダムな歩行可能な位置を取得
      const position = worldSystem.getRandomWalkableTile();
      if (!position) continue;

      // アイテムのタイプをランダムに決定
      const itemTypes = ['energy', 'health', 'key', 'weapon'];
      const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];

      // アイテムエンティティを作成
      const item = await this.createItem(itemType, position);
      if (item && entitySystem) {
        entitySystem.registerEntity(item);
      }
    }

    console.log(`${itemCount} items spawned`);
  }

  /**
   * アイテムエンティティを作成
   * @param type アイテムのタイプ
   * @param position 位置
   */
  private async createItem(type: string, position: Vector3): Promise<any> {
    // ここでは実際のアイテムクラスではなくプレースホルダーを返す
    // 実際の実装では、Item クラスのインスタンスを返す

    const item = {
      id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: 'item',
      itemType: type,
      position: { ...position },
    };

    return item;
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    const eventSystem = this.engine.getSystem<EventSystem>('event');
    if (!eventSystem) return;

    // ゲームオーバーイベント
    eventSystem.on(EventName.GAME_OVER, (data) => {
      if (this.onGameOver) {
        this.onGameOver(data.score || 0);
      }
    });

    // タイル選択イベント
    eventSystem.on('tile_selected', (data) => {
      if (this.onTileSelect) {
        this.onTileSelect(data);
      }
    });

    // 敵選択イベント
    eventSystem.on('enemy_selected', (data) => {
      if (this.onEnemySelect) {
        this.onEnemySelect(data.enemy);
      }
    });

    // キャラクター選択イベント
    eventSystem.on('character_selected', (data) => {
      if (this.onCharacterSelect) {
        this.onCharacterSelect(data.character);
      }
    });
  }

  /**
   * ゲームオーバーハンドラーを設定
   * @param callback ゲームオーバー時に呼び出されるコールバック
   */
  setOnGameOver(callback: (score: number) => void): void {
    this.onGameOver = callback;
  }

  /**
   * タイル選択ハンドラーを設定
   * @param callback タイル選択時に呼び出されるコールバック
   */
  setOnTileSelect(callback: (tileInfo: any) => void): void {
    this.onTileSelect = callback;
  }

  /**
   * 敵選択ハンドラーを設定
   * @param callback 敵選択時に呼び出されるコールバック
   */
  setOnEnemySelect(callback: (enemy: any) => void): void {
    this.onEnemySelect = callback;
  }

  /**
   * キャラクター選択ハンドラーを設定
   * @param callback キャラクター選択時に呼び出されるコールバック
   */
  setOnCharacterSelect(callback: (character: any) => void): void {
    this.onCharacterSelect = callback;
  }

  /**
   * プレイヤーを移動
   * @param direction 移動方向
   */
  movePlayer(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (!this.player) return;

    this.player.move(direction);
  }

  /**
   * プレイヤーが攻撃
   */
  async playerAttack(): Promise<void> {
    if (!this.player) return;

    await this.player.attack();

    // 敵がすべて倒されたかチェック
    if (this.isAllEnemiesDefeated()) {
      const eventSystem = this.engine.getSystem<EventSystem>('event');
      if (eventSystem) {
        eventSystem.emit('all_enemies_defeated', {});
      }
    }
  }

  /**
   * プレイヤーのターンを終了
   */
  endPlayerTurn(): void {
    // ターン管理システムがあれば、次のターンに進む
    const turnManager = this.engine.getSystem<any>('turn');
    if (turnManager) {
      turnManager.nextTurn();
    }
  }

  /**
   * すべての敵が倒されたかをチェック
   */
  isAllEnemiesDefeated(): boolean {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return false;

    // enemyタグを持つエンティティをチェック
    const enemies = entitySystem.getEntitiesByTag('enemy');
    return enemies.length === 0;
  }

  /**
   * プレイヤーのアイテムリストを取得
   */
  getPlayerItems(): any[] {
    return this.gameStore.player.items.map((item) => ({
      id: item,
      name: item.charAt(0).toUpperCase() + item.slice(1),
      description: `This is a ${item}.`,
    }));
  }

  /**
   * 画面サイズ変更時の処理
   * @param width 新しい幅
   * @param height 新しい高さ
   */
  resize(width: number, height: number): void {
    const rendererSystem = this.engine.getSystem<RendererSystem>('renderer');
    if (rendererSystem) {
      rendererSystem.resize(width, height);
    }
  }
}

/**
 * WorldSystemクラス - エンジンに登録するためのラッパー
 */
class WorldSystem implements System {
  private tileMap: TileMap;

  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
  }

  async initialize(engine: Engine): Promise<void> {
    // 初期化処理
  }

  update(deltaTime: number): void {
    // 更新処理
  }

  /**
   * 指定位置が通行可能かどうかをチェック
   */
  isWalkable(x: number, y: number, z = 0): boolean {
    return this.tileMap.isWalkable(x, y, z);
  }

  /**
   * タイルマップを取得
   */
  getTileMap(): TileMap {
    return this.tileMap;
  }

  /**
   * ランダムな通行可能なタイルを取得
   */
  getRandomWalkableTile(): Vector3 | null {
    const size = this.tileMap.getSize();
    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.floor(Math.random() * size.width);
      const y = Math.floor(Math.random() * size.height);
      const z = 0; // 基本的にはz=0のレイヤーを使用

      if (this.tileMap.isWalkable(x, y, z)) {
        return { x, y, z };
      }
    }

    return null;
  }
}

// Systemインターフェースを使うためのインポート
import { System } from '../engine/System';
// import { WorldSystem } from '../engine/world/WorldSystem';
