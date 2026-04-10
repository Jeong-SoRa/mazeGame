import { useGame } from '../store/gameStore';
import { getInventoryCapacity } from '../game/CombatSystem';
import { RARITY_COLORS } from '../game/ItemDatabase';
import type { Item } from '../types/game.types';

export default function Inventory() {
  const { state, dispatch } = useGame();
  const { player, selectedCraftItems } = state;
  const capacity = getInventoryCapacity(player);
  const invFull = player.inventory.length >= capacity;

  function handleItemClick(index: number) {
    if (state.activeModal === 'crafting') {
      dispatch({ type: 'TOGGLE_CRAFT_ITEM', inventoryIndex: index });
    }
  }

  function handleUseItem(e: React.MouseEvent, index: number) {
    e.stopPropagation();
    dispatch({ type: 'USE_ITEM', itemIndex: index });
  }

  function handleDropItem(e: React.MouseEvent, index: number) {
    e.stopPropagation();
    dispatch({ type: 'DROP_ITEM', itemIndex: index });
  }

  return (
    <div style={{
      width: 200,
      background: '#111827',
      borderLeft: '1px solid #2a2a3e',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #2a2a3e',
        color: invFull ? '#fca5a5' : '#d1d5db',
        fontSize: 13,
        fontWeight: 600,
        background: invFull ? '#1a0a0a' : '#1a1a2e',
      }}>
        🎒 인벤토리 ({player.inventory.length}/{capacity})
        {invFull && <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 4 }}>가득 참!</span>}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {player.inventory.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>
            아이템 없음
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {player.inventory.map((item: Item, i: number) => {
              const isSelected = selectedCraftItems.includes(i);
              const rarityColor = RARITY_COLORS[item.rarity];
              const isUsable = item.type === 'potion' || (item.type === 'special' && !item.capacity);

              return (
                <div
                  key={i}
                  onClick={() => handleItemClick(i)}
                  title={`${item.name}\n${item.description}${item.attack ? '\n공격력 +' + item.attack : ''}${item.defense ? '\n방어력 +' + item.defense : ''}${item.heal ? '\nHP +' + item.heal : ''}${item.capacity ? '\n가방 +' + item.capacity + '칸' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 8px',
                    borderRadius: 6,
                    cursor: state.activeModal === 'crafting' ? 'pointer' : 'default',
                    background: isSelected ? '#1e1b4b' : '#1a1a2e',
                    border: `1px solid ${isSelected ? '#818cf8' : '#2a2a3e'}`,
                    transition: 'all 0.1s',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{item.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: rarityColor, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>
                      {item.type === 'weapon' && `⚔️+${item.attack}`}
                      {item.type === 'armor' && `🛡️+${item.defense}`}
                      {item.type === 'potion' && `❤️+${item.heal}`}
                      {item.capacity && `🎒+${item.capacity}칸`}
                      {item.type === 'material' && '재료'}
                      {item.type === 'special' && !item.capacity && '특수'}
                    </div>
                  </div>
                  {isSelected && <span style={{ fontSize: 10, color: '#a5b4fc' }}>✓</span>}
                  {isUsable && state.activeModal !== 'crafting' && (
                    <button
                      onClick={(e) => handleUseItem(e, i)}
                      style={{
                        padding: '2px 5px', background: '#14532d',
                        border: '1px solid #4ade80', color: '#86efac',
                        borderRadius: 4, fontSize: 10, cursor: 'pointer',
                      }}
                    >사용</button>
                  )}
                  {state.activeModal !== 'crafting' && (
                    <button
                      onClick={(e) => handleDropItem(e, i)}
                      style={{
                        padding: '2px 5px', background: '#450a0a',
                        border: '1px solid #dc2626', color: '#fca5a5',
                        borderRadius: 4, fontSize: 10, cursor: 'pointer',
                      }}
                    >버리기</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding: '6px 8px', borderTop: '1px solid #2a2a3e', fontSize: 10, color: '#6b7280' }}>
        💡 소지만 해도 아이템 효과 적용<br />
        ✨ 조합모드: 두 개 선택 후 조합
      </div>
    </div>
  );
}
