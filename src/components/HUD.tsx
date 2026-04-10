import { useGame } from '../store/gameStore';
import { getPlayerAttack, getPlayerDefense, getInventoryCapacity } from '../game/CombatSystem';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function HUD() {
  const { state, dispatch } = useGame();
  const { player, steps, optimalSteps, elapsedSeconds, stage, exitPos, mazeSize, message } = state;

  const hp = player.hp;
  const maxHp = player.maxHp;
  const hpPct = (hp / maxHp) * 100;
  const hpColor = hpPct > 60 ? '#22c55e' : hpPct > 30 ? '#f59e0b' : '#ef4444';
  const mp = player.mp;
  const maxMp = player.maxMp;
  const mpPct = (mp / maxMp) * 100;

  const atk = getPlayerAttack(player);
  const def = getPlayerDefense(player);
  const capacity = getInventoryCapacity(player);
  const invFull = player.inventory.length >= capacity;

  return (
    <div style={{
      background: '#111827',
      borderTop: '1px solid #2a2a3e',
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexShrink: 0,
      flexWrap: 'wrap',
    }}>
      {/* HP 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
        <span style={{ color: '#ef4444', fontSize: 14 }}>❤️</span>
        <div style={{ flex: 1, background: '#374151', borderRadius: 4, height: 10, minWidth: 100 }}>
          <div style={{
            width: `${hpPct}%`, height: '100%',
            background: hpColor, borderRadius: 4,
            transition: 'width 0.3s, background 0.3s',
          }} />
        </div>
        <span style={{ color: hpColor, fontSize: 12, fontWeight: 700, minWidth: 55 }}>
          {hp}/{maxHp}
        </span>
      </div>

      {/* MP 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
        <span style={{ color: '#3b82f6', fontSize: 14 }}>💧</span>
        <div style={{ flex: 1, background: '#374151', borderRadius: 4, height: 10, minWidth: 100 }}>
          <div style={{
            width: `${mpPct}%`, height: '100%',
            background: '#3b82f6', borderRadius: 4,
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ color: '#3b82f6', fontSize: 12, fontWeight: 700, minWidth: 55 }}>
          {mp}/{maxMp}
        </span>
      </div>

      {/* 스텝 & 시간 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>
          👣 <b style={{ color: steps <= optimalSteps ? '#22c55e' : steps <= optimalSteps + 5 ? '#f59e0b' : '#ef4444' }}>
            {steps}
          </b>
          <span style={{ color: '#6b7280', fontSize: 10 }}>/{optimalSteps}</span>
        </span>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>
          ⏱ <b style={{ color: '#fff' }}>{formatTime(elapsedSeconds)}</b>
        </span>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>
          🗺 <b style={{ color: '#a78bfa' }}>Stage {stage}</b>
        </span>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>
          🚪 출구: <b style={{ color: '#67e8f9' }}>({exitPos.x},{exitPos.y})</b>
        </span>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>
          📍 내 위치: <b style={{ color: '#fbbf24' }}>({state.playerPos.x},{state.playerPos.y})</b>
        </span>
      </div>

      {/* 스탯 */}
      <div style={{ display: 'flex', gap: 10 }}>
        <span style={{ color: '#fca5a5', fontSize: 12 }}>⚔️ {atk}</span>
        <span style={{ color: '#93c5fd', fontSize: 12 }}>🛡️ {def}</span>
      </div>

      {/* 가방 용량 */}
      <div style={{
        background: invFull ? '#450a0a' : '#1e293b',
        border: `1px solid ${invFull ? '#dc2626' : '#374151'}`,
        borderRadius: 6, padding: '2px 8px', fontSize: 12,
        color: invFull ? '#fca5a5' : '#d1d5db',
      }}>
        🎒 {player.inventory.length}/{capacity}
      </div>

      {/* 버튼들 */}
      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        <button
          onClick={() => dispatch({ type: 'REST' })}
          title="HP/MP 완전 회복 (+30초, +2이동)"
          style={{
            background: '#1e293b', border: '1px solid #22c55e',
            color: '#86efac', padding: '4px 10px', borderRadius: 6,
            fontSize: 12, cursor: 'pointer',
          }}
        >
          💤 휴식
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_MODAL', modal: 'crafting' })}
          style={{
            background: '#1e293b', border: '1px solid #4338ca',
            color: '#a5b4fc', padding: '4px 10px', borderRadius: 6,
            fontSize: 12, cursor: 'pointer',
          }}
        >
          ✨ 조합
        </button>
        <button
          onClick={() => dispatch({ type: 'RETURN_TO_SELECT' })}
          style={{
            background: '#1e293b', border: '1px solid #dc2626',
            color: '#fca5a5', padding: '4px 10px', borderRadius: 6,
            fontSize: 12, cursor: 'pointer',
          }}
        >
          🚪 나가기
        </button>
      </div>

      {/* 마지막 크기 */}
      <div style={{ color: '#6b7280', fontSize: 10, width: '100%' }}>
        미로 크기: {mazeSize}×{mazeSize} | 아이템: {player.inventory.length}/{capacity}개
        {invFull && <span style={{ color: '#ef4444' }}>가득 참!</span>} |
        최적 이동수: <span style={{ color: '#22c55e' }}>{optimalSteps}</span>
        {steps > optimalSteps && (
          <span style={{ color: '#f59e0b' }}> (+{steps - optimalSteps})</span>
        )}
      </div>

      {/* 메시지 */}
      {message && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', border: '1px solid #4a4a6e',
          color: '#e8e8e8', padding: '10px 20px', borderRadius: 8,
          fontSize: 14, zIndex: 200, pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease',
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
