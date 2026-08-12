import { Vector3 } from '../types';
import { CoordinateSystem } from '../graphics/CoordinateSystem';

/**
 * 通行可能性を判定する関数型。
 * PathfindingService は WorldSystem の衝突判定へ依存せず、
 * この関数経由でタイル+エンティティの通行可能性を受け取る。
 */
export type WalkableChecker = (x: number, y: number, z: number, excludeEntityId?: string) => boolean;

/**
 * PathfindingService - WorldSystem 内部で A* 経路探索を担当するモジュール。
 *
 * 経路探索はタイル通行可能性のみに依存し、WorldSystem の状態を持たない。
 * WorldSystem は isWalkable を WalkableChecker として注入して利用する。
 *
 * このクラスは WorldSystem の実装詳細であり、外部へ直接公開しない。
 */
export class PathfindingService {
  private readonly coordinateSystem: CoordinateSystem;
  private readonly walkable: WalkableChecker;

  constructor(coordinateSystem: CoordinateSystem, walkable: WalkableChecker) {
    this.coordinateSystem = coordinateSystem;
    this.walkable = walkable;
  }

  /**
   * A*アルゴリズムによる経路探索
   * @param start 開始位置
   * @param goal 目標位置
   * @param maxDistance 最大検索距離
   * @param excludeEntityId 衝突判定から除外するエンティティID
   * @returns 経路の位置配列、見つからない場合は空配列
   */
  findPath(start: Vector3, goal: Vector3, maxDistance = 50, excludeEntityId?: string): Vector3[] {
    // 開始位置と目標位置が同じ場合は開始位置のみを返す
    if (start.x === goal.x && start.y === goal.y && start.z === goal.z) {
      return [{ ...start }];
    }

    // 2点間の距離が最大距離を超える場合は空配列を返す
    const distance = this.coordinateSystem.getDistance(start, goal);
    if (distance > maxDistance) {
      return [];
    }

    const openSet: PathNode[] = [];
    const closedSet: Set<string> = new Set();
    const startNode = new PathNode(start.x, start.y, start.z);
    const goalNode = new PathNode(goal.x, goal.y, goal.z);

    startNode.g = 0;
    startNode.h = this.heuristic(startNode, goalNode);
    startNode.f = startNode.g + startNode.h;

    openSet.push(startNode);

    while (openSet.length > 0) {
      const currentNode = this.getLowestFScoreNode(openSet);

      if (this.isGoalNode(currentNode, goalNode)) {
        return this.reconstructPath(currentNode);
      }

      this.removeFromArray(openSet, currentNode);
      closedSet.add(this.nodeToString(currentNode));

      const neighbors = this.getNeighborNodes(currentNode, excludeEntityId);

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

    return [];
  }

  private getLowestFScoreNode(nodes: PathNode[]): PathNode {
    return nodes.reduce((lowest, node) => (node.f < lowest.f ? node : lowest));
  }

  private isGoalNode(node: PathNode, goal: PathNode): boolean {
    return node.x === goal.x && node.y === goal.y && node.z === goal.z;
  }

  private removeFromArray(arr: PathNode[], node: PathNode): void {
    const index = arr.indexOf(node);
    if (index > -1) {
      arr.splice(index, 1);
    }
  }

  private isInOpenSet(openSet: PathNode[], node: PathNode): boolean {
    return openSet.some((n) => n.x === node.x && n.y === node.y && n.z === node.z);
  }

  private nodeToString(node: PathNode): string {
    return `${node.x},${node.y},${node.z}`;
  }

  private reconstructPath(node: PathNode): Vector3[] {
    const path: Vector3[] = [];
    let current: PathNode | null = node;
    while (current != null) {
      path.unshift({ x: current.x, y: current.y, z: current.z });
      current = current.parent;
    }
    return path;
  }

  private getNeighborNodes(node: PathNode, excludeEntityId?: string): PathNode[] {
    const neighbors: PathNode[] = [];
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (const dir of directions) {
      const newX = node.x + dir.dx;
      const newY = node.y + dir.dy;

      if (this.walkable(newX, newY, node.z, excludeEntityId)) {
        neighbors.push(new PathNode(newX, newY, node.z));
      }
    }

    return neighbors;
  }

  private heuristic(a: PathNode, b: PathNode): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
  }
}

/**
 * A*パスファインディング用のノードクラス
 */
class PathNode {
  x: number;
  y: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.g = 0;
    this.h = 0;
    this.f = 0;
    this.parent = null;
  }
}
