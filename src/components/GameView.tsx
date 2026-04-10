import { useGame } from '../store/gameStore';
import FPSCanvas from './FPSCanvas';
import CombatModal from './CombatModal';
import ChestModal from './ChestModal';
import CraftingModal from './CraftingModal';
import DiscardModal from './DiscardModal';

export default function GameView() {
  const { state } = useGame();
  const { activeModal } = state;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>
      {/* FPS 메인 뷰 (HUD 포함) */}
      <FPSCanvas />

      {/* 모달들 */}
      {activeModal === 'combat'   && <CombatModal />}
      {activeModal === 'chest'    && <ChestModal />}
      {activeModal === 'crafting' && <CraftingModal />}
      {activeModal === 'discard'  && <DiscardModal />}
    </div>
  );
}
