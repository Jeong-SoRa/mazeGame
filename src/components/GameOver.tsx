import { useGame } from '../store/gameStore';

export default function GameOver() {
  const { state, dispatch } = useGame();
  const { stage, steps } = state;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0505 100%)',
      gap: 20,
    }}>
      <div style={{ fontSize: 80 }}>💀</div>
      <h1 style={{ fontSize: 36, fontWeight: 800, color: '#ef4444' }}>
        Game Over
      </h1>
      <p style={{ color: '#9ca3af', fontSize: 16 }}>
        Stage {stage}에서 쓰러졌습니다
      </p>
      <div style={{
        background: '#1a1a2e', border: '1px solid #4a4a6e',
        borderRadius: 12, padding: '16px 32px', textAlign: 'center',
      }}>
        <div style={{ color: '#9ca3af', fontSize: 13 }}>이동 수</div>
        <div style={{ color: '#fbbf24', fontSize: 28, fontWeight: 700 }}>{steps}</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => dispatch({ type: 'INIT_STAGE', stage })}
          style={{
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '12px 24px', fontSize: 14, cursor: 'pointer', fontWeight: 700,
          }}
        >
          🔄 재도전
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
    </div>
  );
}
