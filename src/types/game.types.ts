export interface Position {
  x: number;
  y: number;
}

export type CellType = 0 | 1; // 0=벽, 1=길

export type ItemType = 'weapon' | 'armor' | 'potion' | 'material' | 'special';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Item {
  id: string;
  name: string;
  emoji: string;
  type: ItemType;
  attack?: number;
  defense?: number;
  heal?: number;
  description: string;
  rarity: Rarity;
}

export interface MonsterTemplate {
  id: string;
  name: string;
  emoji: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  dropTable: { itemId: string; chance: number }[];
  minStage: number;
  color: string;
}

export interface MonsterInstance {
  templateId: string;
  name: string;
  emoji: string;
  currentHp: number;
  maxHp: number;
  attack: number;
  defense: number;
  color: string;
  dropTable: { itemId: string; chance: number }[];
}

export interface ChestInstance {
  items: string[];
  opened: boolean;
}

export interface Character {
  id: string;
  name: string;
  emoji: string;
  description: string;
  stats: {
    hp: number;
    mp: number;
    attack: number;
    defense: number;
  };
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  baseAttack: number;
  baseDefense: number;
  inventory: Item[];
  equippedWeaponId: string | null;
  equippedArmorId: string | null;
}

export interface CombatLog {
  text: string;
  type: 'player' | 'monster' | 'system';
}

export interface CombatState {
  monsterKey: string;
  monster: MonsterInstance;
  log: CombatLog[];
  phase: 'player-turn' | 'monster-turn' | 'player-won' | 'player-died' | 'fled';
}

export interface ChestOpenState {
  chestKey: string;
  items: Item[];
}

export type GameScreen = 'character-select' | 'playing' | 'stage-clear' | 'game-over';
export type ActiveModal = 'combat' | 'chest' | 'crafting' | 'ranking' | null;

export interface GameState {
  screen: GameScreen;
  stage: number;
  maxClearedStage: number;
  maze: CellType[][];
  mazeSize: number;
  playerPos: Position;
  exitPos: Position;
  visitedCells: string[];
  monsters: Record<string, MonsterInstance>;
  chests: Record<string, ChestInstance>;
  player: PlayerState;
  steps: number;
  startTime: number;
  elapsedSeconds: number;
  activeModal: ActiveModal;
  combatState: CombatState | null;
  chestState: ChestOpenState | null;
  craftResult: { success: boolean; item: Item | null; message: string } | null;
  selectedCraftItems: number[];
  message: string | null;
  completionTime: number | null;
  mapRevealTimer: number;
}

export interface RankingEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  steps: number;
  time: number;
  timestamp: number;
}

export type GameAction =
  | { type: 'INIT_STAGE'; stage: number; character?: Character }
  | { type: 'SET_MAX_CLEARED_STAGE'; stage: number }
  | { type: 'MOVE'; dx: number; dy: number }
  | { type: 'COMBAT_ATTACK' }
  | { type: 'COMBAT_USE_ITEM'; itemIndex: number }
  | { type: 'COMBAT_FLEE' }
  | { type: 'COMBAT_NEXT_PHASE' }
  | { type: 'CHEST_TAKE_ALL' }
  | { type: 'CHEST_CLOSE' }
  | { type: 'TOGGLE_CRAFT_ITEM'; inventoryIndex: number }
  | { type: 'CRAFT_ITEMS' }
  | { type: 'CLEAR_CRAFT_RESULT' }
  | { type: 'EQUIP_ITEM'; itemIndex: number }
  | { type: 'USE_ITEM'; itemIndex: number }
  | { type: 'SET_MODAL'; modal: ActiveModal }
  | { type: 'TICK' }
  | { type: 'CLEAR_MESSAGE' }
  | { type: 'RETURN_TO_SELECT' };
