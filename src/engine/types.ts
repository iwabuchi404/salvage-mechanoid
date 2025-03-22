/**
 * エンジン全体で使用される共通の型定義
 */

/**
 * 2D位置を表す型
 */
export type Vector2 = {
  x: number;
  y: number;
};

/**
 * 3D位置を表す型
 */
export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

/**
 * サイズを表す型
 */
export type Size = {
  width: number;
  height: number;
};

/**
 * 矩形を表す型
 */
export type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * 色を表す型
 */
export type Color = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

/**
 * レイヤー名の列挙型
 */
export enum LayerName {
  BACKGROUND = 'background',
  TERRAIN = 'terrain',
  OBJECTS = 'objects',
  CHARACTERS = 'characters',
  EFFECTS = 'effects',
  UI = 'ui',
}

/**
 * イベント名の列挙型
 */
export enum EventName {
  // エンティティ関連イベント
  ENTITY_CREATED = 'entity_created',
  ENTITY_DESTROYED = 'entity_destroyed',
  ENTITY_MOVED = 'entity_moved',
  ENTITY_COLLISION = 'entity_collision',

  // ゲームステート関連イベント
  GAME_START = 'game_start',
  GAME_PAUSE = 'game_pause',
  GAME_RESUME = 'game_resume',
  GAME_OVER = 'game_over',

  // 入力関連イベント
  KEY_PRESSED = 'key_pressed',
  KEY_RELEASED = 'key_released',
  MOUSE_MOVED = 'mouse_moved',
  MOUSE_CLICKED = 'mouse_clicked',

  // UI関連イベント
  UI_BUTTON_CLICKED = 'ui_button_clicked',
  UI_WINDOW_OPENED = 'ui_window_opened',
  UI_WINDOW_CLOSED = 'ui_window_closed',
}

/**
 * タイルの種類を表す列挙型
 */
export enum TileType {
  EMPTY = 0,
  GRASS = 1,
  WATER = 2,
  MOUNTAIN = 3,
  TILE = 4,
  PORTAL = 5,
  DAMAGE = 6,
  HEAL = 7,
  EVENT = 8,
}

/**
 * キャラクターの向きを表す型
 */
export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * ターンフェーズを表す列挙型
 */
export enum TurnPhase {
  PLAYER = 0,
  ENEMY = 1,
  END = 2,
}
