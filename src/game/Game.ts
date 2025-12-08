import { Engine } from '../engine/Engine';
import { RendererSystem } from '../engine/graphics/RendererSystem';
import { EntitySystem } from '../engine/entity/EntitySystem';
import { EventSystem } from '../engine/events/EventSystem';
import { AudioSystem } from '../engine/audio/AudioSystem';
import { TurnSystem } from '../engine/turn/TurnSystem';
import { EffectSystem } from '../engine/effects/EffectSystem';
import { CombatSystem } from '../engine/combat/CombatSystem';
import { InteractionSystem } from '../engine/interaction/InteractionSystem';
import { InputSystem } from '../engine/input/InputSystem';
import { TileMap } from '../engine/world/TileMap';
import { MapGeneratorFacade } from '../engine/world/MapGeneratorFacade';
import { ResourceGenerationSystem } from '../engine/world/ResourceGenerationSystem';
import { FloorManager } from '../engine/world/FloorManager';
import { Player } from '../engine/entity/Player';
import { Obstacle } from '../engine/entity/Obstacle';
import { Item } from '../engine/entity/Item';
import { Enemy } from '../engine/entity/Enemy';
import { createPortal, createEnergyCharger } from '../engine/entity/EventObjectEntity';
import {
  Vector3,
  EventName,
  StageType,
  PlacedObstacle,
  PlacedItem,
  PlacedEnemy,
  Room,
  Corridor,
  TacticalElement,
  InventoryItemType,
  ItemType,
} from '../engine/types';
import { useGameStore } from '../stores/gameStore';
import { useUIStore } from '../stores/uiStore';
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

  // フロアマネージャー
  private floorManager: FloorManager | null = null;

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
  private uiStore = useUIStore();

  // UIコールバック
  private onGameOver: ((score: number) => void) | null = null;
  private onTileSelect: ((tileInfo: any) => void) | null = null;
  private onEnemySelect: ((enemy: any) => void) | null = null;
  private onCharacterSelect: ((character: any) => void) | null = null;
  private onTurnChange: ((isPlayerTurn: boolean) => void) | null = null;

  /**
   * コンストラクタ
   */
  constructor() {
    this.engine = Engine.instance;
  }

  /**
   * ゲームを初期化
   * @param canvas 描画先のキャンバス要素
   */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (this.initialized) {
      return;
    }

    // システムを初期化
    await this.initializeSystems(canvas);

    // フロアマネージャーを初期化
    this.floorManager = new FloorManager(this.engine, 10);

    // マップを生成
    await this.generateMap();

    // プレイヤーを作成
    await this.createPlayer();

    // リソース（障害物・アイテム・敵）を生成
    await this.generateResources();

    // イベントリスナーを設定
    this.setupEventListeners();

    // BGMを開始
    const audioSystem = this.engine.getSystem<AudioSystem>('audio');
    if (audioSystem) {
      audioSystem.playBGM('bgm01');
    }

    // エンジンを開始
    this.engine.start();

    this.initialized = true;
  }

  /**
   * システムを初期化
   * @param canvas 描画先のキャンバス要素
   */
  private async initializeSystems(canvas: HTMLCanvasElement): Promise<void> {
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

    // オーディオシステム
    const audioSystem = new AudioSystem();
    this.engine.registerSystem('audio', audioSystem);

    // ターンシステム
    const turnSystem = new TurnSystem();
    this.engine.registerSystem('turn', turnSystem);

    // エフェクトシステム
    const effectSystem = new EffectSystem();
    this.engine.registerSystem('effect', effectSystem);

    // 戦闘システム
    const combatSystem = new CombatSystem();
    this.engine.registerSystem('combat', combatSystem);

    // インタラクションシステム
    const interactionSystem = new InteractionSystem();
    this.engine.registerSystem('interaction', interactionSystem);

    // 入力システム（初期化前に登録）
    const inputSystem = new InputSystem();
    this.engine.registerSystem('input', inputSystem);

    // すべてのシステムを初期化
    await this.engine.initialize();

    // RendererSystem初期化後にPIXIのcanvasをInputSystemに設定
    const app = rendererSystem.getApp();
    if (app && app.canvas) {
      inputSystem.setCanvas(app.canvas as HTMLCanvasElement);
      console.log('InputSystem canvas set to PIXI canvas');
    } else {
      console.warn('Failed to get PIXI canvas for InputSystem');
    }
  }

  /**
   * マップを生成
   * @param stageType ステージタイプ（オプション、デフォルトはTACTICAL_COMBAT）
   */
  private async generateMap(stageType: StageType = StageType.TACTICAL_COMBAT): Promise<void> {
    // MapGeneratorFacadeを使用
    const mapGenerator = new MapGeneratorFacade(50, 50);

    // ステージタイプに応じてマップ生成
    if (stageType === StageType.CLASSIC) {
      // クラシックモード：従来の方式
      const mapData = await mapGenerator.generateMap(4, 8, stageType);

      // タイルマップを作成
      this.tileMap = new TileMap(50, 50);
      this.tileMap.importMapData(mapData.map);
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

      // 戦術的データをゲームストアに保存（将来の拡張用）
      // TODO: ゲームストアに戦術的データ保存機能を追加
    }

    // WorldSystemを作成してエンジンに登録（タイルマップを使用）
    const worldSystem = new WorldSystem(this.tileMap);
    this.engine.registerSystem('world', worldSystem);
    await worldSystem.initialize(this.engine);

    // タイルマップの描画は、カメラ位置設定後に行う
    // （プレイヤー作成後に renderTileMap を呼び出す）
  }

  /**
   * タイルマップを描画
   */
  private async renderTileMap(): Promise<void> {
    if (!this.tileMap) {
      return;
    }

    const rendererSystem = this.engine.getSystem<RendererSystem>('renderer');
    if (!rendererSystem) {
      return;
    }

    // TileMapから2D配列データを取得
    const mapData: number[][] = [];
    const height = this.tileMap.getHeight();
    const width = this.tileMap.getWidth();

    for (let y = 0; y < height; y++) {
      mapData[y] = [];
      for (let x = 0; x < width; x++) {
        const tile = this.tileMap.getTile(x, y);
        mapData[y][x] = tile ? (tile.type as any) : 0; // TileTypeをnumberにキャスト
      }
    }

    // タイルマップを描画
    await rendererSystem.renderTileMap(mapData);
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
      } catch (_error) {
        // WorldSystemの削除に失敗
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
        } catch (_error) {
          // プレイヤー位置のリセットに失敗
        }
      }
    }
  }

  /**
   * プレイヤーを作成
   */
  private async createPlayer(): Promise<void> {
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

      // カメラの初期位置をプレイヤーの位置に設定
      const coordinateSystem = rendererSystem.getCoordinateSystem();
      const screenPos = coordinateSystem.isometricToScreen(
        startPosition.x,
        startPosition.y,
        startPosition.z
      );
      // カメラの位置 = プレイヤーのスクリーン座標 - 画面中央オフセット
      camera.setPosition(screenPos.x - 400, screenPos.y - 300); // 画面中央に配置（800x600の中心）
    }

    // カメラ位置設定後にタイルマップを再描画
    await this.renderTileMap();
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
    if (!this.tileMap) {
      return;
    }

    // WorldSystemから必要な情報を取得
    const worldSystem = this.engine.getSystem<WorldSystem>('world');
    if (!worldSystem) {
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

    // プレイヤー位置を取得（配置禁止エリアとして使用）
    let playerStartPos: { x: number; y: number } | undefined;
    if (this.player) {
      const transform = this.player.getComponent('transform');
      if (transform && 'position' in transform) {
        const pos = (transform as { position: Vector3 }).position;
        playerStartPos = { x: Math.round(pos.x), y: Math.round(pos.y) };
      }
    }

    // リソースを生成
    const resources = this.resourceSystem.generateResources(
      map,
      rooms,
      corridors,
      tacticalElements,
      {
        playerLevel: playerLevel,
        difficulty: currentFloor,
        playerStartPos: playerStartPos,
      }
    );

    // 生成されたリソースを保存
    this.placedObstacles = resources.obstacles;
    this.placedItems = resources.items;
    this.placedEnemies = resources.enemies;

    // エンティティシステムに登録
    await this.registerResourceEntities(resources.obstacles, resources.items, resources.enemies);
  }

  /**
   * ItemTypeをInventoryItemTypeにマッピング
   */
  private mapItemTypeToInventoryType(itemType: ItemType): InventoryItemType | null {
    switch (itemType) {
      case ItemType.HEALTH:
        return InventoryItemType.HEALTH_PACK;
      case ItemType.ENERGY:
        return InventoryItemType.ENERGY_CELL;
      case ItemType.WEAPON:
      case ItemType.UPGRADE:
        return InventoryItemType.WEAPON_UPGRADE;
      case ItemType.ARMOR:
        return InventoryItemType.ARMOR_UPGRADE;
      case ItemType.KEY:
        return InventoryItemType.KEY_ITEM;
      default:
        return null;
    }
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
      return;
    }

    // 障害物を登録
    for (const obstacleData of obstacles) {
      const obstacle = new Obstacle(obstacleData);
      await obstacle.initialize();
      entitySystem.registerEntity(obstacle);
    }

    // アイテムを登録
    for (const itemData of items) {
      const item = new Item(itemData);

      // ItemTypeからInventoryItemTypeへのマッピング
      const inventoryType = this.mapItemTypeToInventoryType(itemData.type);
      if (inventoryType) {
        item.setInventoryItemType(inventoryType);
      }

      await item.initialize();
      entitySystem.registerEntity(item);
    }

    // 敵を登録
    for (let i = 0; i < enemies.length; i++) {
      const enemyData = enemies[i];
      try {
        const enemy = new Enemy(enemyData);
        await enemy.initialize();
        entitySystem.registerEntity(enemy);
      } catch (error) {
        console.error(`Failed to register enemy ${i}:`, error);
      }
    }

    // イベントオブジェクトを配置
    await this.placeEventObjects(entitySystem);
  }

  /**
   * イベントオブジェクトを配置
   * @param entitySystem エンティティシステム
   */
  private async placeEventObjects(entitySystem: EntitySystem): Promise<void> {
    if (!this.tileMap) {
      return;
    }

    const eventSystem = this.engine.getSystem<EventSystem>('event');
    const audioSystem = this.engine.getSystem<AudioSystem>('audio');

    // 空いている床タイルを取得
    const floorTiles: Vector3[] = [];
    for (let y = 0; y < this.tileMap.getHeight(); y++) {
      for (let x = 0; x < this.tileMap.getWidth(); x++) {
        const tile = this.tileMap.getTile(x, y);
        if (tile && (tile.type as any) === 'floor') {
          // エンティティが既に存在しないかチェック
          const entities = entitySystem.getEntities();
          const occupied = entities.some((entity) => {
            const transform = entity.getComponent('transform');
            if (transform && 'position' in transform) {
              const pos = (transform as { position: Vector3 }).position;
              return pos.x === x && pos.y === y;
            }
            return false;
          });

          if (!occupied) {
            floorTiles.push({ x, y, z: 0 });
          }
        }
      }
    }

    if (floorTiles.length === 0) {
      return;
    }

    // ポータルを1つ配置（階段の代わり）
    const portalPos = floorTiles[Math.floor(Math.random() * floorTiles.length)];
    const portal = createPortal(`portal_${Date.now()}`, portalPos, async (playerId) => {
      audioSystem?.playSE('item');
      eventSystem?.emit('portal_activated', { playerId, position: portalPos });

      // 次の階層へ移動
      if (this.floorManager) {
        const success = await this.floorManager.moveToNextFloor();
        if (success) {
          // フロア移動後、マップとリソースを再生成
          await this.regenerateFloor();
        } else {
          // 最終フロアに到達した場合はゲームクリア
          eventSystem?.emit('game_clear', { floor: this.floorManager.getCurrentFloor() });
        }
      }
    });
    await portal.initialize();
    entitySystem.registerEntity(portal);

    // エネルギーチャージャーを2-3個配置
    const chargerCount = 2 + Math.floor(Math.random() * 2); // 2-3個
    for (let i = 0; i < chargerCount && floorTiles.length > 0; i++) {
      // ポータルと同じ位置を避ける
      const availableTiles = floorTiles.filter(
        (pos) => pos.x !== portalPos.x || pos.y !== portalPos.y
      );
      if (availableTiles.length === 0) break;

      const chargerPos = availableTiles[Math.floor(Math.random() * availableTiles.length)];
      const chargeAmount = 10 + Math.floor(Math.random() * 11); // 10-20
      const maxUses = 1 + Math.floor(Math.random() * 3); // 1-3回使用可能

      const charger = createEnergyCharger(
        `charger_${Date.now()}_${i}`,
        chargerPos,
        chargeAmount,
        maxUses,
        (playerId) => {
          audioSystem?.playSE('item');

          // プレイヤーのエネルギーを回復
          const player = entitySystem.getEntity(playerId);
          if (player) {
            const energyComponent = player.getComponent('energy');
            if (energyComponent && 'recharge' in energyComponent) {
              (energyComponent as { recharge: (amount: number) => void }).recharge(chargeAmount);

              eventSystem?.emit('energy_recharged', {
                playerId,
                amount: chargeAmount,
                position: chargerPos,
              });
            }
          }
        }
      );
      await charger.initialize();
      entitySystem.registerEntity(charger);

      // 使用済みの位置を削除
      const index = floorTiles.findIndex((pos) => pos.x === chargerPos.x && pos.y === chargerPos.y);
      if (index !== -1) {
        floorTiles.splice(index, 1);
      }
    }
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
        // タイル情報をフォーマットして送信
        const tileInfo = {
          name: data.tile.type || 'Unknown',
          effect: 'None',
          statModifier: {},
          position: data.position,
        };
        this.onTileSelect(tileInfo);
      }
    });

    // エンティティ選択イベント（新しいイベント）
    eventSystem.on('entity_selected', (data) => {
      const entity = data.entity;
      const entityId = data.entityId;

      // エンティティのタイプに応じて処理
      if (entity.hasTag('enemy')) {
        // 敵エンティティの場合
        if (this.onEnemySelect) {
          this.onEnemySelect({ entity, id: entityId, position: data.position });
        }
      } else if (entity.hasTag('player')) {
        // プレイヤーの場合
        if (this.onCharacterSelect) {
          this.onCharacterSelect({ entity, id: entityId, position: data.position });
        }
      } else {
        // その他のエンティティ（障害物、アイテムなど）
        if (this.onTileSelect) {
          const entityInfo = {
            name: entityId,
            effect: 'Entity',
            statModifier: {},
            position: data.position,
          };
          this.onTileSelect(entityInfo);
        }
      }
    });

    // 敵選択イベント（後方互換性のため残す）
    eventSystem.on('enemy_selected', (data) => {
      if (this.onEnemySelect) {
        this.onEnemySelect(data.enemy);
      }
    });

    // キャラクター選択イベント（後方互換性のため残す）
    eventSystem.on('character_selected', (data) => {
      if (this.onCharacterSelect) {
        this.onCharacterSelect(data.character);
      }
    });

    // プレイヤーターン開始イベント
    eventSystem.on('player_turn_started', () => {
      if (this.onTurnChange) {
        this.onTurnChange(true);
      }
    });

    // 敵ターン開始イベント
    eventSystem.on('enemy_turn_started', () => {
      if (this.onTurnChange) {
        this.onTurnChange(false);
      }
    });

    // アイテム発見イベント
    eventSystem.on('item_found', (data) => {
      const itemEntity = data.itemEntity as Item;
      const inventoryItem = itemEntity.toInventoryItem();

      if (inventoryItem) {
        // UIダイアログを表示
        this.uiStore.showItemPickupDialog(inventoryItem, {
          x: data.position.x,
          y: data.position.y,
        });

        // アイテムエンティティIDをuiStoreに保存
        this.uiStore.itemPickupDialog.itemEntityId = itemEntity.id;
      }
    });

    // アイテム削除イベント（UIダイアログからのカスタムイベント）
    window.addEventListener('removeItem', ((event: CustomEvent) => {
      const itemId = event.detail.itemId;
      this.removeItem(itemId);
    }) as EventListener);
  }

  /**
   * アイテムを削除
   * @param itemId 削除するアイテムのID
   */
  private removeItem(itemId: string): void {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return;

    const entity = entitySystem.getEntity(itemId);
    if (entity && entity.hasTag('item')) {
      const item = entity as Item;
      // アイテムを収集済みとしてマーク
      item.collect();
      // エンティティを削除
      item.destroy();
      entitySystem.removeEntity(itemId);
    }
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
   * ターン変更ハンドラーを設定
   * @param callback ターン変更時に呼び出されるコールバック
   */
  setOnTurnChange(callback: (isPlayerTurn: boolean) => void): void {
    this.onTurnChange = callback;
  }

  /**
   * プレイヤーを移動
   * @param direction 移動方向
   */
  movePlayer(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (!this.player) {
      return;
    }

    this.player.move(direction);
  }

  /**
   * プレイヤーが攻撃
   */
  async playerAttack(): Promise<void> {
    if (!this.player) {
      return;
    }

    // CombatSystemを通じて攻撃を実行
    const eventSystem = this.engine.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('player_attack_requested', {
        playerId: this.player.id,
      });
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

  /**
   * フロアを再生成（フロア移動後）
   */
  private async regenerateFloor(): Promise<void> {
    // マップを再生成
    await this.generateMap();

    // プレイヤーを再配置
    if (this.player && this.tileMap) {
      const startPos = this.tileMap.getRandomFloorTile();
      if (startPos) {
        const transform = this.player.getComponent('transform');
        if (transform && 'position' in transform) {
          (transform as { position: { x: number; y: number; z: number } }).position = {
            x: startPos.x,
            y: startPos.y,
            z: 0,
          };
        }
      }
    }

    // リソースを再生成
    await this.generateResources();
  }

  /**
   * 現在のフロア番号を取得
   * @returns フロア番号
   */
  getCurrentFloor(): number {
    return this.floorManager?.getCurrentFloor() || 1;
  }

  /**
   * 最大フロア数を取得
   * @returns 最大フロア数
   */
  getMaxFloors(): number {
    return this.floorManager?.getMaxFloors() || 10;
  }
}
