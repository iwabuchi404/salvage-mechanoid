import { EnemyType } from '../../types';

/**
 * 敵のステータスプロファイル（純粋データ）
 *
 * PixiJS・Engine へ依存しない純データとして、EnemyType ごとの
 * 基本ステータスを保持する。EnemyVisualProfile と対になる配置形式。
 *
 * C2: 敵ステータスを純データへ分離し、CombatSystem へ接続する
 */
export interface EnemyStatProfile {
  /** 最大HP（レベル適用前の基本値） */
  readonly baseMaxHealth: number;
  /** 防御力（レベル適用前の基本値） */
  readonly baseDefense: number;
  /** 移動速度（タイル/秒、レベル非依存・アニメーション用） */
  readonly moveSpeed: number;
  /** 攻撃力（レベル適用前の基本値） */
  readonly baseAttackPower: number;
  /**
   * スケジューラ用 行動速度（100系・レベル非依存）。
   * ACTION_THRESHOLD = 100 に対する毎 tick の蓄積量。
   * moveSpeed * 25 で算出: SCOUT(6)=150 / SOLDIER(4)=100 / HEAVY(2)=50。
   * BU-3 P1: 敵の速度差を有効にするため EnemyStatProfile へ追加。
   */
  readonly actionSpeed: number;
}

/**
 * レベル倍率を計算する（純粋関数）
 *
 * レベル1 = 1.0、レベル2 = 1.2、レベル3 = 1.4、…
 * Enemy.getEnemyStats() の旧ロジックと同じ計算式。
 *
 * @param level 敵のレベル（1以上を想定）
 * @returns レベル倍率
 */
export function getLevelMultiplier(level: number): number {
  return 1 + (level - 1) * 0.2;
}

/**
 * EnemyType ごとの基本ステータスプロファイル
 */
const PROFILES: Readonly<Record<EnemyType, EnemyStatProfile>> = Object.freeze({
  [EnemyType.SCOUT]: Object.freeze({
    baseMaxHealth: 30,
    baseDefense: 3,
    moveSpeed: 6,
    baseAttackPower: 5,
    actionSpeed: 150,
  }),
  [EnemyType.SOLDIER]: Object.freeze({
    baseMaxHealth: 50,
    baseDefense: 5,
    moveSpeed: 4,
    baseAttackPower: 10,
    actionSpeed: 100,
  }),
  [EnemyType.HEAVY]: Object.freeze({
    baseMaxHealth: 100,
    baseDefense: 10,
    moveSpeed: 2,
    baseAttackPower: 15,
    actionSpeed: 50,
  }),
});

/**
 * フォールバックプロファイル（未知の EnemyType 用）
 * P1-fix: 旧 Enemy.getEnemyStats() の default ブランチ（SOLDIER 相当）に戻す
 */
const FALLBACK_PROFILE: EnemyStatProfile = Object.freeze({
  baseMaxHealth: 50,
  baseDefense: 5,
  moveSpeed: 4,
  baseAttackPower: 10,
  actionSpeed: 100,
});

/**
 * EnemyType に対応する基本ステータスプロファイルを取得する（純粋関数）
 *
 * @param enemyType 敵タイプ
 * @returns ステータスプロファイル（未知のタイプの場合はフォールバック）
 */
export function getEnemyStatProfile(enemyType: EnemyType): EnemyStatProfile {
  return PROFILES[enemyType] ?? FALLBACK_PROFILE;
}

/**
 * レベル適用後の実効ステータス
 */
export interface EnemyStats {
  readonly maxHealth: number;
  readonly defense: number;
  readonly moveSpeed: number;
  readonly attackPower: number;
  /** スケジューラ用 行動速度（100系・レベル非依存） */
  readonly actionSpeed: number;
}

/**
 * EnemyType とレベルから実効ステータスを計算する（純粋関数）
 *
 * 旧 Enemy.getEnemyStats() と同じ値を返す。
 * maxHealth / defense / attackPower はレベル倍率を適用し、
 * moveSpeed / actionSpeed はレベル非依存。
 *
 * @param enemyType 敵タイプ
 * @param level レベル
 * @returns 実効ステータス
 */
export function resolveEnemyStats(enemyType: EnemyType, level: number): EnemyStats {
  const profile = getEnemyStatProfile(enemyType);
  const multiplier = getLevelMultiplier(level);

  return Object.freeze({
    maxHealth: Math.floor(profile.baseMaxHealth * multiplier),
    defense: Math.floor(profile.baseDefense * multiplier),
    moveSpeed: profile.moveSpeed,
    attackPower: Math.floor(profile.baseAttackPower * multiplier),
    actionSpeed: profile.actionSpeed,
  });
}
