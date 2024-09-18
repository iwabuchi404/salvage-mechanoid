import * as PIXI from 'pixi.js';
import { Application, Assets, Graphics, Sprite, Loader } from 'pixi.js';

import { Stage } from './common/Stage';
import { Character } from './common/Character';
import { Enemy } from './common/Enemy';
import { TurnManager, TurnPhase } from './common/TurnManager';
import { Direction, TileInfo } from './common/types';
import { GameObject } from './common/GameObject';
interface Item {
  id: string;
  name: string;
  description: string;
}

export class Game {
  public app: PIXI.Application | null = null;
  private stage: Stage;

  private player: Character | null = null;
  // private enemies: Enemy[] = [];

  private selectedCharacter: Character | null = null;
  private onCharacterSelect: any;
  private selectedEnemy: Enemy | null = null;
  private onEnemySelect: (enemy: Enemy | null) => void;
  private selectedTile: TileInfo | null = null;
  private onTileSelect: (tileInfo: TileInfo | null) => void;

  private turnManager: TurnManager | null = null;
  private isPlayerTurn = true;
  private currentPhase: TurnPhase = TurnPhase.PLAYER;

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
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 0, 1, 2, 2],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 1],
      [1, 3, 1, 3, 3, 2],
    ];
    // const stageData = [
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 3, 0, 2, 0, 0, 3, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // ];

    this.stage = new Stage(stageData, { width: 160, height: 120 }, 800, 600);

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

    this.stage.initialize(this.app);

    // タイル選択時の処理
    this.stage.setOnTileSelect((tileInfo) => {
      this.selectedTile = tileInfo;
      this.onTileSelect(tileInfo);
    });

    // プレイヤーの作成
    this.player = new Character('player', 'Hero', {
      up: '/robo01bk_r.png',
      down: '/robo01_l.png',
      left: '/robo01bk_l.png',
      right: '/robo01_r.png',
    });

    // テスト用に敵を追加
    const enemy1 = await this.stage.addEnemy('enemy1', 'SLIME', 1, 2, 0);
    const enemy2 = await this.stage.addEnemy('enemy2', 'SLIME', 3, 6, 0);
    const enemy3 = await this.stage.addEnemy('enemy3', 'GOBLIN', 3, 5, 0);

    const boxTexture = '/obj01.png';
    const box = new GameObject(this.stage, boxTexture, 5, 8, 0, { x: 0, y: 0.9 });
    this.stage.addObject(box);

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
    // プレイヤーをステージに追加
    this.stage.addCharacter(this.player, 0, 0, 0);
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
    this.stage.update(this.app?.ticker.deltaMS);
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
      up: '/robo_l.png',
      down: '/robo_r.png',
      left: '/robo_l.png',
      right: '/robo_r.png',
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
    this.stage
      .moveCharacter(this.player, newX, newY, position.z)
      .then(() => {
        // console.log('Player moved successfully');
        // カメラの位置が自動的に更新されます
      })
      .catch((error) => {
        // console.log('Player movement failed:', error);
      });
    // プレイヤーの行動後、次のターンへ
    const nextPhase = this.turnManager!.nextTurn();
    this.handleTurnPhase(nextPhase);
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

    if (target && target instanceof Enemy) {
      const damage = await this.player.attack();
      console.log('damage:', damage);
      await target.takeDamage(damage);
      console.log(`Player attacked ${target.getName()} for ${damage} damage!`);

      if (!target.isAlive()) {
        console.log(`${target.getName()} was defeated!`);
        this.stage.removeEnemy(target);
      }
    } else {
      console.log('No target to attack!');
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
}
