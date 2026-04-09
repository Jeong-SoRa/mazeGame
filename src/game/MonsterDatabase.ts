import type { MonsterTemplate, MonsterInstance } from '../types/game.types';

export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    id: 'slime', name: '슬라임', emoji: '🫧', color: '#4ade80', element: 'water',
    baseHp: 20, baseAttack: 4, baseDefense: 0, minStage: 1,
    dropTable: [
      { itemId: 'small_potion', chance: 0.5 },
      { itemId: 'herb', chance: 0.4 },
    ],
  },
  {
    id: 'rat', name: '거대 쥐', emoji: '🐀', color: '#a78bfa', element: 'earth',
    baseHp: 15, baseAttack: 3, baseDefense: 0, minStage: 1,
    dropTable: [
      { itemId: 'herb', chance: 0.6 },
      { itemId: 'stick', chance: 0.3 },
    ],
  },
  {
    id: 'goblin', name: '고블린', emoji: '👺', color: '#86efac', element: 'earth',
    baseHp: 35, baseAttack: 7, baseDefense: 2, minStage: 2,
    dropTable: [
      { itemId: 'iron_ore', chance: 0.5 },
      { itemId: 'stick', chance: 0.4 },
      { itemId: 'stone_blade', chance: 0.2 },
    ],
  },
  {
    id: 'skeleton', name: '해골', emoji: '💀', color: '#e5e7eb', element: 'wind',
    baseHp: 45, baseAttack: 10, baseDefense: 3, minStage: 4,
    dropTable: [
      { itemId: 'iron_ore', chance: 0.4 },
      { itemId: 'sword', chance: 0.15 },
      { itemId: 'small_potion', chance: 0.3 },
    ],
  },
  {
    id: 'zombie', name: '좀비', emoji: '🧟', color: '#84cc16', element: 'earth',
    baseHp: 60, baseAttack: 12, baseDefense: 4, minStage: 6,
    dropTable: [
      { itemId: 'poison_fang', chance: 0.4 },
      { itemId: 'herb', chance: 0.5 },
      { itemId: 'potion', chance: 0.2 },
    ],
  },
  {
    id: 'werewolf', name: '늑대인간', emoji: '🐺', color: '#a3a3a3', element: 'wind',
    baseHp: 80, baseAttack: 16, baseDefense: 6, minStage: 8,
    dropTable: [
      { itemId: 'wolf_pelt', chance: 0.6 },
      { itemId: 'fire_stone', chance: 0.2 },
      { itemId: 'potion', chance: 0.3 },
    ],
  },
  {
    id: 'vampire', name: '뱀파이어', emoji: '🧛', color: '#c026d3', element: 'water',
    baseHp: 100, baseAttack: 20, baseDefense: 8, minStage: 10,
    dropTable: [
      { itemId: 'magic_dust', chance: 0.5 },
      { itemId: 'ice_crystal', chance: 0.3 },
      { itemId: 'mega_potion', chance: 0.15 },
    ],
  },
  {
    id: 'troll', name: '트롤', emoji: '👹', color: '#16a34a', element: 'earth',
    baseHp: 130, baseAttack: 24, baseDefense: 10, minStage: 12,
    dropTable: [
      { itemId: 'iron_ore', chance: 0.7 },
      { itemId: 'fire_stone', chance: 0.3 },
      { itemId: 'thunder_stone', chance: 0.1 },
    ],
  },
  {
    id: 'dark_knight', name: '암흑 기사', emoji: '🦹', color: '#7c3aed', element: 'fire',
    baseHp: 160, baseAttack: 28, baseDefense: 14, minStage: 14,
    dropTable: [
      { itemId: 'iron_armor', chance: 0.3 },
      { itemId: 'sword', chance: 0.4 },
      { itemId: 'thunder_stone', chance: 0.2 },
    ],
  },
  {
    id: 'dragon', name: '드래곤', emoji: '🐲', color: '#dc2626', element: 'fire',
    baseHp: 250, baseAttack: 38, baseDefense: 20, minStage: 17,
    dropTable: [
      { itemId: 'dragon_scale', chance: 0.8 },
      { itemId: 'dragon_armor', chance: 0.2 },
      { itemId: 'elixir', chance: 0.1 },
    ],
  },
];

// 스테이지에 맞는 몬스터 템플릿 목록
export function getAvailableMonsters(stage: number): MonsterTemplate[] {
  return MONSTER_TEMPLATES.filter(m => m.minStage <= stage);
}

// 스테이지에 맞게 스케일링된 몬스터 인스턴스 생성
export function createMonsterInstance(stage: number): MonsterInstance {
  const available = getAvailableMonsters(stage);
  const template = available[Math.floor(Math.random() * available.length)];
  const scale = 1 + (stage - 1) * 0.15; // 스테이지당 15% 강화

  const maxHp = Math.round(template.baseHp * scale);
  return {
    templateId: template.id,
    name: template.name,
    emoji: template.emoji,
    color: template.color,
    currentHp: maxHp,
    maxHp,
    attack: Math.round(template.baseAttack * scale),
    defense: Math.round(template.baseDefense * scale),
    dropTable: template.dropTable,
    element: template.element,
  };
}
