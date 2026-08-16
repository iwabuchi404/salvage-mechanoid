import { PartsSystem } from '@/engine/parts/PartsSystem';
import { initialPartSet } from '@/data/parts/initialParts';
import { initialWeaponSet } from '@/data/weapons/initialWeapons';

/**
 * BU-2 段階3: PartsSystem の StatSource 実装テスト
 *
 * PartsSystem が StatSource として正しく修飾子を提供することを確認する。
 * また、setLoadout 後に getModifiers() の値が変わることを確認する。
 */
describe('BU-2 段階3: PartsSystem StatSource', () => {
  let partsSystem: PartsSystem;

  beforeEach(() => {
    partsSystem = new PartsSystem();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sourceId が "parts" である', () => {
    expect(partsSystem.sourceId).toBe('parts');
  });

  it('装備なしの場合は修飾子がすべて 0', () => {
    const modifiers = partsSystem.getModifiers();
    expect(modifiers).toHaveLength(4);
    for (const mod of modifiers) {
      expect(mod.value).toBe(0);
      expect(mod.op).toBe('add');
      expect(mod.sourceId).toBe('parts');
    }
  });

  it('setLoadout 後に修飾子が装備値を反映する', () => {
    partsSystem.setLoadout({
      head: initialPartSet.head,
      torso: initialPartSet.torso,
      armR: initialPartSet.armR,
      armL: initialPartSet.armL,
      legs: initialPartSet.legs,
      backpack: initialPartSet.backpack,
      core: initialPartSet.core,
      weaponR: initialWeaponSet.starter,
      weaponL: null,
    });

    const stats = partsSystem.getStats();
    const modifiers = partsSystem.getModifiers();

    const maxHpMod = modifiers.find((m) => m.stat === 'maxHp');
    expect(maxHpMod?.value).toBe(stats.maxHp);

    const defenseMod = modifiers.find((m) => m.stat === 'defense');
    expect(defenseMod?.value).toBe(stats.defense);

    const maxEnergyMod = modifiers.find((m) => m.stat === 'maxEnergy');
    expect(maxEnergyMod?.value).toBe(stats.maxEnergy);

    const carryCapacityMod = modifiers.find((m) => m.stat === 'carryCapacity');
    expect(carryCapacityMod?.value).toBe(stats.carryCapacity);
  });

  it('resetLoadout 後に修飾子が 0 に戻る', () => {
    partsSystem.setLoadout({
      head: initialPartSet.head,
      torso: initialPartSet.torso,
      armR: initialPartSet.armR,
      armL: initialPartSet.armL,
      legs: initialPartSet.legs,
      backpack: initialPartSet.backpack,
      core: initialPartSet.core,
      weaponR: initialWeaponSet.starter,
      weaponL: null,
    });

    partsSystem.resetLoadout();

    const modifiers = partsSystem.getModifiers();
    for (const mod of modifiers) {
      expect(mod.value).toBe(0);
    }
  });
});
