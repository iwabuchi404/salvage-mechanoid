import * as PIXI from 'pixi.js';
import { Application, Assets, Graphics, Sprite, Loader } from 'pixi.js';
import { sound } from '@pixi/sound';
import { Stage } from './common/Stage';
import { Character } from './common/Character';
import { Enemy } from './common/Enemy';
import { TurnManager, TurnPhase } from './common/TurnManager';
import { Direction, TileInfo, TileType } from './common/types';
import { GameObject } from './common/GameObject';
import { FlexibleMapGenerator } from './engine/world/FlexibleMapGenerator';
import { ResourceGenerationSystem } from './engine/world/ResourceGenerationSystem';
import { StageType, Room, Corridor, TacticalElement } from './engine/types';
import { onCharacterDestroyed } from './common/VisualEffect';
import { SoundManager } from './common/SoundManager';
import { useGameStore } from './stores/gameStore';

interface Item {
  id: string;
  name: string;
  description: string;
}

export class Game {
  public app: PIXI.Application | null = null;
  public stage: Stage;
  public player: Character | null = null;
  // private enemies: Enemy[] = [];
  public soundList: any;
  private selectedCharacter: Character | null = null;
  private onCharacterSelect: any;
  private selectedEnemy: Enemy | null = null;
  private onEnemySelect: (enemy: Enemy | null) => void;
  private selectedTile: TileInfo | null = null;
  private onTileSelect: (tileInfo: TileInfo | null) => void;
  private onGameOver: (score: number) => void;
  private turnManager: TurnManager | null = null;
  private isPlayerTurn = true;
  private currentPhase: TurnPhase = TurnPhase.PLAYER;
  private soundManager: SoundManager = SoundManager.getInstance();
  private gameStore = useGameStore();

  constructor() {
    // ステージデータの定義（仮のデータ）
    const stageData = [
      [1, 1, 2, 1, 1, 1],
      [1, 3, 2, 1, 1, 1],
      [1, 1, 0, 1, 2, 2],
      [2, 2, 0, 1, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [0, 0, 0, 3, 0, 0],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 3, 1, 3, 3, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
    ];

    // マップ生成は非同期なのでinitialize()で行う
    // とりあえずダミーマップで初期化
    const dummyMap = Array(50)
      .fill(null)
      .map(() => Array(50).fill(0));
    this.stage = new Stage(dummyMap, { width: 160, height: 120 }, 800, 600);
    this.setupInputHandlers();

    this.onCharacterSelect = () => {
      // console.log('onCharacterSelect init');
    };

    this.onEnemySelect = (enemy: Enemy | null) => {
      if (enemy) {
        // console.log(`Enemy selected in Game: ${enemy.getName()}`);
      } else {
        // console.log('No enemy selected');
      }
    };

    this.onTileSelect = () => {
      // console.log('onTileSelect init');
    };
    this.onGameOver = () => {
      // console.log('onTileSelect init');
    };

    // アイテム削除イベントのリスナーを登録
    window.addEventListener('removeItem', ((event: CustomEvent) => {
      const itemId = event.detail.itemId;
      if (this.stage) {
        this.stage.removeItem(itemId);
      }
    }) as EventListener);
  }

  async createPixi(_canvas: HTMLCanvasElement) {
    const app = new Application();
    await app.init({ background: '#202020' });
    _canvas.appendChild(app.canvas);
    // アセットを初期化
    await Assets.init();
    this.turnManager = TurnManager.getInstance();

    // アプリケーションが正しく初期化されたことを確認
    // app.ticker.add(() => {
    //   console.log("PIXI application is running");
    // });
    return app;
  }

  public async initialize(_canvas: HTMLCanvasElement) {
    this.app = await this.createPixi(_canvas);

    // 新しいFlexibleMapGeneratorでマップ生成（戦術的モード）
    const mapGenerator = new FlexibleMapGenerator(50, 50);
    const generatedMap = await mapGenerator.generateTacticalMap(StageType.TACTICAL_COMBAT, {
      minRoomSize: 4,
      maxRoomSize: 8,
      energyTightness: 'balanced',
      playerLevel: 1,
    });

    // 生成されたマップでStageを再初期化
    this.stage = new Stage(generatedMap.map, { width: 160, height: 120 }, 800, 600);
    this.stage.setRooms(generatedMap.rooms);

    await this.stage.initialize(this.app);

    // タイル選択時の処理
    this.stage.setOnTileSelect((tileInfo) => {
      this.selectedTile = tileInfo;
      this.onTileSelect(tileInfo);
    });

    // プレイヤーの作成
    const startPosition = this.stage.getRandomWalkableTile();
    this.gameStore.player.status.hp = this.gameStore.player.status.maxHp;
    this.gameStore.player.status.energy = this.gameStore.player.status.maxEnergy;
    this.player = new Character('player', 'Hero', {
      up: './robo01bk_r.png',
      down: './robo01_l.png',
      left: './robo01bk_l.png',
      right: './robo01_r.png',
    });
    // プレイヤーをステージに追加
    await this.stage.addCharacter(this.player, startPosition.x, startPosition.y, 0);
    this.player.setPosition(startPosition.x, startPosition.y, 0);
    // this.stage.addCharacter(this.player, 2, 2, 0);
    this.stage.updateCameraPosition();

    // 新しいResourceGenerationSystemでリソースを配置
    const resourceSystem = new ResourceGenerationSystem(50, 50);
    const resources = resourceSystem.generateResources(
      generatedMap.map,
      generatedMap.rooms,
      generatedMap.corridors,
      generatedMap.tacticalElements,
      {
        playerLevel: 1,
        difficulty: 1.0,
      }
    );

    console.log(
      `Generated resources: ${resources.obstacles.length} obstacles, ${resources.items.length} items, ${resources.enemies.length} enemies, ${resources.portals.length} portals, ${resources.chargers.length} chargers`
    );

    // 障害物を配置
    for (const obstacle of resources.obstacles) {
      const box = new GameObject(this.stage, './obj01.png', obstacle.x, obstacle.y, 0, true);
      this.stage.addObject(box);
    }

    // アイテムを配置
    console.log(`Placing ${resources.items.length} items on stage`);
    for (const itemData of resources.items) {
      // PIXI.Graphicsで●を描画
      const itemGraphics = new PIXI.Graphics();

      // アイテムの種類に応じて色を変える
      const colorMap: { [key: string]: number } = {
        health_pack: 0x00ff00, // 緑（体力回復）
        energy_cell: 0x00ffff, // シアン（エネルギー）
        weapon_upgrade: 0xff9900, // オレンジ（武器）
        armor_upgrade: 0x0099ff, // 青（防具）
        key_item: 0xffff00, // 黄色（キーアイテム）
      };
      const color = colorMap[itemData.type] || 0xffffff; // デフォルトは白

      // ●を描画（半径10の円）
      itemGraphics.circle(0, 0, 10);
      itemGraphics.fill(color);
      itemGraphics.stroke({ width: 2, color: 0x000000 }); // 黒い縁取り

      // アイソメトリック座標をスクリーン座標に変換
      const screenPos = this.stage.isometricToScreen(itemData.x, itemData.y);
      itemGraphics.x = screenPos.x;
      itemGraphics.y = screenPos.y - 20; // 少し浮かせる

      console.log(
        `Item at grid(${itemData.x}, ${itemData.y}) -> screen(${screenPos.x}, ${screenPos.y})`
      );

      // Stageのカメラコンテナに追加（他のオブジェクトと同じレイヤー）
      this.stage.addGraphicsToCamera(itemGraphics);

      // Stageにアイテムデータを追加
      this.stage.addItemData(itemData, itemGraphics);
    }

    // 敵を配置
    for (const enemyData of resources.enemies) {
      // EnemyTypeを旧システムの敵タイプにマッピング
      const enemyTypeMapping: { [key: string]: 'SLIME' | 'GOBLIN' } = {
        scout: 'SLIME',
        soldier: 'GOBLIN',
        heavy: 'GOBLIN',
        turret: 'GOBLIN',
        boss: 'GOBLIN',
      };
      await this.stage.addEnemy(
        enemyData.id,
        enemyTypeMapping[enemyData.type] || 'SLIME',
        enemyData.x,
        enemyData.y,
        0
      );
    }

    // ポータルを配置（新システム）
    for (const portalData of resources.portals) {
      const portal = this.stage.addEventObject(
        './obj02.png',
        portalData.x,
        portalData.y,
        0,
        (character) => {
          if (character === this.player) {
            console.log('ポータル');
            this.gameStore.setPortalActive(true);
          }
        },
        false,
        { x: 0.5, y: 0.8 }
      );
      this.stage.addObject(portal);
    }

    // エネルギーチャージャーを配置（新システム）
    for (const chargerData of resources.chargers) {
      const charger = this.stage.addEventObject(
        './obj01.png', // 仮の画像、後で専用画像に変更可能
        chargerData.x,
        chargerData.y,
        0,
        (character) => {
          if (character === this.player && chargerData.remainingUses > 0) {
            // エネルギー回復処理
            const currentEnergy = this.gameStore.player.status.energy;
            const maxEnergy = this.gameStore.player.status.maxEnergy;
            const newEnergy = Math.min(currentEnergy + chargerData.chargeAmount, maxEnergy);
            this.gameStore.player.status.energy = newEnergy;
            chargerData.remainingUses--;
            console.log(
              `Energy charged! +${chargerData.chargeAmount} (${chargerData.remainingUses} uses left)`
            );
          }
        },
        false,
        { x: 0.5, y: 0.8 }
      );
      this.stage.addObject(charger);
    }

    this.stage.setOnCharacterSelect((character) => {
      this.selectedCharacter = character;
      if (this.onCharacterSelect) {
        this.onCharacterSelect(character);
      }
    });

    this.stage.setOnEnemySelect((enemy) => {
      this.selectedEnemy = enemy;
      this.onEnemySelect(enemy);
    });

    // プレイヤーを追跡
    this.stage.setFollowTarget(this.player);
    // カメラのスムージングを設定（必要に応じて調整）
    this.stage.setCameraSmoothing(0.1);
    this.start();

    const enemies = this.stage.getAllEnemies();
    if (this.player && enemies) {
      this.turnManager?.initialize(this.player, enemies);
    }

    this.stage.setTurnManager(this.turnManager);
    this.startNewTurn();
  }

  public resize(width: number, height: number): void {
    if (this.app) {
      this.app.renderer.resize(width, height);
      // ステージやその他のゲーム要素のサイズも調整する必要があります
      // 例：
      // this.stage.resize(width, height);
      // this.player.updatePosition();
      // など
    }
  }

  private setupInputHandlers() {
    // test
  }

  private start() {
    if (this.app) {
      // ゲームループの開始
      this.app.ticker.add(() => this.gameLoop());
    }
  }

  private gameLoop() {
    // ゲームの更新ロジックをここに書く
    // 例: キャラクターのアニメーション更新、衝突検出など
    this.checkGameOver();
    this.stage.update(this.app?.ticker.deltaMS);
  }

  private checkGameOver() {
    console.log('checkGameOver HP', this.player?.getStatus().hp);
    if (this.player && this.player.getStatus().hp <= 0) {
      this.gameOver();
    }
  }

  private gameOver() {
    // ゲームオーバー時の処理
    console.log('game over');
    // const finalScore = this.calculateScore(); // スコア計算のメソッドを実装する
    if (this.onGameOver) {
      this.onGameOver(100);
    }
  }

  public setOnGameOver(callback: (score: number) => void) {
    this.onGameOver = callback;
  }

  public getCurrentPhase(): TurnPhase {
    return this.currentPhase;
  }

  private startNewTurn(): void {
    this.currentPhase = this.turnManager!.startTurn();
    this.handleTurnPhase(this.currentPhase);
  }

  private handleTurnPhase(phase: TurnPhase): void {
    switch (phase) {
      case TurnPhase.PLAYER:
        this.startPlayerTurn();
        break;
      case TurnPhase.ENEMY:
        this.startEnemyTurn();
        break;
      case TurnPhase.END:
        this.endTurn();
        break;
    }
  }

  private startPlayerTurn(): void {
    this.isPlayerTurn = true;
    // UIを更新してプレイヤーのアクションを待つ
  }

  private startEnemyTurn(): void {
    this.isPlayerTurn = false;
    // console.log('Enemy turn started');
    this.processEnemyTurn();
  }

  private async processEnemyTurn(): Promise<void> {
    while (this.turnManager!.getCurrentPhase() === TurnPhase.ENEMY) {
      const currentCharacter = this.turnManager!.getCurrentCharacter();
      if (currentCharacter instanceof Enemy) {
        await this.performEnemyAction(currentCharacter);
      }
      const nextPhase = this.turnManager!.nextTurn();
      if (nextPhase === TurnPhase.END) {
        this.endTurn();
        break;
      }
    }
  }

  private async performEnemyAction(enemy: Enemy): Promise<void> {
    // 敵のAIロジックをここに実装
    // console.log(`${enemy.getName()} is thinking...`);

    // ランダムな移動を実行
    // console.log(enemy);
    // await enemy.moveRandomly(this.stage);
    await enemy.act(this.stage);

    // console.log(`${enemy.getName()} moved to a random direction`);
    // 実際の行動（移動、攻撃など）をここに実装
  }

  private endTurn(): void {
    // console.log('Turn ended');
    this.startNewTurn();
  }

  async addPlayer() {
    // プレイヤーキャラクターの作成
    this.player = new Character('player', 'Hero', {
      up: './robo_l.png',
      down: './robo_r.png',
      left: './robo_l.png',
      right: './robo_r.png',
    });
    this.stage.addCharacter(this.player, 1, 0, 2);

    return this.player;
  }

  public movePlayer(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (!this.isPlayerTurn || !this.player) return;

    const position = this.player.getPosition();
    let newX = position.x;
    let newY = position.y;
    switch (direction) {
      case 'up':
        newY--;
        break;
      case 'down':
        newY++;
        break;
      case 'left':
        newX--;
        break;
      case 'right':
        newX++;
        break;
    }
    // console.log(position, direction, newX, newY);
    this.player.setDirection(direction);

    if (this.player.getEnergy() > 0) {
      this.stage
        .moveCharacter(this.player, newX, newY, position.z)
        .then(() => {
          this.checkEnergyStatus();
          if (this.player) {
            this.stage.checkAndTriggerEvents(this.player);
          }
          const nextPhase = this.turnManager!.nextTurn();
          this.handleTurnPhase(nextPhase);
        })
        .catch((error) => {
          console.log('Player movement failed:', error);
        });
    } else {
      this.handleEmergencyShutdown();
    }
  }

  public setOnCharacterSelect(callback: ((character: Character | Enemy | null) => void) | null) {
    if (callback === null) {
      this.onCharacterSelect = () => {
        // console.log('onCharacterSelect');
      }; // デフォルトの空の関数を設定
      this.selectedCharacter = null;
    } else {
      this.onCharacterSelect = callback;
    }
  }

  public getSelectedCharacter(): Character | null {
    return this.selectedCharacter;
  }

  public setOnEnemySelect(callback: (enemy: Enemy | null) => void) {
    this.onEnemySelect = callback;
  }

  public getSelectedEnemy(): Enemy | null {
    return this.selectedEnemy;
  }

  public setOnTileSelect(callback: (tileInfo: TileInfo | null) => void) {
    this.onTileSelect = callback;
  }

  public getSelectedTile(): TileInfo | null {
    return this.selectedTile;
  }

  private playerItems: Item[] = [
    { id: 'potion', name: 'ポーション', description: 'HPを50回復します' },
    { id: 'ether', name: 'エーテル', description: 'MPを30回復します' },
  ];

  public async playerAttack(): Promise<void> {
    if (!this.isPlayerTurn || !this.player) return;
    if (this.player.getMoveState()) return;

    const targetPosition = this.stage.getAttackTargetPosition(this.player);
    const target = this.stage.getCharacterAt(targetPosition.x, targetPosition.y, targetPosition.z);

    if (target && target instanceof Enemy && this.player.getEnergy() >= 2) {
      this.soundManager.playSE('attack');
      const damage = await this.player.attack();
      await target.takeDamage(damage);
      console.log(`Player attacked ${target.getName()} for ${damage} damage!`);
      this.checkEnergyStatus();

      if (!target.isAlive()) {
        console.log(`${target.getName()} was defeated!`);
        const cameraPos = this.stage.getCameraPosition();
        const effectPos = this.stage.isometricToScreen(
          target.getPosition().x,
          target.getPosition().y
        );

        this.soundManager.playSE('explosion');
        const effectContainer = onCharacterDestroyed(
          { x: effectPos.x + cameraPos.x, y: effectPos.y + cameraPos.y },
          40
        );
        this.app?.stage.addChild(effectContainer);
        this.stage.removeEnemy(target);
      }
    } else {
      console.log('No target to attack!');
      await this.player.attack();
      this.soundManager.playSE('attack');
    }

    // プレイヤーの行動後、次のターンへ
    const nextPhase = this.turnManager!.nextTurn();
    this.handleTurnPhase(nextPhase);
  }

  public changePlayerDirection(direction: any): void {
    if (this.player) {
      this.stage.changeCharacterDirection(this.player, direction);
    }
  }

  public getPlayerItems(): Item[] {
    return [...this.playerItems];
  }
  public isAllEnemiesDefeated(): boolean {
    const enemies = this.stage.getAllEnemies();
    if (!enemies || enemies.length == 0) {
      return true;
    }
    return false;
  }

  private checkEnergyStatus(): void {
    const player = this.player;
    if (!player) return;

    const energy = player.getEnergy();
    if (energy === 0) {
      this.handleEmergencyShutdown();
    } else if (energy <= player.getMaxEnergy() * 0.15) {
      // クリティカルモードの処理
      player.takeDamage(1);
      if (!player.isAlive()) {
        this.gameOver();
      }
    }
  }

  private handleEmergencyShutdown(): void {
    console.log('Emergency Shutdown!');
    // 3ターン行動不能の処理
    // その後の強制帰還処理
    this.gameOver();
  }

  private setupEventObjects(): void {
    // ポータル（衝突なし）
    const pos = this.stage.getRandomWalkableTile();
    this.stage.addEventObject(
      './obj02.png',
      pos.x,
      pos.y,
      0,
      (character) => {
        if (character === this.player) {
          console.log('ポータル');
          this.gameStore.setPortalActive(true);
        }
      },
      false
    );

    //   // ダメージマス（衝突なし）
    //   this.stage.addEventObject('/assets/damage_tile.png', 7, 7, 0, (character) => {
    //     character.takeDamage(10);
    //     console.log(`${character.getName()} took 10 damage from a damage tile!`);
    //   }, false);

    //   // 回復マス（衝突なし）
    //   this.stage.addEventObject('/assets/heal_tile.png', 9, 9, 0, (character) => {
    //     character.heal(20);
    //     console.log(`${character.getName()} healed 20 HP from a healing tile!`);
    //   }, false);

    //   // 障害物（衝突あり）
    //   this.stage.addEventObject('/assets/obstacle.png', 11, 11, 0, (character) => {
    //     console.log(`${character.getName()} bumped into an obstacle!`);
    //   }, true);
    // }
  }
}
