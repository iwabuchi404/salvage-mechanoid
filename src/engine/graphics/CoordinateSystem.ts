import { Vector2, Vector3 } from '../types';

/**
 * 座標変換システム - 異なる座標空間間の変換を処理
 */
export class CoordinateSystem {
  /**
   * コンストラクタ
   * @param tileWidth タイルの幅（ピクセル）
   * @param tileHeight タイルの高さ（ピクセル）
   */
  constructor(private tileWidth: number, private tileHeight: number) {
    console.log(`CoordinateSystem initialized with tile dimensions: ${tileWidth}x${tileHeight}`);
  }

  /**
   * アイソメトリック（マップ）座標をスクリーン座標に変換
   * @param x マップのX座標
   * @param y マップのY座標
   * @param z マップのZ座標（高さ）
   * @returns スクリーン座標
   */
  isometricToScreen(x: number, y: number, z = 0): Vector2 {
    return {
      x: ((x - y) * this.tileWidth) / 2,
      y: ((x + y) * this.tileHeight) / 3 - z * (this.tileHeight / 2),
    };
  }

  /**
   * スクリーン座標をアイソメトリック（マップ）座標に変換
   * @param screenX スクリーンのX座標
   * @param screenY スクリーンのY座標
   * @returns マップ座標（Z座標は含まない）
   */
  screenToIsometric(screenX: number, screenY: number): Vector2 {
    const x = (screenX / (this.tileWidth / 2) + screenY / (this.tileHeight / 3)) / 2;
    const y = (screenY / (this.tileHeight / 3) - screenX / (this.tileWidth / 2)) / 2;
    return { x, y };
  }

  /**
   * アイソメトリック座標のタイル位置を取得（整数化）
   * @param x マップのX座標
   * @param y マップのY座標
   * @returns タイル位置（整数化されたマップ座標）
   */
  getTilePosition(x: number, y: number): Vector2 {
    return {
      x: Math.floor(x),
      y: Math.floor(y),
    };
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

  /**
   * 指定した位置が隣接しているかどうかをチェック
   * @param pos1 1つ目の位置
   * @param pos2 2つ目の位置
   * @returns 隣接している場合はtrue
   */
  isAdjacent(pos1: Vector3, pos2: Vector3): boolean {
    // 同じZ座標であり、X/Y軸のいずれかで1マス離れている場合のみ隣接と見なす
    return (
      pos1.z === pos2.z &&
      ((Math.abs(pos1.x - pos2.x) === 1 && pos1.y === pos2.y) ||
        (Math.abs(pos1.y - pos2.y) === 1 && pos1.x === pos2.x))
    );
  }

  /**
   * タイルの幅を取得
   * @returns タイルの幅（ピクセル）
   */
  getTileWidth(): number {
    return this.tileWidth;
  }

  /**
   * タイルの高さを取得
   * @returns タイルの高さ（ピクセル）
   */
  getTileHeight(): number {
    return this.tileHeight;
  }

  /**
   * タイルのサイズを設定
   * @param width 新しいタイルの幅（ピクセル）
   * @param height 新しいタイルの高さ（ピクセル）
   */
  setTileSize(width: number, height: number): void {
    this.tileWidth = Math.max(1, width);
    this.tileHeight = Math.max(1, height);
    console.log(`Tile dimensions updated to: ${this.tileWidth}x${this.tileHeight}`);
  }
}
