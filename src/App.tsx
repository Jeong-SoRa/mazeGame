import { GameProvider, useGame } from './store/gameStore';
import { useAuth } from './hooks/useAuth';
import LoginScreen from './components/LoginScreen';
import CharacterSelect from './components/CharacterSelect';
import GameView from './components/GameView';
import StageClear from './components/StageClear';
import GameOver from './components/GameOver';

function GameRouter() {
  const { user, loading } = useAuth();
  const { state } = useGame();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        color: '#a78bfa',
        fontSize: 18,
        fontFamily: 'monospace'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '24px'
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            background: '#a78bfa',
            borderRadius: '1px',
            animation: 'bounce1 1.2s infinite ease-in-out'
          }} />
          <div style={{
            width: '10px',
            height: '10px',
            background: '#a78bfa',
            borderRadius: '1px',
            animation: 'bounce2 1.2s infinite ease-in-out'
          }} />
          <div style={{
            width: '10px',
            height: '10px',
            background: '#a78bfa',
            borderRadius: '1px',
            animation: 'bounce3 1.2s infinite ease-in-out'
          }} />
        </div>
        <div style={{
          textAlign: 'center',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          fontSize: '14px',
          opacity: 0.7,
          fontWeight: 'bold'
        }}>
          Loading
        </div>
        <style>{`
          @keyframes bounce1 {
            0%, 80%, 100% {
              transform: scaleY(0.6);
              opacity: 0.4;
            }
            40% {
              transform: scaleY(1.2);
              opacity: 1;
            }
          }
          @keyframes bounce2 {
            0%, 20%, 80%, 100% {
              transform: scaleY(0.6);
              opacity: 0.4;
            }
            50% {
              transform: scaleY(1.2);
              opacity: 1;
            }
          }
          @keyframes bounce3 {
            0%, 40%, 80%, 100% {
              transform: scaleY(0.6);
              opacity: 0.4;
            }
            60% {
              transform: scaleY(1.2);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  switch (state.screen) {
    case 'character-select':
      return <CharacterSelect user={user} />;
    case 'playing':
      return <GameView />;
    case 'stage-clear':
      return <StageClear user={user} />;
    case 'game-over':
      return <GameOver />;
    default:
      return <CharacterSelect user={user} />;
  }
}

export default function App() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}
