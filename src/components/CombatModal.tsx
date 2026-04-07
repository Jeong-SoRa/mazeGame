import { useGame } from '../store/gameStore';

export default function CombatModal() {
  const { state, dispatch } = useGame();
  const { combatState, player } = state;
  if (!combatState) return null;

  const { monster, log, phase } = combatState;
  const hpPct = monster.currentHp / monster.maxHp;
  const playerHpPct = player.hp / player.maxHp;
  const potions = player.inventory.map((item, i) => ({ item, i })).filter(({ item }) => item.type === 'potion');

  const isDone = phase === 'player-won' || phase === 'player-died' || phase === 'fled';

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ minWidth: 380 }}>
        {/* 몬스터 정보 */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 52 }}>{monster.emoji}</div>
          <h3 style={{ color: '#f87171', fontSize: 20, fontWeight: 700 }}>{monster.name}</h3>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>몬스터 HP</span>
              <div style={{ width: 160, height: 10, background: '#374151', borderRadius: 5 }}>
                <div style={{
                  width: `${hpPct * 100}%`, height: '100%',
                  background: hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444',
                  borderRadius: 5, transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ color: '#f87171', fontSize: 12, minWidth: 60 }}>
                {monster.currentHp}/{monster.maxHp}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
              <span style={{ color: '#fca5a5', fontSize: 12 }}>⚔️ {monster.attack}</span>
              <span style={{ color: '#93c5fd', fontSize: 12 }}>🛡️ {monster.defense}</span>
            </div>
          </div>
        </div>

        {/* 플레이어 HP */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>내 HP</span>
            <div style={{ flex: 1, height: 10, background: '#374151', borderRadius: 5 }}>
              <div style={{
                width: `${playerHpPct * 100}%`, height: '100%',
                background: playerHpPct > 0.6 ? '#22c55e' : playerHpPct > 0.3 ? '#f59e0b' : '#ef4444',
                borderRadius: 5, transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ color: '#86efac', fontSize: 12, minWidth: 55 }}>{player.hp}/{player.maxHp}</span>
          </div>
        </div>

        {/* 전투 로그 */}
        <div style={{
          background: '#0f172a', border: '1px solid #1e293b',
          borderRadius: 6, padding: 8, height: 120, overflow: 'auto',
          marginBottom: 12,
        }}>
          {log.map((l, i) => (
            <div key={i} style={{
              fontSize: 12, marginBottom: 2,
              color: l.type === 'player' ? '#86efac' : l.type === 'monster' ? '#fca5a5' : '#d1d5db',
            }}>
              {l.text}
            </div>
          ))}
        </div>

        {/* 행동 버튼 */}
        {!isDone ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => dispatch({ type: 'COMBAT_ATTACK' })}
              style={{
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px', fontSize: 14, cursor: 'pointer', fontWeight: 700,
              }}
            >
              ⚔️ 공격
            </button>

            {potions.length > 0 && (
              <div>
                <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>포션 사용:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {potions.map(({ item, i }) => (
                    <button
                      key={i}
                      onClick={() => dispatch({ type: 'COMBAT_USE_ITEM', itemIndex: i })}
                      style={{
                        background: '#1e3a2e', border: '1px solid #22c55e',
                        color: '#86efac', borderRadius: 6,
                        padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      {item.emoji} {item.name} (+{item.heal}HP)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => dispatch({ type: 'COMBAT_FLEE' })}
              style={{
                background: '#374151', border: '1px solid #6b7280',
                color: '#d1d5db', borderRadius: 8,
                padding: '8px', fontSize: 13, cursor: 'pointer',
              }}
            >
              🏃 도망 ({Math.round(Math.max(25, 55 - state.stage))}% 성공률)
            </button>
          </div>
        ) : (
          <button
            onClick={() => dispatch({ type: 'COMBAT_NEXT_PHASE' })}
            style={{
              width: '100%',
              background: phase === 'player-won' || phase === 'fled'
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #6b7280, #4b5563)',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px', fontSize: 14, cursor: 'pointer', fontWeight: 700,
            }}
          >
            {phase === 'player-won' ? '🎉 계속 탐험' : phase === 'fled' ? '🏃 계속 탐험' : '💀 게임오버'}
          </button>
        )}
      </div>
    </div>
  );
}
