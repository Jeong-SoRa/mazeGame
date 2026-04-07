import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useGame } from '../store/gameStore';
import { saveRanking, fetchMyBest } from '../firebase/firestore';
import RankingModal from './RankingModal';
import type { RankingEntry } from '../types/game.types';

interface Props {
  user: User;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function StageClear({ user }: Props) {
  const { state, dispatch } = useGame();
  const { stage, steps, completionTime } = state;
  const time = completionTime ?? 0;

  const [saved, setSaved] = useState(false);
  const [myBest, setMyBest] = useState<RankingEntry | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  useEffect(() => {
    async function saveAndFetch() {
      try {
        // 이전 최고 기록 확인
        const prev = await fetchMyBest(user.uid, stage);
        if (!prev || steps < prev.steps) {
          setIsNewBest(true);
        }
        // 랭킹 저장
        await saveRanking(user.uid, user.displayName ?? '익명', user.photoURL ?? '', stage, steps, time);
        setSaved(true);
        const best = await fetchMyBest(user.uid, stage);
        setMyBest(best);
      } catch (e) {
        console.error('랭킹 저장 실패:', e);
        setSaved(true);
      }
    }
    saveAndFetch();
  }, []);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0f2027 50%, #1a1a2e 100%)',
      gap: 20,
    }}>
      <div style={{ fontSize: 80 }}>🎉</div>
      <h1 style={{ fontSize: 36, fontWeight: 800, color: '#a78bfa' }}>
        Stage {stage} 클리어!
      </h1>

      {isNewBest && (
        <div style={{
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid #f59e0b',
          borderRadius: 8, padding: '8px 20px',
          color: '#fbbf24', fontSize: 14, fontWeight: 700,
        }}>
          🌟 새 최고 기록!
        </div>
      )}

      <div style={{
        background: '#1a1a2e', border: '1px solid #4a4a6e',
        borderRadius: 12, padding: '20px 40px', textAlign: 'center',
        display: 'flex', gap: 32,
      }}>
        <div>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>이동 수</div>
          <div style={{ color: '#fbbf24', fontSize: 32, fontWeight: 800 }}>{steps}</div>
        </div>
        <div>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>클리어 시간</div>
          <div style={{ color: '#67e8f9', fontSize: 32, fontWeight: 800 }}>{formatTime(time)}</div>
        </div>
      </div>

      {myBest && (
        <div style={{ color: '#9ca3af', fontSize: 13 }}>
          내 최고 기록: 👣 {myBest.steps}걸음 / ⏱ {formatTime(myBest.time)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {stage < 20 && (
          <button
            onClick={() => dispatch({ type: 'INIT_STAGE', stage: stage + 1 })}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px 24px', fontSize: 14, cursor: 'pointer', fontWeight: 700,
            }}
          >
            ➡️ 다음 스테이지
          </button>
        )}
        <button
          onClick={() => dispatch({ type: 'INIT_STAGE', stage })}
          style={{
            background: '#1e293b', border: '1px solid #4338ca',
            color: '#a5b4fc', borderRadius: 8,
            padding: '12px 20px', fontSize: 14, cursor: 'pointer',
          }}
        >
          🔄 재도전
        </button>
        <button
          onClick={() => setShowRanking(true)}
          style={{
            background: '#1e293b', border: '1px solid #d97706',
            color: '#fbbf24', borderRadius: 8,
            padding: '12px 20px', fontSize: 14, cursor: 'pointer',
          }}
        >
          🏆 이 스테이지 랭킹
        </button>
        <button
          onClick={() => dispatch({ type: 'RETURN_TO_SELECT' })}
          style={{
            background: '#374151', border: '1px solid #6b7280',
            color: '#d1d5db', borderRadius: 8,
            padding: '12px 20px', fontSize: 14, cursor: 'pointer',
          }}
        >
          🗺️ 스테이지 선택
        </button>
      </div>

      {!saved && (
        <div style={{ color: '#6b7280', fontSize: 12 }}>기록 저장 중...</div>
      )}

      {showRanking && (
        <RankingModal stage={stage} onClose={() => setShowRanking(false)} />
      )}
    </div>
  );
}
