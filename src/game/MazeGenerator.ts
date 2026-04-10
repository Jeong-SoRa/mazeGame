import type { CellType, Position } from '../types/game.types';
import type { MonsterInstance, ChestInstance } from '../types/game.types';
import { createMonsterInstance } from './MonsterDatabase';
import { ITEMS } from './ItemDatabase';

// 시드 기반 랜덤 생성기 (LCG 알고리즘)
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // 0~1 사이의 랜덤 값 생성
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  // min ~ max 사이의 정수 생성
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// 스테이지별 미로 크기 (홀수여야 함)
export function getMazeSize(stage: number): number {
  // Stage 1: 11, Stage 10: 29, Stage 20: 49
  return 2 * (5 + stage) + 1;
}

// 재귀 역추적으로 완전 미로 생성 (시드 기반)
export function generateMaze(size: number, rng: SeededRandom): CellType[][] {
  const maze: CellType[][] = Array.from({ length: size }, () =>
    Array(size).fill(0)
  );

  function carve(x: number, y: number) {
    const dirs = [
      [0, -2], [0, 2], [-2, 0], [2, 0],
    ];

    // 시드 기반으로 방향 섞기
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 0) {
        maze[y + dy / 2][x + dx / 2] = 1;
        maze[ny][nx] = 1;
        carve(nx, ny);
      }
    }
  }

  maze[1][1] = 1;
  carve(1, 1);

  return maze;
}

// 열린 칸(길) 목록 수집
function getOpenCells(maze: CellType[][], excludes: string[]): Position[] {
  const positions: Position[] = [];
  const excludeSet = new Set(excludes);
  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[y].length; x++) {
      if (maze[y][x] === 1 && !excludeSet.has(`${x},${y}`)) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

// BFS로 최단 경로 계산
function calculateOptimalSteps(
  maze: CellType[][],
  start: Position,
  end: Position
): number {
  const mazeSize = maze.length;
  const visited = new Set<string>();
  const queue: Array<{ pos: Position; steps: number }> = [];

  queue.push({ pos: start, steps: 0 });
  visited.add(`${start.x},${start.y}`);

  const directions = [
    { dx: 0, dy: -1 }, // 위
    { dx: 0, dy: 1 },  // 아래
    { dx: -1, dy: 0 }, // 왼쪽
    { dx: 1, dy: 0 },  // 오른쪽
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    // 목표 지점 도달
    if (current.pos.x === end.x && current.pos.y === end.y) {
      return current.steps;
    }

    // 인접한 칸들 확인
    for (const dir of directions) {
      const newX = current.pos.x + dir.dx;
      const newY = current.pos.y + dir.dy;
      const key = `${newX},${newY}`;

      // 유효한 범위 내이고, 길이며, 방문하지 않은 칸
      if (
        newX >= 0 && newX < mazeSize &&
        newY >= 0 && newY < mazeSize &&
        maze[newY][newX] === 1 &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push({
          pos: { x: newX, y: newY },
          steps: current.steps + 1
        });
      }
    }
  }

  // 경로를 찾을 수 없는 경우 (이론적으로는 발생하지 않아야 함)
  return -1;
}

// 보물상자 내용물 생성 (스테이지 기반, 시드 기반)
function generateChestItems(stage: number, rng: SeededRandom): string[] {
  const itemPool: string[][] = [
    // tier 1 (공통)
    ['small_potion', 'herb', 'stick', 'stone_blade'],
    // tier 2 (중간)
    ['potion', 'iron_ore', 'fire_stone', 'ice_crystal', 'poison_fang', 'leather_armor'],
    // tier 3 (희귀)
    ['mega_potion', 'sword', 'thunder_stone', 'wolf_pelt', 'magic_dust', 'iron_armor'],
    // tier 4 (에픽)
    ['dragon_scale', 'flame_sword', 'ice_sword', 'thunder_sword', 'dragon_armor'],
  ];

  const tier = Math.min(3, Math.floor((stage - 1) / 5));
  const count = 1 + rng.nextInt(0, 1); // 1~2개
  const pool = [...itemPool[0], ...(tier >= 1 ? itemPool[1] : []), ...(tier >= 2 ? itemPool[2] : []), ...(tier >= 3 ? itemPool[3] : [])];

  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    const itemId = pool[rng.nextInt(0, pool.length - 1)];
    if (ITEMS[itemId]) items.push(itemId);
  }
  return items;
}

export interface GeneratedMap {
  maze: CellType[][];
  mazeSize: number;
  playerPos: Position;
  exitPos: Position;
  monsters: Record<string, MonsterInstance>;
  chests: Record<string, ChestInstance>;
  optimalSteps: number; // 최소 이동수
}

// 전체 맵 생성 (스테이지별 고정 시드 사용)
export function generateMap(stage: number): GeneratedMap {
  // 스테이지별 고정 시드 생성 (큰 소수 사용)
  const seed = stage * 982451653 + 67867967;
  const rng = new SeededRandom(seed);

  const mazeSize = getMazeSize(stage);
  const maze = generateMaze(mazeSize, rng);

  const playerPos: Position = { x: 1, y: 1 };
  const exitPos: Position = { x: mazeSize - 2, y: mazeSize - 2 };
  // 출구도 열린 칸으로
  maze[exitPos.y][exitPos.x] = 1;

  const excludes = [`${playerPos.x},${playerPos.y}`, `${exitPos.x},${exitPos.y}`];
  let openCells = getOpenCells(maze, excludes);

  // 몬스터 배치 (열린 칸의 18~25%)
  const monsterRate = 0.18 + (stage / 20) * 0.07;
  const monsterCount = Math.floor(openCells.length * monsterRate);
  const monsters: Record<string, MonsterInstance> = {};

  for (let i = 0; i < monsterCount && openCells.length > 0; i++) {
    const idx = rng.nextInt(0, openCells.length - 1);
    const pos = openCells.splice(idx, 1)[0];
    const key = `${pos.x},${pos.y}`;
    monsters[key] = createMonsterInstance(stage);
  }

  // 보물상자 배치 (열린 칸의 6~10%)
  openCells = getOpenCells(maze, [...excludes, ...Object.keys(monsters)]);
  const chestRate = 0.06 + (stage / 20) * 0.04;
  const chestCount = Math.floor(openCells.length * chestRate);
  const chests: Record<string, ChestInstance> = {};

  for (let i = 0; i < chestCount && openCells.length > 0; i++) {
    const idx = rng.nextInt(0, openCells.length - 1);
    const pos = openCells.splice(idx, 1)[0];
    const key = `${pos.x},${pos.y}`;
    chests[key] = { items: generateChestItems(stage, rng), opened: false };
  }

  // 최단 경로 계산
  const optimalSteps = calculateOptimalSteps(maze, playerPos, exitPos);

  return { maze, mazeSize, playerPos, exitPos, monsters, chests, optimalSteps };
}
