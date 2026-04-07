import { useGame } from '../store/gameStore';
import { RARITY_COLORS } from '../game/ItemDatabase';

export default function CraftingModal() {
  const { state, dispatch } = useGame();
  const { player, selectedCraftItems, craftResult } = state;

  const item1 = selectedCraftItems[0] !== undefined ? player.inventory[selectedCraftItems[0]] : null;
  const item2 = selectedCraftItems[1] !== undefined ? player.inventory[selectedCraftItems[1]] : null;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#a78bfa', fontSize: 18, fontWeight: 700 }}>✨ 아이템 조합</h3>
          <button
            onClick={() => dispatch({ type: 'SET_MODAL', modal: null })}
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 12 }}>
          💡 인벤토리에서 두 아이템을 선택하면 조합을 시도합니다. 레시피는 직접 발견해보세요!
        </p>

        {/* 조합 슬롯 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, marginBottom: 16, padding: 16,
          background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b',
        }}>
          <ItemSlot item={item1} label="재료 1" />
          <span style={{ color: '#6b7280', fontSize: 20 }}>+</span>
          <ItemSlot item={item2} label="재료 2" />
          <span style={{ color: '#6b7280', fontSize: 20 }}>=</span>
          <div style={{
            width: 60, height: 60,
            background: '#1e293b', border: '2px dashed #4338ca',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: '#4338ca',
          }}>
            ?
          </div>
        </div>

        {/* 조합 결과 */}
        {craftResult && (
          <div style={{
            padding: 12, borderRadius: 8, marginBottom: 12,
            background: craftResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${craftResult.success ? '#22c55e' : '#ef4444'}`,
          }}>
            <div style={{ color: craftResult.success ? '#86efac' : '#fca5a5', fontSize: 13 }}>
              {craftResult.message}
            </div>
            {craftResult.success && craftResult.item && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 28 }}>{craftResult.item.emoji}</span>
                <div>
                  <div style={{ color: RARITY_COLORS[craftResult.item.rarity], fontWeight: 700 }}>
                    {craftResult.item.name}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>{craftResult.item.description}</div>
                </div>
              </div>
            )}
            <button
              onClick={() => dispatch({ type: 'CLEAR_CRAFT_RESULT' })}
              style={{
                marginTop: 8, background: 'transparent', border: '1px solid #374151',
                color: '#9ca3af', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >
              확인
            </button>
          </div>
        )}

        {/* 조합 버튼 */}
        <button
          onClick={() => dispatch({ type: 'CRAFT_ITEMS' })}
          disabled={selectedCraftItems.length !== 2}
          style={{
            width: '100%',
            background: selectedCraftItems.length === 2
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              : '#374151',
            color: selectedCraftItems.length === 2 ? '#fff' : '#6b7280',
            border: 'none', borderRadius: 8,
            padding: '10px', fontSize: 14, cursor: selectedCraftItems.length === 2 ? 'pointer' : 'not-allowed',
            fontWeight: 600, marginBottom: 16,
          }}
        >
          {selectedCraftItems.length === 2 ? '⚗️ 조합 시도!' : `아이템 ${2 - selectedCraftItems.length}개 더 선택`}
        </button>

        {/* 인벤토리 */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12 }}>
          <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>
            인벤토리에서 조합할 아이템 선택 ({selectedCraftItems.length}/2)
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6, maxHeight: 200, overflow: 'auto',
          }}>
            {player.inventory.map((item, i) => {
              const isSelected = selectedCraftItems.includes(i);
              return (
                <div
                  key={i}
                  onClick={() => dispatch({ type: 'TOGGLE_CRAFT_ITEM', inventoryIndex: i })}
                  title={`${item.name}: ${item.description}`}
                  style={{
                    background: isSelected ? '#1e1b4b' : '#1a1a2e',
                    border: `1px solid ${isSelected ? '#818cf8' : '#2a2a3e'}`,
                    borderRadius: 6, padding: '6px',
                    textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{ fontSize: 22 }}>{item.emoji}</div>
                  <div style={{ fontSize: 10, color: RARITY_COLORS[item.rarity], marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  {isSelected && <div style={{ color: '#818cf8', fontSize: 10 }}>✓선택</div>}
                </div>
              );
            })}
            {player.inventory.length === 0 && (
              <div style={{ gridColumn: '1/-1', color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 13 }}>
                인벤토리가 비어있습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemSlot({ item, label }: { item: { name: string; emoji: string; rarity: string } | null; label: string }) {
  return (
    <div style={{
      width: 60, height: 60,
      background: item ? '#1e293b' : '#0f172a',
      border: `2px solid ${item ? '#6366f1' : '#2a2a3e'}`,
      borderRadius: 8, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {item ? (
        <>
          <span style={{ fontSize: 24 }}>{item.emoji}</span>
          <span style={{ fontSize: 9, color: RARITY_COLORS[item.rarity as string], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 54 }}>
            {item.name}
          </span>
        </>
      ) : (
        <span style={{ color: '#374151', fontSize: 11 }}>{label}</span>
      )}
    </div>
  );
}
