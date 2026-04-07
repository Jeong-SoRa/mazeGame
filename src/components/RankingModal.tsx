import { useEffect, useState } from 'react';
import { fetchRankings } from '../firebase/firestore';
import type { RankingEntry } from '../types/game.types';

interface Props {
  stage: number;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RankingModal({ stage, onClose }: Props) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRankings(stage)
      .then(setRankings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [stage]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ minWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#f59e0b', fontSize: 18, fontWeight: 700 }}>
            🏆 Stage {stage} 랭킹
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>불러오는 중...</div>
        ) : rankings.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>
            아직 기록이 없습니다.<br />
            첫 번째 클리어를 도전해보세요!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rankings.map((entry, i) => (
              <div key={entry.uid} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: i === 0 ? 'rgba(245,158,11,0.1)' : '#0f172a',
                border: `1px solid ${i === 0 ? '#f59e0b40' : '#1e293b'}`,
                borderRadius: 8, padding: '10px 12px',
              }}>
                <span style={{ fontSize: 20, minWidth: 28 }}>{MEDALS[i] ?? `${i + 1}.`}</span>
                {entry.photoURL ? (
                  <img src={entry.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                    👤
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e8e8e8', fontSize: 13, fontWeight: 600 }}>{entry.displayName}</div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>
                    {new Date(entry.timestamp).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>
                    👣 {entry.steps}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>
                    ⏱ {formatTime(entry.time)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12, color: '#6b7280', fontSize: 11, textAlign: 'center' }}>
          스텝 수 기준 정렬 (적을수록 좋음)
        </div>
      </div>
    </div>
  );
}
