import { useEffect } from 'react';
import { useGame } from '../store/gameStore';

const KEY_MAP: Record<string, { dx: number; dy: number }> = {
  ArrowUp:    { dx: 0, dy: -1 },
  ArrowDown:  { dx: 0, dy: 1 },
  ArrowLeft:  { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

export function useKeyboard() {
  const { state, dispatch } = useGame();

  useEffect(() => {
    if (state.screen !== 'playing') return;

    function handleKey(e: KeyboardEvent) {
      // 모달 열려있으면 이동 무시
      if (state.activeModal !== null) return;

      const dir = KEY_MAP[e.key];
      if (dir) {
        e.preventDefault();
        dispatch({ type: 'MOVE', dx: dir.dx, dy: dir.dy });
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [state.screen, state.activeModal, dispatch]);
}
