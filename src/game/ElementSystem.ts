import type { Element } from '../types/game.types';

// 속성 상성표
// 바람 > 나무 > 물 > 불 > 바람 (순환 상성)
const ELEMENT_ADVANTAGE: Record<Element, Element> = {
  wind: 'earth',  // 바람이 나무를 자른다
  earth: 'water', // 나무가 물을 흡수한다
  water: 'fire',  // 물이 불을 끈다
  fire: 'wind',   // 불이 바람을 태운다
};

const ELEMENT_DISADVANTAGE: Record<Element, Element> = {
  wind: 'fire',   // 바람이 불에 약하다
  fire: 'water',  // 불이 물에 약하다
  water: 'earth', // 물이 나무에 약하다
  earth: 'wind',  // 나무가 바람에 약하다
};

// 속성 상성에 따른 데미지 배율 계산
export function getElementMultiplier(attackerElement: Element, defenderElement: Element): number {
  if (ELEMENT_ADVANTAGE[attackerElement] === defenderElement) {
    return 1.5; // 상성 유리: 1.5배 데미지
  }

  if (ELEMENT_DISADVANTAGE[attackerElement] === defenderElement) {
    return 0.7; // 상성 불리: 0.7배 데미지
  }

  return 1.0; // 중립: 1배 데미지
}

// 속성 이모지 반환
export function getElementEmoji(element: Element): string {
  const elementEmojis: Record<Element, string> = {
    wind: '💨',
    fire: '🔥',
    water: '💧',
    earth: '🌿'
  };
  return elementEmojis[element];
}

// 속성 이름 반환 (한국어)
export function getElementName(element: Element): string {
  const elementNames: Record<Element, string> = {
    wind: '바람',
    fire: '불',
    water: '물',
    earth: '나무'
  };
  return elementNames[element];
}

// 상성 텍스트 반환
export function getAdvantageText(attackerElement: Element, defenderElement: Element): string {
  const multiplier = getElementMultiplier(attackerElement, defenderElement);

  if (multiplier > 1.0) {
    return '효과가 뛰어나다!';
  }

  if (multiplier < 1.0) {
    return '효과가 별로다...';
  }

  return '';
}