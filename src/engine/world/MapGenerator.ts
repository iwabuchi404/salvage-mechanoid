import { TileType, Room, RoomGenerationConfig, RoomType } from '../types';
import { BSPGenerator } from './generators/BSPGenerator';

/**
 * マップジェネレータークラス - 既存のインターフェース互換性を保持
 * 内部的にBSPGeneratorを使用
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

  // BSPジェネレーター
  private bspGenerator: BSPGenerator;

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

    // BSPジェネレーターを初期化
    this.bspGenerator = new BSPGenerator(this.width, this.height);

    console.log(`MapGenerator created with dimensions: ${width}x${height}`);
  }

  /**
   * ランダムなマップを生成
   * @returns 生成されたマップデータと部屋情報
   */
  generateMap(): { map: number[][]; rooms: Room[] } {
    console.log('Generating random map using BSP algorithm...');

    // BSPGeneratorを使用してマップを生成
    const config: RoomGenerationConfig = {
      minSize: this.minRoomSize,
      maxSize: this.maxRoomSize,
      density: 0.7,
      connectivity: 0.8,
      roomTypes: [
        RoomType.NORMAL,
        RoomType.BOSS,
        RoomType.TREASURE,
        RoomType.ENTRANCE,
        RoomType.EXIT,
      ],
    };

    const generationResult = this.bspGenerator.generate(config);

    // マップデータを初期化
    const map: number[][] = [];
    for (let y = 0; y < this.height; y++) {
      map[y] = [];
      for (let x = 0; x < this.width; x++) {
        map[y][x] = TileType.EMPTY;
      }
    }

    // 部屋をマップに描画
    for (const room of generationResult.rooms) {
      for (let dy = 0; dy < room.height; dy++) {
        for (let dx = 0; dx < room.width; dx++) {
          if (room.y + dy < this.height && room.x + dx < this.width) {
            map[room.y + dy][room.x + dx] = TileType.GRASS;
          }
        }
      }
    }

    // 通路を生成
    this.connectRooms(map, generationResult.rooms);

    // ランダムな特徴を追加
    this.addRandomFeatures(map);

    console.log(`Map generated with ${generationResult.rooms.length} rooms`);

    return {
      map: map,
      rooms: generationResult.rooms,
    };
  }

  /**
   * 部屋同士を接続する通路を生成
   * @param map マップデータ
   * @param rooms 部屋のリスト
   */
  private connectRooms(map: number[][], rooms: Room[]) {
    if (rooms.length < 2) return;

    // X座標でソートした部屋のリスト
    const sortedRooms = [...rooms].sort((a, b) => a.x - b.x);

    // 隣接する部屋同士を接続
    for (let i = 0; i < sortedRooms.length - 1; i++) {
      const roomA = sortedRooms[i];
      const roomB = sortedRooms[i + 1];

      this.createCorridor(
        map,
        roomA.x + Math.floor(roomA.width / 2),
        roomA.y + Math.floor(roomA.height / 2),
        roomB.x + Math.floor(roomB.width / 2),
        roomB.y + Math.floor(roomB.height / 2)
      );
    }

    // ランダムに追加の接続を作成
    for (let i = 0; i < Math.floor(rooms.length / 2); i++) {
      const roomA = rooms[Math.floor(Math.random() * rooms.length)];
      const roomB = rooms[Math.floor(Math.random() * rooms.length)];

      if (roomA !== roomB) {
        this.createCorridor(
          map,
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
   * @param map マップデータ
   * @param x1 開始X座標
   * @param y1 開始Y座標
   * @param x2 終了X座標
   * @param y2 終了Y座標
   */
  private createCorridor(map: number[][], x1: number, y1: number, x2: number, y2: number) {
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
        map[y][x] = TileType.GRASS;
      }
    }
  }

  /**
   * ランダムな特徴（水場、山など）を追加
   * @param map マップデータ
   */
  private addRandomFeatures(map: number[][]) {
    // 特徴の数を決定（マップサイズに比例）
    const featureCount = Math.floor(this.width * this.height * 0.01);

    for (let i = 0; i < featureCount; i++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);

      // GRASSタイルにのみ特徴を追加
      if (map[y][x] === TileType.GRASS) {
        // ランダムに水場か山を配置
        map[y][x] = Math.random() < 0.7 ? TileType.WATER : TileType.MOUNTAIN;
      }
    }
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
