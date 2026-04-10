import type { PlayerState, MonsterInstance, CombatLog, Item, Element } from '../types/game.types';
import { ITEMS } from './ItemDatabase';
import { getElementMultiplier, getAdvantageText } from './ElementSystem';

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getPlayerAttack(player: PlayerState): number {
  const weaponBonus = player.inventory.reduce((sum, item) => sum + (item.attack ?? 0), 0);
  return player.baseAttack + weaponBonus;
}

export function getPlayerDefense(player: PlayerState): number {
  const armorBonus = player.inventory.reduce((sum, item) => sum + (item.defense ?? 0), 0);
  return player.baseDefense + armorBonus;
}

// 인벤토리 최대 용량 (기본 10 + 주머니 5씩 추가)
export function getInventoryCapacity(player: PlayerState): number {
  const pouches = player.inventory.filter(item => item.id === 'pouch').length;
  return 10 + pouches * 5;
}

// 플레이어의 실제 공격 속성 (인벤토리 첫 번째 무기 속성 우선, 없으면 캐릭터 속성)
export function getPlayerAttackElement(player: PlayerState): Element {
  const weapon = player.inventory.find(item => item.type === 'weapon' && item.element);
  return weapon?.element ?? player.element;
}

// 속성 상성을 고려한 데미지 계산
export function calculateDamageWithElement(
  baseDamage: number,
  attackerElement: Element,
  defenderElement: Element
): { damage: number; multiplier: number } {
  const multiplier = getElementMultiplier(attackerElement, defenderElement);
  const damage = Math.floor(baseDamage * multiplier);
  return { damage, multiplier };
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

  // 플레이어 공격 (속성 상성 적용)
  const pAtk = getPlayerAttack(player);
  const mDef = monster.defense;
  const baseDmgToMonster = Math.max(1, pAtk - mDef + rand(-2, 4));

  const playerElement = getPlayerAttackElement(player);
  const { damage: dmgToMonster } = calculateDamageWithElement(
    baseDmgToMonster,
    playerElement,
    monster.element
  );

  const monsterHpAfter = Math.max(0, monster.currentHp - dmgToMonster);

  logs.push({
    text: `⚔️ ${monster.name}에게 ${dmgToMonster} 데미지!`,
    type: 'player',
  });

  // 속성 상성 메시지 추가
  const advantageText = getAdvantageText(playerElement, monster.element);
  if (advantageText) {
    logs.push({
      text: advantageText,
      type: 'system',
    });
  }

  if (monsterHpAfter <= 0) {
    logs.push({ text: `💥 ${monster.name}을(를) 처치했습니다!`, type: 'system' });
    return { playerHpAfter: player.hp, monsterHpAfter: 0, logs, playerDied: false, monsterDied: true };
  }

  // 몬스터 반격 (속성 상성 적용)
  const mAtk = monster.attack;
  const pDef = getPlayerDefense(player);
  const baseDmgToPlayer = Math.max(1, mAtk - pDef + rand(-2, 3));

  // 플레이어의 방어 속성 (인벤토리 첫 번째 방어구 속성 우선, 없으면 캐릭터 속성)
  const armor = player.inventory.find(item => item.type === 'armor' && item.element);
  const playerDefenseElement = armor?.element ?? player.element;

  const { damage: dmgToPlayer } = calculateDamageWithElement(
    baseDmgToPlayer,
    monster.element,
    playerDefenseElement
  );

  const playerHpAfter = Math.max(0, player.hp - dmgToPlayer);

  logs.push({
    text: `💢 ${monster.name}의 반격! ${dmgToPlayer} 데미지를 받았습니다.`,
    type: 'monster',
  });

  // 몬스터 공격의 속성 상성 메시지
  const monsterAdvantageText = getAdvantageText(monster.element, playerDefenseElement);
  if (monsterAdvantageText) {
    logs.push({
      text: monsterAdvantageText,
      type: 'system',
    });
  }

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
