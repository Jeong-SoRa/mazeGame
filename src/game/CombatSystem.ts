import type { PlayerState, MonsterInstance, CombatLog, Item } from '../types/game.types';
import { ITEMS } from './ItemDatabase';

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getPlayerAttack(player: PlayerState): number {
  const weapon = player.equippedWeaponId ? ITEMS[player.equippedWeaponId] : null;
  return player.baseAttack + (weapon?.attack ?? 0);
}

export function getPlayerDefense(player: PlayerState): number {
  const armor = player.equippedArmorId ? ITEMS[player.equippedArmorId] : null;
  return player.baseDefense + (armor?.defense ?? 0);
}

export interface AttackResult {
  playerHpAfter: number;
  monsterHpAfter: number;
  logs: CombatLog[];
  playerDied: boolean;
  monsterDied: boolean;
}

// 플레이어 공격 → 몬스터 반격 (한 라운드)
export function doPlayerAttack(player: PlayerState, monster: MonsterInstance): AttackResult {
  const logs: CombatLog[] = [];

  // 플레이어 공격
  const pAtk = getPlayerAttack(player);
  const mDef = monster.defense;
  const dmgToMonster = Math.max(1, pAtk - mDef + rand(-2, 4));
  const monsterHpAfter = Math.max(0, monster.currentHp - dmgToMonster);

  logs.push({
    text: `⚔️ ${monster.name}에게 ${dmgToMonster} 데미지!`,
    type: 'player',
  });

  if (monsterHpAfter <= 0) {
    logs.push({ text: `💥 ${monster.name}을(를) 처치했습니다!`, type: 'system' });
    return { playerHpAfter: player.hp, monsterHpAfter: 0, logs, playerDied: false, monsterDied: true };
  }

  // 몬스터 반격
  const mAtk = monster.attack;
  const pDef = getPlayerDefense(player);
  const dmgToPlayer = Math.max(1, mAtk - pDef + rand(-2, 3));
  const playerHpAfter = Math.max(0, player.hp - dmgToPlayer);

  logs.push({
    text: `💢 ${monster.name}의 반격! ${dmgToPlayer} 데미지를 받았습니다.`,
    type: 'monster',
  });

  const playerDied = playerHpAfter <= 0;
  if (playerDied) {
    logs.push({ text: '💀 당신은 쓰러졌습니다...', type: 'system' });
  }

  return { playerHpAfter, monsterHpAfter, logs, playerDied, monsterDied: false };
}

// 포션 사용
export function usePotion(player: PlayerState, item: Item): { hpAfter: number; log: CombatLog } {
  const healAmount = item.heal ?? 0;
  const hpAfter = Math.min(player.maxHp, player.hp + healAmount);
  const actual = hpAfter - player.hp;
  return {
    hpAfter,
    log: { text: `🧪 ${item.name} 사용! HP ${actual} 회복 (${hpAfter}/${player.maxHp})`, type: 'system' },
  };
}

// 도망 성공률 (50% + 스테이지 불이익)
export function tryFlee(stage: number): boolean {
  const chance = Math.max(0.25, 0.55 - stage * 0.01);
  return Math.random() < chance;
}

// 몬스터 드랍 계산
export function calculateDrops(monster: MonsterInstance): Item[] {
  const drops: Item[] = [];
  for (const drop of monster.dropTable) {
    if (Math.random() < drop.chance && ITEMS[drop.itemId]) {
      drops.push(ITEMS[drop.itemId]);
    }
  }
  return drops;
}
