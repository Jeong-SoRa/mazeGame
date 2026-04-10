import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { GameState, GameAction, PlayerState, CombatState, Character } from '../types/game.types';
import { generateMap } from '../game/MazeGenerator';
import { ITEMS, craftItems } from '../game/ItemDatabase';
import { doPlayerAttack, usePotion, tryFlee, calculateDrops, getPlayerDefense, getInventoryCapacity } from '../game/CombatSystem';

// ─── 초기 플레이어 ───────────────────────────────────────────────────────────
function createInitialPlayer(character?: Character): PlayerState {
  if (character) {
    return {
      hp: character.stats.hp,
      maxHp: character.stats.hp,
      mp: character.stats.mp,
      maxMp: character.stats.mp,
      baseAttack: character.stats.attack,
      baseDefense: character.stats.defense,
      inventory: [],
      element: character.element,
    };
  }

  return {
    hp: 100,
    maxHp: 100,
    mp: 60,
    maxMp: 80,
    baseAttack: 6,
    baseDefense: 2,
    inventory: [],
    element: 'wind', // 기본 속성
  };
}

// ─── 초기 상태 ───────────────────────────────────────────────────────────────
const initialState: GameState = {
  screen: 'character-select',
  stage: 1,
  maxClearedStage: 0,
  maze: [],
  mazeSize: 0,
  playerPos: { x: 1, y: 1 },
  exitPos: { x: 0, y: 0 },
  visitedCells: [],
  monsters: {},
  chests: {},
  player: createInitialPlayer(),
  steps: 0,
  optimalSteps: 0,
  startTime: 0,
  elapsedSeconds: 0,
  activeModal: null,
  combatState: null,
  chestState: null,
  discardState: null,
  craftResult: null,
  selectedCraftItems: [],
  message: null,
  completionTime: null,
  mapRevealTimer: 0,
};

// ─── 리듀서 ──────────────────────────────────────────────────────────────────
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    case 'INIT_STAGE': {
      const { stage, character } = action;
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
        player: createInitialPlayer(character),
        startTime: Date.now(),
        elapsedSeconds: 0,
        mapRevealTimer: 0,
        discardState: null,
      };
    }

    case 'TICK': {
      if (state.screen !== 'playing') return state;
      return {
        ...state,
        elapsedSeconds: Math.floor((Date.now() - state.startTime) / 1000),
        mapRevealTimer: Math.max(0, state.mapRevealTimer - 1),
      };
    }

    case 'MOVE': {
      if (state.activeModal !== null) return state;

      const { dx, dy, bypassWallCheck } = action;
      const nx = state.playerPos.x + dx;
      const ny = state.playerPos.y + dy;

      // 범위 체크
      if (ny < 0 || ny >= state.mazeSize || nx < 0 || nx >= state.mazeSize) return state;

      // 벽 체크 (레이캐스팅 체크를 통과한 경우 건너뛰기)
      if (!bypassWallCheck && state.maze[ny][nx] === 0) {
        console.log('MOVE blocked by wall check');
        return state;
      }

      if (bypassWallCheck) {
        console.log('MOVE bypassing wall check (raycast approved)');
      }

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
          maxClearedStage: Math.max(state.maxClearedStage, state.stage),
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
        const capacity = getInventoryCapacity(state.player);
        const canAdd = Math.max(0, capacity - state.player.inventory.length);
        const toAdd = drops.slice(0, canAdd);
        const pending = drops.slice(canAdd);

        const dropLogs = drops.length > 0
          ? [{ text: `🎁 획득: ${drops.map(i => i.emoji + i.name).join(', ')}`, type: 'system' as const }]
          : [{ text: '아이템이 드랍되지 않았습니다.', type: 'system' as const }];

        const newInventory = [...state.player.inventory, ...toAdd];
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
            maxClearedStage: Math.max(state.maxClearedStage, state.stage),
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
          discardState: pending.length > 0 ? { pendingItems: pending } : null,
          combatState: {
            ...state.combatState,
            monster: { ...state.combatState.monster, currentHp: 0 },
            log: [...newLogs, ...dropLogs, ...(pending.length > 0 ? [{ text: `⚠️ 가방이 가득 찼습니다! ${pending.length}개의 아이템을 버려야 합니다.`, type: 'system' as const }] : [])],
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
        const pDef = getPlayerDefense(state.player);
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
        // 가방이 가득 찼으면 버리기 모달로 전환
        if (state.discardState && state.discardState.pendingItems.length > 0) {
          return { ...state, activeModal: 'discard', combatState: null };
        }
        return { ...state, activeModal: null, combatState: null };
      }
      if (phase === 'player-died') {
        return { ...state, screen: 'game-over', activeModal: null, combatState: null };
      }
      return state;
    }

    case 'CHEST_TAKE_ALL': {
      if (!state.chestState) return state;

      const capacity = getInventoryCapacity(state.player);
      const canAdd = Math.max(0, capacity - state.player.inventory.length);
      const toAdd = state.chestState.items.slice(0, canAdd);
      const pending = state.chestState.items.slice(canAdd);

      if (pending.length > 0) {
        return {
          ...state,
          player: { ...state.player, inventory: [...state.player.inventory, ...toAdd] },
          activeModal: 'discard',
          chestState: null,
          discardState: { pendingItems: pending },
          message: `📦 ${toAdd.length}개 획득. 가방이 가득 찼습니다!`,
        };
      }
      return {
        ...state,
        player: { ...state.player, inventory: [...state.player.inventory, ...toAdd] },
        activeModal: null,
        chestState: null,
        message: `📦 ${toAdd.length}개의 아이템을 획득했습니다!`,
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

      // 마나 부족 시 조합 불가
      const MP_COST = 10;
      if (player.mp < MP_COST) {
        return {
          ...state,
          selectedCraftItems: [],
          craftResult: { success: false, item: null, message: `💧 마나가 부족합니다! (필요: ${MP_COST} MP)` },
        };
      }

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
          player: { ...state.player, inventory: newInventory, mp: player.mp - MP_COST },
          selectedCraftItems: [],
          craftResult: { success: true, item: result, message: `✨ ${result.emoji} ${result.name} 제작 성공! (MP -${MP_COST})` },
        };
      } else {
        return {
          ...state,
          player: { ...state.player, mp: player.mp - MP_COST },
          selectedCraftItems: [],
          craftResult: { success: false, item: null, message: '❌ 조합에 실패했습니다. 다른 조합을 시도해보세요.' },
        };
      }
    }

    case 'CLEAR_CRAFT_RESULT': {
      return { ...state, craftResult: null };
    }

    case 'USE_ITEM': {
      const item = state.player.inventory[action.itemIndex];
      if (!item) return state;
      const newInventory = state.player.inventory.filter((_, i) => i !== action.itemIndex);

      if (item.type === 'potion') {
        const healed = Math.min(state.player.maxHp, state.player.hp + (item.heal ?? 0));
        return {
          ...state,
          player: { ...state.player, hp: healed, inventory: newInventory },
          message: `${item.emoji} ${item.name} 사용! HP +${item.heal}`,
        };
      }
      if (item.id === 'eagle') {
        return {
          ...state,
          player: { ...state.player, inventory: newInventory },
          mapRevealTimer: 60,
          message: '🦅 독수리! 1분간 미니맵 경로 공개!',
        };
      }
      return state;
    }

    case 'DROP_ITEM': {
      const newInventory = state.player.inventory.filter((_, i) => i !== action.itemIndex);

      // 버리기 후 대기 중인 아이템 자동 추가
      if (state.discardState && state.discardState.pendingItems.length > 0) {
        const newCapacity = getInventoryCapacity({ ...state.player, inventory: newInventory });
        const canAdd = Math.max(0, newCapacity - newInventory.length);
        const toAdd = state.discardState.pendingItems.slice(0, canAdd);
        const remaining = state.discardState.pendingItems.slice(canAdd);
        const finalInventory = [...newInventory, ...toAdd];

        if (remaining.length === 0) {
          return {
            ...state,
            player: { ...state.player, inventory: finalInventory },
            discardState: null,
            activeModal: null,
          };
        }
        return {
          ...state,
          player: { ...state.player, inventory: finalInventory },
          discardState: { pendingItems: remaining },
        };
      }

      return {
        ...state,
        player: { ...state.player, inventory: newInventory },
      };
    }

    case 'DISCARD_SKIP': {
      if (!state.discardState) return state;
      const remaining = state.discardState.pendingItems.filter((_, i) => i !== action.pendingIndex);

      if (remaining.length === 0) {
        return { ...state, discardState: null, activeModal: null };
      }
      return { ...state, discardState: { pendingItems: remaining } };
    }

    case 'SET_MODAL': {
      return { ...state, activeModal: action.modal, selectedCraftItems: [], craftResult: null };
    }

    case 'REST': {
      if (state.activeModal !== null) return state;
      // HP/MP 완전 회복, 소요시간 +30초(startTime을 30초 앞당김), 이동수 +2
      return {
        ...state,
        player: { ...state.player, hp: state.player.maxHp, mp: state.player.maxMp },
        startTime: state.startTime - 30_000,
        steps: state.steps + 2,
        message: '💤 휴식 완료! HP/MP 완전 회복 (+30초, +2이동)',
      };
    }

    case 'CLEAR_MESSAGE': {
      return { ...state, message: null };
    }

    case 'SET_MAX_CLEARED_STAGE': {
      return { ...state, maxClearedStage: Math.max(state.maxClearedStage, action.stage) };
    }

    case 'RETURN_TO_SELECT': {
      return { ...initialState, screen: 'character-select', maxClearedStage: state.maxClearedStage };
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
