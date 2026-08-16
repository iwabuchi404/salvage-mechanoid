/**
 * BU-2 段階7: Player の初期値を外部から注入するための設定。
 *
 * Player は gameStore を直接参照しないため、生成時に
 * 初期ステータスをこのインターフェースで受け取る。
 * Game が gameStore から値を読み取り、PlayerFactory へ渡す。
 *
 * P0-2修正: strength を廃止し attackPower に一本化した。
 */
export interface PlayerInitialConfig {
  maxHp: number;
  hp: number;
  maxEnergy: number;
  energy: number;
  defense: number;
  attackPower: number;
  viewRadius: number;
  level: number;
}
