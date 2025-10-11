import { Vector2 } from '../../types';

/**
 * A*パスファインディングのノード
 */
export class AStarNode {
  public position: Vector2;
  public gScore: number; // 開始点からの実際のコスト
  public hScore: number; // ゴールまでのヒューリスティックコスト
  public fScore: number; // g + h
  public parent: AStarNode | null;
  public isWalkable: boolean;

  constructor(x: number, y: number, walkable = true) {
    this.position = { x, y };
    this.gScore = Infinity;
    this.hScore = 0;
    this.fScore = Infinity;
    this.parent = null;
    this.isWalkable = walkable;
  }

  /**
   * fScoreを更新
   */
  updateFScore(): void {
    this.fScore = this.gScore + this.hScore;
  }
}

/**
 * 優先度キュー（最小ヒープ）
 */
export class PriorityQueue<T> {
  private items: Array<{ element: T; priority: number }> = [];

  /**
   * 要素を追加
   * @param element 要素
   * @param priority 優先度（小さいほど高優先）
   */
  enqueue(element: T, priority: number): void {
    this.items.push({ element, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 最高優先度の要素を取得・削除
   * @returns 要素（キューが空の場合はundefined）
   */
  dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.element;
  }

  /**
   * キューが空かどうか
   * @returns 空の場合true
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * キューのサイズ
   * @returns 要素数
   */
  size(): number {
    return this.items.length;
  }
}

/**
 * A*パスファインディングアルゴリズム
 */
export class AStar {
  private width: number;
  private height: number;
  private nodes: AStarNode[][];
  private allowDiagonal: boolean;

  /**
   * コンストラクタ
   * @param width マップの幅
   * @param height マップの高さ
   * @param allowDiagonal 対角線移動を許可するか
   */
  constructor(width: number, height: number, allowDiagonal = false) {
    this.width = width;
    this.height = height;
    this.allowDiagonal = allowDiagonal;
    this.nodes = [];
    this.initializeNodes();
  }

  /**
   * ノードグリッドを初期化
   */
  private initializeNodes(): void {
    this.nodes = [];
    for (let y = 0; y < this.height; y++) {
      this.nodes[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.nodes[y][x] = new AStarNode(x, y, true);
      }
    }
  }

  /**
   * 障害物を設定
   * @param obstacles 障害物の座標リスト
   */
  setObstacles(obstacles: Vector2[]): void {
    // 全ノードを歩行可能にリセット
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.nodes[y][x].isWalkable = true;
      }
    }

    // 障害物を設定
    for (const obstacle of obstacles) {
      if (this.isInBounds(obstacle.x, obstacle.y)) {
        this.nodes[obstacle.y][obstacle.x].isWalkable = false;
      }
    }
  }

  /**
   * マップデータから障害物を設定
   * @param mapData マップデータ（0=歩行可能, 0以外=障害物）
   * @param walkableTiles 歩行可能なタイルタイプのリスト
   */
  setObstaclesFromMap(mapData: number[][], walkableTiles: number[] = [0, 1]): void {
    for (let y = 0; y < Math.min(mapData.length, this.height); y++) {
      for (let x = 0; x < Math.min(mapData[y].length, this.width); x++) {
        this.nodes[y][x].isWalkable = walkableTiles.includes(mapData[y][x]);
      }
    }
  }

  /**
   * 経路を探索
   * @param start 開始点
   * @param goal 目標点
   * @returns 経路（見つからない場合は空配列）
   */
  findPath(start: Vector2, goal: Vector2): Vector2[] {
    // 範囲チェック
    if (!this.isInBounds(start.x, start.y) || !this.isInBounds(goal.x, goal.y)) {
      return [];
    }

    // 開始点または目標点が歩行不可能
    if (!this.nodes[start.y][start.x].isWalkable || !this.nodes[goal.y][goal.x].isWalkable) {
      return [];
    }

    // ノードを初期化
    this.resetNodes();

    const startNode = this.nodes[start.y][start.x];

    // 開始ノードを設定
    startNode.gScore = 0;
    startNode.hScore = this.heuristic(start, goal);
    startNode.updateFScore();

    const openSet = new PriorityQueue<AStarNode>();
    const closedSet = new Set<string>();

    openSet.enqueue(startNode, startNode.fScore);

    while (!openSet.isEmpty()) {
      const current = openSet.dequeue();
      if (!current) break;

      const currentKey = this.nodeToKey(current);

      // 既に処理済み
      if (closedSet.has(currentKey)) continue;

      // クローズドセットに追加
      closedSet.add(currentKey);

      // ゴールに到達
      if (current.position.x === goal.x && current.position.y === goal.y) {
        return this.reconstructPath(current);
      }

      // 隣接ノードを探索
      const neighbors = this.getNeighbors(current);

      for (const neighbor of neighbors) {
        const neighborKey = this.nodeToKey(neighbor);

        // 既に処理済みまたは歩行不可能
        if (closedSet.has(neighborKey) || !neighbor.isWalkable) {
          continue;
        }

        // 移動コストを計算
        const moveCost = this.getMoveCost(current, neighbor);
        const tentativeGScore = current.gScore + moveCost;

        // より良い経路が見つかった
        if (tentativeGScore < neighbor.gScore) {
          neighbor.parent = current;
          neighbor.gScore = tentativeGScore;
          neighbor.hScore = this.heuristic(neighbor.position, goal);
          neighbor.updateFScore();

          openSet.enqueue(neighbor, neighbor.fScore);
        }
      }
    }

    // 経路が見つからない
    return [];
  }

  /**
   * ノードをリセット
   */
  private resetNodes(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const node = this.nodes[y][x];
        node.gScore = Infinity;
        node.hScore = 0;
        node.fScore = Infinity;
        node.parent = null;
      }
    }
  }

  /**
   * ヒューリスティック関数（マンハッタン距離またはユークリッド距離）
   * @param a 点A
   * @param b 点B
   * @returns ヒューリスティックコスト
   */
  private heuristic(a: Vector2, b: Vector2): number {
    if (this.allowDiagonal) {
      // ユークリッド距離
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    } else {
      // マンハッタン距離
      return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    }
  }

  /**
   * 移動コストを計算
   * @param from 移動元ノード
   * @param to 移動先ノード
   * @returns 移動コスト
   */
  private getMoveCost(from: AStarNode, to: AStarNode): number {
    const dx = Math.abs(to.position.x - from.position.x);
    const dy = Math.abs(to.position.y - from.position.y);

    // 対角線移動
    if (dx === 1 && dy === 1) {
      return Math.sqrt(2); // 約1.414
    }

    // 直線移動
    return 1;
  }

  /**
   * 隣接ノードを取得
   * @param node 中心ノード
   * @returns 隣接ノードのリスト
   */
  private getNeighbors(node: AStarNode): AStarNode[] {
    const neighbors: AStarNode[] = [];
    const directions = this.allowDiagonal
      ? [
          { x: -1, y: -1 },
          { x: 0, y: -1 },
          { x: 1, y: -1 },
          { x: -1, y: 0 },
          { x: 1, y: 0 },
          { x: -1, y: 1 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ]
      : [
          { x: 0, y: -1 }, // 上
          { x: -1, y: 0 }, // 左
          { x: 1, y: 0 }, // 右
          { x: 0, y: 1 }, // 下
        ];

    for (const dir of directions) {
      const x = node.position.x + dir.x;
      const y = node.position.y + dir.y;

      if (this.isInBounds(x, y)) {
        neighbors.push(this.nodes[y][x]);
      }
    }

    return neighbors;
  }

  /**
   * 経路を再構築
   * @param goalNode ゴールノード
   * @returns 経路（開始点からゴールまで）
   */
  private reconstructPath(goalNode: AStarNode): Vector2[] {
    const path: Vector2[] = [];
    let current: AStarNode | null = goalNode;

    while (current !== null) {
      path.unshift({ x: current.position.x, y: current.position.y });
      current = current.parent;
    }

    return path;
  }

  /**
   * 座標が範囲内かチェック
   * @param x X座標
   * @param y Y座標
   * @returns 範囲内の場合true
   */
  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * ノードをキー文字列に変換
   * @param node ノード
   * @returns キー文字列
   */
  private nodeToKey(node: AStarNode): string {
    return `${node.position.x},${node.position.y}`;
  }

  /**
   * 2点間の直線経路を生成（A*を使わない単純な線）
   * @param start 開始点
   * @param end 終了点
   * @returns 直線経路
   */
  generateStraightPath(start: Vector2, end: Vector2): Vector2[] {
    const path: Vector2[] = [];

    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const sx = start.x < end.x ? 1 : -1;
    const sy = start.y < end.y ? 1 : -1;

    let err = dx - dy;
    let x = start.x;
    let y = start.y;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      path.push({ x, y });

      if (x === end.x && y === end.y) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return path;
  }

  /**
   * マップサイズを更新
   * @param width 新しい幅
   * @param height 新しい高さ
   */
  updateSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.initializeNodes();
  }
}
