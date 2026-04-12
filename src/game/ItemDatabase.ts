import type { Item } from '../types/game.types';

export const ITEMS: Record<string, Item> = {
  // === 무기 ===
  stick: {
    id: 'stick', name: '나무 막대기', emoji: '🪵', type: 'weapon', element: 'earth',
    attack: 2, description: '평범한 나무 막대기. 약한 공격력', rarity: 'common',
  },
  stone_blade: {
    id: 'stone_blade', name: '돌 칼날', emoji: '🪨', type: 'weapon', element: 'earth',
    attack: 5, description: '날카롭게 갈아낸 돌칼', rarity: 'common',
  },
  sword: {
    id: 'sword', name: '철 검', emoji: '⚔️', type: 'weapon', element: 'wind',
    attack: 10, description: '단단한 철로 만든 검', rarity: 'uncommon',
  },
  poison_sword: {
    id: 'poison_sword', name: '독검', emoji: '🗡️', type: 'weapon', element: 'earth',
    attack: 12, description: '독이 발린 위험한 검', rarity: 'rare',
  },
  flame_sword: {
    id: 'flame_sword', name: '화염검', emoji: '🔥', type: 'weapon', element: 'fire',
    attack: 18, description: '불꽃이 타오르는 강력한 검', rarity: 'epic',
  },
  ice_sword: {
    id: 'ice_sword', name: '빙검', emoji: '❄️', type: 'weapon', element: 'water',
    attack: 16, description: '얼음처럼 차가운 마법 검', rarity: 'epic',
  },
  thunder_sword: {
    id: 'thunder_sword', name: '번개검', emoji: '⚡', type: 'weapon', element: 'wind',
    attack: 22, description: '번개의 힘이 담긴 검', rarity: 'legendary',
  },
  dragon_slayer: {
    id: 'dragon_slayer_sword', name: '용살검', emoji: '🐉', type: 'weapon', element: 'fire',
    attack: 30, description: '용을 처치하기 위해 만들어진 궁극의 검', rarity: 'legendary',
  },

  // === 방어구 ===
  leather_armor: {
    id: 'leather_armor', name: '가죽 갑옷', emoji: '🥋', type: 'armor', element: 'earth',
    defense: 4, description: '가벼운 가죽 갑옷', rarity: 'common',
  },
  iron_armor: {
    id: 'iron_armor', name: '철 갑옷', emoji: '🛡️', type: 'armor', element: 'wind',
    defense: 9, description: '무거운 철 갑옷', rarity: 'uncommon',
  },
  dragon_armor: {
    id: 'dragon_armor', name: '용의 갑옷', emoji: '🦾', type: 'armor', element: 'fire',
    defense: 18, description: '용의 비늘로 만든 최강의 갑옷', rarity: 'legendary',
  },

  // === 포션 ===
  small_potion: {
    id: 'small_potion', name: '작은 포션', emoji: '🧪', type: 'potion',
    heal: 25, description: 'HP를 25 회복', rarity: 'common',
  },
  potion: {
    id: 'potion', name: '포션', emoji: '💊', type: 'potion',
    heal: 60, description: 'HP를 60 회복', rarity: 'uncommon',
  },
  mega_potion: {
    id: 'mega_potion', name: '메가 포션', emoji: '💉', type: 'potion',
    heal: 120, description: 'HP를 120 회복', rarity: 'rare',
  },
  elixir: {
    id: 'elixir', name: '엘릭서', emoji: '✨', type: 'potion',
    heal: 9999, description: 'HP를 완전히 회복하는 전설의 물약', rarity: 'legendary',
  },

  // === 재료 ===
  herb: {
    id: 'herb', name: '약초', emoji: '🌿', type: 'material',
    description: '약효가 있는 풀', rarity: 'common',
  },
  iron_ore: {
    id: 'iron_ore', name: '철광석', emoji: '⛏️', type: 'material',
    description: '단단한 철광석', rarity: 'common',
  },
  fire_stone: {
    id: 'fire_stone', name: '화염석', emoji: '🔴', type: 'material',
    description: '뜨거운 마법의 돌', rarity: 'uncommon',
  },
  ice_crystal: {
    id: 'ice_crystal', name: '얼음 결정', emoji: '🔷', type: 'material',
    description: '차가운 마법 결정체', rarity: 'uncommon',
  },
  thunder_stone: {
    id: 'thunder_stone', name: '번개석', emoji: '🟡', type: 'material',
    description: '번개의 에너지가 담긴 돌', rarity: 'rare',
  },
  poison_fang: {
    id: 'poison_fang', name: '독니', emoji: '🦷', type: 'material',
    description: '독이 있는 몬스터의 이빨', rarity: 'uncommon',
  },
  dragon_scale: {
    id: 'dragon_scale', name: '용의 비늘', emoji: '🐲', type: 'material',
    description: '희귀한 용의 비늘', rarity: 'epic',
  },
  wolf_pelt: {
    id: 'wolf_pelt', name: '늑대 가죽', emoji: '🐺', type: 'material',
    description: '질긴 늑대의 가죽', rarity: 'uncommon',
  },
  magic_dust: {
    id: 'magic_dust', name: '마법 가루', emoji: '✨', type: 'material',
    description: '신비로운 마법 가루', rarity: 'rare',
  },

  // === 특수 ===
  eagle: {
    id: 'eagle', name: '독수리', emoji: '🦅', type: 'special',
    description: '1분간 미니맵 경로를 공개합니다', rarity: 'uncommon',
  },
  pouch: {
    id: 'pouch', name: '주머니', emoji: '👜', type: 'special',
    capacity: 5, description: '가방 용량을 5 증가시킵니다. 소지만 해도 효과 적용', rarity: 'rare',
  },
};

// 숨겨진 조합 레시피 (플레이어가 실험으로 발견)
// key: 두 아이템 ID를 알파벳순으로 정렬 후 '+' 연결
export const RECIPES: Record<string, string> = {
  'iron_ore+stick': 'sword',
  'fire_stone+sword': 'flame_sword',
  'ice_crystal+sword': 'ice_sword',
  'poison_fang+sword': 'poison_sword',
  'fire_stone+ice_crystal': 'thunder_stone',
  'thunder_stone+sword': 'thunder_sword',
  'dragon_scale+flame_sword': 'dragon_slayer',
  'herb+small_potion': 'potion',
  'herb+potion': 'mega_potion',
  'dragon_scale+mega_potion': 'elixir',
  'iron_ore+leather_armor': 'iron_armor',
  'dragon_scale+iron_armor': 'dragon_armor',
  'wolf_pelt+stick': 'leather_armor',
  'fire_stone+stone_blade': 'sword',
  'magic_dust+potion': 'mega_potion',
  'magic_dust+sword': 'flame_sword',
  'magic_dust+wolf_pelt': 'pouch',
  'herb+leather_armor': 'pouch',
};

export function craftItems(id1: string, id2: string): Item | null {
  const key = [id1, id2].sort().join('+');
  const resultId = RECIPES[key];
  if (resultId && ITEMS[resultId]) {
    return ITEMS[resultId];
  }
  return null;
}

export const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};
