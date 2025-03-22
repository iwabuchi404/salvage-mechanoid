import { Tile } from './Tile';
import { TileType, Vector2, Vector3 } from '../types';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';

/**
 * タイルマップクラス - ゲーム世界の地形を管理
 */
export class TileMap {
  // タイルのマップ（キー: "x,y,z", 値: Tile）
  private tiles: Map<string, Tile> = new Map();

  // マップの幅（タイル数）
  private width: number;

  // マップの高さ（タイル数）
  private height: number;

  // マップの深さ（レイヤー数）
  private depth = 1;

  // マップが有効かどうか
  private _active = true;

  /**
   * コンストラクタ
   * @param width マップの幅（タイル数）
   * @param height マップの高さ（タイル数）
   * @param depth マップの深さ（レイヤー数）
   */
  constructor(width: number, height: number, depth = 1) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.depth = Math.max(1, depth);

    console.log(`TileMap created with dimensions: ${width}x${height}x${depth}`);
  }

  /**
   * タイルの座標からユニークなキーを生成
   * @param x X座標
   * @param y Y座標
   * @param z Z座標（レイヤー）
   * @returns ユニークキー
   */
  private getTileKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  /**
   * タイルを設定
   * @param tile タイル
   */
  setTile(tile: Tile): void {
    const key = this.getTileKey(tile.position.x, tile.position.y, tile.position.z);
    this.tiles.set(key, tile);

    // タイル変更イベントを発行
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('tile_changed', {
        position: tile.position,
        type: tile.type,
      });
    }
  }

  /**
   * 位置から直接タイルを設定
   * @param x X座標
   * @param y Y座標
   * @param z Z座標（レイヤー）
   * @param type タイルタイプ
   * @param walkable 通行可能かどうか
   * @param properties 追加プロパティ
   * @returns 設定されたタイル
   */
  setTileAt(
    x: number,
    y: number,
    z = 0,
    type: TileType = TileType.EMPTY,
    walkable = false,
    properties: { [key: string]: any } = {}
  ): Tile {
    // 範囲外のチェック
    if (!this.isInBounds(x, y, z)) {
      throw new Error(`Tile position out of bounds: (${x}, ${y}, ${z})`);
    }

    const tile: Tile = {
      type,
      position: { x, y, z },
      walkable,
      properties: { ...properties },
    };

    this.setTile(tile);
    return tile;
  }

  /**
   * 指定位置のタイルを取得
   * @param x X座標
   * @param y Y座標
   * @param z Z座標（レイヤー）
   * @returns タイル、または undefined
   */
  getTile(x: number, y: number, z = 0): Tile | undefined {
    const key = this.getTileKey(x, y, z);
    return this.tiles.get(key);
  }

  /**
   * 指定位置が通行可能かどうかをチェック
   * @param x X座標
   * @param y Y座標
   * @param z Z座標（レイヤー）
   * @returns 通行可能な場合はtrue
   */
  isWalkable(x: number, y: number, z = 0): boolean {
    // 範囲外は通行不可
    if (!this.isInBounds(x, y, z)) {
      return false;
    }

    const tile = this.getTile(x, y, z);
    return tile ? tile.walkable : false;
  }

  /**
   * 指定位置がマップの範囲内かどうかをチェック
   * @param x X座標
   * @param y Y座標
   * @param z Z座標（レイヤー）
   * @returns 範囲内の場合はtrue
   */
  isInBounds(x: number, y: number, z = 0): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
  }

  /**
   * マップデータをインポート
   * @param data 2次元または3次元の配列（数値はTileType列挙型に対応）
   */
  importMapData(data: number[][] | number[][][]): void {
    // 2次元配列の場合、z=0のレイヤーとして処理
    if (data.length > 0 && !Array.isArray(data[0][0])) {
      const mapData = data as number[][];

      for (let y = 0; y < mapData.length; y++) {
        for (let x = 0; x < mapData[y].length; x++) {
          const tileType = mapData[y][x] as TileType;

          // EMPTYタイル以外を設定（EMPTYは通常スキップ）
          if (tileType !== TileType.EMPTY) {
            // タイルタイプによって通行可能かどうかを設定
            const walkable = this.isTypeWalkable(tileType);
            this.setTileAt(x, y, 0, tileType, walkable);
          }
        }
      }
    } else {
      // 3次元配列の場合、z方向もループ
      const mapData = data as number[][][];

      for (let z = 0; z < mapData.length; z++) {
        for (let y = 0; y < mapData[z].length; y++) {
          for (let x = 0; x < mapData[z][y].length; x++) {
            const tileType = mapData[z][y][x] as TileType;

            if (tileType !== TileType.EMPTY) {
              const walkable = this.isTypeWalkable(tileType);
              this.setTileAt(x, y, z, tileType, walkable);
            }
          }
        }
      }
    }

    console.log(`Map data imported, total tiles: ${this.tiles.size}`);
  }

  /**
   * タイルタイプが通行可能かどうかを判定
   * @param type タイルタイプ
   * @returns 通行可能な場合はtrue
   */
  private isTypeWalkable(type: TileType): boolean {
    // タイルタイプに応じて通行可能かどうかを判定
    // 実装に応じてカスタマイズ可能
    switch (type) {
      case TileType.GRASS:
      case TileType.TILE:
      case TileType.PORTAL:
      case TileType.HEAL:
        return true;

      case TileType.EMPTY:
      case TileType.WATER:
      case TileType.MOUNTAIN:
      case TileType.DAMAGE:
        return false;

      default:
        return false;
    }
  }

  /**
   * マップのサイズを取得
   * @returns マップのサイズ
   */
  getSize(): { width: number; height: number; depth: number } {
    return {
      width: this.width,
      height: this.height,
      depth: this.depth,
    };
  }

  /**
   * マップをクリア
   */
  clear(): void {
    this.tiles.clear();
    console.log('TileMap cleared');
  }

  /**
   * 特定種類のタイルのすべての位置を取得
   * @param type 検索するタイルタイプ
   * @returns 位置の配列
   */
  findTilesByType(type: TileType): Vector3[] {
    const result: Vector3[] = [];

    for (const tile of this.tiles.values()) {
      if (tile.type === type) {
        result.push({ ...tile.position });
      }
    }

    return result;
  }

  /**
   * マップが有効かどうかを取得
   */
  get active(): boolean {
    return this._active;
  }

  /**
   * マップの有効・無効を設定
   */
  set active(value: boolean) {
    this._active = value;
  }

  /**
   * 指定位置の周辺タイルを取得
   * @param x 中心X座標
   * @param y 中心Y座標
   * @param z Z座標（レイヤー）
   * @param radius 取得する半径
   * @returns 範囲内のタイルの配列
   */
  getTilesInRange(x: number, y: number, z = 0, radius = 1): Tile[] {
    const result: Tile[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = x + dx;
        const ty = y + dy;

        if (this.isInBounds(tx, ty, z)) {
          const tile = this.getTile(tx, ty, z);
          if (tile) {
            result.push(tile);
          }
        }
      }
    }

    return result;
  }

  /**
   * 指定位置から最も近いタイプのタイルを検索
   * @param x 開始X座標
   * @param y 開始Y座標
   * @param z Z座標（レイヤー）
   * @param type 検索するタイルタイプ
   * @param maxDistance 最大検索距離
   * @returns 最も近いタイルの位置、または見つからない場合はnull
   */
  findNearestTileOfType(
    x: number,
    y: number,
    z = 0,
    type: TileType,
    maxDistance: number = Number.MAX_SAFE_INTEGER
  ): Vector3 | null {
    // シンプルな実装: マンハッタン距離でソート
    const tilesOfType = this.findTilesByType(type);

    if (tilesOfType.length === 0) {
      return null;
    }

    let nearestTile: Vector3 | null = null;
    let shortestDistance = Number.MAX_SAFE_INTEGER;

    for (const tilePos of tilesOfType) {
      if (tilePos.z !== z) continue; // 同じレイヤーのみを考慮

      const distance = Math.abs(tilePos.x - x) + Math.abs(tilePos.y - y);

      if (distance <= maxDistance && distance < shortestDistance) {
        shortestDistance = distance;
        nearestTile = tilePos;
      }
    }

    return nearestTile;
  }

  /**
   * 2点間のマンハッタン距離を計算
   * @param pos1 1つ目の位置
   * @param pos2 2つ目の位置
   * @returns マンハッタン距離
   */
  getDistance(pos1: Vector3, pos2: Vector3): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) + Math.abs(pos1.z - pos2.z);
  }
}
