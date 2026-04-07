import type { CellType, Position } from '../types/game.types';
import type { MonsterInstance, ChestInstance } from '../types/game.types';
import { createMonsterInstance } from './MonsterDatabase';
import { ITEMS } from './ItemDatabase';

// 스테이지별 미로 크기 (홀수여야 함)
export function getMazeSize(stage: number): number {
  // Stage 1: 11, Stage 10: 29, Stage 20: 49
  return 2 * (5 + stage) + 1;
}

// 재귀 역추적으로 완전 미로 생성
export function generateMaze(size: number): CellType[][] {
  const maze: CellType[][] = Array.from({ length: size }, () =>
    Array(size).fill(0)
  );

  function carve(x: number, y: number) {
    const dirs = [
      [0, -2], [0, 2], [-2, 0], [2, 0],
    ].sort(() => Math.random() - 0.5);

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

// 보물상자 내용물 생성 (스테이지 기반)
function generateChestItems(stage: number): string[] {
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
  const count = 1 + Math.floor(Math.random() * 2); // 1~2개
  const pool = [...itemPool[0], ...(tier >= 1 ? itemPool[1] : []), ...(tier >= 2 ? itemPool[2] : []), ...(tier >= 3 ? itemPool[3] : [])];

  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    const itemId = pool[Math.floor(Math.random() * pool.length)];
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
}

// 전체 맵 생성
export function generateMap(stage: number): GeneratedMap {
  const mazeSize = getMazeSize(stage);
  const maze = generateMaze(mazeSize);

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
    const idx = Math.floor(Math.random() * openCells.length);
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
    const idx = Math.floor(Math.random() * openCells.length);
    const pos = openCells.splice(idx, 1)[0];
    const key = `${pos.x},${pos.y}`;
    chests[key] = { items: generateChestItems(stage), opened: false };
  }

  return { maze, mazeSize, playerPos, exitPos, monsters, chests };
}
