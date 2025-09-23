import { TileType } from '../types';

/**
 * 部屋の情報を表す型
 */
interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * マップジェネレータークラス - ランダムなダンジョンマップを生成
 */
export class MapGenerator {
  // マップの幅（タイル数）
  private width: number;

  // マップの高さ（タイル数）
  private height: number;

  // 最小の部屋サイズ
  private minRoomSize: number;

  // 最大の部屋サイズ
  private maxRoomSize: number;

  // 部屋間の最小距離
  private minRoomDistance: number;

  // 生成されたマップデータ
  private stageData: number[][];

  // 生成された部屋のリスト
  private rooms: Room[];

  /**
   * コンストラクタ
   * @param width マップの幅（タイル数）
   * @param height マップの高さ（タイル数）
   * @param minRoomSize 最小の部屋サイズ
   * @param maxRoomSize 最大の部屋サイズ
   */
  constructor(width: number, height: number, minRoomSize: number, maxRoomSize: number) {
    this.width = Math.max(10, width);
    this.height = Math.max(10, height);
    this.minRoomSize = Math.max(3, minRoomSize);
    this.maxRoomSize = Math.max(this.minRoomSize, maxRoomSize);
    this.minRoomDistance = 3;
    this.stageData = [];
    this.rooms = [];

    console.log(`MapGenerator created with dimensions: ${width}x${height}`);
  }

  /**
   * ランダムなマップを生成
   * @returns 生成されたマップデータと部屋情報
   */
  generateMap(): { map: number[][]; rooms: Room[] } {
    console.log('Generating random map...');

    // マップを初期化（全てEMPTY）
    this.initializeMap();

    // 空間分割アルゴリズムを使用して部屋を生成
    this.splitSpace(0, 0, this.width, this.height, 0);

    // 部屋同士を接続する通路を生成
    this.connectRooms();

    // ランダムな特徴（水場、山など）を追加
    this.addRandomFeatures();

    console.log(`Map generated with ${this.rooms.length} rooms`);

    return {
      map: this.stageData,
      rooms: [...this.rooms]
    };
  }

  /**
   * マップを初期化（全てEMPTY）
   */
  private initializeMap() {
    this.stageData = [];
    for (let y = 0; y < this.height; y++) {
      this.stageData[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.stageData[y][x] = TileType.EMPTY;
      }
    }
  }

  /**
   * 空間分割アルゴリズムを使用して部屋を生成
   * @param x 領域のX開始位置
   * @param y 領域のY開始位置
   * @param width 領域の幅
   * @param height 領域の高さ
   * @param depth 再帰の深さ
   */
  private splitSpace(x: number, y: number, width: number, height: number, depth: number) {
    // 再帰の終了条件
    if (
      width < this.maxRoomSize * 2 + this.minRoomDistance ||
      height < this.maxRoomSize * 2 + this.minRoomDistance ||
      depth > 10
    ) {
      this.createRoom(x, y, width, height);
      return;
    }

    // 縦または横に分割
    const splitVertical = width > height;
    const splitPosition = splitVertical
      ? x + Math.floor(width / 2 + (Math.random() * 0.5 - 0.25) * width)
      : y + Math.floor(height / 2 + (Math.random() * 0.5 - 0.25) * height);

    if (splitVertical) {
      this.splitSpace(x, y, splitPosition - x, height, depth + 1);
      this.splitSpace(splitPosition, y, x + width - splitPosition, height, depth + 1);
    } else {
      this.splitSpace(x, y, width, splitPosition - y, depth + 1);
      this.splitSpace(x, splitPosition, width, y + height - splitPosition, depth + 1);
    }
  }

  /**
   * 領域内に部屋を作成
   * @param x 領域のX開始位置
   * @param y 領域のY開始位置
   * @param width 領域の幅
   * @param height 領域の高さ
   */
  private createRoom(x: number, y: number, width: number, height: number) {
    // 部屋のサイズを決定
    const roomWidth = Math.max(
      this.minRoomSize,
      Math.min(width - this.minRoomDistance * 2, this.maxRoomSize)
    );
    const roomHeight = Math.max(
      this.minRoomSize,
      Math.min(height - this.minRoomDistance * 2, this.maxRoomSize)
    );

    // 部屋の位置を決定
    const roomX = Math.min(
      this.width - roomWidth - this.minRoomDistance,
      Math.max(this.minRoomDistance, x + Math.floor((width - roomWidth) / 2))
    );
    const roomY = Math.min(
      this.height - roomHeight - this.minRoomDistance,
      Math.max(this.minRoomDistance, y + Math.floor((height - roomHeight) / 2))
    );

    // 部屋を作成（GRASSタイル）
    for (let dy = 0; dy < roomHeight; dy++) {
      for (let dx = 0; dx < roomWidth; dx++) {
        if (roomY + dy < this.height && roomX + dx < this.width) {
          this.stageData[roomY + dy][roomX + dx] = TileType.GRASS;
        }
      }
    }

    // 部屋情報を保存
    this.rooms.push({
      x: roomX,
      y: roomY,
      width: roomWidth,
      height: roomHeight,
    });
  }

  /**
   * 部屋同士を接続する通路を生成
   */
  private connectRooms() {
    // X座標でソートした部屋のリスト
    const sortedRooms = [...this.rooms].sort((a, b) => a.x - b.x);

    // 隣接する部屋同士を接続
    for (let i = 0; i < sortedRooms.length - 1; i++) {
      const roomA = sortedRooms[i];
      const roomB = sortedRooms[i + 1];

      this.createCorridor(
        roomA.x + Math.floor(roomA.width / 2),
        roomA.y + Math.floor(roomA.height / 2),
        roomB.x + Math.floor(roomB.width / 2),
        roomB.y + Math.floor(roomB.height / 2)
      );
    }

    // ランダムに追加の接続を作成
    for (let i = 0; i < Math.floor(this.rooms.length / 2); i++) {
      const roomA = this.rooms[Math.floor(Math.random() * this.rooms.length)];
      const roomB = this.rooms[Math.floor(Math.random() * this.rooms.length)];

      if (roomA !== roomB) {
        this.createCorridor(
          roomA.x + Math.floor(roomA.width / 2),
          roomA.y + Math.floor(roomA.height / 2),
          roomB.x + Math.floor(roomB.width / 2),
          roomB.y + Math.floor(roomB.height / 2)
        );
      }
    }
  }

  /**
   * 2点間に通路を作成
   * @param x1 開始X座標
   * @param y1 開始Y座標
   * @param x2 終了X座標
   * @param y2 終了Y座標
   */
  private createCorridor(x1: number, y1: number, x2: number, y2: number) {
    let x = x1;
    let y = y1;

    // ランダムに水平か垂直方向に移動
    while (x !== x2 || y !== y2) {
      if (Math.random() < 0.5) {
        if (x < x2) x++;
        else if (x > x2) x--;
      } else {
        if (y < y2) y++;
        else if (y > y2) y--;
      }

      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        this.stageData[y][x] = TileType.GRASS;
      }
    }
  }

  /**
   * ランダムな特徴（水場、山など）を追加
   */
  private addRandomFeatures() {
    // 特徴の数を決定（マップサイズに比例）
    const featureCount = Math.floor(this.width * this.height * 0.01);

    for (let i = 0; i < featureCount; i++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);

      // GRASSタイルにのみ特徴を追加
      if (this.stageData[y][x] === TileType.GRASS) {
        // ランダムに水場か山を配置
        this.stageData[y][x] = Math.random() < 0.7 ? TileType.WATER : TileType.MOUNTAIN;
      }
    }
    // ポータルを配置（1〜3個）
    const portalCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < portalCount; i++) {
      const room = this.rooms[Math.floor(Math.random() * this.rooms.length)];
      const px = room.x + Math.floor(Math.random() * (room.width - 2)) + 1;
      const py = room.y + Math.floor(Math.random() * (room.height - 2)) + 1;

      if (this.stageData[py][px] === TileType.GRASS) {
        this.stageData[py][px] = TileType.PORTAL;
      }
    }

    // 回復マスを配置（1〜5個）
    const healCount = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < healCount; i++) {
      const room = this.rooms[Math.floor(Math.random() * this.rooms.length)];
      const hx = room.x + Math.floor(Math.random() * (room.width - 2)) + 1;
      const hy = room.y + Math.floor(Math.random() * (room.height - 2)) + 1;

      if (this.stageData[hy][hx] === TileType.GRASS) {
        this.stageData[hy][hx] = TileType.HEAL;
      }
    }
  }

  /**
   * 生成された部屋のリストを取得
   * @returns 部屋のリスト
   */
  getRooms(): Room[] {
    return [...this.rooms];
  }

  /**
   * 生成されたマップデータを取得
   * @returns マップデータ
   */
  getMapData(): number[][] {
    return this.stageData.map((row) => [...row]);
  }

  /**
   * マップの現在のサイズを取得
   * @returns マップのサイズ
   */
  getSize(): { width: number; height: number } {
    return {
      width: this.width,
      height: this.height,
    };
  }
}
