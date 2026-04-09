import { useState } from 'react';
import { useGame } from '../store/gameStore';
import type { User } from 'firebase/auth';
import type { Character } from '../types/game.types';
import { logout } from '../firebase/auth';

interface Props {
  user: User;
}

const characters: Character[] = [
  {
    id: 'warrior',
    name: '전사',
    emoji: '⚔️',
    description: '강력한 공격력과 높은 체력을 가진 근접 전투의 달인',
    stats: { hp: 120, mp: 40, attack: 8, defense: 4 }
  },
  {
    id: 'mage',
    name: '마법사',
    emoji: '🔮',
    description: '마법으로 적을 공격하고 강력한 스킬을 사용하는 지적 전투원',
    stats: { hp: 80, mp: 100, attack: 6, defense: 2 }
  },
  {
    id: 'rogue',
    name: '도적',
    emoji: '🗡️',
    description: '빠른 속도와 균형잡힌 능력치를 가진 민첩한 전투원',
    stats: { hp: 100, mp: 60, attack: 7, defense: 3 }
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
          🎮 캐릭터를 선택하세요
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
              <div style={{ fontSize: 48, marginBottom: 12 }}>{character.emoji}</div>
              <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                {character.name}
              </h3>
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