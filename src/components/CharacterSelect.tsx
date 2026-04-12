import { useState } from 'react';
import { useGame } from '../store/gameStore';
import type { User } from 'firebase/auth';
import type { Character } from '../types/game.types';
import { logout, signInWithGoogle } from '../firebase/auth';
import { getElementEmoji, getElementName } from '../game/ElementSystem';

interface Props {
  user: User | null;
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
  const isLoggedIn = user !== null;

  async function handleLogin() {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
      alert('로그인에 실패했습니다.');
    }
  }

  function startGame() {
    if (!selectedCharacter || !isLoggedIn) return;

    // 선택된 캐릭터로 첫번째 스테이지 시작
    dispatch({
      type: 'INIT_STAGE',
      stage: 1,
      character: selectedCharacter
    });
  }

  return (
    <>
      <style>
        {`
          @keyframes rainbow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }

          @keyframes pixelGlow {
            0% {
              text-shadow:
                -2px -2px 0 #000,
                2px -2px 0 #000,
                -2px 2px 0 #000,
                2px 2px 0 #000,
                0 0 15px rgba(255, 107, 107, 0.5),
                0 0 30px rgba(255, 217, 61, 0.3),
                4px 4px 0 rgba(0, 0, 0, 0.5);
            }
            100% {
              text-shadow:
                -3px -3px 0 #000,
                3px -3px 0 #000,
                -3px 3px 0 #000,
                3px 3px 0 #000,
                0 0 25px rgba(255, 107, 107, 0.8),
                0 0 50px rgba(255, 217, 61, 0.6),
                6px 6px 0 rgba(0, 0, 0, 0.7);
            }
          }
        `}
      </style>
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
          {isLoggedIn ? (
            <>
              {user.photoURL && (
                <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
              )}
              <span style={{ color: '#d1d5db', fontSize: 14 }}>{user.displayName}</span>
            </>
          ) : (
            <span style={{ color: '#6b7280', fontSize: 14 }}>로그인이 필요합니다</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 18 }}>Breaking MAZE</span>
          {isLoggedIn ? (
            <button onClick={logout} style={{
              background: 'transparent', border: '1px solid #4a4a6e',
              color: '#9ca3af', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
            }}>로그아웃</button>
          ) : (
            <button onClick={handleLogin} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fff', color: '#1f2937', border: 'none',
              padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 로그인
            </button>
          )}
        </div>
      </div>

      {/* 캐릭터 선택 메인 영역 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 메인 게임 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: '100%', padding: '0 8px' }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 10vw, 4.5rem)',
            fontWeight: '900',
            background: 'linear-gradient(45deg, #ff6b6b, #ffd93d, #6bcf7f, #4ecdc4, #45b7d1, #96ceb4, #feca57)',
            backgroundSize: '300% 300%',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            fontFamily: '"Courier New", "Consolas", "Monaco", monospace',
            letterSpacing: '0.15em',
            margin: '0 0 12px 0',
            animation: 'rainbow 3s ease-in-out infinite, pixelGlow 2s ease-in-out infinite alternate',
            textTransform: 'uppercase',
            transform: 'scaleY(1.1)',
            WebkitTextStroke: '2px #000',
            textShadow: `
              -2px -2px 0 #000,
              2px -2px 0 #000,
              -2px 2px 0 #000,
              2px 2px 0 #000,
              0 0 20px rgba(255, 107, 107, 0.6),
              0 0 40px rgba(255, 217, 61, 0.4),
              4px 4px 0 rgba(0, 0, 0, 0.5)
            `,
            filter: 'contrast(1.2)',
          }}>
            Breaking MAZE
          </h1>

          <p style={{
            fontSize: 'clamp(0.85rem, 3.5vw, 1.3rem)',
            color: '#c4b5fd',
            marginBottom: '8px',
            fontWeight: '600',
            fontFamily: '"Courier New", "Consolas", "Monaco", monospace',
            letterSpacing: '0.08em',
            textShadow: `
              -1px -1px 0 rgba(0, 0, 0, 0.8),
              1px -1px 0 rgba(0, 0, 0, 0.8),
              -1px 1px 0 rgba(0, 0, 0, 0.8),
              1px 1px 0 rgba(0, 0, 0, 0.8),
              0 0 8px rgba(167, 139, 250, 0.6)
            `,
            transform: 'scaleY(1.05)',
          }}>
            몬스터를 잡고 아이템을 만들면서 강해져서 미로를 탈출하세요
          </p>

          <div style={{
            width: '100px',
            height: '3px',
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)',
            margin: '0 auto',
            borderRadius: '2px',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)',
          }} />
        </div>

        <h2 style={{ color: '#e8e8e8', textAlign: 'center', marginBottom: 32, fontSize: 20, fontWeight: '400' }}>
          미로탈출을 함께 할 친구를 선택하세요
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          maxWidth: 900,
          width: '100%',
        }}>
          {characters.map(character => {
            const isSelected = selectedCharacter?.id === character.id;
            return (
              <div key={character.id} style={{
                position: 'relative',
                background: isSelected ? '#2a2a4e' : '#1a1a2e',
                border: `2px solid ${isSelected ? '#6366f1' : '#2a2a4e'}`,
                borderRadius: 12,
                padding: 20,
                textAlign: 'center',
                cursor: isLoggedIn ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                transform: isSelected ? 'translateY(-2px)' : 'translateY(0)',
                opacity: isLoggedIn ? 1 : 0.4,
              }}
                onClick={() => { if (isLoggedIn) setSelectedCharacter(isSelected ? null : character); }}
                onMouseEnter={e => {
                  if (!isSelected && isLoggedIn) {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#4a4a6e';
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected && isLoggedIn) {
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

                {/* 선택 오버레이 */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 12,
                    background: 'rgba(10, 10, 20, 0.82)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    backdropFilter: 'blur(2px)',
                  }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ color: '#c4b5fd', fontSize: 18, fontWeight: 700 }}>
                      {character.name}
                    </div>
                    <button
                      onClick={startGame}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '12px 36px',
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'transform 0.15s',
                        boxShadow: '0 0 16px rgba(99, 102, 241, 0.5)',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    >
                       모험 시작하기
                    </button>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>다른 캐릭터를 선택하려면 클릭</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}