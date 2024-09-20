import { TileType } from './types';

interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MapGenerator {
  private width: number;
  private height: number;
  private minRoomSize: number;
  private maxRoomSize: number;
  private minRoomDistance: number;
  private map: TileType[][];
  private rooms: Room[];

  constructor(width: number, height: number, minRoomSize: number, maxRoomSize: number) {
    this.width = width;
    this.height = height;
    this.minRoomSize = minRoomSize;
    this.maxRoomSize = maxRoomSize;
    this.minRoomDistance = 3; // 部屋間の最小距離
    this.map = [];
    this.rooms = [];
  }

  generateMap(): TileType[][] {
    this.initializeMap();
    this.splitSpace(0, 0, this.width, this.height, 0);
    this.connectRooms();
    this.addRandomFeatures();
    return this.map;
  }

  private initializeMap() {
    for (let y = 0; y < this.height; y++) {
      this.map[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.map[y][x] = TileType.EMPTY;
      }
    }
  }

  private splitSpace(x: number, y: number, width: number, height: number, depth: number) {
    if (
      width < this.maxRoomSize * 2 + this.minRoomDistance ||
      height < this.maxRoomSize * 2 + this.minRoomDistance ||
      depth > 10
    ) {
      this.createRoom(x, y, width, height);
      return;
    }

    const splitVertical = width > height;
    const splitPosition = splitVertical
      ? x + Math.floor(width / 2 + (Math.random() * 0.5 - 0.25) * width)
      : y + Math.floor(height / 2 + (Math.random() * 0.5 - 0.25) * height);

    if (splitVertical) {
      this.splitSpace(x, y, splitPosition - x, height, depth + 1);
      this.splitSpace(splitPosition, y, x + width - splitPosition, height, depth + 1);
    } else {
      this.splitSpace(x, y, width, splitPosition - y, depth + 1);
      this.splitSpace(x, splitPosition, width, y + height - splitPosition, depth + 1);
    }
  }

  private createRoom(x: number, y: number, width: number, height: number) {
    const roomWidth = Math.max(
      this.minRoomSize,
      Math.min(width - this.minRoomDistance * 2, this.maxRoomSize)
    );
    const roomHeight = Math.max(
      this.minRoomSize,
      Math.min(height - this.minRoomDistance * 2, this.maxRoomSize)
    );
    const roomX = Math.min(
      this.width - roomWidth - this.minRoomDistance,
      Math.max(this.minRoomDistance, x + Math.floor((width - roomWidth) / 2))
    );
    const roomY = Math.min(
      this.height - roomHeight - this.minRoomDistance,
      Math.max(this.minRoomDistance, y + Math.floor((height - roomHeight) / 2))
    );

    // 部屋の周りに壁（EMPTYタイル）を配置
    for (let dy = -1; dy <= roomHeight; dy++) {
      for (let dx = -1; dx <= roomWidth; dx++) {
        if (
          roomY + dy >= 0 &&
          roomY + dy < this.height &&
          roomX + dx >= 0 &&
          roomX + dx < this.width
        ) {
          this.map[roomY + dy][roomX + dx] = TileType.EMPTY;
        }
      }
    }

    // 部屋の内部をGRASSタイルで埋める
    for (let dy = 0; dy < roomHeight; dy++) {
      for (let dx = 0; dx < roomWidth; dx++) {
        if (roomY + dy < this.height && roomX + dx < this.width) {
          this.map[roomY + dy][roomX + dx] = TileType.GRASS;
        }
      }
    }

    this.rooms.push({ x: roomX, y: roomY, width: roomWidth, height: roomHeight });
  }

  private connectRooms() {
    const sortedRooms = [...this.rooms].sort((a, b) => a.x - b.x);

    for (let i = 0; i < sortedRooms.length - 1; i++) {
      const roomA = sortedRooms[i];
      const roomB = sortedRooms[i + 1];
      this.createCorridor(
        roomA.x + Math.floor(roomA.width / 2),
        roomA.y + Math.floor(roomA.height / 2),
        roomB.x + Math.floor(roomB.width / 2),
        roomB.y + Math.floor(roomB.height / 2)
      );
    }

    // 追加の通路を生成
    for (let i = 0; i < Math.floor(this.rooms.length / 2); i++) {
      const roomA = this.rooms[Math.floor(Math.random() * this.rooms.length)];
      const roomB = this.rooms[Math.floor(Math.random() * this.rooms.length)];
      if (roomA !== roomB) {
        this.createCorridor(
          roomA.x + Math.floor(roomA.width / 2),
          roomA.y + Math.floor(roomA.height / 2),
          roomB.x + Math.floor(roomB.width / 2),
          roomB.y + Math.floor(roomB.height / 2)
        );
      }
    }
  }

  private createCorridor(x1: number, y1: number, x2: number, y2: number) {
    let x = x1;
    let y = y1;

    const path: { x: number; y: number }[] = [];

    while (x !== x2 || y !== y2) {
      if (Math.random() < 0.5) {
        if (x < x2) x++;
        else if (x > x2) x--;
      } else {
        if (y < y2) y++;
        else if (y > y2) y--;
      }

      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        path.push({ x, y });
      }
    }

    // 通路を作成し、周囲に壁を配置
    for (const point of path) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = point.x + dx;
          const ny = point.y + dy;
          if (ny >= 0 && ny < this.height && nx >= 0 && nx < this.width) {
            if (dx === 0 && dy === 0) {
              this.map[ny][nx] = TileType.GRASS; // 通路の中心
            } else if (this.map[ny][nx] === TileType.EMPTY) {
              this.map[ny][nx] = TileType.EMPTY; // 通路の壁
            }
          }
        }
      }
    }
  }

  private addRandomFeatures() {
    const featureCount = Math.floor(this.width * this.height * 0.01); // マップの1%の数のランダム要素を追加
    for (let i = 0; i < featureCount; i++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      if (this.map[y][x] === TileType.GRASS) {
        this.map[y][x] = Math.random() < 0.7 ? TileType.WATER : TileType.MOUNTAIN;
      }
    }
  }
}
