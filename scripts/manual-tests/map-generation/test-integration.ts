// 統合テスト - FlexibleMapGeneratorと特徴配置システム
import { FlexibleMapGenerator } from '../../../src/engine/world/FlexibleMapGenerator';
import { initializeMapGeneratorFactory } from '../../../src/engine/world/MapGeneratorInterface';

async function testIntegration() {
  console.log('=== フェーズ2統合テスト ===');
  
  try {
    // ファクトリー初期化
    console.log('1. MapGeneratorFactory初期化...');
    await initializeMapGeneratorFactory();
    console.log('✅ ファクトリー初期化完了');
    
    // FlexibleMapGeneratorテスト
    console.log('\n2. FlexibleMapGenerator動作テスト...');
    const generator = new FlexibleMapGenerator(30, 30);
    
    const startTime = performance.now();
    const result = await generator.generateMap(4, 8);
    const endTime = performance.now();
    
    console.log(`✅ マップ生成完了: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`   生成された部屋数: ${result.rooms.length}`);
    console.log(`   マップサイズ: ${result.map.length}x${result.map[0].length}`);
    
    // タイル統計
    const tileStats: Record<number, number> = {};
    let totalTiles = 0;
    
    for (let y = 0; y < result.map.length; y++) {
      for (let x = 0; x < result.map[y].length; x++) {
        const tileType = result.map[y][x];
        tileStats[tileType] = (tileStats[tileType] || 0) + 1;
        totalTiles++;
      }
    }
    
    console.log('\n3. タイル統計:');
    Object.entries(tileStats).forEach(([type, count]) => {
      const percentage = ((count / totalTiles) * 100).toFixed(1);
      console.log(`   タイプ ${type}: ${count}個 (${percentage}%)`);
    });
    
    // 部屋情報
    console.log('\n4. 部屋情報:');
    result.rooms.forEach((room, index) => {
      console.log(`   部屋${index + 1}: (${room.x},${room.y}) ${room.width}×${room.height} [${room.type}]`);
    });
    
    // より高度な機能テスト
    console.log('\n5. 高度な機能テスト...');
    
    // A*通路生成テスト
    console.log('   A*通路生成テスト中...');
    const astarResult = await generator.generate({
      width: 25,
      height: 25,
      algorithm: 'bsp' as any,
      roomConfig: {
        minSize: 3,
        maxSize: 7,
        density: 0.6,
        connectivity: 0.9,
        roomTypes: ['normal', 'boss', 'treasure']
      } as any,
      corridorConfig: {
        method: 'astar',
        width: 1,
        redundancy: 0.2,
        allowDiagonal: false
      } as any,
      featureConfig: {
        method: 'basic',
        density: 0.03,
        rules: [],
        themeFeatures: [],
        globalRules: []
      } as any,
      postProcessing: {
        ensureConnectivity: true,
        balanceFeatures: true,
        optimizePerformance: false
      }
    });
    
    console.log(`✅ A*テスト完了: ${astarResult.corridors.length}本の通路生成`);
    console.log(`   配置された特徴: ${astarResult.features.length}個`);
    
    // 特徴配置システムテスト
    console.log('   特徴配置システムテスト中...');
    const featureResult = await generator.generate({
      width: 20,
      height: 20,
      algorithm: 'bsp' as any,
      roomConfig: {
        minSize: 4,
        maxSize: 6,
        density: 0.7,
        connectivity: 0.8,
        roomTypes: ['normal', 'boss', 'treasure', 'entrance']
      } as any,
      corridorConfig: {
        method: 'lshape',
        width: 1,
        redundancy: 0.1,
        allowDiagonal: false
      } as any,
      featureConfig: {
        method: 'rule-based',
        density: 0.05,
        rules: [],
        themeFeatures: [],
        globalRules: []
      } as any,
      postProcessing: {
        ensureConnectivity: true,
        balanceFeatures: true,
        optimizePerformance: false
      }
    });
    
    console.log(`✅ 特徴配置テスト完了: ${featureResult.features.length}個の特徴配置`);
    
    console.log('\n=== 統合テスト成功 ===');
    console.log('🎉 フェーズ2の実装が正常に動作しています！');
    
    return true;
    
  } catch (error) {
    console.error('❌ 統合テストエラー:', error);
    console.error('スタックトレース:', error.stack);
    return false;
  }
}

// テスト実行
testIntegration().then(success => {
  if (success) {
    console.log('\n✅ すべてのテストが成功しました');
    process.exit(0);
  } else {
    console.log('\n❌ テストが失敗しました');
    process.exit(1);
  }
}).catch(error => {
  console.error('テスト実行エラー:', error);
  process.exit(1);
});
