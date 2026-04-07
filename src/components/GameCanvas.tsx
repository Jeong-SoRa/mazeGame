import { useEffect, useRef } from 'react';
import { useGame } from '../store/gameStore';
import { useKeyboard } from '../hooks/useKeyboard';

const VIEWPORT = 21;     // 보이는 칸 수 (홀수)
const HALF = Math.floor(VIEWPORT / 2);

// 색상 팔레트
const C = {
  wallFog:    '#0d0d14',
  wallVisit:  '#12121e',
  wallVisible:'#1a1a30',
  pathFog:    '#0a0a0f',
  pathVisit:  '#1e2235',
  pathVisible:'#2d3f52',
  player:     '#00ff88',
  exit:       '#00ccff',
  monsterBg:  '#3d1515',
  chest:      '#c89a00',
  chestOpened:'#4a4a4a',
  fog:        'rgba(0,0,0,0.88)',
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state } = useGame();
  useKeyboard();

  const {
    maze, mazeSize, playerPos, exitPos,
    visitedCells, monsters, chests, screen,
  } = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || screen !== 'playing') return;

    const size = Math.min(container.clientWidth, container.clientHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    const cellSize = Math.floor(size / Math.min(VIEWPORT, mazeSize));
    const visibleW = Math.min(VIEWPORT, mazeSize);
    const visibleH = Math.min(VIEWPORT, mazeSize);

    // 카메라 오프셋 (플레이어 중심)
    let camX = playerPos.x - HALF;
    let camY = playerPos.y - HALF;
    camX = Math.max(0, Math.min(mazeSize - visibleW, camX));
    camY = Math.max(0, Math.min(mazeSize - visibleH, camY));

    const visitedSet = new Set(visitedCells);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);

    // 각 셀 렌더링
    for (let row = 0; row < visibleH; row++) {
      for (let col = 0; col < visibleW; col++) {
        const mx = camX + col;
        const my = camY + row;
        if (mx < 0 || mx >= mazeSize || my < 0 || my >= mazeSize) continue;

        const key = `${mx},${my}`;
        const isWall = maze[my]?.[mx] === 0;
        const isVisited = visitedSet.has(key);
        const isVisible = Math.abs(mx - playerPos.x) <= 1 && Math.abs(my - playerPos.y) <= 1;
        const isPlayer = mx === playerPos.x && my === playerPos.y;
        const isExit = mx === exitPos.x && my === exitPos.y;

        const px = col * cellSize;
        const py = row * cellSize;

        // 배경 색 결정
        let bgColor: string;
        if (isWall) {
          bgColor = isVisible ? C.wallVisible : isVisited ? C.wallVisit : C.wallFog;
        } else {
          bgColor = isVisible ? C.pathVisible : isVisited ? C.pathVisit : C.pathFog;
        }
        ctx.fillStyle = bgColor;
        ctx.fillRect(px, py, cellSize, cellSize);

        if (!isVisible && !isVisited) continue; // 완전 암흑

        // 출구 표시
        if (isExit && isVisited) {
          ctx.fillStyle = 'rgba(0,204,255,0.2)';
          ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
          ctx.fillStyle = C.exit;
          ctx.font = `${cellSize - 4}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🚪', px + cellSize / 2, py + cellSize / 2);
        }

        // 보물상자 (시야 내에만 표시)
        if (isVisible && chests[key]) {
          const chest = chests[key];
          if (!chest.opened) {
            ctx.fillStyle = 'rgba(200,154,0,0.25)';
            ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
            ctx.font = `${cellSize - 6}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('📦', px + cellSize / 2, py + cellSize / 2);
          } else if (isVisited) {
            ctx.fillStyle = '#374151';
            ctx.fillRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
          }
        }

        // 방문했지만 시야 밖: 열린 상자 표시
        if (!isVisible && isVisited && chests[key]?.opened) {
          ctx.fillStyle = '#252525';
          ctx.fillRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
        }

        // 몬스터 (시야 내에만 표시)
        if (isVisible && monsters[key]) {
          const m = monsters[key];
          // 몬스터 배경
          ctx.fillStyle = C.monsterBg;
          ctx.beginPath();
          ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2);
          ctx.fill();
          // 몬스터 이모지
          ctx.font = `${cellSize - 8}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(m.emoji, px + cellSize / 2, py + cellSize / 2);
          // HP 바
          const hpPct = m.currentHp / m.maxHp;
          ctx.fillStyle = '#333';
          ctx.fillRect(px + 2, py + 1, cellSize - 4, 3);
          ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
          ctx.fillRect(px + 2, py + 1, (cellSize - 4) * hpPct, 3);
        }

        // 플레이어
        if (isPlayer) {
          // 글로우 효과
          ctx.shadowColor = C.player;
          ctx.shadowBlur = 10;
          ctx.fillStyle = C.player;
          ctx.beginPath();
          ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize / 2 - 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // 플레이어 심볼
          ctx.fillStyle = '#000';
          ctx.font = `bold ${Math.floor(cellSize * 0.5)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('P', px + cellSize / 2, py + cellSize / 2);
        }

        // 안개 오버레이 (방문했지만 시야 밖)
        if (isVisited && !isVisible) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(px, py, cellSize, cellSize);
        }
      }
    }

    // 미니맵 (우상단)
    const mmSize = 90;
    const mmCellSize = mmSize / mazeSize;
    const mmX = size - mmSize - 8;
    const mmY = 8;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);

    for (let y = 0; y < mazeSize; y++) {
      for (let x = 0; x < mazeSize; x++) {
        const k = `${x},${y}`;
        const vis = visitedSet.has(k);
        if (!vis) continue;

        const px2 = mmX + x * mmCellSize;
        const py2 = mmY + y * mmCellSize;

        if (x === playerPos.x && y === playerPos.y) {
          ctx.fillStyle = C.player;
        } else if (x === exitPos.x && y === exitPos.y) {
          ctx.fillStyle = C.exit;
        } else if (maze[y]?.[x] === 1) {
          ctx.fillStyle = '#3a5070';
        } else {
          ctx.fillStyle = '#1a1a2e';
        }
        ctx.fillRect(px2, py2, Math.max(1, mmCellSize - 0.5), Math.max(1, mmCellSize - 0.5));
      }
    }

  }, [maze, mazeSize, playerPos, exitPos, visitedCells, monsters, chests, screen]);

  // 모바일 스와이프 지원
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const { dispatch } = useGame();

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current || state.activeModal !== null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return;

    if (absDx > absDy) {
      dispatch({ type: 'MOVE', dx: dx > 0 ? 1 : -1, dy: 0 });
    } else {
      dispatch({ type: 'MOVE', dx: 0, dy: dy > 0 ? 1 : -1 });
    }
    touchStart.current = null;
  }

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflow: 'hidden' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {/* 방향키 UI (모바일 힌트) */}
      <div style={{
        position: 'absolute', bottom: 100, right: 16,
        display: 'grid', gridTemplateColumns: 'repeat(3, 40px)',
        gridTemplateRows: 'repeat(3, 40px)', gap: 4,
        opacity: 0.7,
      }}>
        {[
          { label: '↑', dx: 0, dy: -1, gridArea: '1/2' },
          { label: '←', dx: -1, dy: 0, gridArea: '2/1' },
          { label: '→', dx: 1, dy: 0, gridArea: '2/3' },
          { label: '↓', dx: 0, dy: 1, gridArea: '3/2' },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={() => dispatch({ type: 'MOVE', dx: btn.dx, dy: btn.dy })}
            style={{
              gridArea: btn.gridArea,
              background: 'rgba(30,30,60,0.9)',
              border: '1px solid #4a4a6e',
              color: '#a5b4fc', borderRadius: 6,
              fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
