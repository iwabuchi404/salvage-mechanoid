// サンプルパーツデータ（スキル付き）

import {
  RobotPart,
  PartSlot,
  Rarity,
  ArmType,
  Skill,
  SkillType,
  SkillTarget,
} from '../../engine/types';

/**
 * スキル定義
 */

// 頭部スキル: スキャン
const scanSkill: Skill = {
  id: 'skill_scan',
  name: 'スキャン',
  description: '周囲の敵情報を詳細表示し、罠を検知する',
  icon: '🔍',
  type: SkillType.UTILITY,
  target: SkillTarget.SELF,
  energyCost: 3,
  cooldown: 2,
  range: 0,
  areaOfEffect: 2,
};

// 胴体スキル: シールド展開
const shieldSkill: Skill = {
  id: 'skill_shield',
  name: 'シールド展開',
  description: '2ターンの間、被ダメージを50%軽減',
  icon: '🛡',
  type: SkillType.DEFENSE,
  target: SkillTarget.SELF,
  energyCost: 10,
  cooldown: 6,
  range: 0,
};

// 胴体スキル: 緊急修理
const repairSkill: Skill = {
  id: 'skill_repair',
  name: '緊急修理',
  description: 'HPを30%回復する',
  icon: '🔧',
  type: SkillType.SUPPORT,
  target: SkillTarget.SELF,
  energyCost: 15,
  cooldown: 8,
  range: 0,
  heal: 30,
};

// 脚部スキル: ダッシュ
const dashSkill: Skill = {
  id: 'skill_dash',
  name: 'ダッシュ',
  description: '2マス瞬間移動（障害物無視）',
  icon: '⚡',
  type: SkillType.MOBILITY,
  target: SkillTarget.SELF,
  energyCost: 5,
  cooldown: 3,
  range: 2,
};

// 脚部スキル: ジャンプ
const jumpSkill: Skill = {
  id: 'skill_jump',
  name: 'ジャンプ',
  description: '3マス跳躍移動、着地時周囲1マスにダメージ5',
  icon: '🦘',
  type: SkillType.MOBILITY,
  target: SkillTarget.SELF,
  energyCost: 7,
  cooldown: 4,
  range: 3,
  areaOfEffect: 1,
  damage: 5,
};

// バックパックスキル: 煙幕展開
const smokeSkill: Skill = {
  id: 'skill_smoke',
  name: '煙幕展開',
  description: '周囲2マス、敵命中率-50%、2ターン',
  icon: '💨',
  type: SkillType.UTILITY,
  target: SkillTarget.AREA,
  energyCost: 6,
  cooldown: 4,
  range: 0,
  areaOfEffect: 2,
};

// バックパックスキル: ドローン配備
const droneSkill: Skill = {
  id: 'skill_drone',
  name: 'ドローン配備',
  description: '3ターン、自動で敵を攻撃（ダメージ5/ターン）',
  icon: '🚁',
  type: SkillType.SUPPORT,
  target: SkillTarget.AREA,
  energyCost: 12,
  cooldown: 8,
  range: 5,
  damage: 5,
};

// 武器腕スキル: ビームキャノン
const beamCannonSkill: Skill = {
  id: 'skill_beam_cannon',
  name: 'ビームキャノン',
  description: '直線5マス、ダメージ20、貫通',
  icon: '🔫',
  type: SkillType.ATTACK,
  target: SkillTarget.ENEMY,
  energyCost: 12,
  cooldown: 5,
  range: 5,
  damage: 20,
};

/**
 * スキル持ちパーツ（レア以上）
 */

// 頭部: 高性能センサー（スキル: スキャン）
export const advancedSensor: RobotPart = {
  id: 'head_advanced_sensor',
  name: '高性能センサー',
  description: '詳細な索敵が可能なセンサーユニット',
  slot: PartSlot.HEAD,
  rarity: Rarity.RARE,
  hp: 15,
  defense: 3,
  weight: 15,
  energyCapacity: 15,
  skill: scanSkill,
  passiveEffect: null,
  sellPrice: 120,
};

// 胴体: シールドジェネレーター（スキル: シールド展開）
export const shieldGenerator: RobotPart = {
  id: 'torso_shield_generator',
  name: 'シールドジェネレーター',
  description: 'エネルギーシールドを展開できる胴体',
  slot: PartSlot.TORSO,
  rarity: Rarity.RARE,
  hp: 20,
  defense: 3,
  weight: 45,
  energyCapacity: 20,
  skill: shieldSkill,
  passiveEffect: null,
  sellPrice: 180,
};

// 胴体: 修理ユニット（スキル: 緊急修理）
export const repairUnit: RobotPart = {
  id: 'torso_repair_unit',
  name: '修理ユニット',
  description: '自己修復機能を持つ胴体装甲',
  slot: PartSlot.TORSO,
  rarity: Rarity.EPIC,
  hp: 35,
  defense: 6,
  weight: 50,
  energyCapacity: 25,
  skill: repairSkill,
  passiveEffect: null,
  sellPrice: 350,
};

// 脚部: ブースター脚（スキル: ダッシュ）
export const boosterLegs: RobotPart = {
  id: 'legs_booster',
  name: 'ブースター脚',
  description: '高速移動が可能な軽量脚部',
  slot: PartSlot.LEGS,
  rarity: Rarity.RARE,
  hp: 15,
  defense: 2,
  weight: 35,
  energyCapacity: 15,
  skill: dashSkill,
  passiveEffect: null,
  carryCapacity: 120,
  sellPrice: 160,
};

// 脚部: ジャンプユニット（スキル: ジャンプ）
export const jumpLegs: RobotPart = {
  id: 'legs_jump_unit',
  name: 'ジャンプユニット',
  description: '跳躍移動が可能な特殊脚部',
  slot: PartSlot.LEGS,
  rarity: Rarity.EPIC,
  hp: 20,
  defense: 4,
  weight: 42,
  energyCapacity: 20,
  skill: jumpSkill,
  passiveEffect: null,
  carryCapacity: 140,
  sellPrice: 320,
};

// バックパック: 煙幕発生器（スキル: 煙幕展開）
export const smokeGenerator: RobotPart = {
  id: 'backpack_smoke_generator',
  name: '煙幕発生器',
  description: '煙幕を展開できるバックパック',
  slot: PartSlot.BACKPACK,
  rarity: Rarity.RARE,
  hp: 8,
  defense: 2,
  weight: 18,
  energyCapacity: 25,
  skill: smokeSkill,
  passiveEffect: null,
  sellPrice: 140,
};

// バックパック: ドローンベイ（スキル: ドローン配備）
export const droneBay: RobotPart = {
  id: 'backpack_drone_bay',
  name: 'ドローンベイ',
  description: '攻撃ドローンを配備できるバックパック',
  slot: PartSlot.BACKPACK,
  rarity: Rarity.EPIC,
  hp: 10,
  defense: 2,
  weight: 22,
  energyCapacity: 30,
  skill: droneSkill,
  passiveEffect: null,
  sellPrice: 300,
};

// 武器腕: ビームキャノン腕（スキル: ビームキャノン）
export const beamCannonArm: RobotPart = {
  id: 'arm_r_beam_cannon',
  name: 'ビームキャノン腕',
  description: '高出力ビームを発射する武器腕',
  slot: PartSlot.ARM_R,
  rarity: Rarity.EPIC,
  hp: 20,
  defense: 4,
  weight: 38,
  energyCapacity: 10,
  skill: beamCannonSkill,
  passiveEffect: null,
  armType: ArmType.WEAPON_ARM,
  canEquipWeapon: false,
  sellPrice: 400,
};

/**
 * 効果ありコア（パッシブ効果持ち）
 */

// 高効率コア
export const efficientCore: RobotPart = {
  id: 'core_efficient',
  name: '高効率コア',
  description: 'エネルギー効率を高めるコア',
  slot: PartSlot.CORE,
  rarity: Rarity.RARE,
  hp: 0,
  defense: 0,
  weight: 10,
  energyCapacity: 80,
  skill: null,
  passiveEffect: {
    type: 'energy_efficiency',
    value: 10,
    description: 'スキルコスト-10%',
  },
  sellPrice: 250,
};

// 強化コア
export const powerCore: RobotPart = {
  id: 'core_power',
  name: '強化コア',
  description: '攻撃力を増加させるコア',
  slot: PartSlot.CORE,
  rarity: Rarity.RARE,
  hp: 0,
  defense: 0,
  weight: 12,
  energyCapacity: 100,
  skill: null,
  passiveEffect: {
    type: 'attack_boost',
    value: 10,
    description: '攻撃力+10%',
  },
  sellPrice: 280,
};

// 防御コア
export const defenseCore: RobotPart = {
  id: 'core_defense',
  name: '防御コア',
  description: '防御力を増加させるコア',
  slot: PartSlot.CORE,
  rarity: Rarity.EPIC,
  hp: 0,
  defense: 0,
  weight: 11,
  energyCapacity: 100,
  skill: null,
  passiveEffect: {
    type: 'defense_boost',
    value: 15,
    description: '防御力+15%',
  },
  sellPrice: 320,
};

/**
 * 全サンプルパーツリスト
 */
export const allSampleParts = [
  advancedSensor,
  shieldGenerator,
  repairUnit,
  boosterLegs,
  jumpLegs,
  smokeGenerator,
  droneBay,
  beamCannonArm,
  efficientCore,
  powerCore,
  defenseCore,
];
