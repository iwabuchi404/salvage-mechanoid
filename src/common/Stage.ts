import * as PIXI from 'pixi.js';
import { Character } from './Character';
import { Enemy, EnemyFactory } from './Enemy';
import { GameObject } from './GameObject';
import { MapGenerator } from './MapGenerator';
import { Direction, TileType, Tile, TileInfo } from './types';

const TileInfoMap: { [key in TileType]: TileInfo } = {
  [TileType.EMPTY]: {
    type: TileType.EMPTY,
    name: 'Empty',
    effect: 'Impassable',
    statModifier: {},
  },
  [TileType.GRASS]: {
    type: TileType.GRASS,
    name: 'Grass',
    effect: 'Normal terrain',
    statModifier: {},
  },
  [TileType.WATER]: {
    type: TileType.WATER,
    name: 'Water',
    effect: 'Slows movement',
    statModifier: { speed: -1 },
  },
  [TileType.MOUNTAIN]: {
    type: TileType.MOUNTAIN,
    name: 'Mountain',
    effect: 'Increases defense',
    statModifier: { defense: 1 },
  },
};

export class Stage {
  private app: PIXI.Application | null = null;
  private tileMap: Tile[][][];
  private characters: Map<string, Character>;
  private objects: Map<string, GameObject>;
  private events: Map<string, () => void>;
  private camera: PIXI.Container;
  private tileContainer: PIXI.Container;
  private characterContainer: PIXI.Container | null = null;
  private cameraSpeed = 5;
  private stageData: number[][];
  private tileSize: { width: number; height: number };
  private keysPressed: Set<string> = new Set();
  private onCharacterSelect: any;
  private enemies: Map<string, Enemy> | null = null;
  private onEnemySelect: any;
  private selectedTile: Tile | null = null;
  private hoveredTile: Tile | null = null;
  private onTileSelect: (tileInfo: TileInfo | null) => void;
  private overlayContainer: PIXI.Container;
  private followTarget: Character | null = null;
  private cameraLerpFactor = 0.1; // カメラの追従速度（0.0 〜 1.0）
  private viewportWidth: number;
  private viewportHeight: number;
  private player: Character | null = null;
  private turnManager: any = null;

  constructor(
    stageData: number[][],
    tileSize: { width: number; height: number },
    viewportWidth: number,
    viewportHeight: number
  ) {
    this.stageData = stageData;
    this.tileSize = tileSize;
    this.tileMap = [];
    this.characters = new Map();
    this.objects = new Map();
    this.events = new Map();
    this.camera = new PIXI.Container();
    this.tileContainer = new PIXI.Container();
    this.overlayContainer = new PIXI.Container();
    this.characterContainer = new PIXI.Container();
    // レイヤーを追加
    this.camera.addChild(this.tileContainer);
    this.camera.addChild(this.overlayContainer);
    this.camera.addChild(this.characterContainer);

    // カメラの位置を設定
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    //エネミー
    this.enemies = new Map();
    this.onEnemySelect = (enemy: Enemy) => {
      console.log(`Enemy selected: ${enemy.getName()}`);
    };
    this.onCharacterSelect = () => {
      console.log('onCharacterSelect init');
    };

    this.onTileSelect = () => {
      console.log('onTileSelect init');
    };
  }

  public async initialize(app: PIXI.Application): Promise<void> {
    this.app = app;
    this.app.stage.addChild(this.camera);
    await this.initializeTileMap();
    this.setupKeyboardListeners();
    this.centerCamera();
    this.app.ticker.add(() => this.update());

    this.app.stage.interactive = true;
    if (this.characterContainer) {
      this.characterContainer.interactive = true;
    }

    this.setupMouseListeners();
  }

  public setTurnManager(manager: any) {
    this.turnManager = manager;
  }

  private async initializeTileMap(): Promise<void> {
    const mapGenerator = new MapGenerator(50, 50, 4, 8);
    const generatedMap = mapGenerator.generateMap();

    for (let y = 0; y < generatedMap.length; y++) {
      this.tileMap[y] = [];
      for (let x = 0; x < generatedMap[y].length; x++) {
        this.tileMap[y][x] = [];
        const tileType = generatedMap[y][x];
        if (tileType !== TileType.EMPTY) {
          const tile: Tile = {
            type: tileType,
            height: 0,
            sprite: await this.createTileSprite(tileType, x, y),
            overlay: await this.createTileOverlay(x, y),
          };
          this.tileMap[y][x][0] = tile;
        }
      }
    }

    // for (let y = 0; y < this.stageData.length; y++) {
    //   this.tileMap[y] = [];
    //   for (let x = 0; x < this.stageData[y].length; x++) {
    //     this.tileMap[y][x] = [];
    //     const tileType = this.stageData[y][x] as TileType;
    //     if (tileType !== TileType.EMPTY) {
    //       const tile: Tile = {
    //         type: tileType,
    //         height: 0,
    //         sprite: await this.createTileSprite(tileType, x, y),
    //         overlay: this.createTileOverlay(x, y),
    //       };
    //       this.tileMap[y][x][0] = tile;
    //     }
    //   }
    // }
  }

  private async createTileSprite(tileType: TileType, x: number, y: number): Promise<PIXI.Sprite> {
    let texturePath: string;
    switch (tileType) {
      case TileType.GRASS:
        texturePath = '/image.png';
        break;
      case TileType.WATER:
        texturePath = '/image02.png';
        break;
      case TileType.MOUNTAIN:
        texturePath = '/image03.png';
        break;
      default:
        texturePath = '/image.png';
    }

    const sprite = new PIXI.Sprite(await PIXI.Assets.load(texturePath));

    // クォータービューのタイル配置
    sprite.x = ((x - y) * this.tileSize.width) / 2;
    sprite.y = ((x + y) * this.tileSize.height) / 3;

    // タイルの中心を基準点に設定
    sprite.anchor.set(0.5, 0.5);

    this.tileContainer?.addChild(sprite);
    return sprite;
  }

  private createTileOverlay(x: number, y: number): PIXI.Graphics {
    const overlay = new PIXI.Graphics();
    const position = this.isometricToScreen(x, y);

    overlay.x = position.x;
    overlay.y = position.y - this.tileSize.height / 6;

    this.overlayContainer.addChild(overlay);
    return overlay;
  }

  private drawTileOverlay(overlay: PIXI.Graphics, color: number, alpha: number) {
    overlay.clear();
    overlay.beginFill(color, alpha);
    overlay.moveTo(0, -this.tileSize.height / 3);
    overlay.lineTo(this.tileSize.width / 2, 0);
    overlay.lineTo(0, this.tileSize.height / 3);
    overlay.lineTo(-this.tileSize.width / 2, 0);
    overlay.closePath();
    overlay.endFill();
  }

  private setupKeyboardListeners() {
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      this.keysPressed.add(event.key);
    });

    window.addEventListener('keyup', (event: KeyboardEvent) => {
      this.keysPressed.delete(event.key);
    });
  }

  private setupMouseListeners() {
    this.app!.stage.eventMode = 'static';
    this.app!.stage.hitArea = this.app!.screen;
    this.app!.stage.on('mousemove', (event: PIXI.FederatedMouseEvent) => this.onMouseMove(event));
    this.app!.stage.on('click', (event: PIXI.FederatedMouseEvent) => this.onMouseClick(event));
  }
  private onMouseMove(event: PIXI.FederatedMouseEvent) {
    const localPos = this.overlayContainer.toLocal(event.global);
    const hoveredTile = this.getTileAtPosition(localPos.x, localPos.y);

    if (this.hoveredTile && this.hoveredTile !== this.selectedTile) {
      this.hoveredTile.overlay!.clear();
    }

    if (hoveredTile && hoveredTile !== this.selectedTile) {
      this.drawTileOverlay(hoveredTile.overlay!, 0xffffff, 0.3);
    }

    this.hoveredTile = hoveredTile;
  }

  private onMouseClick(event: PIXI.FederatedMouseEvent) {
    const localPos = this.overlayContainer.toLocal(event.global);
    const clickedTile = this.getTileAtPosition(localPos.x, localPos.y);

    if (this.selectedTile) {
      this.selectedTile.overlay!.clear();
    }

    if (clickedTile) {
      this.drawTileOverlay(clickedTile.overlay!, 0xffff00, 0.5);
      this.selectedTile = clickedTile;
      this.onTileSelect(TileInfoMap[clickedTile.type]);
    } else {
      this.selectedTile = null;
      this.onTileSelect(null);
    }
  }

  private getTileAtPosition(x: number, y: number): Tile | null {
    const isoPos = this.screenToIsometric(x, y);
    const tileX = Math.round(isoPos.x);
    const tileY = Math.round(isoPos.y);

    if (
      tileX >= 0 &&
      tileX < this.stageData[0].length &&
      tileY >= 0 &&
      tileY < this.stageData.length
    ) {
      return this.tileMap[tileY][tileX][0] || null;
    }
    return null;
  }

  public setOnTileSelect(callback: (tileInfo: TileInfo | null) => void) {
    this.onTileSelect = callback;
  }

  public update(deltaTime?: number) {
    let dx = 0;
    let dy = 0;

    if (this.keysPressed.has('ArrowUp')) dy += this.cameraSpeed;
    if (this.keysPressed.has('ArrowDown')) dy -= this.cameraSpeed;
    if (this.keysPressed.has('ArrowLeft')) dx += this.cameraSpeed;
    if (this.keysPressed.has('ArrowRight')) dx -= this.cameraSpeed;

    if (dx !== 0 || dy !== 0) {
      this.moveCamera(dx, dy);
    }

    if (this.followTarget) {
      this.updateCameraPosition();
    }

    this.sortCharacters();
    this.updateVisibleTiles();
  }

  public setFollowTarget(character: Character) {
    this.followTarget = character;
    this.updateCameraPosition();
  }

  public updateCameraPosition() {
    if (!this.followTarget || !this.app) return;

    const targetPosition = this.followTarget.getPosition();
    const screenPosition = this.isometricToScreen(targetPosition.x, targetPosition.y);

    const screenCenterX = this.app.screen.width / 2;
    const screenCenterY = this.app.screen.height / 2;

    // 目標のカメラ位置を計算
    const targetCameraX = screenCenterX - screenPosition.x;
    const targetCameraY = screenCenterY - screenPosition.y;

    // 現在のカメラ位置から目標位置へスムーズに移動
    this.camera.x += (targetCameraX - this.camera.x) * this.cameraLerpFactor;
    this.camera.y += (targetCameraY - this.camera.y) * this.cameraLerpFactor;
  }

  private moveCamera(dx: number, dy: number) {
    if (!this.app) return;

    const newX = this.camera.x + dx;
    const newY = this.camera.y + dy;

    const mapBounds = this.getMapBounds();
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // カメラの移動範囲を制限
    const minX = screenWidth - mapBounds.maxX;
    const maxX = -mapBounds.minX;
    const minY = screenHeight - mapBounds.maxY;
    const maxY = -mapBounds.minY;

    this.camera.x = Math.max(Math.min(newX, maxX), minX);
    this.camera.y = Math.max(Math.min(newY, maxY), minY);
  }

  private centerCamera() {
    if (!this.app) return;

    const mapBounds = this.getMapBounds();
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    this.camera.x = (screenWidth - (mapBounds.maxX - mapBounds.minX)) / 2 - mapBounds.minX;
    this.camera.y = (screenHeight - (mapBounds.maxY - mapBounds.minY)) / 3 - mapBounds.minY;
  }
  // カメラのスムージング係数を設定するメソッド
  public setCameraSmoothing(factor: number) {
    this.cameraLerpFactor = Math.max(0, Math.min(1, factor));
  }

  private getMapBounds(): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (let y = 0; y < this.stageData.length; y++) {
      for (let x = 0; x < this.stageData[y].length; x++) {
        const position = this.isometricToScreen(x, y);
        minX = Math.min(minX, position.x - this.tileSize.width / 2);
        maxX = Math.max(maxX, position.x + this.tileSize.width / 2);
        minY = Math.min(minY, position.y - this.tileSize.height / 3);
        maxY = Math.max(maxY, position.y + this.tileSize.height / 3);
      }
    }

    return { minX, maxX, minY, maxY };
  }

  public addCharacter(character: Character, x: number, y: number, z: number) {
    const sprite = character.getSprite();
    const position = this.isometricToScreen(x, y);
    sprite.x = position.x;
    sprite.y = position.y - z * 5; // 高さに応じて調整
    this.characters.set(character.getId(), character);
    this.characterContainer?.addChild(sprite);
    this.sortCharacters(); // キャラクターの深度ソートを行う

    // Add click event listener
    character.setClickHandler(() => {
      this.onCharacterSelect(character);
    });

    this.setPlayer(character);
  }

  public async addEnemy(
    id: string,
    type: string,
    x: number,
    y: number,
    z: number,
    level = 1
  ): Promise<Enemy> {
    const enemy = await EnemyFactory.createEnemy(id, type, level);
    const sprite = enemy.getSprite();
    const position = this.isometricToScreen(x, y);
    sprite.x = position.x;
    sprite.y = position.y - z * 5;
    enemy.setPosition(x, y, z);
    this.enemies?.set(`${x},${y},${z}`, enemy);
    this.characterContainer?.addChild(sprite);
    this.sortCharacters();

    enemy.setClickHandler(() => {
      this.onEnemySelect(enemy);
    });
    return enemy;
  }

  public removeEnemy(enemy: Enemy) {
    const key = `${enemy.getPosition().x},${enemy.getPosition().y},${enemy.getPosition().z}`;

    if (this.enemies?.has(key)) {
      enemy.deleteEnemy();
      this.enemies.delete(key);
      this.characterContainer?.removeChild(enemy.getSprite());
      this.sortCharacters();
      console.log('Enemy removed successfully');
    } else {
      console.log('Enemy not found in the enemies map');
    }
  }
  public getAllEnemies(): Enemy[] | false {
    if (this.enemies) {
      return Array.from(this.enemies.values());
    } else {
      return false;
    }
  }
  public addObject(gameObject: GameObject) {
    const position = gameObject.getPosition();
    const key = `${position.x},${position.y},${position.z}`;
    this.objects.set(key, gameObject);
    this.characterContainer?.addChild(gameObject.getSprite());
    this.sortCharacters();
  }

  public removeGameObject(x: number, y: number, z: number): void {
    const key = `${x},${y},${z}`;
    const gameObject = this.objects.get(key);
    if (gameObject) {
      this.characterContainer?.removeChild(gameObject.getSprite());
      this.objects.delete(key);
      this.sortCharacters();
    }
  }

  public setOnEnemySelect(callback: (enemy: Enemy) => void) {
    this.onEnemySelect = callback;
  }

  //深度ソート
  private sortCharacters() {
    // this.characterContainer?.children.sort((a, b) => a.y - b.y);

    const allSprites = [...this.characterContainer!.children];
    allSprites.sort((a, b) => {
      const aY = a.y + a.height / 2;
      const bY = b.y + b.height / 2;
      return aY - bY;
    });
    this.characterContainer!.children = allSprites;
  }

  // 新しいメソッド: 指定された位置が占有されているかチェック
  private isOccupied(x: number, y: number, z: number): boolean {
    // キャラクターの位置をチェック
    for (const character of this.characters.values()) {
      const pos = character.getPosition();
      if (pos.x === x && pos.y === y && pos.z === z) {
        return true;
      }
    }
    // エネミーの位置をチェック
    const key = `${x},${y},${z}`;
    return this.enemies?.has(key) ?? false;

    return false;
  }

  public isPositionOccupied(x: number, y: number, z: number): boolean {
    for (const character of this.characters.values()) {
      const pos = character.getPosition();
      if (pos.x === x && pos.y === y && pos.z === z) {
        return true;
      }
    }
    return false;
  }

  public async moveCharacter(
    character: Character | Enemy,
    targetX: number,
    targetY: number,
    targetZ: number
  ): Promise<void> {
    if (
      !this.isValidMove(targetX, targetY, targetZ) ||
      this.isOccupied(targetX, targetY, targetZ)
    ) {
      // console.log('Invalid move or occupied position');
      return Promise.resolve();
    }

    const startPosition = character.getPosition();
    const targetPosition = this.isometricToScreen(targetX, targetY);

    // 現在の位置から character を削除
    if (character instanceof Enemy) {
      this.enemies?.delete(`${startPosition.x},${startPosition.y},${startPosition.z}`);
    } else {
      this.characters.delete(character.getId());
    }

    await character.move(targetPosition.x, targetPosition.y - targetZ * 5, 0);
    character.setPosition(targetX, targetY, targetZ);

    // 新しい位置に character を追加
    if (character instanceof Enemy) {
      this.enemies?.set(`${targetX},${targetY},${targetZ}`, character);
    } else {
      this.characters.set(character.getId(), character);
    }

    if (character === this.followTarget) {
      this.updateCameraPosition();
    }

    const event = this.events.get(`${targetX},${targetY},${targetZ}`);
    if (event) {
      event();
    }

    this.sortCharacters(); // キャラクターの深度ソートを行う
  }

  public isValidMove(x: number, y: number, z: number): boolean {
    // マップの境界チェック
    if (x < 0 || x >= this.tileMap[0].length || y < 0 || y >= this.tileMap.length) {
      return false;
    }

    // タイルの存在チェック
    // if (!this.tileMap[y] || !this.tileMap[y][x] || !this.tileMap[y][x][z]) {
    if (!this.tileMap[y] || !this.tileMap[y][x] || !this.tileMap[y][x][0]) {
      return false;
    }

    // タイルが移動可能かチェック（例：EMPTYタイプは移動不可）
    const tileType = this.tileMap[y][x][0].type;
    if (tileType === TileType.EMPTY) {
      return false;
    }

    // 他のキャラクターとの衝突チェック
    if (this.isPositionOccupied(x, y, z)) {
      return false;
    }

    // GameObjectとの衝突チェック
    if (this.objects.has(`${x},${y},${z}`)) {
      return false;
    }

    return true;
  }

  public changeCharacterDirection(character: Character, direction: Direction): void {
    character.setDirection(direction);
    // this.updateCharacterSprite(character);
  }

  public getAttackTargetPosition(character: Character): {
    x: number;
    y: number;
    z: number;
  } {
    const position = character.getPosition();
    const direction = character.getDirection();

    switch (direction) {
      case 'up':
        return { ...position, y: position.y - 1 };
      case 'down':
        return { ...position, y: position.y + 1 };
      case 'left':
        return { ...position, x: position.x - 1 };
      case 'right':
        return { ...position, x: position.x + 1 };
      default:
        return { ...position }; // デフォルトケースを追加
    }
  }
  public getTileHeight(): number {
    return this.tileSize.height;
  }
  public isometricToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: ((x - y) * this.tileSize.width) / 2,
      y: ((x + y) * this.tileSize.height) / 3,
    };
  }

  public screenToIsometric(screenX: number, screenY: number): { x: number; y: number } {
    const tileWidth = this.tileSize.width;
    const tileHeight = this.tileSize.height;

    // Adjust for the tile's center point
    screenX += tileWidth / 2;
    screenY += tileHeight / 2;

    const x = (screenX / (tileWidth / 2) + screenY / (tileHeight / 3)) / 2 - 1;
    const y = (screenY / (tileHeight / 3) - screenX / (tileWidth / 2)) / 2;
    return { x, y };
  }

  // クリックされたタイルの座標を取得するメソッド
  public getTileCoordinates(screenX: number, screenY: number): { x: number; y: number } {
    const localPosition = this.camera.toLocal(new PIXI.Point(screenX, screenY));
    return this.screenToIsometric(localPosition.x, localPosition.y);
  }

  public setOnCharacterSelect(callback: (character: Character) => void) {
    this.onCharacterSelect = callback;
  }

  public getCharacterAt(x: number, y: number, z: number): Character | Enemy | null {
    for (const character of this.characters.values()) {
      const pos = character.getPosition();
      if (pos.x === x && pos.y === y && pos.z === z) {
        return character;
      }
    }

    for (const enemy of this.enemies?.values() || []) {
      const pos = enemy.getPosition();
      if (pos.x === x && pos.y === y && pos.z === z) {
        return enemy;
      }
    }

    return null;
  }

  private updateVisibleTiles(): void {
    const visibleTiles = this.getVisibleTiles();

    for (let y = 0; y < this.stageData.length; y++) {
      if (!this.tileMap[y]) continue; // この行を追加
      for (let x = 0; x < this.stageData[y].length; x++) {
        if (!this.tileMap[y][x]) continue; // この行を追加
        const tile = this.tileMap[y][x][0];
        if (!tile) continue; // この行を追加
        if (tile && tile.sprite) {
          if (visibleTiles.has(`${x},${y}`)) {
            tile.sprite.visible = true;
          } else {
            tile.sprite.visible = false;
          }
        }
      }
    }
  }

  private getVisibleTiles(): Set<string> {
    const visibleTiles = new Set<string>();
    const cameraX = -this.camera.x;
    const cameraY = -this.camera.y;

    // アイソメトリックビューの変換係数
    const isoX = this.tileSize.width / 2;
    const isoY = this.tileSize.height / 2;

    // ビューポートの四隅の座標をアイソメトリック座標系に変換
    const corners = [
      this.screenToIso(cameraX, cameraY),
      this.screenToIso(cameraX + this.viewportWidth, cameraY),
      this.screenToIso(cameraX, cameraY + this.viewportHeight),
      this.screenToIso(cameraX + this.viewportWidth, cameraY + this.viewportHeight),
    ];

    // 表示範囲の境界を計算
    const minX = Math.floor(Math.min(...corners.map((c) => c.x))) - 1;
    const maxX = Math.ceil(Math.max(...corners.map((c) => c.x))) + 1;
    const minY = Math.floor(Math.min(...corners.map((c) => c.y))) - 1;
    const maxY = Math.ceil(Math.max(...corners.map((c) => c.y))) + 1;

    // 表示範囲内のタイルを追加
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x >= 0 && x < this.stageData[0].length && y >= 0 && y < this.stageData.length) {
          visibleTiles.add(`${x},${y}`);
        }
      }
    }

    return visibleTiles;
  }

  public screenToIso(screenX: number, screenY: number): { x: number; y: number } {
    const isoX = this.tileSize.width / 2;
    const isoY = this.tileSize.height / 3;
    return {
      x: (screenX / isoX + screenY / isoY) / 3,
      y: (screenY / isoY - screenX / isoX) / 2,
    };
  }

  public setPlayer(player: Character): void {
    this.player = player;
  }

  public getPlayer(): Character | null {
    return this.player;
  }

  //距離を取得する
  public getDistance(
    pos1: { x: number; y: number; z: number },
    pos2: { x: number; y: number; z: number }
  ): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) + Math.abs(pos1.z - pos2.z);
  }

  public canMoveTo(x: number, y: number, z: number): boolean {
    console.log(`Checking if can move to: (${x}, ${y}, ${z})`);

    // マップの境界チェック
    if (x < 0 || x >= this.stageData[0].length || y < 0 || y >= this.stageData.length) {
      return false;
    }

    // タイルの存在チェック
    if (!this.tileMap[y] || !this.tileMap[y][x] || !this.tileMap[y][x][z]) {
      return false;
    }

    // タイルが移動可能かチェック（例：EMPTYタイプは移動不可）
    const tileType = this.tileMap[y][x][z].type;
    if (tileType === TileType.EMPTY) {
      return false;
    }

    // 他のキャラクターやエネミーとの衝突チェック
    // if (this.isOccupied(x, y, z)) {
    //   return false;
    // }

    return true;
  }

  public findPath(
    start: { x: number; y: number; z: number },
    goal: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number }[] {
    const openSet: Node[] = [];
    const closedSet: Set<string> = new Set();
    const startNode = new Node(start.x, start.y, start.z);
    const goalNode = new Node(goal.x, goal.y, goal.z);

    startNode.g = 0;
    startNode.h = this.heuristic(startNode, goalNode);
    startNode.f = startNode.g + startNode.h;

    openSet.push(startNode);

    while (openSet.length > 0) {
      const currentNode = this.getLowestFScoreNode(openSet);

      if (this.isGoal(currentNode, goalNode)) {
        return this.reconstructPath(currentNode);
      }

      this.removeFromArray(openSet, currentNode);
      closedSet.add(this.nodeToString(currentNode));

      const neighbors = this.getNeighbors(currentNode);

      for (const neighbor of neighbors) {
        if (closedSet.has(this.nodeToString(neighbor))) {
          continue;
        }

        const tentativeGScore = currentNode.g + 1;

        if (!this.isInOpenSet(openSet, neighbor)) {
          openSet.push(neighbor);
        } else if (tentativeGScore >= neighbor.g) {
          continue;
        }

        neighbor.parent = currentNode;
        neighbor.g = tentativeGScore;
        neighbor.h = this.heuristic(neighbor, goalNode);
        neighbor.f = neighbor.g + neighbor.h;
      }
    }

    return []; // パスが見つからない場合
  }

  private getLowestFScoreNode(nodes: Node[]): Node {
    return nodes.reduce((lowest, node) => (node.f < lowest.f ? node : lowest));
  }

  private isGoal(node: Node, goal: Node): boolean {
    return node.x === goal.x && node.y === goal.y && node.z === goal.z;
  }

  private removeFromArray(arr: Node[], node: Node): void {
    const index = arr.indexOf(node);
    if (index > -1) {
      arr.splice(index, 1);
    }
  }

  private isInOpenSet(openSet: Node[], node: Node): boolean {
    return openSet.some((n) => n.x === node.x && n.y === node.y && n.z === node.z);
  }

  private nodeToString(node: Node): string {
    return `${node.x},${node.y},${node.z}`;
  }

  private reconstructPath(node: Node): { x: number; y: number; z: number }[] {
    const path = [];
    let current: Node | null = node;
    while (current != null) {
      path.unshift({ x: current.x, y: current.y, z: current.z });
      current = current.parent;
    }
    return path;
  }

  private getNeighbors(node: Node): Node[] {
    const neighbors: Node[] = [];
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (const dir of directions) {
      const newX = node.x + dir.dx;
      const newY = node.y + dir.dy;

      if (this.isWalkable(newX, newY, node.z)) {
        neighbors.push(new Node(newX, newY, node.z));
      }
    }

    return neighbors;
  }

  private heuristic(a: Node, b: Node): number {
    // マンハッタン距離を使用
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
  }

  //マップ内のランダムな歩行可能なタイルを返す
  public getRandomWalkableTile(): { x: number; y: number } {
    const walkableTiles: { x: number; y: number }[] = [];

    for (let y = 0; y < this.tileMap.length; y++) {
      for (let x = 0; x < this.tileMap[y].length; x++) {
        if (this.isWalkable(x, y, 0)) {
          walkableTiles.push({ x, y });
        }
      }
    }

    if (walkableTiles.length === 0) {
      throw new Error('No walkable tiles found in the map');
    }

    const randomIndex = Math.floor(Math.random() * walkableTiles.length);
    return walkableTiles[randomIndex];
  }

  //指定された座標のタイルが歩行可能かどうかを判断
  public isWalkable(x: number, y: number, z: number): boolean {
    if (!this.tileMap[y] || !this.tileMap[y][x] || !this.tileMap[y][x][z]) {
      return false;
    }

    const tileType = this.tileMap[y][x][z].type;
    return tileType === TileType.GRASS || tileType === TileType.WATER;
  }
}

class Node {
  x: number;
  y: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.g = 0;
    this.h = 0;
    this.f = 0;
    this.parent = null;
  }

  equals(other: Node): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }
}
