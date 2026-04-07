import { useGame } from '../store/gameStore';
import GameCanvas from './GameCanvas';
import HUD from './HUD';
import Inventory from './Inventory';
import CombatModal from './CombatModal';
import ChestModal from './ChestModal';
import CraftingModal from './CraftingModal';

export default function GameView() {
  const { state } = useGame();
  const { activeModal } = state;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 메인 게임 영역 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 캔버스 */}
        <GameCanvas />
        {/* 인벤토리 패널 */}
        <Inventory />
      </div>

      {/* 하단 HUD */}
      <HUD />

      {/* 모달들 */}
      {activeModal === 'combat' && <CombatModal />}
      {activeModal === 'chest' && <ChestModal />}
      {activeModal === 'crafting' && <CraftingModal />}
    </div>
  );
}
