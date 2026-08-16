// パーツシステム - パーツ管理とステータス計算

import { System } from '../System';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import type { RobotPart, Weapon, RobotLoadout, RobotStats, PassiveEffect, Skill } from '../types';
import { PartSlot, ArmType } from '../types';
import { StatSource, StatModifier } from '../entity/stats/StatTypes';

/**
 * パーツシステム
 * プレイヤーのパーツ構成を管理し、総合ステータスを計算する
 *
 * BU-2: StatSource を実装し、StatsComponent へ修飾子を提供する。
 * P2修正: setLoadout / resetLoadout / equipPart / unequipPart / equipWeapon /
 * unequipWeapon で loadout_changed イベントを発行し、StatsComponent が
 * invalidate() を呼ぶようにした。
 */
export class PartsSystem implements System, StatSource {
  name = 'parts';

  // StatSource の実装
  readonly sourceId = 'parts';

  /** loadout_changed イベントを発行する */
  private notifyLoadoutChanged(): void {
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('loadout_changed', { sourceId: this.sourceId });
    }
  }

  /**
   * 現在の装備から StatsComponent へ提供する修飾子一覧を返す。
   * パーツのステータスは add 修飾子として表現する。
   * carryCapacity は脚部の値が上書き方式だが、ここでは add で表現する
   * （複数脚部の装備は想定外のため、最後の値が優先される現行挙動と
   *  実質的に同じになる）。
   */
  getModifiers(): readonly StatModifier[] {
    const stats = this.getStats();
    const modifiers: StatModifier[] = [
      { stat: 'maxHp', op: 'add', value: stats.maxHp, sourceId: this.sourceId },
      { stat: 'maxEnergy', op: 'add', value: stats.maxEnergy, sourceId: this.sourceId },
      { stat: 'defense', op: 'add', value: stats.defense, sourceId: this.sourceId },
      { stat: 'carryCapacity', op: 'add', value: stats.carryCapacity, sourceId: this.sourceId },
    ];
    return modifiers;
  }

  // 現在のパーツ構成
  private loadout: RobotLoadout = {
    head: null,
    torso: null,
    armR: null,
    armL: null,
    legs: null,
    backpack: null,
    core: null,
    weaponR: null,
    weaponL: null,
  };

  async initialize(): Promise<void> {
    console.log('PartsSystem initialized');
  }

  update(_deltaTime: number): void {
    // パーツシステムは更新不要
  }

  /**
   * パーツ構成を取得
   */
  getLoadout(): RobotLoadout {
    return { ...this.loadout };
  }

  /**
   * パーツを装備
   */
  equipPart(part: RobotPart): boolean {
    // 重量チェック
    if (!this.canEquipPart(part)) {
      console.log(`Cannot equip ${part.name}: weight limit exceeded`);
      return false;
    }

    // スロットに応じて装備
    switch (part.slot) {
      case PartSlot.HEAD:
        this.loadout.head = part;
        break;
      case PartSlot.TORSO:
        this.loadout.torso = part;
        break;
      case PartSlot.ARM_R:
        this.loadout.armR = part;
        // 武器腕に変更した場合、武器を外す
        if (part.armType === ArmType.WEAPON_ARM) {
          this.loadout.weaponR = null;
        }
        break;
      case PartSlot.ARM_L:
        this.loadout.armL = part;
        // 武器腕に変更した場合、武器を外す
        if (part.armType === ArmType.WEAPON_ARM) {
          this.loadout.weaponL = null;
        }
        break;
      case PartSlot.LEGS:
        this.loadout.legs = part;
        break;
      case PartSlot.BACKPACK:
        this.loadout.backpack = part;
        break;
      case PartSlot.CORE:
        this.loadout.core = part;
        break;
    }

    console.log(`Equipped ${part.name} to ${part.slot}`);
    this.notifyLoadoutChanged();
    return true;
  }

  /**
   * パーツを装備可能かチェック（重量制限）
   */
  canEquipPart(part: RobotPart): boolean {
    // 一時的にパーツを装備した状態でステータスを計算
    const tempLoadout = { ...this.loadout };

    switch (part.slot) {
      case PartSlot.HEAD:
        tempLoadout.head = part;
        break;
      case PartSlot.TORSO:
        tempLoadout.torso = part;
        break;
      case PartSlot.ARM_R:
        tempLoadout.armR = part;
        break;
      case PartSlot.ARM_L:
        tempLoadout.armL = part;
        break;
      case PartSlot.LEGS:
        tempLoadout.legs = part;
        break;
      case PartSlot.BACKPACK:
        tempLoadout.backpack = part;
        break;
      case PartSlot.CORE:
        tempLoadout.core = part;
        break;
    }

    const tempStats = this.calculateStats(tempLoadout);
    return tempStats.totalWeight <= tempStats.carryCapacity;
  }

  /**
   * 武器を装備
   */
  equipWeapon(weapon: Weapon, slot: 'R' | 'L'): boolean {
    if (slot === 'R') {
      // 右腕がマニピュレーターか確認
      if (!this.loadout.armR || this.loadout.armR.armType !== ArmType.MANIPULATOR) {
        console.log('Right arm is not a manipulator');
        return false;
      }

      // 重量チェック
      const tempLoadout = { ...this.loadout, weaponR: weapon };
      const tempStats = this.calculateStats(tempLoadout);
      if (tempStats.totalWeight > tempStats.carryCapacity) {
        console.log('Weapon too heavy');
        return false;
      }

      this.loadout.weaponR = weapon;
      console.log(`Equipped ${weapon.name} to right hand`);
      this.notifyLoadoutChanged();
      return true;
    } else {
      // 左腕がマニピュレーターか確認
      if (!this.loadout.armL || this.loadout.armL.armType !== ArmType.MANIPULATOR) {
        console.log('Left arm is not a manipulator');
        return false;
      }

      // 重量チェック
      const tempLoadout = { ...this.loadout, weaponL: weapon };
      const tempStats = this.calculateStats(tempLoadout);
      if (tempStats.totalWeight > tempStats.carryCapacity) {
        console.log('Weapon too heavy');
        return false;
      }

      this.loadout.weaponL = weapon;
      console.log(`Equipped ${weapon.name} to left hand`);
      this.notifyLoadoutChanged();
      return true;
    }
  }

  /**
   * 武器を外す
   */
  unequipWeapon(slot: 'R' | 'L'): void {
    if (slot === 'R') {
      this.loadout.weaponR = null;
    } else {
      this.loadout.weaponL = null;
    }
    this.notifyLoadoutChanged();
  }

  /**
   * パーツを外す
   */
  unequipPart(slot: PartSlot): void {
    switch (slot) {
      case PartSlot.HEAD:
        this.loadout.head = null;
        break;
      case PartSlot.TORSO:
        this.loadout.torso = null;
        break;
      case PartSlot.ARM_R:
        this.loadout.armR = null;
        this.loadout.weaponR = null; // 武器も外す
        break;
      case PartSlot.ARM_L:
        this.loadout.armL = null;
        this.loadout.weaponL = null; // 武器も外す
        break;
      case PartSlot.LEGS:
        this.loadout.legs = null;
        break;
      case PartSlot.BACKPACK:
        this.loadout.backpack = null;
        break;
      case PartSlot.CORE:
        this.loadout.core = null;
        break;
    }
    this.notifyLoadoutChanged();
  }

  /**
   * ロボットの総合ステータスを計算
   */
  getStats(): RobotStats {
    return this.calculateStats(this.loadout);
  }

  /**
   * 総合ステータス計算（内部用）
   */
  private calculateStats(loadout: RobotLoadout): RobotStats {
    const parts = [
      loadout.head,
      loadout.torso,
      loadout.armR,
      loadout.armL,
      loadout.legs,
      loadout.backpack,
      loadout.core,
    ];

    let maxHp = 0;
    let defense = 0;
    let totalWeight = 0;
    let maxEnergy = 0;
    let carryCapacity = 0;
    const passiveEffects: PassiveEffect[] = [];

    // 各パーツのステータスを合計
    for (const part of parts) {
      if (part) {
        maxHp += part.hp;
        defense += part.defense;
        totalWeight += part.weight;
        maxEnergy += part.energyCapacity;

        // 脚部の積載量
        if (part.carryCapacity) {
          carryCapacity = part.carryCapacity;
        }

        // パッシブ効果（コアのみ）
        if (part.passiveEffect) {
          passiveEffects.push(part.passiveEffect);
        }
      }
    }

    // 武器の重量を追加
    if (loadout.weaponR) {
      totalWeight += loadout.weaponR.weight;
    }
    if (loadout.weaponL) {
      totalWeight += loadout.weaponL.weight;
    }

    return {
      maxHp,
      defense,
      totalWeight,
      maxEnergy,
      carryCapacity,
      passiveEffects,
    };
  }

  /**
   * 使用可能なスキル一覧を取得
   */
  getAvailableSkills(): Skill[] {
    const skills: Skill[] = [];

    const parts = [
      this.loadout.head,
      this.loadout.torso,
      this.loadout.armR,
      this.loadout.armL,
      this.loadout.legs,
      this.loadout.backpack,
    ];

    for (const part of parts) {
      if (part && part.skill) {
        skills.push(part.skill);
      }
    }

    return skills;
  }

  /**
   * パーツ構成をリセット（初期化用）
   */
  resetLoadout(): void {
    this.loadout = {
      head: null,
      torso: null,
      armR: null,
      armL: null,
      legs: null,
      backpack: null,
      core: null,
      weaponR: null,
      weaponL: null,
    };
    this.notifyLoadoutChanged();
  }

  /**
   * パーツ構成を一括設定（初期装備用）
   */
  setLoadout(loadout: RobotLoadout): void {
    this.loadout = { ...loadout };
    console.log('Loadout set');
    this.notifyLoadoutChanged();
  }

  /**
   * パッシブ効果を取得
   */
  getPassiveEffects(): PassiveEffect[] {
    return this.getStats().passiveEffects;
  }

  /**
   * 特定のパッシブ効果の値を取得
   */
  getPassiveEffectValue(type: string): number {
    const effects = this.getPassiveEffects();
    const effect = effects.find((e) => e.type === type);
    return effect ? effect.value : 0;
  }
}
