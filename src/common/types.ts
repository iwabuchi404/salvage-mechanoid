import * as PIXI from 'pixi.js';
import { Enemy } from './Enemy';
import { Stage } from './Stage';

//キャラクターの方向
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface EnemyBehavior {
  act(enemy: Enemy, stage: Stage): Promise<void>;
}

export interface EnemyType {
  name: string;
  baseHp: number;
  baseAttack: number;
  center?: { x: number; y: number };
  textures: { [key: string]: string };
  behavior: EnemyBehavior;
  // 追加のプロパティやメソッドをここに定義できます
}

// タイルの種類を定義する
// export enum TileType {
//   EMPTY = 0,
//   GRASS = 1,
//   WATER = 2,
//   MOUNTAIN = 3,
//   // 必要に応じて他のタイルタイプを追加
// }

export enum TileType {
  EMPTY = 0,
  GRASS = 1,
  WATER = 2,
  MOUNTAIN = 3,
  TILE = 4,
}

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

// 敵のタイプを定義するインターフェース
export interface EnemyType {
  name: string;
  baseHp: number;
  baseAttack: number;
  center?: { x: number; y: number };
  textures: { [key: string]: string };
}
