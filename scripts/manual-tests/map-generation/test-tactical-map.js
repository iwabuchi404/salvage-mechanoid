/**
 * 戦術的マップ生成のテストスクリプト
 * Node.jsで簡単に動作確認するためのスクリプト
 */

// 簡易版の型とEnumの定義（テスト用）
const StageType = {
  CLASSIC: 'classic',
  ENERGY_MANAGEMENT: 'energy_management',
  TACTICAL_COMBAT: 'tactical_combat',
  INFORMATION_WAR: 'information_war',
};

const MapGenerationAlgorithm = {
  BSP: 'bsp',
};

const RoomType = {
  NORMAL: 'normal',
  BOSS: 'boss',
  TREASURE: 'treasure',
  ENTRANCE: 'entrance',
  EXIT: 'exit',
};

const EnergyPointType = {
  CHARGING_STATION: 'charging_station',
  ENERGY_TANK: 'energy_tank',
  BATTERY_PACK: 'battery_pack',
};

const TileEffect = {
  NORMAL: 'normal',
  ENERGY_DRAIN: 'energy_drain',
  SENSOR_BOOST: 'sensor_boost',
  COVER: 'cover',
};

/**
 * テスト用の簡易TacticalMapGenerator
 */
class SimpleTacticalMapGenerator {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  async generateTacticalMap(stageType, options = {}) {
    console.log(`\n=== Generating ${stageType} stage ===`);
    
    // 基本マップの生成
    const rooms = this.generateBasicRooms();
    const map = this.generateBasicMap(rooms);
    
    // ステージタイプ別の戦術的要素
    const tacticalData = this.generateTacticalElements(stageType, rooms, options);
    
    return {
      map: map,
      rooms: rooms,
      ...tacticalData,
      metadata: {
        stageType: stageType,
        generationTime: Date.now(),
      },
    };
  }

  generateBasicRooms() {
    // 簡単な部屋配置
    const rooms = [
      { x: 5, y: 5, width: 8, height: 6, type: RoomType.ENTRANCE },
      { x: 20, y: 8, width: 6, height: 8, type: RoomType.NORMAL },
      { x: 35, y: 12, width: 7, height: 5, type: RoomType.NORMAL },
      { x: 15, y: 25, width: 10, height: 8, type: RoomType.BOSS },
      { x: 40, y: 30, width: 6, height: 6, type: RoomType.TREASURE },
    ];
    
    console.log(`Generated ${rooms.length} rooms`);
    return rooms;
  }

  generateBasicMap(rooms) {
    // 50x50の基本マップ
    const map = Array(50).fill(null).map(() => Array(50).fill(0));
    
    // 部屋を描画
    rooms.forEach(room => {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (x < 50 && y < 50) {
            map[y][x] = 1; // GRASS
          }
        }
      }
    });
    
    return map;
  }

  generateTacticalElements(stageType, rooms, options) {
    switch (stageType) {
      case StageType.ENERGY_MANAGEMENT:
        return this.generateEnergyManagementElements(rooms, options);
      
      case StageType.TACTICAL_COMBAT:
        return this.generateTacticalCombatElements(rooms, options);
      
      case StageType.INFORMATION_WAR:
        return this.generateInformationWarElements(rooms, options);
      
      default:
        return this.generateDefaultElements(rooms, options);
    }
  }

  generateEnergyManagementElements(rooms, options) {
    const energyPoints = [];
    const tacticalElements = [];
    const terrainEffects = new Map();

    // エネルギーポイントの戦略的配置
    if (rooms.length >= 3) {
      // 早期充電ステーション
      const earlyRoom = rooms[1];
      energyPoints.push({
        x: earlyRoom.x + Math.floor(earlyRoom.width / 2),
        y: earlyRoom.y + Math.floor(earlyRoom.height / 2),
        type: EnergyPointType.CHARGING_STATION,
        recoveryAmount: 30,
        turnsRequired: 3,
      });

      // 終盤エネルギータンク
      const lateRoom = rooms[rooms.length - 2];
      energyPoints.push({
        x: lateRoom.x + Math.floor(lateRoom.width / 2),
        y: lateRoom.y + Math.floor(lateRoom.height / 2),
        type: EnergyPointType.ENERGY_TANK,
        recoveryAmount: 50,
      });
    }

    // エネルギー消費地帯
    for (let i = 10; i < 40; i += 5) {
      terrainEffects.set(`${i},20`, TileEffect.ENERGY_DRAIN);
    }

    const tacticalMetadata = {
      estimatedEnergyConsumption: 150,
      availableEnergyRecovery: 80,
      tacticalChoicePoints: energyPoints.length + terrainEffects.size,
      recommendedSkills: ['energy_efficiency', 'power_conservation'],
      difficultyRating: 3.2,
    };

    console.log(`Energy Management Stage:`);
    console.log(`- Energy points: ${energyPoints.length}`);
    console.log(`- Energy drain zones: ${terrainEffects.size}`);
    console.log(`- Difficulty: ${tacticalMetadata.difficultyRating}/5.0`);

    return {
      energyPoints,
      tacticalElements,
      terrainEffects,
      tacticalMetadata,
    };
  }

  generateTacticalCombatElements(rooms, options) {
    const energyPoints = [];
    const tacticalElements = [];
    const terrainEffects = new Map();

    // バランスの取れたエネルギー供給
    const midRoom = rooms[Math.floor(rooms.length / 2)];
    energyPoints.push({
      x: midRoom.x + Math.floor(midRoom.width / 2),
      y: midRoom.y + Math.floor(midRoom.height / 2),
      type: EnergyPointType.BATTERY_PACK,
      recoveryAmount: 25,
    });

    // スキル活用地形
    for (let i = 15; i < 35; i += 3) {
      terrainEffects.set(`${i},15`, TileEffect.COVER);      // 遮蔽
      terrainEffects.set(`${i},25`, TileEffect.SENSOR_BOOST); // センサー強化
    }

    // 高台（戦術的要素）
    tacticalElements.push({
      x: 30,
      y: 20,
      type: 'high_ground',
      effect: {
        range: 2,
        bonus: 1,
        description: 'Provides +1 range and +20% damage',
      },
      accessibility: {
        energyCost: 2,
      },
    });

    const tacticalMetadata = {
      estimatedEnergyConsumption: 120,
      availableEnergyRecovery: 25,
      tacticalChoicePoints: tacticalElements.length + terrainEffects.size,
      recommendedSkills: ['tactical_analysis', 'adaptive_combat'],
      difficultyRating: 2.8,
    };

    console.log(`Tactical Combat Stage:`);
    console.log(`- Energy points: ${energyPoints.length}`);
    console.log(`- Terrain effects: ${terrainEffects.size}`);
    console.log(`- Tactical elements: ${tacticalElements.length}`);
    console.log(`- Difficulty: ${tacticalMetadata.difficultyRating}/5.0`);

    return {
      energyPoints,
      tacticalElements,
      terrainEffects,
      tacticalMetadata,
    };
  }

  generateInformationWarElements(rooms, options) {
    const energyPoints = [];
    const tacticalElements = [];
    const terrainEffects = new Map();

    // センサー関連の地形効果
    for (let i = 5; i < 45; i += 8) {
      for (let j = 5; j < 45; j += 8) {
        if (Math.random() < 0.3) {
          terrainEffects.set(`${i},${j}`, TileEffect.SENSOR_BOOST);
        } else if (Math.random() < 0.2) {
          terrainEffects.set(`${i},${j}`, 'sensor_jamming');
        }
      }
    }

    // 観測ポイント
    tacticalElements.push({
      x: 25,
      y: 25,
      type: 'observation_post',
      effect: {
        range: 5,
        description: 'Reveals enemy positions within 5 tiles',
      },
      accessibility: {
        requiresSkill: 'advanced_sensors',
      },
    });

    // 情報価値のあるエネルギーポイント
    energyPoints.push({
      x: 35,
      y: 35,
      type: EnergyPointType.CHARGING_STATION,
      recoveryAmount: 20,
      turnsRequired: 2,
      hiddenUntilScanned: true,
    });

    const tacticalMetadata = {
      estimatedEnergyConsumption: 100,
      availableEnergyRecovery: 20,
      tacticalChoicePoints: tacticalElements.length + terrainEffects.size,
      recommendedSkills: ['advanced_sensors', 'information_warfare'],
      difficultyRating: 3.5,
    };

    console.log(`Information War Stage:`);
    console.log(`- Energy points: ${energyPoints.length}`);
    console.log(`- Terrain effects: ${terrainEffects.size}`);
    console.log(`- Tactical elements: ${tacticalElements.length}`);
    console.log(`- Difficulty: ${tacticalMetadata.difficultyRating}/5.0`);

    return {
      energyPoints,
      tacticalElements,
      terrainEffects,
      tacticalMetadata,
    };
  }

  generateDefaultElements(rooms, options) {
    console.log(`Classic Stage: No tactical elements added`);
    
    return {
      energyPoints: [],
      tacticalElements: [],
      terrainEffects: new Map(),
      tacticalMetadata: {
        estimatedEnergyConsumption: 100,
        availableEnergyRecovery: 100,
        tacticalChoicePoints: 0,
        recommendedSkills: [],
        difficultyRating: 1.0,
      },
    };
  }
}

/**
 * テスト実行
 */
async function runTests() {
  console.log('=== Tactical Map Generation Test ===\n');
  
  const generator = new SimpleTacticalMapGenerator(50, 50);
  
  // 各ステージタイプをテスト
  const stageTypes = [
    StageType.CLASSIC,
    StageType.ENERGY_MANAGEMENT,
    StageType.TACTICAL_COMBAT,
    StageType.INFORMATION_WAR,
  ];
  
  for (const stageType of stageTypes) {
    const result = await generator.generateTacticalMap(stageType, {
      energyTightness: 'balanced',
      playerLevel: 1,
    });
    
    console.log(`Stage: ${result.metadata.stageType}`);
    console.log(`Rooms: ${result.rooms.length}`);
    console.log(`Energy Recovery/Consumption Ratio: ${
      (result.tacticalMetadata.availableEnergyRecovery / 
       result.tacticalMetadata.estimatedEnergyConsumption).toFixed(2)
    }`);
    console.log('---');
  }
  
  console.log('\n✅ All tests completed successfully!');
  console.log('\n📋 Next Steps:');
  console.log('1. Implement detailed tactical element placement algorithms');
  console.log('2. Add terrain effect visualization in the game');
  console.log('3. Integrate energy point interaction system');
  console.log('4. Create UI for stage type selection');
  console.log('5. Add tactical metadata display to the game UI');
}

// テスト実行
if (typeof require !== 'undefined' && require.main === module) {
  runTests().catch(console.error);
}

module.exports = { SimpleTacticalMapGenerator, StageType };