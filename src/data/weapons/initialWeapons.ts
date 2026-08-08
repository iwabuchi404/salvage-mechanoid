// 初期武器データ

import { Weapon, WeaponType, Rarity } from '../../engine/types';

/**
 * 初期武器
 */

// コンバットナイフ（近接 × 弾薬）
export const combatKnife: Weapon = {
  id: 'weapon_combat_knife',
  name: 'コンバットナイフ',
  description: '基本的な近接武器。耐久性が高く扱いやすい',
  type: WeaponType.MELEE_AMMO,
  rarity: Rarity.COMMON,
  damage: 8,
  range: 1,
  accuracy: 85,
  weight: 5,
  sellPrice: 15,
};

/**
 * サンプル武器（コモン）
 */

// スチールパイプ（近接 × 弾薬）
export const steelPipe: Weapon = {
  id: 'weapon_steel_pipe',
  name: 'スチールパイプ',
  description: '拾った鉄パイプ。重いが威力がある',
  type: WeaponType.MELEE_AMMO,
  rarity: Rarity.COMMON,
  damage: 12,
  range: 1,
  accuracy: 70,
  weight: 8,
  sellPrice: 10,
};

// オートピストル（射撃 × 弾薬）
export const autoPistol: Weapon = {
  id: 'weapon_auto_pistol',
  name: 'オートピストル',
  description: '標準的な自動拳銃。射程が短い',
  type: WeaponType.RANGED_AMMO,
  rarity: Rarity.COMMON,
  damage: 10,
  range: 4,
  accuracy: 75,
  weight: 6,
  ammoCapacity: 12,
  currentAmmo: 12,
  sellPrice: 30,
};

// レーザーピストル（射撃 × エネルギー）
export const laserPistol: Weapon = {
  id: 'weapon_laser_pistol',
  name: 'レーザーピストル',
  description: 'エネルギーで動作する小型レーザー銃',
  type: WeaponType.RANGED_ENERGY,
  rarity: Rarity.COMMON,
  damage: 9,
  range: 5,
  accuracy: 80,
  weight: 4,
  energyCost: 3,
  sellPrice: 35,
};

/**
 * サンプル武器（レア）
 */

// プラズマブレード（近接 × エネルギー）
export const plasmaBlade: Weapon = {
  id: 'weapon_plasma_blade',
  name: 'プラズマブレード',
  description: 'プラズマ刃を展開する高性能近接武器',
  type: WeaponType.MELEE_ENERGY,
  rarity: Rarity.RARE,
  damage: 18,
  range: 1,
  accuracy: 90,
  weight: 7,
  energyCost: 5,
  sellPrice: 150,
};

// アサルトライフル（射撃 × 弾薬）
export const assaultRifle: Weapon = {
  id: 'weapon_assault_rifle',
  name: 'アサルトライフル',
  description: '中距離用の自動小銃。威力と命中率のバランスが良い',
  type: WeaponType.RANGED_AMMO,
  rarity: Rarity.RARE,
  damage: 15,
  range: 6,
  accuracy: 80,
  weight: 10,
  ammoCapacity: 30,
  currentAmmo: 30,
  sellPrice: 180,
};

// ビームライフル（射撃 × エネルギー）
export const beamRifle: Weapon = {
  id: 'weapon_beam_rifle',
  name: 'ビームライフル',
  description: '高出力ビームを発射する長距離武器',
  type: WeaponType.RANGED_ENERGY,
  rarity: Rarity.RARE,
  damage: 20,
  range: 7,
  accuracy: 85,
  weight: 9,
  energyCost: 8,
  sellPrice: 200,
};

/**
 * 初期武器セット
 */
export const initialWeaponSet = {
  starter: combatKnife,
};

/**
 * 全武器リスト
 */
export const allWeapons = [
  combatKnife,
  steelPipe,
  autoPistol,
  laserPistol,
  plasmaBlade,
  assaultRifle,
  beamRifle,
];
