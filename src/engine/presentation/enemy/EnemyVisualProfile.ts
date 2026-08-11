import { EnemyType, Direction, LayerName } from '../../types';

/**
 * 敵の表示設定（PixiJS オブジェクトを含まない純粋データ）
 */
export interface EnemyVisualProfile {
  /** 方向別テクスチャパス */
  readonly texturePaths: Readonly<Record<Direction, string>>;
  /** 初期テクスチャパス（方向未確定時） */
  readonly defaultTexturePath: string;
  /** アンカーポイント（0,0 が左上、1,1 が右下） */
  readonly anchor: Readonly<{ x: number; y: number }>;
  /** 描画レイヤー名 */
  readonly layer: LayerName;
}

function createProfile(textureBaseName: string): EnemyVisualProfile {
  const leftTexturePath = `./${textureBaseName}_l.png`;
  const rightTexturePath = `./${textureBaseName}_r.png`;

  return Object.freeze({
    texturePaths: Object.freeze({
      up: rightTexturePath,
      down: leftTexturePath,
      left: leftTexturePath,
      right: rightTexturePath,
    }),
    defaultTexturePath: leftTexturePath,
    anchor: Object.freeze({ x: 0.5, y: 1.0 }),
    layer: LayerName.CHARACTERS,
  });
}

/**
 * EnemyType ごとの表示プロファイル
 */
const PROFILES: Readonly<Record<EnemyType, EnemyVisualProfile>> = Object.freeze({
  [EnemyType.SCOUT]: createProfile('robo04'),
  [EnemyType.SOLDIER]: createProfile('robo03'),
  [EnemyType.HEAVY]: createProfile('robo02'),
});

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
