import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useGame } from '../store/gameStore';
import { logout } from '../firebase/auth';
import { loadProgress } from '../firebase/firestore';
import RankingModal from './RankingModal';

interface Props {
  user: User;
}

const STAGE_EMOJIS = ['🌱','🌿','🌲','🏔️','⛰️','🌋','🏜️','🌊','❄️','🌀','💀','☠️','👻','🧟','🐺','🧛','👹','🐲','🔮','👑'];

export default function StageSelect({ user }: Props) {
  const { state, dispatch } = useGame();
  const [rankingStage, setRankingStage] = useState<number | null>(null);

  useEffect(() => {
    loadProgress(user.uid).then(maxCleared => {
      if (maxCleared > state.maxClearedStage) {
        dispatch({ type: 'SET_MAX_CLEARED_STAGE', stage: maxCleared });
      }
    });
  }, [user.uid]);

  const unlockedUpTo = state.maxClearedStage + 1;

  function startStage(stage: number) {
    if (stage > unlockedUpTo) return;
    dispatch({ type: 'INIT_STAGE', stage });
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
          <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 18 }}>🗺️ 미로 탈출</span>
          <button onClick={logout} style={{
            background: 'transparent', border: '1px solid #4a4a6e',
            color: '#9ca3af', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
          }}>로그아웃</button>
        </div>
      </div>

      {/* 스테이지 그리드 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <h2 style={{ color: '#e8e8e8', textAlign: 'center', marginBottom: 24, fontSize: 20 }}>
          스테이지 선택
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          maxWidth: 600,
          margin: '0 auto',
        }}>
          {Array.from({ length: 20 }, (_, i) => i + 1).map(stage => {
            const difficulty = stage <= 5 ? '초급' : stage <= 10 ? '중급' : stage <= 15 ? '고급' : '전설';
            const diffColor = stage <= 5 ? '#22c55e' : stage <= 10 ? '#3b82f6' : stage <= 15 ? '#a855f7' : '#f59e0b';
            const mazeSize = 2 * (5 + stage) + 1;
            const locked = stage > unlockedUpTo;
            const cleared = stage <= state.maxClearedStage;

            return (
              <div key={stage} style={{
                background: locked ? '#0f0f1a' : '#1a1a2e',
                border: `1px solid ${cleared ? '#6366f1' : locked ? '#1a1a2e' : '#2a2a4e'}`,
                borderRadius: 10,
                padding: '14px 8px',
                textAlign: 'center',
                cursor: locked ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: locked ? 0.45 : 1,
              }}
                onMouseEnter={e => {
                  if (locked) return;
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  if (locked) return;
                  (e.currentTarget as HTMLDivElement).style.borderColor = cleared ? '#6366f1' : '#2a2a4e';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>
                  {locked ? '🔒' : STAGE_EMOJIS[stage - 1]}
                </div>
                <div style={{ color: locked ? '#4b5563' : '#fff', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
                  Stage {stage}
                </div>
                <div style={{ color: locked ? '#374151' : diffColor, fontSize: 11, marginBottom: 4 }}>{difficulty}</div>
                <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 10 }}>
                  {mazeSize}×{mazeSize}
                </div>
                {cleared && (
                  <div style={{ color: '#6366f1', fontSize: 10, marginBottom: 6 }}>✓ 클리어</div>
                )}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button
                    onClick={() => startStage(stage)}
                    disabled={locked}
                    style={{
                      background: locked ? '#1f2937' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: locked ? '#4b5563' : '#fff', border: 'none', borderRadius: 6,
                      padding: '5px 10px', fontSize: 11,
                      cursor: locked ? 'not-allowed' : 'pointer', fontWeight: 600,
                    }}
                  >
                    {locked ? '잠금' : '시작'}
                  </button>
                  <button
                    onClick={() => !locked && setRankingStage(stage)}
                    disabled={locked}
                    style={{
                      background: 'transparent',
                      color: locked ? '#374151' : '#f59e0b',
                      border: `1px solid ${locked ? '#374151' : '#f59e0b'}`,
                      borderRadius: 6,
                      padding: '5px 8px', fontSize: 11,
                      cursor: locked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    🏆
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {rankingStage !== null && (
        <RankingModal
          stage={rankingStage}
          onClose={() => setRankingStage(null)}
        />
      )}
    </div>
  );
}
