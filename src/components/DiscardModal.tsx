import { useGame } from '../store/gameStore';
import { getInventoryCapacity } from '../game/CombatSystem';
import { RARITY_COLORS } from '../game/ItemDatabase';
import { ItemImage } from './ItemImage';

export default function DiscardModal() {
  const { state, dispatch } = useGame();
  const { player, discardState } = state;

  if (!discardState) return null;

  const capacity = getInventoryCapacity(player);
  const pending = discardState.pendingItems;
  const total = player.inventory.length + pending.length;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ minWidth: 360, maxWidth: 420 }}>
        <h3 style={{ color: '#f87171', fontSize: 18, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>
          🎒 가방이 가득 찼습니다!
        </h3>
        <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
          현재 {player.inventory.length}/{capacity}개 · 버릴 아이템을 선택하세요 ({pending.length}개 대기 중)
        </p>

        {/* 새로 들어오는 아이템 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            📥 받을 아이템 ({pending.length}개)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pending.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#1c2a1a', border: '1px solid #4ade80',
                borderRadius: 6, padding: '6px 10px',
              }}>
                <ItemImage itemId={item.id} emoji={item.emoji} size={18} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: RARITY_COLORS[item.rarity], fontSize: 12, fontWeight: 600 }}>{item.name}</span>
                  <div style={{ color: '#6b7280', fontSize: 10 }}>
                    {item.type === 'weapon' && `⚔️ +${item.attack}`}
                    {item.type === 'armor' && `🛡️ +${item.defense}`}
                    {item.type === 'potion' && `❤️ +${item.heal}`}
                    {item.capacity && `🎒 +${item.capacity}칸`}
                    {item.type === 'material' && '재료'}
                    {item.type === 'special' && !item.capacity && '특수'}
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'DISCARD_SKIP', pendingIndex: i })}
                  style={{
                    padding: '3px 8px', background: '#450a0a', border: '1px solid #dc2626',
                    color: '#fca5a5', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                  }}
                >
                  버리기
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 현재 인벤토리 */}
        <div>
          <div style={{ color: '#93c5fd', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            🎒 현재 아이템 ({player.inventory.length}/{capacity})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
            {player.inventory.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#1e293b', border: '1px solid #374151',
                borderRadius: 6, padding: '6px 10px',
              }}>
                <ItemImage itemId={item.item.id} emoji={item.item.emoji} size={18} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: RARITY_COLORS[item.item.rarity], fontSize: 12, fontWeight: 600 }}>{item.item.name}</span>
                  <div style={{ color: '#6b7280', fontSize: 10 }}>
                    {item.item.type === 'weapon' && `⚔️ +${item.item.attack}`}
                    {item.item.type === 'armor' && `🛡️ +${item.item.defense}`}
                    {item.item.type === 'potion' && `❤️ +${item.item.heal}`}
                    {item.item.capacity && `🎒 +${item.item.capacity}칸`}
                    {item.item.type === 'material' && '재료'}
                    {item.item.type === 'special' && !item.item.capacity && '특수'}
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'DROP_ITEM', itemIndex: i })}
                  style={{
                    padding: '3px 8px', background: '#450a0a', border: '1px solid #dc2626',
                    color: '#fca5a5', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                  }}
                >
                  버리기
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ color: '#6b7280', fontSize: 10, textAlign: 'center', marginTop: 12 }}>
          총 {total}개 → {capacity}개로 줄여야 합니다 ({total - capacity}개 버리기)
        </div>
      </div>
    </div>
  );
}
