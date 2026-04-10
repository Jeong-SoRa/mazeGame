import { useState } from 'react';
import { useGame } from '../store/gameStore';
import type { User } from 'firebase/auth';
import type { Character } from '../types/game.types';
import { logout } from '../firebase/auth';
import { getElementEmoji, getElementName } from '../game/ElementSystem';

interface Props {
  user: User;
}

interface CharacterWithImage extends Character {
  image: string;
}

const characters: CharacterWithImage[] = [
  {
    id: 'cheese_cat',
    name: '치즈 고양이',
    image: 'player/player_cheese_cat.png',
    element: 'earth',
    description: '치즈의 힘으로 든든한 방어력과 회복력을 가진 고양이',
    stats: { hp: 110, mp: 50, attack: 7, defense: 5 }
  },
  {
    id: 'tuxedo_cat',
    name: '턱시도 고양이',
    image: 'player/player_tuxedo_cat.png',
    element: 'water',
    description: '우아하고 지적인 턱시도 고양이, 가장 고양이스러운 고양이',
    stats: { hp: 90, mp: 80, attack: 6, defense: 3 }
  },
  {
    id: 'bread_cat',
    name: '식빵 고양이',
    image: 'player/player_bread_cat.png',
    element: 'fire',
    description: '언제나 식빵만 굽는 고양이, 왜인지 높은 공격력과 스피드가 특징',
    stats: { hp: 85, mp: 65, attack: 9, defense: 2 }
  }
];

export default function CharacterSelect({ user }: Props) {
  const { dispatch } = useGame();
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  function startGame() {
    if (!selectedCharacter) return;

    // 선택된 캐릭터로 첫번째 스테이지 시작
    dispatch({
      type: 'INIT_STAGE',
      stage: 1,
      character: selectedCharacter
    });
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
      overflow: 'hidden',
    }}>
      {/* 상단 유저 정보 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid #2a2a3e',
        background: 'rgba(26,26,46,0.8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user.photoURL && (
            <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          )}
          <span style={{ color: '#d1d5db', fontSize: 14 }}>{user.displayName}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 18 }}>🗺️ 캐릭터 선택</span>
          <button onClick={logout} style={{
            background: 'transparent', border: '1px solid #4a4a6e',
            color: '#9ca3af', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
          }}>로그아웃</button>
        </div>
      </div>

      {/* 캐릭터 선택 메인 영역 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ color: '#e8e8e8', textAlign: 'center', marginBottom: 32, fontSize: 24 }}>
          미로탈출을 함께 할 친구를 선택하세요
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          maxWidth: 900,
          width: '100%',
          marginBottom: 32,
        }}>
          {characters.map(character => (
            <div key={character.id} style={{
              background: selectedCharacter?.id === character.id ? '#2a2a4e' : '#1a1a2e',
              border: `2px solid ${selectedCharacter?.id === character.id ? '#6366f1' : '#2a2a4e'}`,
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              transform: selectedCharacter?.id === character.id ? 'translateY(-2px)' : 'translateY(0)',
            }}
              onClick={() => setSelectedCharacter(character)}
              onMouseEnter={e => {
                if (selectedCharacter?.id !== character.id) {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#4a4a6e';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={e => {
                if (selectedCharacter?.id !== character.id) {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a4e';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }
              }}
            >
              <div style={{ width: 120, height: 120, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={character.image}
                  alt={character.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement).style.display = 'block'; }}
                />
                
              </div>
              <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                {character.name}
              </h3>
              <div style={{ color: '#a78bfa', fontSize: 14, marginBottom: 8 }}>
                {getElementEmoji(character.element)} {getElementName(character.element)} 속성
              </div>
              <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.4, marginBottom: 16 }}>
                {character.description}
              </p>

              {/* 스탯 정보 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                background: 'rgba(0,0,0,0.3)',
                padding: 12,
                borderRadius: 8,
              }}>
                <div style={{ color: '#ef4444', fontSize: 12 }}>
                  <span>❤️ HP: {character.stats.hp}</span>
                </div>
                <div style={{ color: '#3b82f6', fontSize: 12 }}>
                  <span>💧 MP: {character.stats.mp}</span>
                </div>
                <div style={{ color: '#f59e0b', fontSize: 12 }}>
                  <span>⚔️ 공격: {character.stats.attack}</span>
                </div>
                <div style={{ color: '#22c55e', fontSize: 12 }}>
                  <span>🛡️ 방어: {character.stats.defense}</span>
                </div>
              </div>

              {selectedCharacter?.id === character.id && (
                <div style={{
                  color: '#6366f1',
                  fontSize: 12,
                  fontWeight: 600,
                  marginTop: 8,
                }}>
                  ✓ 선택됨
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 시작 버튼 */}
        <button
          onClick={startGame}
          disabled={!selectedCharacter}
          style={{
            background: selectedCharacter
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              : '#374151',
            color: selectedCharacter ? '#fff' : '#6b7280',
            border: 'none',
            borderRadius: 12,
            padding: '16px 48px',
            fontSize: 18,
            fontWeight: 700,
            cursor: selectedCharacter ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            transform: selectedCharacter ? 'scale(1)' : 'scale(0.95)',
          }}
          onMouseEnter={e => {
            if (selectedCharacter) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={e => {
            if (selectedCharacter) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }
          }}
        >
          🚀 모험 시작하기
        </button>
      </div>
    </div>
  );
}