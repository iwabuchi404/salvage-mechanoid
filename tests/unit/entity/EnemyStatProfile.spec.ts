import {
  getEnemyStatProfile,
  getLevelMultiplier,
  resolveEnemyStats,
} from '@/engine/entity/enemy/EnemyStatProfile';
import { EnemyType } from '@/engine/types';

/**
 * EnemyStatProfile の純粋関数テスト
 * PixiJS・Engine 初期化なしで実行できる。
 *
 * C2: 敵ステータスを純データへ分離し、CombatSystem へ接続する
 */
describe('EnemyStatProfile', () => {
  describe('getLevelMultiplier', () => {
    it('レベル1の倍率は 1.0', () => {
      expect(getLevelMultiplier(1)).toBe(1.0);
    });

    it('レベル2の倍率は 1.2', () => {
      expect(getLevelMultiplier(2)).toBe(1.2);
    });

    it('レベル3の倍率は 1.4', () => {
      expect(getLevelMultiplier(3)).toBe(1.4);
    });

    it('レベル5の倍率は 1.8', () => {
      expect(getLevelMultiplier(5)).toBe(1.8);
    });
  });

  describe('getEnemyStatProfile', () => {
    it('SCOUT の基本プロファイルを取得できる', () => {
      const profile = getEnemyStatProfile(EnemyType.SCOUT);

      expect(profile.baseMaxHealth).toBe(30);
      expect(profile.baseDefense).toBe(3);
      expect(profile.moveSpeed).toBe(6);
      expect(profile.baseAttackPower).toBe(5);
    });

    it('SOLDIER の基本プロファイルを取得できる', () => {
      const profile = getEnemyStatProfile(EnemyType.SOLDIER);

      expect(profile.baseMaxHealth).toBe(50);
      expect(profile.baseDefense).toBe(5);
      expect(profile.moveSpeed).toBe(4);
      expect(profile.baseAttackPower).toBe(10);
    });

    it('HEAVY の基本プロファイルを取得できる', () => {
      const profile = getEnemyStatProfile(EnemyType.HEAVY);

      expect(profile.baseMaxHealth).toBe(100);
      expect(profile.baseDefense).toBe(10);
      expect(profile.moveSpeed).toBe(2);
      expect(profile.baseAttackPower).toBe(15);
    });

    it('プロファイルが不変（freeze）である', () => {
      const profile = getEnemyStatProfile(EnemyType.SCOUT);

      expect(Object.isFrozen(profile)).toBe(true);
    });
  });

  describe('resolveEnemyStats', () => {
    it('SCOUT レベル1の実効ステータス', () => {
      const stats = resolveEnemyStats(EnemyType.SCOUT, 1);

      expect(stats.maxHealth).toBe(30);
      expect(stats.defense).toBe(3);
      expect(stats.moveSpeed).toBe(6);
      expect(stats.attackPower).toBe(5);
    });

    it('SOLDIER レベル1の実効ステータス', () => {
      const stats = resolveEnemyStats(EnemyType.SOLDIER, 1);

      expect(stats.maxHealth).toBe(50);
      expect(stats.defense).toBe(5);
      expect(stats.moveSpeed).toBe(4);
      expect(stats.attackPower).toBe(10);
    });

    it('HEAVY レベル1の実効ステータス', () => {
      const stats = resolveEnemyStats(EnemyType.HEAVY, 1);

      expect(stats.maxHealth).toBe(100);
      expect(stats.defense).toBe(10);
      expect(stats.moveSpeed).toBe(2);
      expect(stats.attackPower).toBe(15);
    });

    it('HEAVY レベル3の実効ステータス（レベル倍率 1.4）', () => {
      const stats = resolveEnemyStats(EnemyType.HEAVY, 3);

      expect(stats.maxHealth).toBe(140); // 100 * 1.4 = 140
      expect(stats.defense).toBe(14); // 10 * 1.4 = 14
      expect(stats.moveSpeed).toBe(2); // moveSpeed はレベル非依存
      expect(stats.attackPower).toBe(21); // 15 * 1.4 = 21
    });

    it('SCOUT レベル2の実効ステータス（レベル倍率 1.2）', () => {
      const stats = resolveEnemyStats(EnemyType.SCOUT, 2);

      expect(stats.maxHealth).toBe(36); // 30 * 1.2 = 36
      expect(stats.defense).toBe(3); // 3 * 1.2 = 3.6 -> 3
      expect(stats.moveSpeed).toBe(6);
      expect(stats.attackPower).toBe(6); // 5 * 1.2 = 6
    });

    it('実効ステータスが不変（freeze）である', () => {
      const stats = resolveEnemyStats(EnemyType.SCOUT, 1);

      expect(Object.isFrozen(stats)).toBe(true);
    });
  });
});
