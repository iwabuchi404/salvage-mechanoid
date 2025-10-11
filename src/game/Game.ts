import { Engine } from '../engine/Engine';
import { RendererSystem } from '../engine/graphics/RendererSystem';
import { EntitySystem } from '../engine/entity/EntitySystem';
import { EventSystem } from '../engine/events/EventSystem';
import { TileMap } from '../engine/world/TileMap';
import { FlexibleMapGenerator } from '../engine/world/FlexibleMapGenerator';
import { ResourceGenerationSystem } from '../engine/world/ResourceGenerationSystem';
import { Player } from '../engine/entity/Player';
import { Obstacle } from '../engine/entity/Obstacle';
import { Item } from '../engine/entity/Item';
import { Enemy } from '../engine/entity/Enemy';
import {
  Vector3,
  EventName,
  TileType,
  StageType,
  PlacedObstacle,
  PlacedItem,
  PlacedEnemy,
  Room,
  Corridor,
  TacticalElement,
} from '../engine/types';
import { useGameStore } from '../stores/gameStore';
import { WorldSystem } from '../engine/world/WorldSystem';

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

  // リソース生成システム
  private resourceSystem: ResourceGenerationSystem | null = null;

  // 生成されたリソースを保存
  private placedObstacles: PlacedObstacle[] = [];
  private placedItems: PlacedItem[] = [];
  private placedEnemies: PlacedEnemy[] = [];

  // マップ生成情報を保存
  private currentRooms: Room[] = [];
  private currentCorridors: Corridor[] = [];
  private currentTacticalElements: TacticalElement[] = [];

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

    // リソース（障害物・アイテム・敵）を生成
    await this.generateResources();

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
   * @param stageType ステージタイプ（オプション、デフォルトはTACTICAL_COMBAT）
   */
  private async generateMap(stageType: StageType = StageType.TACTICAL_COMBAT): Promise<void> {
    console.log(`Generating map with stage type: ${stageType}...`);

    // 新しいFlexibleMapGeneratorを使用
    const mapGenerator = new FlexibleMapGenerator(50, 50);

    // ステージタイプに応じてマップ生成
    if (stageType === StageType.CLASSIC) {
      // クラシックモード：従来の方式
      const mapData = await mapGenerator.generateMap(4, 8, stageType);

      // タイルマップを作成
      this.tileMap = new TileMap(50, 50);
      this.tileMap.importMapData(mapData.map);

      console.log('Map generated with Classic mode');
      console.log(`Generated ${mapData.rooms.length} rooms`);
    } else {
      // 戦術的モード：新しい戦術的システム
      const tacticalData = await mapGenerator.generateTacticalMap(stageType, {
        minRoomSize: 4,
        maxRoomSize: 8,
        energyTightness: 'balanced',
        playerLevel: 1,
      });

      // タイルマップを作成
      this.tileMap = new TileMap(50, 50);
      this.tileMap.importMapData(tacticalData.map);

      // マップ生成情報を保存
      this.currentRooms = tacticalData.rooms;
      this.currentCorridors = tacticalData.corridors;
      this.currentTacticalElements = tacticalData.tacticalElements;

      // 戦術的要素の情報を表示
      console.log(`Map generated with Tactical mode: ${stageType}`);
      console.log(`Generated ${tacticalData.rooms.length} rooms`);
      console.log(`Energy points: ${tacticalData.energyPoints.length}`);
      console.log(`Tactical elements: ${tacticalData.tacticalElements.length}`);
      console.log(`Terrain effects: ${tacticalData.terrainEffects.size}`);
      console.log(
        `Estimated energy consumption: ${tacticalData.tacticalMetadata.estimatedEnergyConsumption}`
      );
      console.log(
        `Available energy recovery: ${tacticalData.tacticalMetadata.availableEnergyRecovery}`
      );
      console.log(`Difficulty rating: ${tacticalData.tacticalMetadata.difficultyRating}`);

      // 戦術的データをゲームストアに保存（将来の拡張用）
      // TODO: ゲームストアに戦術的データ保存機能を追加
      console.log('Tactical data ready for game store integration:', {
        energyPointsCount: tacticalData.energyPoints.length,
        tacticalElementsCount: tacticalData.tacticalElements.length,
        terrainEffectsCount: tacticalData.terrainEffects.size,
      });
    }

    // WorldSystemを作成してエンジンに登録（タイルマップを使用）
    const worldSystem = new WorldSystem(this.tileMap);
    this.engine.registerSystem('world', worldSystem);
  }

  /**
   * 異なるステージタイプでマップを生成（公開メソッド）
   * @param stageType 生成するステージタイプ
   */
  async generateMapWithStageType(stageType: StageType): Promise<void> {
    // 既存のマップをクリア
    if (this.tileMap) {
      // WorldSystemを削除（removeSystemメソッドがない場合はスキップ）
      try {
        // this.engine.removeSystem('world'); // TODO: Engine.removeSystemメソッドの実装が必要
        console.log('Clearing existing world system');
      } catch (error) {
        console.warn('Could not remove world system:', error);
      }
      this.tileMap = null;
    }

    // 新しいマップを生成
    await this.generateMap(stageType);

    // プレイヤー位置をリセット
    if (this.player) {
      const startPosition = this.findStartPosition();
      if (startPosition) {
        // プレイヤーの位置更新（setPositionメソッドがない場合は直接設定）
        try {
          // this.player.position = startPosition; // TODO: Player.positionプロパティの実装が必要
          console.log('Player position should be reset to:', startPosition);
        } catch (error) {
          console.warn('Could not reset player position:', error);
        }
      }
    }
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
   * リソース（障害物・アイテム・敵）を生成
   */
  private async generateResources(): Promise<void> {
    console.log('Generating resources...');

    if (!this.tileMap) {
      console.warn('TileMap not found, skipping resource generation');
      return;
    }

    // WorldSystemから必要な情報を取得
    const worldSystem = this.engine.getSystem<WorldSystem>('world');
    if (!worldSystem) {
      console.warn('WorldSystem not found, skipping resource generation');
      return;
    }

    const tileMap = worldSystem.getTileMap();

    // マップデータを取得
    const mapSize = tileMap.getSize();
    const map: number[][] = [];
    for (let y = 0; y < mapSize.height; y++) {
      map[y] = [];
      for (let x = 0; x < mapSize.width; x++) {
        const tile = tileMap.getTile(x, y, 0);
        map[y][x] = tile ? tile.type : 0;
      }
    }

    // 保存されている部屋と通路の情報を使用
    const rooms = this.currentRooms;
    const corridors = this.currentCorridors;
    const tacticalElements = this.currentTacticalElements;

    // リソース生成システムを初期化
    this.resourceSystem = new ResourceGenerationSystem(mapSize.width, mapSize.height);

    // プレイヤーレベルと難易度を取得
    const playerLevel = this.gameStore.player.status.level || 1;
    const currentFloor = worldSystem.getCurrentFloor();

    // リソースを生成
    const resources = this.resourceSystem.generateResources(
      map,
      rooms,
      corridors,
      tacticalElements,
      {
        playerLevel: playerLevel,
        difficulty: currentFloor,
      }
    );

    // 生成されたリソースを保存
    this.placedObstacles = resources.obstacles;
    this.placedItems = resources.items;
    this.placedEnemies = resources.enemies;

    console.log(
      `Resources generated: ${resources.obstacles.length} obstacles, ${resources.items.length} items, ${resources.enemies.length} enemies`
    );

    // エンティティシステムに登録
    await this.registerResourceEntities(resources.obstacles, resources.items, resources.enemies);
  }

  /**
   * リソースエンティティをEntitySystemに登録
   */
  private async registerResourceEntities(
    obstacles: PlacedObstacle[],
    items: PlacedItem[],
    enemies: PlacedEnemy[]
  ): Promise<void> {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) {
      console.warn('EntitySystem not found, skipping entity registration');
      return;
    }

    console.log('Registering resource entities...');

    // 障害物を登録
    for (const obstacleData of obstacles) {
      const obstacle = new Obstacle(obstacleData);
      await obstacle.initialize();
      entitySystem.registerEntity(obstacle);
    }
    console.log(`Registered ${obstacles.length} obstacles`);

    // アイテムを登録
    for (const itemData of items) {
      const item = new Item(itemData);
      await item.initialize();
      entitySystem.registerEntity(item);
    }
    console.log(`Registered ${items.length} items`);

    // 敵を登録
    for (const enemyData of enemies) {
      const enemy = new Enemy(enemyData);
      await enemy.initialize();
      entitySystem.registerEntity(enemy);
    }
    console.log(`Registered ${enemies.length} enemies`);

    console.log('All resource entities registered successfully');
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

// Systemインターフェースを使うためのインポート
import { System } from '../engine/System';
