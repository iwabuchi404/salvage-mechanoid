import { EnergyComponent } from '@/engine/entity/components/Energy';

describe('EnergyComponent', () => {
  it('初期値を0から最大値の範囲に丸める', () => {
    expect(new EnergyComponent(100, 120).createSnapshot()).toEqual({
      currentEnergy: 100,
      maxEnergy: 100,
    });
    expect(new EnergyComponent(0, -10).createSnapshot()).toEqual({
      currentEnergy: 0,
      maxEnergy: 1,
    });
  });

  it('残量が足りる場合だけエネルギーを消費する', () => {
    const energy = new EnergyComponent(100, 40);

    expect(energy.consume(25)).toBe(true);
    expect(energy.currentEnergy).toBe(15);
    expect(energy.consume(20)).toBe(false);
    expect(energy.currentEnergy).toBe(15);
  });

  it('回復量を最大値で制限し、実際の回復量を返す', () => {
    const energy = new EnergyComponent(100, 80);

    expect(energy.restore(50)).toBe(20);
    expect(energy.currentEnergy).toBe(100);
    expect(energy.restore(10)).toBe(0);
  });

  it('最大値を下げた場合は現在値も新しい最大値に合わせる', () => {
    const energy = new EnergyComponent(100, 80);

    energy.setMaxEnergy(50);

    expect(energy.createSnapshot()).toEqual({
      currentEnergy: 50,
      maxEnergy: 50,
    });
  });

  it('スナップショットを復元するときも値を正規化する', () => {
    const energy = new EnergyComponent(100, 10);

    energy.restoreSnapshot({ currentEnergy: 300, maxEnergy: 150 });

    expect(energy.createSnapshot()).toEqual({
      currentEnergy: 150,
      maxEnergy: 150,
    });
  });
});
