import {
  getPlayerVisualProfile,
  getPlayerTexturePath,
} from '@/engine/presentation/player/PlayerVisualProfile';
import { Direction, LayerName } from '@/engine/types';

/**
 * PlayerVisualProfile の純粋関数テスト
 * PixiJS 初期化なしで実行できる。
 *
 * C1: Player / Item の描画ライフサイクルを Presentation へ移す
 */
describe('PlayerVisualProfile', () => {
  describe('getPlayerVisualProfile', () => {
    it('既定のプロファイルを取得できる', () => {
      const profile = getPlayerVisualProfile();

      expect(profile.defaultTexturePath).toBe('./robo01_l.png');
      expect(profile.anchor).toEqual({ x: 0.5, y: 1.0 });
      expect(profile.layer).toBe(LayerName.CHARACTERS);
    });

    it('方向別テクスチャパスが全方向分ある', () => {
      const profile = getPlayerVisualProfile();

      expect(profile.texturePaths.up).toBeDefined();
      expect(profile.texturePaths.down).toBeDefined();
      expect(profile.texturePaths.left).toBeDefined();
      expect(profile.texturePaths.right).toBeDefined();
    });

    it('プロファイルが不変（freeze）である', () => {
      const profile = getPlayerVisualProfile();

      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.texturePaths)).toBe(true);
      expect(Object.isFrozen(profile.anchor)).toBe(true);
    });
  });

  describe('getPlayerTexturePath', () => {
    it('down 方向のテクスチャパスを取得できる', () => {
      expect(getPlayerTexturePath('down')).toBe('./robo01_l.png');
    });

    it('up 方向のテクスチャパスを取得できる', () => {
      expect(getPlayerTexturePath('up')).toBe('./robo01bk_r.png');
    });

    it('left 方向のテクスチャパスを取得できる', () => {
      expect(getPlayerTexturePath('left')).toBe('./robo01bk_l.png');
    });

    it('right 方向のテクスチャパスを取得できる', () => {
      expect(getPlayerTexturePath('right')).toBe('./robo01_r.png');
    });
  });
});
