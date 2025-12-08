import * as PIXI from 'pixi.js';

// 新システムの型定義をインポート
import { Direction, TileType } from '../engine/types';

// 新システムの型を再エクスポート
export { Direction, TileType };

// タイルを表す型
export type Tile = {
  type: TileType;
  height: number;
  sprite?: PIXI.Sprite;
  overlay?: PIXI.Graphics;
};

// タイルの情報を表す型
export type TileInfo = {
  type: TileType;
  name: string;
  effect: string;
  statModifier: { [key: string]: number };
};

export enum TurnPhase {
  PLAYER,
  ENEMY,
  END,
}

// ヘックス座標を表す型
export type HexCoord = { q: number; r: number; s: number };

// 敵のタイプ（旧システム用）
export interface EnemyType {
  name: string;
  baseHp: number;
  baseAttack: number;
  textures: {
    up: string;
    down: string;
    left: string;
    right: string;
  };
  center?: { x: number; y: number };
  behavior: EnemyBehavior;
}

// 敵の行動パターン（旧システム用）
export interface EnemyBehavior {
  act(enemy: any, stage: any): Promise<void>;
}
