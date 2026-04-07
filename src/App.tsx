import { GameProvider, useGame } from './store/gameStore';
import { useAuth } from './hooks/useAuth';
import LoginScreen from './components/LoginScreen';
import StageSelect from './components/StageSelect';
import GameView from './components/GameView';
import StageClear from './components/StageClear';
import GameOver from './components/GameOver';

function GameRouter() {
  const { user, loading } = useAuth();
  const { state } = useGame();

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f', color: '#a78bfa', fontSize: 18,
      }}>
        🗺️ 로딩 중...
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  switch (state.screen) {
    case 'stage-select':
      return <StageSelect user={user} />;
    case 'playing':
      return <GameView />;
    case 'stage-clear':
      return <StageClear user={user} />;
    case 'game-over':
      return <GameOver />;
    default:
      return <StageSelect user={user} />;
  }
}

export default function App() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}
