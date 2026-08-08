// 初期装備パーツデータ

import { RobotPart, PartSlot, Rarity, ArmType } from '../../engine/types';

/**
 * 初期装備パーツ一覧
 */

// 頭部: 標準センサー
export const standardSensor: RobotPart = {
  id: 'head_standard_sensor',
  name: '標準センサー',
  description: '基本的な索敵機能を持つセンサーユニット',
  slot: PartSlot.HEAD,
  rarity: Rarity.COMMON,
  hp: 10,
  defense: 2,
  weight: 12,
  energyCapacity: 10,
  skill: null,
  passiveEffect: null,
  sellPrice: 20,
};

// 胴体: 軽量装甲
export const lightArmor: RobotPart = {
  id: 'torso_light_armor',
  name: '軽量装甲',
  description: '最低限の防御力を提供する軽量な胴体装甲',
  slot: PartSlot.TORSO,
  rarity: Rarity.COMMON,
  hp: 30,
  defense: 5,
  weight: 35,
  energyCapacity: 15,
  skill: null,
  passiveEffect: null,
  sellPrice: 30,
};

// 右腕: 汎用マニピュレータ
export const standardManipulatorR: RobotPart = {
  id: 'arm_r_standard_manipulator',
  name: '汎用マニピュレータ（右）',
  description: '武器を装備できる標準的な腕部パーツ',
  slot: PartSlot.ARM_R,
  rarity: Rarity.COMMON,
  hp: 15,
  defense: 3,
  weight: 20,
  energyCapacity: 5,
  skill: null,
  passiveEffect: null,
  armType: ArmType.MANIPULATOR,
  canEquipWeapon: true,
  sellPrice: 25,
};

// 左腕: 汎用マニピュレータ
export const standardManipulatorL: RobotPart = {
  id: 'arm_l_standard_manipulator',
  name: '汎用マニピュレータ（左）',
  description: '武器を装備できる標準的な腕部パーツ',
  slot: PartSlot.ARM_L,
  rarity: Rarity.COMMON,
  hp: 15,
  defense: 3,
  weight: 20,
  energyCapacity: 5,
  skill: null,
  passiveEffect: null,
  armType: ArmType.MANIPULATOR,
  canEquipWeapon: true,
  sellPrice: 25,
};

// 脚部: 標準脚部
export const standardLegs: RobotPart = {
  id: 'legs_standard',
  name: '標準脚部',
  description: 'バランスの取れた標準的な脚部ユニット',
  slot: PartSlot.LEGS,
  rarity: Rarity.COMMON,
  hp: 20,
  defense: 4,
  weight: 40,
  energyCapacity: 10,
  skill: null,
  passiveEffect: null,
  carryCapacity: 150, // 積載量150kg
  sellPrice: 35,
};

// バックパック: 小型パック
export const smallBackpack: RobotPart = {
  id: 'backpack_small',
  name: '小型パック',
  description: '最小限の補助機能を持つバックパック',
  slot: PartSlot.BACKPACK,
  rarity: Rarity.COMMON,
  hp: 5,
  defense: 1,
  weight: 15,
  energyCapacity: 20,
  skill: null,
  passiveEffect: null,
  sellPrice: 15,
};

// コア: 小型コア
export const smallCore: RobotPart = {
  id: 'core_small',
  name: '小型コア',
  description: '基本的なエネルギー供給を行う小型コア',
  slot: PartSlot.CORE,
  rarity: Rarity.COMMON,
  hp: 0,
  defense: 0,
  weight: 8,
  energyCapacity: 50,
  skill: null,
  passiveEffect: null,
  sellPrice: 40,
};

/**
 * 初期装備セット
 */
export const initialPartSet = {
  head: standardSensor,
  torso: lightArmor,
  armR: standardManipulatorR,
  armL: standardManipulatorL,
  legs: standardLegs,
  backpack: smallBackpack,
  core: smallCore,
};
