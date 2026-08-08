// 簡単なマップ生成テスト
const { FlexibleMapGenerator } = require('../../../dist/engine/world/FlexibleMapGenerator');

async function testMapGeneration() {
  console.log('=== マップ生成テスト開始 ===');
  
  try {
    // FlexibleMapGeneratorインスタンスを作成
    const generator = new FlexibleMapGenerator(30, 30);
    
    console.log('FlexibleMapGenerator インスタンス作成完了');
    
    // マップを生成
    const startTime = Date.now();
    const result = await generator.generateMap(4, 8);
    const endTime = Date.now();
    
    console.log(`マップ生成完了: ${endTime - startTime}ms`);
    console.log(`生成された部屋数: ${result.rooms.length}`);
    console.log(`マップサイズ: ${result.map.length} x ${result.map[0].length}`);
    
    // タイルタイプの統計
    const tileStats = {};
    for (let y = 0; y < result.map.length; y++) {
      for (let x = 0; x < result.map[y].length; x++) {
        const tileType = result.map[y][x];
        tileStats[tileType] = (tileStats[tileType] || 0) + 1;
      }
    }
    
    console.log('タイル統計:', tileStats);
    
    // 部屋情報の表示
    console.log('\n部屋情報:');
    result.rooms.forEach((room, index) => {
      console.log(`  部屋 ${index + 1}: (${room.x}, ${room.y}) ${room.width}x${room.height} タイプ: ${room.type}`);
    });
    
    console.log('\n=== マップ生成テスト完了 ===');
    return true;
    
  } catch (error) {
    console.error('マップ生成エラー:', error);
    return false;
  }
}

// テスト実行
testMapGeneration().then(success => {
  if (success) {
    console.log('✅ テスト成功');
    process.exit(0);
  } else {
    console.log('❌ テスト失敗');
    process.exit(1);
  }
}).catch(error => {
  console.error('テスト実行エラー:', error);
  process.exit(1);
});
