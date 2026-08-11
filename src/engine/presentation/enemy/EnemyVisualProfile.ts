import { EnemyType, Direction } from '../../types';

/**
 * 敵の表示設定（PixiJS オブジェクトを含まない純粋データ）
 */
export interface EnemyVisualProfile {
  /** 方向別テクスチャパス */
  texturePaths: Record<Direction, string>;
  /** 初期テクスチャパス（方向未確定時） */
  defaultTexturePath: string;
  /** アンカーポイント（0,0 が左上、1,1 が右下） */
  anchor: { x: number; y: number };
  /** 描画レイヤー名 */
  layer: string;
}

/**
 * EnemyType ごとの表示プロファイル
 */
const PROFILES: Record<EnemyType, EnemyVisualProfile> = {
  [EnemyType.SCOUT]: {
    texturePaths: {
      up: './robo04_r.png',
      down: './robo04_l.png',
      left: './robo04_l.png',
      right: './robo04_r.png',
    },
    defaultTexturePath: './robo04_l.png',
    anchor: { x: 0.5, y: 1.0 },
    layer: 'characters',
  },
  [EnemyType.SOLDIER]: {
    texturePaths: {
      up: './robo03_r.png',
      down: './robo03_l.png',
      left: './robo03_l.png',
      right: './robo03_r.png',
    },
    defaultTexturePath: './robo03_l.png',
    anchor: { x: 0.5, y: 1.0 },
    layer: 'characters',
  },
  [EnemyType.HEAVY]: {
    texturePaths: {
      up: './robo02_r.png',
      down: './robo02_l.png',
      left: './robo02_l.png',
      right: './robo02_r.png',
    },
    defaultTexturePath: './robo02_l.png',
    anchor: { x: 0.5, y: 1.0 },
    layer: 'characters',
  },
};

/**
 * フォールバックプロファイル（未知の EnemyType 用）
 */
const FALLBACK_PROFILE: EnemyVisualProfile = PROFILES[EnemyType.HEAVY];

/**
 * EnemyType に対応する表示プロファイルを取得する（純粋関数）
 * @param enemyType 敵タイプ
 * @returns 表示プロファイル（未知のタイプの場合はフォールバック）
 */
export function getEnemyVisualProfile(enemyType: EnemyType): EnemyVisualProfile {
  return PROFILES[enemyType] ?? FALLBACK_PROFILE;
}

/**
 * EnemyType と方向からテクスチャパスを取得する（純粋関数）
 * @param enemyType 敵タイプ
 * @param direction 方向
 * @returns テクスチャパス
 */
export function getEnemyTexturePath(enemyType: EnemyType, direction: Direction): string {
  const profile = getEnemyVisualProfile(enemyType);
  return profile.texturePaths[direction] ?? profile.defaultTexturePath;
}
