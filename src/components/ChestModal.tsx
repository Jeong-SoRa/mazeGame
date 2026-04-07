import { useGame } from '../store/gameStore';
import { RARITY_COLORS } from '../game/ItemDatabase';

export default function ChestModal() {
  const { state, dispatch } = useGame();
  const { chestState } = state;
  if (!chestState) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>📦</div>
        <h3 style={{ color: '#fbbf24', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          보물 상자 발견!
        </h3>
        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
          {chestState.items.length}개의 아이템이 들어있습니다
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {chestState.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#0f172a', border: `1px solid ${RARITY_COLORS[item.rarity]}40`,
              borderRadius: 8, padding: '10px 14px',
            }}>
              <span style={{ fontSize: 28 }}>{item.emoji}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ color: RARITY_COLORS[item.rarity], fontWeight: 700, fontSize: 14 }}>
                  {item.name}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{item.description}</div>
                <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>
                  {item.attack ? `⚔️ 공격력 +${item.attack}` : ''}
                  {item.defense ? `🛡️ 방어력 +${item.defense}` : ''}
                  {item.heal ? `❤️ 회복 +${item.heal}` : ''}
                  {item.type === 'material' ? '🔧 조합 재료' : ''}
                </div>
              </div>
              <span style={{ color: RARITY_COLORS[item.rarity], fontSize: 11, textTransform: 'uppercase' }}>
                {item.rarity}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => dispatch({ type: 'CHEST_TAKE_ALL' })}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#000', border: 'none', borderRadius: 8,
              padding: '12px', fontSize: 14, cursor: 'pointer', fontWeight: 700,
            }}
          >
            📥 전부 획득
          </button>
          <button
            onClick={() => dispatch({ type: 'CHEST_CLOSE' })}
            style={{
              background: '#374151', border: '1px solid #6b7280',
              color: '#d1d5db', borderRadius: 8,
              padding: '12px 16px', fontSize: 13, cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
