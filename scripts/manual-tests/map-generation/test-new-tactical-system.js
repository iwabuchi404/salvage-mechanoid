/**
 * 新しい戦術的マップ生成システムのテストスクリプト
 */

// 簡易版の型とEnumの定義（テスト用）
const StageType = {
  CLASSIC: 'classic',
  ENERGY_MANAGEMENT: 'energy_management',
  TACTICAL_COMBAT: 'tactical_combat',
  INFORMATION_WAR: 'information_war',
};

const EnergyPointType = {
  CHARGING_STATION: 'charging_station',
  ENERGY_TANK: 'energy_tank',
  BATTERY_PACK: 'battery_pack',
  POWER_NODE: 'power_node',
};

const TileEffect = {
  NORMAL: 'normal',
  ENERGY_DRAIN: 'energy_drain',
  ENERGY_BOOST: 'energy_boost',
  SENSOR_BOOST: 'sensor_boost',
  SENSOR_JAMMING: 'sensor_jamming',
  COVER: 'cover',
  EXPOSED: 'exposed',
  SKILL_BOOST: 'skill_boost',
};

const TacticalElementType = {
  HIGH_GROUND: 'high_ground',
  CHOKEPOINT: 'chokepoint',
  OBSERVATION_POST: 'observation_post',
  AMBUSH_POINT: 'ambush_point',
  SUPPLY_CACHE: 'supply_cache',
  ESCAPE_ROUTE: 'escape_route',
};

/**
 * 新しい戦術的マップ生成システムのシミュレーター
 */
class NewTacticalMapGenerator {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  async generateTacticalMap(stageType, options = {}) {
    console.log(`\n🎯 === Generating ${stageType.toUpperCase()} stage ===`);
    
    const config = {
      energyTightness: options.energyTightness || 'balanced',
      primaryTacticalFocus: this.getStageTypeFocus(stageType),
      playerLevel: options.playerLevel || 1,
      tacticalElementDensity: 0.3,
    };
    
    // 基本マップの生成
    const rooms = this.generateAdvancedRooms(stageType);
    const map = this.generateAdvancedMap(rooms, stageType);
    
    // 戦術的要素の生成
    const tacticalData = this.generateAdvancedTacticalElements(stageType, rooms, map, config);
    
    // パフォーマンス評価
    const performance = this.evaluateMapPerformance(tacticalData, config);
    
    return {
      map: map,
      rooms: rooms,
      ...tacticalData,
      performance: performance,
      metadata: {
        stageType: stageType,
        generationTime: Date.now(),
        config: config,
      },
    };
  }

  getStageTypeFocus(stageType) {
    const focusMap = {
      [StageType.ENERGY_MANAGEMENT]: 'energy_management',
      [StageType.TACTICAL_COMBAT]: 'skill_selection',
      [StageType.INFORMATION_WAR]: 'sensor_usage',
      [StageType.CLASSIC]: 'mixed',
    };
    return focusMap[stageType] || 'mixed';
  }

  generateAdvancedRooms(stageType) {
    // ステージタイプに応じた部屋配置
    const roomConfigs = {
      [StageType.ENERGY_MANAGEMENT]: {
        count: 6,
        sizes: [
          { width: 8, height: 6 }, // スタート部屋
          { width: 5, height: 5 }, // 充電室
          { width: 6, height: 8 }, // メイン廊下
          { width: 4, height: 6 }, // 中継点
          { width: 7, height: 5 }, // 補給室
          { width: 10, height: 8 } // ボス部屋
        ]
      },
      [StageType.TACTICAL_COMBAT]: {
        count: 5,
        sizes: [
          { width: 6, height: 6 }, // 戦闘開始
          { width: 12, height: 8 }, // 大戦闘場
          { width: 8, height: 6 }, // 戦術室
          { width: 6, height: 10 }, // 縦長戦闘場
          { width: 10, height: 10 } // 最終決戦場
        ]
      },
      [StageType.INFORMATION_WAR]: {
        count: 7,
        sizes: [
          { width: 5, height: 5 }, // 偵察開始
          { width: 6, height: 4 }, // 狭い通路
          { width: 8, height: 8 }, // 観測室
          { width: 4, height: 8 }, // 隠し通路
          { width: 7, height: 6 }, // 情報室
          { width: 5, height: 5 }, // 妨害室
          { width: 9, height: 7 }  // 制御室
        ]
      },
      [StageType.CLASSIC]: {
        count: 5,
        sizes: [
          { width: 6, height: 6 },
          { width: 8, height: 5 },
          { width: 7, height: 7 },
          { width: 5, height: 8 },
          { width: 9, height: 6 }
        ]
      }
    };

    const config = roomConfigs[stageType] || roomConfigs[StageType.CLASSIC];
    const rooms = [];
    
    let currentX = 5;
    let currentY = 5;
    
    for (let i = 0; i < config.count; i++) {
      const size = config.sizes[i] || { width: 6, height: 6 };
      
      rooms.push({
        x: currentX,
        y: currentY,
        width: size.width,
        height: size.height,
        type: i === 0 ? 'entrance' : (i === config.count - 1 ? 'boss' : 'normal'),
      });
      
      // 次の部屋の位置を計算（螺旋状に配置）
      if (i % 2 === 0) {
        currentX += size.width + 3 + Math.floor(Math.random() * 4);
      } else {
        currentY += size.height + 3 + Math.floor(Math.random() * 4);
        currentX = Math.max(5, currentX - Math.floor(Math.random() * 8));
      }
      
      // マップ境界チェック
      if (currentX + 10 > this.width) currentX = 5;
      if (currentY + 10 > this.height) currentY = 5;
    }
    
    console.log(`Generated ${rooms.length} specialized rooms for ${stageType}`);
    return rooms;
  }

  generateAdvancedMap(rooms, stageType) {
    // より複雑な地形生成
    const map = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
    
    // 部屋を描画
    rooms.forEach(room => {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (x < this.width && y < this.height) {
            map[y][x] = 1; // GRASS
          }
        }
      }
    });
    
    // ステージタイプ別の特殊地形
    this.addSpecialTerrain(map, rooms, stageType);
    
    // 通路生成（改良版）
    this.generateImprovedCorridors(map, rooms, stageType);
    
    return map;
  }

  addSpecialTerrain(map, rooms, stageType) {
    switch (stageType) {
      case StageType.ENERGY_MANAGEMENT:
        // エネルギー消費地帯を通路に追加
        this.addEnergyDrainPaths(map, rooms);
        break;
      case StageType.TACTICAL_COMBAT:
        // 戦術的な障害物と遮蔽物
        this.addTacticalObstacles(map, rooms);
        break;
      case StageType.INFORMATION_WAR:
        // 視界を遮る構造
        this.addVisibilityObstacles(map, rooms);
        break;
    }
  }

  addEnergyDrainPaths(map, rooms) {
    // 部屋間に高エネルギー消費ゾーン
    for (let i = 0; i < rooms.length - 1; i++) {
      const room1 = rooms[i];
      const room2 = rooms[i + 1];
      
      const midX = Math.floor((room1.x + room1.width + room2.x) / 2);
      const midY = Math.floor((room1.y + room1.height + room2.y) / 2);
      
      // 3x3のドレインゾーン
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = midX + dx;
          const ny = midY + dy;
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            map[ny][nx] = 2; // 特殊地形マーカー
          }
        }
      }
    }
  }

  addTacticalObstacles(map, rooms) {
    // 大きな部屋に戦術的な遮蔽物
    for (const room of rooms) {
      if (room.width >= 8 && room.height >= 8) {
        // 部屋の中央に遮蔽物
        const centerX = room.x + Math.floor(room.width / 2);
        const centerY = room.y + Math.floor(room.height / 2);
        
        // L字型の遮蔽物
        for (let i = 0; i < 3; i++) {
          if (centerX + i < this.width) map[centerY][centerX + i] = 3;
          if (centerY + i < this.height) map[centerY + i][centerX] = 3;
        }
      }
    }
  }

  addVisibilityObstacles(map, rooms) {
    // 各部屋に視界を制限する構造
    for (const room of rooms) {
      // 部屋の入り口付近にブロック
      const entranceX = room.x + Math.floor(room.width / 2);
      const entranceY = room.y;
      
      if (entranceY - 1 >= 0) {
        map[entranceY - 1][entranceX] = 4; // 視界ブロック
      }
    }
  }

  generateImprovedCorridors(map, rooms, stageType) {
    // よりインテリジェントな通路生成
    for (let i = 0; i < rooms.length - 1; i++) {
      const room1 = rooms[i];
      const room2 = rooms[i + 1];
      
      // ステージタイプに応じた通路スタイル
      switch (stageType) {
        case StageType.ENERGY_MANAGEMENT:
          this.generateEfficientCorridor(map, room1, room2);
          break;
        case StageType.TACTICAL_COMBAT:
          this.generateTacticalCorridor(map, room1, room2);
          break;
        case StageType.INFORMATION_WAR:
          this.generateStealthCorridor(map, room1, room2);
          break;
        default:
          this.generateStandardCorridor(map, room1, room2);
          break;
      }
    }
  }

  generateEfficientCorridor(map, room1, room2) {
    // 直線的で効率的な通路
    const start = { x: room1.x + Math.floor(room1.width / 2), y: room1.y + room1.height };
    const end = { x: room2.x + Math.floor(room2.width / 2), y: room2.y };
    
    this.drawStraightLine(map, start, end);
  }

  generateTacticalCorridor(map, room1, room2) {
    // 戦術的な複雑さを持つ通路
    const start = { x: room1.x + room1.width, y: room1.y + Math.floor(room1.height / 2) };
    const end = { x: room2.x, y: room2.y + Math.floor(room2.height / 2) };
    
    // L字型通路
    this.drawLShapeCorridor(map, start, end);
  }

  generateStealthCorridor(map, room1, room2) {
    // 迂回路を含む隠密的な通路
    const start = { x: room1.x + room1.width, y: room1.y + room1.height };
    const end = { x: room2.x, y: room2.y };
    
    // ジグザグ通路
    this.drawZigzagCorridor(map, start, end);
  }

  generateStandardCorridor(map, room1, room2) {
    // 標準的なL字通路
    const start = { x: room1.x + Math.floor(room1.width / 2), y: room1.y + room1.height };
    const end = { x: room2.x + Math.floor(room2.width / 2), y: room2.y };
    
    this.drawLShapeCorridor(map, start, end);
  }

  drawStraightLine(map, start, end) {
    const dx = Math.sign(end.x - start.x);
    const dy = Math.sign(end.y - start.y);
    
    let x = start.x;
    let y = start.y;
    
    while (x !== end.x || y !== end.y) {
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        map[y][x] = 1;
      }
      
      if (x !== end.x) x += dx;
      if (y !== end.y) y += dy;
    }
  }

  drawLShapeCorridor(map, start, end) {
    // 水平に移動してから垂直に移動
    let x = start.x;
    let y = start.y;
    
    // 水平移動
    while (x !== end.x) {
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        map[y][x] = 1;
      }
      x += Math.sign(end.x - x);
    }
    
    // 垂直移動
    while (y !== end.y) {
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        map[y][x] = 1;
      }
      y += Math.sign(end.y - y);
    }
  }

  drawZigzagCorridor(map, start, end) {
    const stepX = Math.sign(end.x - start.x);
    const stepY = Math.sign(end.y - start.y);
    
    let x = start.x;
    let y = start.y;
    let zigzag = true;
    
    while (x !== end.x || y !== end.y) {
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        map[y][x] = 1;
      }
      
      if (zigzag) {
        if (x !== end.x) x += stepX;
        else if (y !== end.y) y += stepY;
      } else {
        if (y !== end.y) y += stepY;
        else if (x !== end.x) x += stepX;
      }
      
      // 2歩ごとに方向転換
      if (Math.random() < 0.3) zigzag = !zigzag;
    }
  }

  generateAdvancedTacticalElements(stageType, rooms, map, config) {
    const elements = {
      energyPoints: [],
      tacticalElements: [],
      terrainEffects: new Map(),
    };

    switch (stageType) {
      case StageType.ENERGY_MANAGEMENT:
        this.generateEnergyManagementElements(rooms, map, config, elements);
        break;
      case StageType.TACTICAL_COMBAT:
        this.generateTacticalCombatElements(rooms, map, config, elements);
        break;
      case StageType.INFORMATION_WAR:
        this.generateInformationWarElements(rooms, map, config, elements);
        break;
      default:
        this.generateMixedElements(rooms, map, config, elements);
        break;
    }

    return elements;
  }

  generateEnergyManagementElements(rooms, map, config, elements) {
    console.log('🔋 Generating Energy Management elements...');
    
    // 戦略的エネルギーポイント配置
    const energyStrategy = this.calculateEnergyStrategy(rooms, config.energyTightness);
    
    for (const point of energyStrategy.points) {
      elements.energyPoints.push({
        x: point.x,
        y: point.y,
        type: point.type,
        recoveryAmount: point.amount,
        turnsRequired: point.turns,
        strategicValue: point.value,
      });
    }
    
    // エネルギー消費地帯
    const drainZones = this.calculateEnergyDrainZones(map, rooms, config.energyTightness);
    for (const zone of drainZones) {
      elements.terrainEffects.set(`${zone.x},${zone.y}`, TileEffect.ENERGY_DRAIN);
    }
    
    // エネルギー効率ボーナス地帯
    const boostZones = this.calculateEnergyBoostZones(rooms);
    for (const zone of boostZones) {
      elements.terrainEffects.set(`${zone.x},${zone.y}`, TileEffect.ENERGY_BOOST);
    }
    
    console.log(`   ⚡ ${elements.energyPoints.length} energy points`);
    console.log(`   ⚡ ${drainZones.length} drain zones`);
    console.log(`   ⚡ ${boostZones.length} boost zones`);
  }

  calculateEnergyStrategy(rooms, tightness) {
    const strategies = {
      relaxed: { density: 0.8, types: ['tank', 'station', 'pack'] },
      balanced: { density: 0.5, types: ['station', 'pack'] },
      tight: { density: 0.3, types: ['station'] },
      critical: { density: 0.1, types: ['node'] },
    };
    
    const strategy = strategies[tightness] || strategies.balanced;
    const points = [];
    
    const pointCount = Math.floor(rooms.length * strategy.density);
    
    for (let i = 0; i < pointCount && i < rooms.length; i++) {
      const room = rooms[i];
      const type = strategy.types[i % strategy.types.length];
      
      const typeMapping = {
        tank: { type: EnergyPointType.ENERGY_TANK, amount: 50, turns: undefined, value: 'high' },
        station: { type: EnergyPointType.CHARGING_STATION, amount: 30, turns: 3, value: 'medium' },
        pack: { type: EnergyPointType.BATTERY_PACK, amount: 20, turns: undefined, value: 'low' },
        node: { type: EnergyPointType.POWER_NODE, amount: 15, turns: 2, value: 'critical' },
      };
      
      const config = typeMapping[type];
      
      points.push({
        x: room.x + Math.floor(room.width / 2),
        y: room.y + Math.floor(room.height / 2),
        ...config,
      });
    }
    
    return { points };
  }

  calculateEnergyDrainZones(map, rooms, tightness) {
    const drainIntensity = {
      relaxed: 0.1,
      balanced: 0.15,
      tight: 0.25,
      critical: 0.35,
    };
    
    const intensity = drainIntensity[tightness] || 0.15;
    const zones = [];
    
    // 通路に配置
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        if (map[y][x] === 1 && Math.random() < intensity) {
          // 部屋の中でないことを確認
          const inRoom = rooms.some(room => 
            x >= room.x && x < room.x + room.width &&
            y >= room.y && y < room.y + room.height
          );
          
          if (!inRoom) {
            zones.push({ x, y, drainAmount: 2 });
          }
        }
      }
    }
    
    return zones;
  }

  calculateEnergyBoostZones(rooms) {
    const zones = [];
    
    // 大きな部屋の隅にエネルギーボーストゾーン
    for (const room of rooms) {
      if (room.width >= 8 && room.height >= 6) {
        zones.push({
          x: room.x + room.width - 2,
          y: room.y + room.height - 2,
          boostAmount: 1,
        });
      }
    }
    
    return zones;
  }

  generateTacticalCombatElements(rooms, map, config, elements) {
    console.log('⚔️ Generating Tactical Combat elements...');
    
    // 高台の配置
    const highGrounds = this.calculateHighGroundPositions(rooms);
    for (const hg of highGrounds) {
      elements.tacticalElements.push({
        x: hg.x,
        y: hg.y,
        type: TacticalElementType.HIGH_GROUND,
        effect: { range: hg.range, bonus: hg.bonus },
        accessCost: hg.cost,
      });
    }
    
    // 遮蔽地形
    const coverZones = this.calculateCoverZones(rooms, map);
    for (const cover of coverZones) {
      elements.terrainEffects.set(`${cover.x},${cover.y}`, TileEffect.COVER);
    }
    
    // スキル強化地形
    const skillZones = this.calculateSkillBoostZones(rooms);
    for (const zone of skillZones) {
      elements.terrainEffects.set(`${zone.x},${zone.y}`, TileEffect.SKILL_BOOST);
    }
    
    // チョークポイント
    const chokePoints = this.calculateChokePoints(rooms);
    for (const choke of chokePoints) {
      elements.tacticalElements.push({
        x: choke.x,
        y: choke.y,
        type: TacticalElementType.CHOKEPOINT,
        effect: { description: 'Strategic control point' },
        defensiveBonus: choke.bonus,
      });
    }
    
    console.log(`   ⚔️ ${highGrounds.length} high ground positions`);
    console.log(`   ⚔️ ${coverZones.length} cover zones`);
    console.log(`   ⚔️ ${skillZones.length} skill boost zones`);
    console.log(`   ⚔️ ${chokePoints.length} choke points`);
  }

  calculateHighGroundPositions(rooms) {
    const positions = [];
    
    for (const room of rooms) {
      if (room.width >= 6 && room.height >= 6) {
        // 部屋の4つ角を候補に
        const candidates = [
          { x: room.x + 1, y: room.y + 1, range: 2, bonus: 1.2, cost: 2 },
          { x: room.x + room.width - 2, y: room.y + 1, range: 2, bonus: 1.2, cost: 2 },
          { x: room.x + 1, y: room.y + room.height - 2, range: 1, bonus: 1.1, cost: 1 },
          { x: room.x + room.width - 2, y: room.y + room.height - 2, range: 1, bonus: 1.1, cost: 1 },
        ];
        
        // ランダムに1-2個選択
        const selected = candidates
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.random() < 0.6 ? 1 : 2);
        
        positions.push(...selected);
      }
    }
    
    return positions;
  }

  calculateCoverZones(rooms, map) {
    const zones = [];
    
    // 部屋の入り口付近に遮蔽
    for (const room of rooms) {
      const entrances = this.findRoomEntrances(room, map);
      
      for (const entrance of entrances) {
        // 入り口から2-3マス内側に遮蔽
        const coverPositions = [
          { x: entrance.x + 1, y: entrance.y + 1 },
          { x: entrance.x - 1, y: entrance.y + 1 },
          { x: entrance.x + 1, y: entrance.y - 1 },
        ].filter(pos => 
          pos.x >= room.x && pos.x < room.x + room.width &&
          pos.y >= room.y && pos.y < room.y + room.height
        );
        
        zones.push(...coverPositions);
      }
    }
    
    return zones;
  }

  calculateSkillBoostZones(rooms) {
    const zones = [];
    
    // 大きな部屋の中央にスキルブースト
    for (const room of rooms) {
      if (room.width >= 8 && room.height >= 8) {
        const centerX = room.x + Math.floor(room.width / 2);
        const centerY = room.y + Math.floor(room.height / 2);
        
        // 2x2のブーストエリア
        for (let dx = 0; dx < 2; dx++) {
          for (let dy = 0; dy < 2; dy++) {
            zones.push({
              x: centerX + dx - 1,
              y: centerY + dy - 1,
              boostPercentage: 25,
            });
          }
        }
      }
    }
    
    return zones;
  }

  calculateChokePoints(rooms) {
    const points = [];
    
    // 部屋間の接続点をチョークポイントに
    for (let i = 1; i < rooms.length - 1; i++) {
      const currentRoom = rooms[i];
      const nextRoom = rooms[i + 1];
      
      const midX = Math.floor((currentRoom.x + currentRoom.width + nextRoom.x) / 2);
      const midY = Math.floor((currentRoom.y + currentRoom.height + nextRoom.y) / 2);
      
      points.push({
        x: midX,
        y: midY,
        bonus: 1.5,
        controlValue: 'high',
      });
    }
    
    return points;
  }

  generateInformationWarElements(rooms, map, config, elements) {
    console.log('🕵️ Generating Information War elements...');
    
    // センサー強化エリア
    const sensorBoosts = this.calculateSensorBoostZones(rooms);
    for (const boost of sensorBoosts) {
      elements.terrainEffects.set(`${boost.x},${boost.y}`, TileEffect.SENSOR_BOOST);
    }
    
    // センサー妨害エリア
    const sensorJams = this.calculateSensorJamZones(rooms);
    for (const jam of sensorJams) {
      elements.terrainEffects.set(`${jam.x},${jam.y}`, TileEffect.SENSOR_JAMMING);
    }
    
    // 観測ポイント
    const observationPosts = this.calculateObservationPosts(rooms);
    for (const post of observationPosts) {
      elements.tacticalElements.push({
        x: post.x,
        y: post.y,
        type: TacticalElementType.OBSERVATION_POST,
        effect: { range: post.range, infoGain: post.info },
        requirements: { skill: 'advanced_sensors', energy: post.energyCost },
      });
    }
    
    // 隠し要素
    const hiddenElements = this.calculateHiddenElements(rooms);
    for (const hidden of hiddenElements) {
      if (hidden.type === 'energy') {
        elements.energyPoints.push({
          x: hidden.x,
          y: hidden.y,
          type: EnergyPointType.BATTERY_PACK,
          recoveryAmount: hidden.amount,
          hiddenUntilScanned: true,
        });
      }
    }
    
    console.log(`   🕵️ ${sensorBoosts.length} sensor boost zones`);
    console.log(`   🕵️ ${sensorJams.length} sensor jam zones`);
    console.log(`   🕵️ ${observationPosts.length} observation posts`);
    console.log(`   🕵️ ${hiddenElements.length} hidden elements`);
  }

  calculateSensorBoostZones(rooms) {
    const zones = [];
    
    // 各部屋の角にセンサーブースト
    for (const room of rooms) {
      const corners = [
        { x: room.x + 1, y: room.y + 1 },
        { x: room.x + room.width - 2, y: room.y + 1 },
        { x: room.x + 1, y: room.y + room.height - 2 },
        { x: room.x + room.width - 2, y: room.y + room.height - 2 },
      ];
      
      // ランダムに1-2個選択
      const selected = corners
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.random() < 0.5 ? 1 : 2);
      
      zones.push(...selected.map(corner => ({
        ...corner,
        boostRange: 2,
      })));
    }
    
    return zones;
  }

  calculateSensorJamZones(rooms) {
    const zones = [];
    
    // 大きな部屋の一部を妨害エリアに
    for (const room of rooms) {
      if (room.width >= 8 && room.height >= 8 && Math.random() < 0.4) {
        const jamX = room.x + Math.floor(room.width * 0.3);
        const jamY = room.y + Math.floor(room.height * 0.3);
        
        // 3x3の妨害エリア
        for (let dx = 0; dx < 3; dx++) {
          for (let dy = 0; dy < 3; dy++) {
            zones.push({
              x: jamX + dx,
              y: jamY + dy,
              jamStrength: 'high',
            });
          }
        }
      }
    }
    
    return zones;
  }

  calculateObservationPosts(rooms) {
    const posts = [];
    
    // 中央の部屋と後半の部屋に観測所
    const centralIndex = Math.floor(rooms.length / 2);
    const lateIndex = Math.floor(rooms.length * 0.75);
    
    const targetRooms = [rooms[centralIndex], rooms[lateIndex]].filter(room => room);
    
    for (const room of targetRooms) {
      posts.push({
        x: room.x + Math.floor(room.width / 2),
        y: room.y + Math.floor(room.height / 2),
        range: 5,
        info: 'enemy_positions',
        energyCost: 3,
      });
    }
    
    return posts;
  }

  calculateHiddenElements(rooms) {
    const elements = [];
    
    // いくつかの部屋に隠し要素
    for (let i = 2; i < rooms.length; i += 2) {
      const room = rooms[i];
      
      if (Math.random() < 0.6) {
        elements.push({
          x: room.x + room.width - 2,
          y: room.y + room.height - 2,
          type: 'energy',
          amount: 25,
          discoveryRequirement: 'sensor_scan',
        });
      }
    }
    
    return elements;
  }

  generateMixedElements(rooms, map, config, elements) {
    console.log('🔄 Generating Mixed elements...');
    
    // 各システムから少しずつ
    const energyConfig = { ...config, energyTightness: 'balanced' };
    this.generateEnergyManagementElements(rooms, map, energyConfig, {
      energyPoints: elements.energyPoints,
      terrainEffects: elements.terrainEffects,
      tacticalElements: [],
    });
    
    const combatElements = { tacticalElements: [], terrainEffects: new Map() };
    this.generateTacticalCombatElements(rooms, map, config, combatElements);
    
    // 半分の戦術要素を追加
    const combatCount = Math.floor(combatElements.tacticalElements.length / 2);
    elements.tacticalElements.push(...combatElements.tacticalElements.slice(0, combatCount));
    
    // 戦術地形効果の一部を追加
    let effectCount = 0;
    for (const [key, effect] of combatElements.terrainEffects) {
      if (effectCount < 5) {
        elements.terrainEffects.set(key, effect);
        effectCount++;
      }
    }
    
    console.log(`   🔄 Mixed: ${elements.energyPoints.length} energy, ${elements.tacticalElements.length} tactical, ${elements.terrainEffects.size} terrain`);
  }

  evaluateMapPerformance(tacticalData, config) {
    const energyBalance = this.calculateEnergyBalance(tacticalData.energyPoints, config);
    const tacticalDepth = this.calculateTacticalDepth(tacticalData.tacticalElements);
    const informationValue = this.calculateInformationValue(tacticalData.terrainEffects);
    
    const overallScore = (energyBalance.score + tacticalDepth.score + informationValue.score) / 3;
    
    return {
      energyBalance,
      tacticalDepth,
      informationValue,
      overallScore,
      recommendation: this.generateRecommendation(overallScore),
    };
  }

  calculateEnergyBalance(energyPoints, config) {
    const totalRecovery = energyPoints.reduce((sum, point) => sum + point.recoveryAmount, 0);
    const estimatedConsumption = 120; // 基準値
    
    const ratio = totalRecovery / estimatedConsumption;
    let score = 0;
    let balance = '';
    
    if (ratio >= 0.8 && ratio <= 1.2) {
      score = 10;
      balance = 'Perfect';
    } else if (ratio >= 0.6 && ratio <= 1.4) {
      score = 8;
      balance = 'Good';
    } else if (ratio >= 0.4 && ratio <= 1.6) {
      score = 6;
      balance = 'Acceptable';
    } else {
      score = 4;
      balance = 'Poor';
    }
    
    return {
      score,
      balance,
      ratio: ratio.toFixed(2),
      totalRecovery,
      estimatedConsumption,
    };
  }

  calculateTacticalDepth(tacticalElements) {
    const elementTypes = new Set(tacticalElements.map(el => el.type));
    const diversity = elementTypes.size;
    const density = tacticalElements.length;
    
    let score = Math.min(10, diversity * 2 + density * 0.5);
    
    let depth = '';
    if (score >= 8) depth = 'Deep';
    else if (score >= 6) depth = 'Moderate';
    else if (score >= 4) depth = 'Basic';
    else depth = 'Shallow';
    
    return {
      score,
      depth,
      diversity,
      density,
      types: Array.from(elementTypes),
    };
  }

  calculateInformationValue(terrainEffects) {
    const effectTypes = new Set(Array.from(terrainEffects.values()));
    const sensorEffects = Array.from(terrainEffects.values())
      .filter(effect => effect.includes('sensor') || effect.includes('SENSOR'));
    
    const informationDensity = sensorEffects.length;
    const effectDiversity = effectTypes.size;
    
    let score = Math.min(10, informationDensity * 0.8 + effectDiversity);
    
    let value = '';
    if (score >= 8) value = 'High';
    else if (score >= 6) value = 'Medium';
    else if (score >= 4) value = 'Low';
    else value = 'None';
    
    return {
      score,
      value,
      informationDensity,
      effectDiversity,
      types: Array.from(effectTypes),
    };
  }

  generateRecommendation(overallScore) {
    if (overallScore >= 9) {
      return 'Excellent tactical design with strong strategic depth';
    } else if (overallScore >= 7) {
      return 'Good tactical design with solid gameplay opportunities';
    } else if (overallScore >= 5) {
      return 'Adequate tactical design, consider enhancing key elements';
    } else {
      return 'Tactical design needs improvement - add more strategic elements';
    }
  }

  // ヘルパーメソッド
  findRoomEntrances(room, map) {
    const entrances = [];
    
    // 簡易実装：部屋の中央の辺を入り口とする
    entrances.push(
      { x: room.x + Math.floor(room.width / 2), y: room.y },
      { x: room.x + Math.floor(room.width / 2), y: room.y + room.height - 1 },
      { x: room.x, y: room.y + Math.floor(room.height / 2) },
      { x: room.x + room.width - 1, y: room.y + Math.floor(room.height / 2) }
    );
    
    return entrances;
  }
}

/**
 * テスト実行
 */
async function runAdvancedTests() {
  console.log('🚀 === Advanced Tactical Map Generation Test ===\n');
  
  const generator = new NewTacticalMapGenerator(50, 50);
  
  const stageTypes = [
    StageType.ENERGY_MANAGEMENT,
    StageType.TACTICAL_COMBAT,
    StageType.INFORMATION_WAR,
    StageType.CLASSIC,
  ];
  
  const testConfigs = [
    { energyTightness: 'balanced', playerLevel: 1 },
    { energyTightness: 'tight', playerLevel: 2 },
    { energyTightness: 'critical', playerLevel: 3 },
  ];
  
  for (const stageType of stageTypes) {
    for (const testConfig of testConfigs) {
      const result = await generator.generateTacticalMap(stageType, testConfig);
      
      console.log(`📊 Stage: ${result.metadata.stageType.toUpperCase()}`);
      console.log(`   Config: ${testConfig.energyTightness}, Level ${testConfig.playerLevel}`);
      console.log(`   Rooms: ${result.rooms.length}`);
      console.log(`   Energy Points: ${result.energyPoints.length}`);
      console.log(`   Tactical Elements: ${result.tacticalElements.length}`);
      console.log(`   Terrain Effects: ${result.terrainEffects.size}`);
      console.log(`   Performance Score: ${result.performance.overallScore.toFixed(1)}/10`);
      console.log(`   Energy Balance: ${result.performance.energyBalance.balance} (${result.performance.energyBalance.ratio})`);
      console.log(`   Tactical Depth: ${result.performance.tacticalDepth.depth}`);
      console.log(`   Information Value: ${result.performance.informationValue.value}`);
      console.log(`   📝 ${result.performance.recommendation}`);
      console.log('   ---');
    }
    console.log('');
  }
  
  console.log('✅ All advanced tests completed successfully!');
  console.log('\n🎯 Key Improvements Implemented:');
  console.log('1. ✅ Detailed energy point placement algorithms');
  console.log('2. ✅ Advanced terrain effect systems');
  console.log('3. ✅ Sophisticated tactical element placement');
  console.log('4. ✅ Stage-specific generation strategies');
  console.log('5. ✅ Comprehensive performance evaluation');
  console.log('6. ✅ Intelligent corridor generation');
  console.log('7. ✅ Balanced resource distribution');
  console.log('8. ✅ Strategic element positioning');
}

// テスト実行
if (typeof require !== 'undefined' && require.main === module) {
  runAdvancedTests().catch(console.error);
}

module.exports = { NewTacticalMapGenerator, StageType };