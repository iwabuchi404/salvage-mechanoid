/**
 * 実効ステータスとして管理する値のキー。
 *
 * ここに無い値（score など）は StatsComponent の管理対象外とし、
 * 進行状態として別に保持する。
 *
 * BU-2 設計決定: level を StatKey に含める。
 * - level: レベルによるステータス成長を修飾子として表現するため。
 *
 * P0-2修正: strength を廃止し attackPower に一本化した。
 * 旧設計では strength（生の筋力）と attackPower（実効攻撃力）が独立したキー
 * だったが、strength をブーストしても attackPower に伝播しない問題があった。
 * UI・CombatSystem・アイテム効果すべて attackPower を見るように統一した。
 */
export type StatKey =
  | 'maxHp'
  | 'maxEnergy'
  | 'defense'
  | 'attackPower'
  | 'viewRadius'
  | 'moveSpeed'
  | 'carryCapacity'
  | 'level';

/** 修飾子の適用方法 */
export type StatOp = 'add' | 'multiply';

/**
 * ステータス修飾子。
 *
 * 装備・状態異常・永続強化など、あらゆる変化要因をこの形で表現する。
 * sourceId は同一要因の修飾子をまとめて外すために使う。
 */
export interface StatModifier {
  readonly stat: StatKey;
  readonly op: StatOp;
  readonly value: number;
  /** 修飾子の出所（例: "parts:head", "effect:poison", "item:strength_chip"） */
  readonly sourceId: string;
}

/** 修飾子を提供できるもの（装備、状態異常など） */
export interface StatSource {
  /** この要因を識別する ID（sourceId のプレフィックスに使う） */
  readonly sourceId: string;
  /** 現在の修飾子一覧を返す */
  getModifiers(): readonly StatModifier[];
}

/** 実効ステータス（導出結果） */
export type EffectiveStats = Readonly<Record<StatKey, number>>;
