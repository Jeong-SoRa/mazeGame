import { useState } from 'react';
import type { User } from 'firebase/auth';
import { useGame } from '../store/gameStore';
import { logout } from '../firebase/auth';
import RankingModal from './RankingModal';

interface Props {
  user: User;
}

const STAGE_EMOJIS = ['🌱','🌿','🌲','🏔️','⛰️','🌋','🏜️','🌊','❄️','🌀','💀','☠️','👻','🧟','🐺','🧛','👹','🐲','🔮','👑'];

export default function StageSelect({ user }: Props) {
  const { dispatch } = useGame();
  const [rankingStage, setRankingStage] = useState<number | null>(null);

  function startStage(stage: number) {
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

            return (
              <div key={stage} style={{
                background: '#1a1a2e',
                border: '1px solid #2a2a4e',
                borderRadius: 10,
                padding: '14px 8px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a4e';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>{STAGE_EMOJIS[stage - 1]}</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
                  Stage {stage}
                </div>
                <div style={{ color: diffColor, fontSize: 11, marginBottom: 4 }}>{difficulty}</div>
                <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 10 }}>
                  {mazeSize}×{mazeSize}
                </div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button
                    onClick={() => startStage(stage)}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: '#fff', border: 'none', borderRadius: 6,
                      padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    시작
                  </button>
                  <button
                    onClick={() => setRankingStage(stage)}
                    style={{
                      background: 'transparent',
                      color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: 6,
                      padding: '5px 8px', fontSize: 11, cursor: 'pointer',
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
