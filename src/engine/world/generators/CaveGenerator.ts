import { BaseRoomGenerator } from './BaseGenerator';
import {
  RoomGenerationConfig,
  RoomGenerationResult,
  Room,
  RoomType,
} from '../MapGeneratorInterface';
import { MapGenerationAlgorithm } from '../../types';

/**
 * 洞窟生成アルゴリズム
 * Cellular Automataによる有機的な洞窟構造生成
 */
export class CaveGenerator extends BaseRoomGenerator {
  private iterations = 5;
  private wallProbability = 0.45;

  generate(config: RoomGenerationConfig): RoomGenerationResult {
    const startTime = performance.now();

    // 1. 初期グリッドの生成
    let grid = this.generateInitialGrid(config);

    // 2. Cellular Automataの複数イテレーション適用
    for (let i = 0; i < this.iterations; i++) {
      grid = this.applyCellularRules(grid, config);
    }

    // 3. 洞窟を部屋に変換
    const rooms = this.extractRoomsFromCave(grid, config);

    const endTime = performance.now();

    return {
      rooms: rooms,
      metadata: {
        algorithm: 'cellular',
        parameters: config,
        generationTime: endTime - startTime,
        seed: this.seed,
      },
    };
  }

  getGeneratorType(): string {
    return MapGenerationAlgorithm.CELLULAR_AUTOMATA;
  }

  getSupportedParameters(): string[] {
    return ['minSize', 'maxSize', 'density', 'connectivity', 'roomTypes'];
  }

  getDescription(): string {
    return 'Cellular Automata algorithm for organic cave generation';
  }

  /**
   * 初期グリッドの生成
   * @param config 生成設定
   * @returns 初期グリッド
   */
  private generateInitialGrid(config: RoomGenerationConfig): number[][] {
    const grid: number[][] = [];

    for (let y = 0; y < this.height; y++) {
      grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        // 壁の確率で初期化
        const isWall = this.random() < this.wallProbability;
        grid[y][x] = isWall ? 3 : 0; // 3=壁, 0=空
      }
    }

    return grid;
  }

  /**
   * Cellular Automataルールの適用
   * @param grid 現在のグリッド
   * @param config 生成設定
   * @returns 新しいグリッド
   */
  private applyCellularRules(grid: number[][], config: RoomGenerationConfig): number[][] {
    const newGrid: number[][] = [];

    for (let y = 0; y < this.height; y++) {
      newGrid[y] = [];
      for (let x = 0; x < this.width; x++) {
        const neighbors = this.countWallNeighbors(grid, x, y);

        // Conway's Game of Lifeルール適用
        if (grid[y][x] === 3) {
          // 壁の場合
          // 3つ以上の近傍壁があれば壁のまま、それ以外は空に
          newGrid[y][x] = neighbors >= 3 ? 3 : 0;
        } else {
          // 空の場合
          // 3つ以上の近傍壁があれば壁に、それ以外は空のまま
          newGrid[y][x] = neighbors >= 3 ? 3 : 0;
        }
      }
    }

    return newGrid;
  }

  /**
   * 壁の近傍数をカウント
   * @param grid グリッド
   * @param x X座標
   * @param y Y座標
   * @returns 壁の近傍数
   */
  private countWallNeighbors(grid: number[][], x: number, y: number): number {
    let count = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue; // 自分自身はカウントしない

        const nx = x + dx;
        const ny = y + dy;

        if (this.isInBounds(nx, ny) && grid[ny][nx] === 3) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * 洞窟から部屋を抽出
   * @param grid 洞窟グリッド
   * @param config 生成設定
   * @returns 部屋のリスト
   */
  private extractRoomsFromCave(grid: number[][], config: RoomGenerationConfig): Room[] {
    const rooms: Room[] = [];
    const visited: boolean[][] = [];

    // 訪問配列の初期化
    for (let y = 0; y < this.height; y++) {
      visited[y] = [];
      for (let x = 0; x < this.width; x++) {
        visited[y][x] = false;
      }
    }

    // すべての空の領域を検索
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (grid[y][x] === 0 && !visited[y][x]) {
          const room = this.floodFill(grid, visited, x, y, config);
          if (room) {
            rooms.push(room);
          }
        }
      }
    }

    return rooms;
  }

  /**
   * 洪水塗りつぶしによる領域抽出
   * @param grid グリッド
   * @param visited 訪問配列
   * @param startX 開始X座標
   * @param startY 開始Y座標
   * @param config 生成設定
   * @returns 部屋情報
   */
  private floodFill(
    grid: number[][],
    visited: boolean[][],
    startX: number,
    startY: number,
    config: RoomGenerationConfig
  ): Room | null {
    const points: { x: number; y: number }[] = [];
    const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];

    let minX = startX,
      maxX = startX;
    let minY = startY,
      maxY = startY;

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;

      if (visited[y][x] || grid[y][x] !== 0) {
        continue;
      }

      visited[y][x] = true;
      points.push({ x, y });

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // 4方向の隣接セルをチェック
      const neighbors = [
        { x: x + 1, y: y },
        { x: x - 1, y: y },
        { x: x, y: y + 1 },
        { x: x, y: y - 1 },
      ];

      for (const neighbor of neighbors) {
        if (
          this.isInBounds(neighbor.x, neighbor.y) &&
          !visited[neighbor.y][neighbor.x] &&
          grid[neighbor.y][neighbor.x] === 0
        ) {
          stack.push(neighbor);
        }
      }
    }

    // 領域のサイズが最小サイズ以上かチェック
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    if (width < config.minSize || height < config.minSize) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: width,
      height: height,
      type: RoomType.NORMAL,
      connections: [],
      features: [],
      customData: { generationMethod: 'cellular' },
    };
  }
}
