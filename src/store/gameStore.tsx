import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { GameState, GameAction, PlayerState, CombatState } from '../types/game.types';
import { generateMap } from '../game/MazeGenerator';
import { ITEMS, craftItems } from '../game/ItemDatabase';
import { doPlayerAttack, usePotion, tryFlee, calculateDrops } from '../game/CombatSystem';

// ─── 초기 플레이어 ───────────────────────────────────────────────────────────
function createInitialPlayer(): PlayerState {
  return {
    hp: 100,
    maxHp: 100,
    baseAttack: 6,
    baseDefense: 2,
    inventory: [],
    equippedWeaponId: null,
    equippedArmorId: null,
  };
}

// ─── 초기 상태 ───────────────────────────────────────────────────────────────
const initialState: GameState = {
  screen: 'stage-select',
  stage: 1,
  maze: [],
  mazeSize: 0,
  playerPos: { x: 1, y: 1 },
  exitPos: { x: 0, y: 0 },
  visitedCells: [],
  monsters: {},
  chests: {},
  player: createInitialPlayer(),
  steps: 0,
  startTime: 0,
  elapsedSeconds: 0,
  activeModal: null,
  combatState: null,
  chestState: null,
  craftResult: null,
  selectedCraftItems: [],
  message: null,
  completionTime: null,
};

// ─── 리듀서 ──────────────────────────────────────────────────────────────────
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    case 'INIT_STAGE': {
      const { stage } = action;
      const map = generateMap(stage);
      const visited = [`${map.playerPos.x},${map.playerPos.y}`];
      // 주변 1칸도 초기 방문 처리 (시작 위치 시야)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = map.playerPos.x + dx;
          const ny = map.playerPos.y + dy;
          if (ny >= 0 && ny < map.mazeSize && nx >= 0 && nx < map.mazeSize) {
            const key = `${nx},${ny}`;
            if (!visited.includes(key)) visited.push(key);
          }
        }
      }
      return {
        ...initialState,
        screen: 'playing',
        stage,
        ...map,
        visitedCells: visited,
        player: createInitialPlayer(),
        startTime: Date.now(),
        elapsedSeconds: 0,
      };
    }

    case 'TICK': {
      if (state.screen !== 'playing') return state;
      return {
        ...state,
        elapsedSeconds: Math.floor((Date.now() - state.startTime) / 1000),
      };
    }

    case 'MOVE': {
      if (state.activeModal !== null) return state;

      const { dx, dy } = action;
      const nx = state.playerPos.x + dx;
      const ny = state.playerPos.y + dy;

      // 범위 체크
      if (ny < 0 || ny >= state.mazeSize || nx < 0 || nx >= state.mazeSize) return state;
      // 벽 체크
      if (state.maze[ny][nx] === 0) return state;

      const key = `${nx},${ny}`;

      // 몬스터 체크
      if (state.monsters[key]) {
        const monster = state.monsters[key];
        const combatState: CombatState = {
          monsterKey: key,
          monster: { ...monster },
          log: [{ text: `⚠️ ${monster.name}(이)가 나타났습니다! (HP: ${monster.currentHp}/${monster.maxHp})`, type: 'system' }],
          phase: 'player-turn',
        };
        return { ...state, activeModal: 'combat', combatState };
      }

      // 보물상자 체크
      if (state.chests[key] && !state.chests[key].opened) {
        const chest = state.chests[key];
        const items = chest.items.map(id => ITEMS[id]).filter(Boolean);
        return {
          ...state,
          playerPos: { x: nx, y: ny },
          steps: state.steps + 1,
          visitedCells: addVisited(state.visitedCells, nx, ny, state.mazeSize, state.maze),
          chests: { ...state.chests, [key]: { ...chest, opened: true } },
          activeModal: 'chest',
          chestState: { chestKey: key, items },
        };
      }

      // 이동
      const newPos = { x: nx, y: ny };
      const newVisited = addVisited(state.visitedCells, nx, ny, state.mazeSize, state.maze);

      // 출구 도달 체크
      if (nx === state.exitPos.x && ny === state.exitPos.y) {
        return {
          ...state,
          playerPos: newPos,
          steps: state.steps + 1,
          visitedCells: newVisited,
          screen: 'stage-clear',
          completionTime: state.elapsedSeconds,
        };
      }

      return {
        ...state,
        playerPos: newPos,
        steps: state.steps + 1,
        visitedCells: newVisited,
      };
    }

    case 'COMBAT_ATTACK': {
      if (!state.combatState || state.combatState.phase !== 'player-turn') return state;

      const result = doPlayerAttack(state.player, state.combatState.monster);
      const newLogs = [...state.combatState.log, ...result.logs];

      if (result.monsterDied) {
        // 드랍 계산
        const drops = calculateDrops(state.combatState.monster);
        const dropLogs = drops.length > 0
          ? [{ text: `🎁 획득: ${drops.map(i => i.emoji + i.name).join(', ')}`, type: 'system' as const }]
          : [{ text: '아이템이 드랍되지 않았습니다.', type: 'system' as const }];

        const newInventory = [...state.player.inventory, ...drops];
        const monsterKey = state.combatState.monsterKey;
        const newMonsters = { ...state.monsters };
        delete newMonsters[monsterKey];

        // 몬스터가 있던 칸으로 이동
        const [mx, my] = monsterKey.split(',').map(Number);
        const newVisited = addVisited(state.visitedCells, mx, my, state.mazeSize, state.maze);

        // 출구가 있는 칸이면 스테이지 클리어
        if (mx === state.exitPos.x && my === state.exitPos.y) {
          return {
            ...state,
            player: { ...state.player, inventory: newInventory },
            monsters: newMonsters,
            playerPos: { x: mx, y: my },
            steps: state.steps + 1,
            visitedCells: newVisited,
            screen: 'stage-clear',
            completionTime: state.elapsedSeconds,
            combatState: null,
            activeModal: null,
          };
        }

        return {
          ...state,
          player: { ...state.player, inventory: newInventory },
          monsters: newMonsters,
          playerPos: { x: mx, y: my },
          steps: state.steps + 1,
          visitedCells: newVisited,
          combatState: {
            ...state.combatState,
            monster: { ...state.combatState.monster, currentHp: 0 },
            log: [...newLogs, ...dropLogs],
            phase: 'player-won',
          },
        };
      }

      if (result.playerDied) {
        return {
          ...state,
          player: { ...state.player, hp: 0 },
          combatState: {
            ...state.combatState,
            monster: { ...state.combatState.monster, currentHp: result.monsterHpAfter },
            log: newLogs,
            phase: 'player-died',
          },
        };
      }

      return {
        ...state,
        player: { ...state.player, hp: result.playerHpAfter },
        combatState: {
          ...state.combatState,
          monster: { ...state.combatState.monster, currentHp: result.monsterHpAfter },
          log: newLogs,
          phase: 'player-turn',
        },
      };
    }

    case 'COMBAT_USE_ITEM': {
      if (!state.combatState || state.combatState.phase !== 'player-turn') return state;

      const item = state.player.inventory[action.itemIndex];
      if (!item || item.type !== 'potion') return state;

      const { hpAfter, log } = usePotion(state.player, item);
      const newInventory = state.player.inventory.filter((_, i) => i !== action.itemIndex);

      return {
        ...state,
        player: { ...state.player, hp: hpAfter, inventory: newInventory },
        combatState: {
          ...state.combatState,
          log: [...state.combatState.log, log],
          phase: 'player-turn',
        },
      };
    }

    case 'COMBAT_FLEE': {
      if (!state.combatState) return state;

      if (tryFlee(state.stage)) {
        return {
          ...state,
          combatState: {
            ...state.combatState,
            log: [...state.combatState.log, { text: '🏃 도망쳤습니다!', type: 'system' }],
            phase: 'fled',
          },
        };
      } else {
        // 도망 실패 → 몬스터 공격
        const mAtk = state.combatState.monster.attack;
        const pDef = Math.max(0, state.player.baseDefense + (state.player.equippedArmorId ? (ITEMS[state.player.equippedArmorId]?.defense ?? 0) : 0));
        const dmg = Math.max(1, mAtk - pDef + Math.floor(Math.random() * 3));
        const newHp = Math.max(0, state.player.hp - dmg);
        const fled_log = { text: `도망 실패! ${state.combatState.monster.name}의 공격! ${dmg} 데미지.`, type: 'monster' as const };

        if (newHp <= 0) {
          return {
            ...state,
            player: { ...state.player, hp: 0 },
            combatState: {
              ...state.combatState,
              log: [...state.combatState.log, fled_log, { text: '💀 당신은 쓰러졌습니다...', type: 'system' }],
              phase: 'player-died',
            },
          };
        }

        return {
          ...state,
          player: { ...state.player, hp: newHp },
          combatState: {
            ...state.combatState,
            log: [...state.combatState.log, fled_log],
            phase: 'player-turn',
          },
        };
      }
    }

    case 'COMBAT_NEXT_PHASE': {
      if (!state.combatState) return state;
      const phase = state.combatState.phase;

      if (phase === 'player-won' || phase === 'fled') {
        return { ...state, activeModal: null, combatState: null };
      }
      if (phase === 'player-died') {
        return { ...state, screen: 'game-over', activeModal: null, combatState: null };
      }
      return state;
    }

    case 'CHEST_TAKE_ALL': {
      if (!state.chestState) return state;

      const newInventory = [...state.player.inventory, ...state.chestState.items];
      return {
        ...state,
        player: { ...state.player, inventory: newInventory },
        activeModal: null,
        chestState: null,
        message: `📦 ${state.chestState.items.length}개의 아이템을 획득했습니다!`,
      };
    }

    case 'CHEST_CLOSE': {
      return { ...state, activeModal: null, chestState: null };
    }

    case 'TOGGLE_CRAFT_ITEM': {
      const { inventoryIndex } = action;
      const selected = state.selectedCraftItems;

      if (selected.includes(inventoryIndex)) {
        return { ...state, selectedCraftItems: selected.filter(i => i !== inventoryIndex) };
      }
      if (selected.length >= 2) {
        return { ...state, selectedCraftItems: [selected[1], inventoryIndex] };
      }
      return { ...state, selectedCraftItems: [...selected, inventoryIndex] };
    }

    case 'CRAFT_ITEMS': {
      const { selectedCraftItems, player } = state;
      if (selectedCraftItems.length !== 2) return state;

      const [i1, i2] = selectedCraftItems;
      const item1 = player.inventory[i1];
      const item2 = player.inventory[i2];
      if (!item1 || !item2) return state;

      const result = craftItems(item1.id, item2.id);

      if (result) {
        // 두 아이템 제거 후 결과 추가
        const newInventory = player.inventory.filter((_, i) => i !== i1 && i !== i2);
        newInventory.push(result);
        return {
          ...state,
          player: { ...state.player, inventory: newInventory },
          selectedCraftItems: [],
          craftResult: { success: true, item: result, message: `✨ ${result.emoji} ${result.name} 제작 성공!` },
        };
      } else {
        return {
          ...state,
          selectedCraftItems: [],
          craftResult: { success: false, item: null, message: '❌ 조합에 실패했습니다. 다른 조합을 시도해보세요.' },
        };
      }
    }

    case 'CLEAR_CRAFT_RESULT': {
      return { ...state, craftResult: null };
    }

    case 'EQUIP_ITEM': {
      const item = state.player.inventory[action.itemIndex];
      if (!item) return state;

      if (item.type === 'weapon') {
        const already = state.player.equippedWeaponId === item.id;
        return {
          ...state,
          player: { ...state.player, equippedWeaponId: already ? null : item.id },
          message: already ? `${item.name} 장착 해제` : `⚔️ ${item.name} 장착`,
        };
      }
      if (item.type === 'armor') {
        const already = state.player.equippedArmorId === item.id;
        return {
          ...state,
          player: { ...state.player, equippedArmorId: already ? null : item.id },
          message: already ? `${item.name} 장착 해제` : `🛡️ ${item.name} 장착`,
        };
      }
      return state;
    }

    case 'SET_MODAL': {
      return { ...state, activeModal: action.modal, selectedCraftItems: [], craftResult: null };
    }

    case 'CLEAR_MESSAGE': {
      return { ...state, message: null };
    }

    case 'RETURN_TO_SELECT': {
      return { ...initialState };
    }

    default:
      return state;
  }
}

// ─── 방문 셀 추가 (시야 반경 1칸) ────────────────────────────────────────────
function addVisited(
  existing: string[],
  x: number,
  y: number,
  size: number,
  maze: GameState['maze']
): string[] {
  const set = new Set(existing);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny >= 0 && ny < size && nx >= 0 && nx < size) {
        set.add(`${nx},${ny}`);
      }
    }
  }
  // 이동 방향 2칸 앞도 살짝 보임 (시야 힌트)
  void maze;
  return Array.from(set);
}

// ─── Context ─────────────────────────────────────────────────────────────────
interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.screen === 'playing') {
      timerRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.screen]);

  // 메시지 자동 삭제
  useEffect(() => {
    if (state.message) {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_MESSAGE' }), 2500);
      return () => clearTimeout(t);
    }
  }, [state.message]);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
