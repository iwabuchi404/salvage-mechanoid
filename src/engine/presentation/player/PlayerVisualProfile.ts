import { Direction, LayerName } from '../../types';

/**
 * Player の表示設定（PixiJS オブジェクトを含まない純粋データ）
 *
 * C1: Player / Item の描画ライフサイクルを Presentation へ移す
 */
export interface PlayerVisualProfile {
  /** 方向別テクスチャパス */
  readonly texturePaths: Readonly<Record<Direction, string>>;
  /** 初期テクスチャパス（方向未確定時） */
  readonly defaultTexturePath: string;
  /** アンカーポイント（0,0 が左上、1,1 が右下） */
  readonly anchor: Readonly<{ x: number; y: number }>;
  /** 描画レイヤー名 */
  readonly layer: LayerName;
}

const PLAYER_PROFILE: PlayerVisualProfile = Object.freeze({
  texturePaths: Object.freeze({
    up: './robo01bk_r.png',
    down: './robo01_l.png',
    left: './robo01bk_l.png',
    right: './robo01_r.png',
  }),
  defaultTexturePath: './robo01_l.png',
  anchor: Object.freeze({ x: 0.5, y: 1.0 }),
  layer: LayerName.CHARACTERS,
});

/**
 * Player の表示プロファイルを取得する（純粋関数）
 */
export function getPlayerVisualProfile(): PlayerVisualProfile {
  return PLAYER_PROFILE;
}

/**
 * 方向からテクスチャパスを取得する（純粋関数）
 * @param direction 方向
 * @returns テクスチャパス
 */
export function getPlayerTexturePath(direction: Direction): string {
  return PLAYER_PROFILE.texturePaths[direction] ?? PLAYER_PROFILE.defaultTexturePath;
}
