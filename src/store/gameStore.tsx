import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { calculateDrops, doPlayerAttack, getPlayerDefense, tryFlee, usePotion } from '../game/CombatSystem';
import { ITEMS, craftItems } from '../game/ItemDatabase';
import { generateMap } from '../game/MazeGenerator';
import type { Character, CombatState, GameAction, GameState, InventorySlot, Item, PlayerState } from '../types/game.types';

let _logIdCounter = 0;
function nextLogId(): string {
  return `log_${Date.now()}_${++_logIdCounter}`;
}

// ─── 인벤토리 스택 관리 함수들 ──────────────────────────────────────────────────
function getMaxStackSize(item: Item): number {
  // 소모품(포션, 재료)은 10개까지 스택 가능
  if (item.type === 'potion' || item.type === 'material') {
    return 10;
  }
  // 장비류는 스택 불가
  return 1;
}

function canStackWith(slot: InventorySlot, item: Item): boolean {
  return slot.item.id === item.id && slot.quantity < getMaxStackSize(item);
}

function addItemsToInventory(inventory: InventorySlot[], items: Item[]): { newInventory: InventorySlot[]; overflow: Item[] } {
  const newInventory = [...inventory];
  const overflow: Item[] = [];

  for (const item of items) {
    let remaining = 1; // 각 아이템은 1개씩 추가

    // 기존 스택에서 추가 가능한 슬롯 찾기
    for (const slot of newInventory) {
      if (remaining === 0) break;
      if (canStackWith(slot, item)) {
        const canAdd = Math.min(remaining, getMaxStackSize(item) - slot.quantity);
        slot.quantity += canAdd;
        remaining -= canAdd;
      }
    }

    // 새 슬롯 추가
    while (remaining > 0 && newInventory.length < 20) { // 최대 20슬롯
      const stackSize = Math.min(remaining, getMaxStackSize(item));
      newInventory.push({
        item: item,
        quantity: stackSize
      });
      remaining -= stackSize;
    }

    // 남은 아이템은 오버플로우
    for (let i = 0; i < remaining; i++) {
      overflow.push(item);
    }
  }

  return { newInventory, overflow };
}

function removeItemFromInventory(inventory: InventorySlot[], slotIndex: number, quantity: number = 1): InventorySlot[] {
  const newInventory = [...inventory];
  const slot = newInventory[slotIndex];

  if (slot && slot.quantity >= quantity) {
    if (slot.quantity === quantity) {
      // 슬롯 제거
      newInventory.splice(slotIndex, 1);
    } else {
      // 수량만 감소
      slot.quantity -= quantity;
    }
  }

  return newInventory;
}
/* 
function getInventorySlotCount(inventory: InventorySlot[]): number {
  return inventory.length;
} */

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
      characterId: character.id,
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
  actionLogs: [],
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

        // 액션 로그 추가
        const newLog = {
          id: nextLogId(),
          type: 'combat' as const,
          message: `${monster.name}을 만났다.`,
          timestamp: Date.now()
        };
        const updatedLogs = [...state.actionLogs, newLog];

        return {
          ...state,
          playerPos: { x: nx, y: ny },
          steps: state.steps + 1,
          visitedCells: addVisited(state.visitedCells, nx, ny, state.mazeSize, state.maze),
          combatState,
          actionLogs: updatedLogs
        };
      }

      // 보물상자 체크 - 한 칸 앞(이동 방향)에 상자가 있으면 인접 위치에서 트리거
      const nxf = nx + dx, nyf = ny + dy;
      const forwardKey = `${nxf},${nyf}`;
      const forwardChest =
        nyf >= 0 && nyf < state.mazeSize &&
        nxf >= 0 && nxf < state.mazeSize &&
        state.maze[nyf]?.[nxf] !== 0 &&
        state.chests[forwardKey] && !state.chests[forwardKey].opened
          ? state.chests[forwardKey]
          : null;

      // 현재 목적지(nx,ny)에 상자가 있으면 그대로 트리거
      const directChest = state.chests[key] && !state.chests[key].opened ? state.chests[key] : null;

      const triggerChest = directChest ?? forwardChest;
      const triggerKey = directChest ? key : forwardKey;
      const triggerPos = directChest ? { x: nx, y: ny } : { x: nx, y: ny };

      if (triggerChest) {
        const items = triggerChest.items.map(id => ITEMS[id]).filter(Boolean);
        const newLog = {
          id: nextLogId(),
          type: 'item' as const,
          message: '보물상자를 발견했다.',
          timestamp: Date.now()
        };
        return {
          ...state,
          playerPos: triggerPos,
          steps: state.steps + 1,
          visitedCells: addVisited(state.visitedCells, nx, ny, state.mazeSize, state.maze),
          chests: { ...state.chests, [triggerKey]: { ...triggerChest, opened: true } },
          chestState: { chestKey: triggerKey, items },
          actionLogs: [...state.actionLogs, newLog]
        };
      }

      // 이동
      const newPos = { x: nx, y: ny };
      const newVisited = addVisited(state.visitedCells, nx, ny, state.mazeSize, state.maze);

      // 출구 도달 체크
      if (nx === state.exitPos.x && ny === state.exitPos.y) {
        // 액션 로그 추가
        const newLog = {
          id: nextLogId(),
          type: 'system' as const,
          message: `🎉 스테이지 ${state.stage} 클리어! (${state.steps + 1}/${state.optimalSteps}걸음)`,
          timestamp: Date.now()
        };
        const updatedLogs = [...state.actionLogs, newLog];

        return {
          ...state,
          playerPos: newPos,
          steps: state.steps + 1,
          visitedCells: newVisited,
          screen: 'stage-clear',
          completionTime: state.elapsedSeconds,
          maxClearedStage: Math.max(state.maxClearedStage, state.stage),
          actionLogs: updatedLogs
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

      // 전투 라운드 로그를 actionLogs에 추가
      const roundActionLogs = result.logs.map((log, i) => ({
        id: `${Date.now()}-${i}`,
        type: 'combat' as const,
        subtype: log.type === 'player' ? 'attack' as const
                : log.type === 'monster' ? 'damage' as const
                : 'element' as const,
        message: log.text,
        timestamp: Date.now()
      }));

      if (result.monsterDied) {
        // 드랍 계산
        const drops = calculateDrops(state.combatState.monster);
        const { newInventory, overflow: pending } = addItemsToInventory(state.player.inventory, drops);

        const dropLogs = drops.length > 0
          ? [{ text: `🎁 획득: ${drops.map(i => i.emoji + i.name).join(', ')}`, type: 'system' as const }]
          : [{ text: '아이템이 드랍되지 않았습니다.', type: 'system' as const }];

        const monsterKey = state.combatState.monsterKey;
        const newMonsters = { ...state.monsters };
        delete newMonsters[monsterKey];

        // 전투 승리 액션 로그
        const victoryLog = {
          id: nextLogId(),
          type: 'combat' as const,
          subtype: 'victory' as const,
          message: `🏆 ${state.combatState.monster.name} 처치!` +
                   (drops.length > 0 ? ` 전리품: ${drops.map(i => i.name).join(', ')}` : ''),
          timestamp: Date.now()
        };
        const updatedActionLogs = [...state.actionLogs, ...roundActionLogs, victoryLog];
        while (updatedActionLogs.length > 50) updatedActionLogs.shift();

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
            actionLogs: updatedActionLogs
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
          actionLogs: updatedActionLogs
        };
      }

      if (result.playerDied) {
        const defeatLog = {
          id: `${Date.now()}-defeat`,
          type: 'combat' as const,
          subtype: 'defeat' as const,
          message: '💀 쓰러졌다...',
          timestamp: Date.now()
        };
        const updatedActionLogs = [...state.actionLogs, ...roundActionLogs, defeatLog];
        while (updatedActionLogs.length > 50) updatedActionLogs.shift();

        return {
          ...state,
          player: { ...state.player, hp: 0 },
          combatState: {
            ...state.combatState,
            monster: { ...state.combatState.monster, currentHp: result.monsterHpAfter },
            log: newLogs,
            phase: 'player-died',
          },
          actionLogs: updatedActionLogs
        };
      }

      const updatedActionLogs = [...state.actionLogs, ...roundActionLogs];
      while (updatedActionLogs.length > 50) updatedActionLogs.shift();

      return {
        ...state,
        player: { ...state.player, hp: result.playerHpAfter },
        combatState: {
          ...state.combatState,
          monster: { ...state.combatState.monster, currentHp: result.monsterHpAfter },
          log: newLogs,
          phase: 'player-turn',
        },
        actionLogs: updatedActionLogs
      };
    }

    case 'COMBAT_USE_ITEM': {
      if (!state.combatState || state.combatState.phase !== 'player-turn') return state;

      const slot = state.player.inventory[action.itemIndex];
      if (!slot || slot.item.type !== 'potion') return state;

      const { hpAfter, log } = usePotion(state.player, slot.item);
      const newInventory = removeItemFromInventory(state.player.inventory, action.itemIndex, 1);

      const healActionLog = {
        id: nextLogId(),
        type: 'combat' as const,
        subtype: 'heal' as const,
        message: log.text,
        timestamp: Date.now()
      };
      const updatedActionLogs = [...state.actionLogs, healActionLog];
      while (updatedActionLogs.length > 50) updatedActionLogs.shift();

      return {
        ...state,
        player: { ...state.player, hp: hpAfter, inventory: newInventory },
        combatState: {
          ...state.combatState,
          log: [...state.combatState.log, log],
          phase: 'player-turn',
        },
        actionLogs: updatedActionLogs
      };
    }

    case 'COMBAT_FLEE': {
      if (!state.combatState) return state;

      if (tryFlee(state.stage)) {
        const fleeActionLog = {
          id: nextLogId(),
          type: 'combat' as const,
          subtype: 'flee' as const,
          message: '🏃 도망쳤다!',
          timestamp: Date.now()
        };
        const updatedActionLogs = [...state.actionLogs, fleeActionLog];
        while (updatedActionLogs.length > 50) updatedActionLogs.shift();

        return {
          ...state,
          combatState: {
            ...state.combatState,
            log: [...state.combatState.log, { text: '🏃 도망쳤습니다!', type: 'system' }],
            phase: 'fled',
          },
          actionLogs: updatedActionLogs
        };
      } else {
        // 도망 실패 → 몬스터 공격
        const mAtk = state.combatState.monster.attack;
        const pDef = getPlayerDefense(state.player);
        const dmg = Math.max(1, mAtk - pDef + Math.floor(Math.random() * 3));
        const newHp = Math.max(0, state.player.hp - dmg);
        const fled_log = { text: `도망 실패! ${state.combatState.monster.name}의 공격! ${dmg} 데미지.`, type: 'monster' as const };

        const fleeFailLog = {
          id: nextLogId(),
          type: 'combat' as const,
          subtype: 'damage' as const,
          message: `💨 도망 실패! 💢 ${dmg} 피해`,
          timestamp: Date.now()
        };

        if (newHp <= 0) {
          const defeatLog = {
            id: `${Date.now()}-defeat`,
            type: 'combat' as const,
            subtype: 'defeat' as const,
            message: '💀 쓰러졌다...',
            timestamp: Date.now()
          };
          const updatedActionLogs = [...state.actionLogs, fleeFailLog, defeatLog];
          while (updatedActionLogs.length > 50) updatedActionLogs.shift();

          return {
            ...state,
            player: { ...state.player, hp: 0 },
            combatState: {
              ...state.combatState,
              log: [...state.combatState.log, fled_log, { text: '💀 당신은 쓰러졌습니다...', type: 'system' }],
              phase: 'player-died',
            },
            actionLogs: updatedActionLogs
          };
        }

        const updatedActionLogs = [...state.actionLogs, fleeFailLog];
        while (updatedActionLogs.length > 50) updatedActionLogs.shift();

        return {
          ...state,
          player: { ...state.player, hp: newHp },
          combatState: {
            ...state.combatState,
            log: [...state.combatState.log, fled_log],
            phase: 'player-turn',
          },
          actionLogs: updatedActionLogs
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

      const { newInventory, overflow: pending } = addItemsToInventory(state.player.inventory, state.chestState.items);

      // 액션 로그 추가
      const acquiredItems = [...state.chestState.items];
      const chestLog = {
        id: nextLogId(),
        type: 'item' as const,
        message: `보물상자에서 ${acquiredItems.map(item => item.name + '(' + (item.type === 'material' ? '재료' : '1') + ')').join(', ')}을 습득했다.`,
        timestamp: Date.now()
      };
      const updatedActionLogs = [...state.actionLogs, chestLog];
      if (updatedActionLogs.length > 50) {
        updatedActionLogs.shift();
      }

      if (pending.length > 0) {
        return {
          ...state,
          player: { ...state.player, inventory: newInventory },
          activeModal: 'discard',
          chestState: null,
          discardState: { pendingItems: pending },
          message: `📦 ${state.chestState.items.length - pending.length}개 획득. 가방이 가득 찼습니다!`,
          actionLogs: updatedActionLogs
        };
      }
      return {
        ...state,
        player: { ...state.player, inventory: newInventory },
        chestState: null,
        message: `📦 ${state.chestState.items.length}개의 아이템을 획득했습니다!`,
        actionLogs: updatedActionLogs
      };
    }

    case 'CHEST_TAKE_SELECTED': {
      if (!state.chestState) return state;
      const { itemIndices } = action;
      const selectedItems = itemIndices.map(i => state.chestState!.items[i]).filter(Boolean);
      if (selectedItems.length === 0) return { ...state, chestState: null };

      const { newInventory, overflow: pending } = addItemsToInventory(state.player.inventory, selectedItems);
      const chestLog = {
        id: nextLogId(),
        type: 'item' as const,
        message: `보물상자에서 ${selectedItems.map(i => i.name).join(', ')}을 습득했다.`,
        timestamp: Date.now()
      };
      const updatedActionLogs = [...state.actionLogs, chestLog];
      if (updatedActionLogs.length > 50) updatedActionLogs.shift();

      if (pending.length > 0) {
        return {
          ...state,
          player: { ...state.player, inventory: newInventory },
          activeModal: 'discard',
          chestState: null,
          discardState: { pendingItems: pending },
          message: `📦 ${selectedItems.length - pending.length}개 획득. 가방이 가득 찼습니다!`,
          actionLogs: updatedActionLogs
        };
      }
      return {
        ...state,
        player: { ...state.player, inventory: newInventory },
        chestState: null,
        message: `📦 ${selectedItems.length}개의 아이템을 획득했습니다!`,
        actionLogs: updatedActionLogs
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
      const slot1 = player.inventory[i1];
      const slot2 = player.inventory[i2];
      if (!slot1 || !slot2) return state;

      const result = craftItems(slot1.item.id, slot2.item.id);

      // 재료 소모 (성공/실패 관계없이 소모)
      let tempInventory = removeItemFromInventory(player.inventory, Math.max(i1, i2), 1); // 큰 인덱스부터 제거
      tempInventory = removeItemFromInventory(tempInventory, Math.min(i1, i2), 1);

      if (result) {
        // 조합 성공시 결과 아이템 추가
        const { newInventory } = addItemsToInventory(tempInventory, [result]);
        return {
          ...state,
          player: { ...state.player, inventory: newInventory, mp: player.mp - MP_COST },
          selectedCraftItems: [],
          craftResult: { success: true, item: result, message: `✨ ${result.emoji} ${result.name} 제작 성공! (MP -${MP_COST})` },
        };
      } else {
        // 조합 실패시에도 재료는 소모
        return {
          ...state,
          player: { ...state.player, inventory: tempInventory, mp: player.mp - MP_COST },
          selectedCraftItems: [],
          craftResult: { success: false, item: null, message: '❌ 조합에 실패했습니다. 재료가 소모되었습니다.' },
        };
      }
    }

    case 'CLEAR_CRAFT_RESULT': {
      return { ...state, craftResult: null };
    }

    case 'USE_ITEM': {
      const slot = state.player.inventory[action.itemIndex];
      if (!slot) return state;
      const newInventory = removeItemFromInventory(state.player.inventory, action.itemIndex, 1);

      if (slot.item.type === 'potion') {
        const healed = Math.min(state.player.maxHp, state.player.hp + (slot.item.heal ?? 0));
        return {
          ...state,
          player: { ...state.player, hp: healed, inventory: newInventory },
          message: `${slot.item.emoji} ${slot.item.name} 사용! HP +${slot.item.heal}`,
        };
      }
      if (slot.item.id === 'eagle') {
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
      const newInventory = removeItemFromInventory(state.player.inventory, action.itemIndex, 1);

      // 버리기 후 대기 중인 아이템 자동 추가
      if (state.discardState && state.discardState.pendingItems.length > 0) {
        const { newInventory: finalInventory, overflow: remaining } = addItemsToInventory(newInventory, state.discardState.pendingItems);

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

    case 'CLEAR_MESSAGE': {
      return { ...state, message: null };
    }

    case 'SET_MAX_CLEARED_STAGE': {
      return { ...state, maxClearedStage: Math.max(state.maxClearedStage, action.stage) };
    }

    case 'RETURN_TO_SELECT': {
      return { ...initialState, screen: 'character-select', maxClearedStage: state.maxClearedStage };
    }

    case 'RETURN_TO_STAGE_SELECT': {
      return { ...state, screen: 'stage-select', activeModal: null };
    }

    case 'ADD_ACTION_LOG': {
      const { logType, message } = action;
      const newLog = {
        id: nextLogId(),
        type: logType,
        message,
        timestamp: Date.now()
      };

      // 최대 50개까지만 유지 (오래된 것부터 제거)
      const updatedLogs = [...state.actionLogs, newLog];
      if (updatedLogs.length > 50) {
        updatedLogs.shift();
      }

      return { ...state, actionLogs: updatedLogs };
    }

    case 'CLEAR_ACTION_LOGS': {
      return { ...state, actionLogs: [] };
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
