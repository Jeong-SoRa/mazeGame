import { useEffect, useRef, useCallback } from 'react';
import { useGame } from '../store/gameStore';
import { getPlayerAttack, getPlayerDefense } from '../game/CombatSystem';
import type { Item } from '../types/game.types';

// ── 상수 ────────────────────────────────────────────────────────────────────
const FOV       = Math.PI / 3;   // 60°
const NUM_RAYS  = 320;
const TURN_LERP = 0.18;
const MOVE_LERP = 0.14;

// 이동 방향 → grid dx/dy (북=0, 동=PI/2, 남=PI, 서=-PI/2)
function angleToDelta(angle: number): { dx: number; dy: number } {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a < Math.PI / 4 || a >= 7 * Math.PI / 4) return { dx: 0,  dy: -1 }; // 북
  if (a < 3 * Math.PI / 4)                       return { dx: 1,  dy:  0 }; // 동
  if (a < 5 * Math.PI / 4)                       return { dx: 0,  dy:  1 }; // 남
  return                                                  { dx: -1, dy:  0 }; // 서
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function FPSCanvas() {
  const { state, dispatch } = useGame();
  const {
    maze, mazeSize, playerPos,
    player, steps, elapsedSeconds, stage,
    activeModal,
  } = state;

  // ── refs (렌더링 루프용) ────────────────────────────────────────────────
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mmRef      = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fpsPosRef     = useRef({ x: 1.5, y: 1.5 });
  const targetPosRef  = useRef({ x: 1.5, y: 1.5 });
  const angleRef      = useRef(0);
  const targetAngleRef = useRef(0);
  const keysRef       = useRef<Record<string, boolean>>({});
  const animRef       = useRef<number>(0);
  const lastKeyRef    = useRef<Record<string, boolean>>({});
  const mazeRef       = useRef(maze);
  const mazeSizeRef   = useRef(mazeSize);
  const activeModalRef = useRef(activeModal);
  const stateRef      = useRef(state);

  // refs 동기화
  useEffect(() => { mazeRef.current = maze; }, [maze]);
  useEffect(() => { mazeSizeRef.current = mazeSize; }, [mazeSize]);
  useEffect(() => { activeModalRef.current = activeModal; }, [activeModal]);
  useEffect(() => { stateRef.current = state; }, [state]);

  // 그리드 위치 변화 → targetPos 갱신
  useEffect(() => {
    targetPosRef.current = { x: playerPos.x + 0.5, y: playerPos.y + 0.5 };
  }, [playerPos]);

  // ── 레이캐스팅 (DDA) ─────────────────────────────────────────────────────
  function castRay(px: number, py: number, angle: number, mz: number[][], mzSize: number) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ddx = Math.abs(1 / (cos || 1e-10));
    const ddy = Math.abs(1 / (sin || 1e-10));
    let mx = Math.floor(px), my = Math.floor(py);
    let stepX: number, stepY: number, sdx: number, sdy: number;
    if (cos < 0) { stepX = -1; sdx = (px - mx) * ddx; }
    else          { stepX =  1; sdx = (mx + 1 - px) * ddx; }
    if (sin < 0) { stepY = -1; sdy = (py - my) * ddy; }
    else          { stepY =  1; sdy = (my + 1 - py) * ddy; }
    let side = 0;
    for (let i = 0; i < mzSize * 15; i++) {
      if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0; }
      else           { sdy += ddy; my += stepY; side = 1; }
      if (mx < 0 || mx >= mzSize || my < 0 || my >= mzSize) break;
      if (mz[my][mx] === 0) {
        const dist = side === 0
          ? (mx - px + (1 - stepX) / 2) / cos
          : (my - py + (1 - stepY) / 2) / sin;
        return { dist: Math.abs(dist), side };
      }
    }
    return { dist: mzSize * 2, side: 0 };
  }

  // ── 장면 렌더링 ──────────────────────────────────────────────────────────
  const drawScene = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    px: number, py: number, angle: number,
    mz: number[][], mzSize: number,
    ex: number, ey: number,
    s: typeof state,
  ) => {
    // 천장 – 하늘
    const ceilG = ctx.createLinearGradient(0, 0, 0, H / 2);
    ceilG.addColorStop(0, '#0c2a6e');
    ceilG.addColorStop(0.5, '#1d6fa4');
    ceilG.addColorStop(1, '#5ab0d8');
    ctx.fillStyle = ceilG;
    ctx.fillRect(0, 0, W, H / 2);

    // 바닥 – 흙
    const floorG = ctx.createLinearGradient(0, H / 2, 0, H);
    floorG.addColorStop(0, '#3b2a1a');
    floorG.addColorStop(1, '#1a1008');
    ctx.fillStyle = floorG;
    ctx.fillRect(0, H / 2, W, H / 2);

    const sliceW = W / NUM_RAYS;

    for (let i = 0; i < NUM_RAYS; i++) {
      const rayAngle = angle - FOV / 2 + (i / NUM_RAYS) * FOV;
      const { dist, side } = castRay(px, py, rayAngle, mz, mzSize);
      const corrected = dist * Math.cos(rayAngle - angle);
      const sliceH = Math.min(H, H / corrected);
      const top = (H - sliceH) / 2;
      const bright = Math.max(0, 1 - corrected / (mzSize * 0.8));
      const base = side === 0 ? 220 : 160;
      const v = Math.floor(base * bright);
      ctx.fillStyle = `rgb(${Math.floor(v * 0.18)},${Math.floor(v * 0.62)},${Math.floor(v * 0.22)})`;
      ctx.fillRect(i * sliceW, top, Math.ceil(sliceW), sliceH);
    }

    // 출구 방향 화살표
    const ddx = ex - px, ddy = ey - py;
    const angleToExit = Math.atan2(ddy, ddx);
    let rel = angleToExit - angle;
    while (rel >  Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    if (Math.abs(rel) >= FOV / 2) {
      const side2 = rel < 0 ? 'left' : 'right';
      const ex2 = side2 === 'left' ? 20 : W - 20;
      const ey2 = Math.max(30, Math.min(H - 30, H / 2 + Math.tan(rel) * W * 0.4));
      ctx.save();
      ctx.fillStyle = 'rgba(0,200,255,0.8)';
      ctx.beginPath();
      if (side2 === 'right') {
        ctx.moveTo(ex2, ey2); ctx.lineTo(ex2 - 14, ey2 - 7); ctx.lineTo(ex2 - 14, ey2 + 7);
      } else {
        ctx.moveTo(ex2, ey2); ctx.lineTo(ex2 + 14, ey2 - 7); ctx.lineTo(ex2 + 14, ey2 + 7);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // 몬스터 빌보드 (시야 내 가장 가까운 몬스터 표시)
    for (const [key, monster] of Object.entries(s.monsters)) {
      const [mx2, my2] = key.split(',').map(Number);
      const mdx = (mx2 + 0.5) - px, mdy = (my2 + 0.5) - py;
      const dist2 = Math.sqrt(mdx * mdx + mdy * mdy);
      if (dist2 > mzSize * 0.6) continue;
      const mAngle = Math.atan2(mdy, mdx);
      let relM = mAngle - angle;
      while (relM >  Math.PI) relM -= 2 * Math.PI;
      while (relM < -Math.PI) relM += 2 * Math.PI;
      if (Math.abs(relM) > FOV * 0.6) continue;
      const corrM = dist2 * Math.cos(relM);
      const sH = Math.min(H * 0.8, H / corrM * 0.9);
      const screenX = W / 2 + (relM / (FOV / 2)) * (W / 2);
      const top2 = (H - sH) / 2;
      ctx.save();
      ctx.font = `${sH * 0.6}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.max(0.2, 1 - corrM / 8);
      ctx.fillText(monster.emoji, screenX, top2 + sH / 2);
      // HP bar
      const bw = sH * 0.6, bx = screenX - bw / 2, by = top2 - 10;
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, bw, 5);
      const hpPct = monster.currentHp / monster.maxHp;
      ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(bx, by, bw * hpPct, 5);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }, []);

  // ── 미니맵 렌더링 ─────────────────────────────────────────────────────────
  const drawMinimap = useCallback((
    mmCtx: CanvasRenderingContext2D,
    ms: number,
    px: number, py: number, angle: number,
    mz: number[][], mzSize: number,
    s: typeof state,
  ) => {
    const cs = ms / mzSize;
    mmCtx.clearRect(0, 0, ms, ms);
    const showPath = s.mapRevealTimer > 0;
    const visited = new Set(s.visitedCells);

    for (let y = 0; y < mzSize; y++) {
      for (let x = 0; x < mzSize; x++) {
        if (showPath && visited.has(`${x},${y}`)) {
          mmCtx.fillStyle = mz[y][x] === 0 ? '#0d1117' : '#1e3a5f';
        } else {
          mmCtx.fillStyle = '#060810';
        }
        mmCtx.fillRect(x * cs, y * cs, cs, cs);
      }
    }
    // 시작점
    mmCtx.fillStyle = '#4ade80';
    mmCtx.fillRect(cs, cs, cs, cs);
    // 출구
    mmCtx.fillStyle = '#00ccff';
    mmCtx.fillRect((mzSize - 2) * cs, (mzSize - 2) * cs, cs, cs);
    // 플레이어
    const ppx = px * cs, ppy = py * cs;
    mmCtx.fillStyle = '#facc15';
    mmCtx.beginPath();
    mmCtx.arc(ppx, ppy, Math.max(cs * 1.3, 2), 0, Math.PI * 2);
    mmCtx.fill();
    // 시야선
    mmCtx.strokeStyle = 'rgba(250,204,21,0.7)';
    mmCtx.lineWidth = 1;
    mmCtx.beginPath();
    mmCtx.moveTo(ppx, ppy);
    mmCtx.lineTo(ppx + Math.cos(angle) * cs * 3, ppy + Math.sin(angle) * cs * 3);
    mmCtx.stroke();
    // 남은 시간
    if (s.mapRevealTimer > 0) {
      mmCtx.fillStyle = 'rgba(250,204,21,0.9)';
      mmCtx.font = `${Math.max(7, Math.floor(cs * 1.8))}px monospace`;
      mmCtx.textAlign = 'center';
      mmCtx.fillText(`🦅${Math.ceil(s.mapRevealTimer)}s`, ms / 2, ms - 3);
      mmCtx.textAlign = 'left';
    }
  }, []);

  // ── 메인 rAF 루프 ─────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    const mm = mmRef.current;
    if (!canvas || !mm) return;

    const ctx = canvas.getContext('2d');
    const mmCtx = mm.getContext('2d');
    if (!ctx || !mmCtx) return;

    const W = canvas.width, H = canvas.height;
    const s = stateRef.current;

    // LERP 이동
    const tp = targetPosRef.current;
    fpsPosRef.current.x += (tp.x - fpsPosRef.current.x) * MOVE_LERP;
    fpsPosRef.current.y += (tp.y - fpsPosRef.current.y) * MOVE_LERP;

    // LERP 회전
    let diff = targetAngleRef.current - angleRef.current;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    angleRef.current += diff * TURN_LERP;

    const px = fpsPosRef.current.x;
    const py = fpsPosRef.current.y;
    const angle = angleRef.current;
    const mz = mazeRef.current as number[][];
    const mzSize = mazeSizeRef.current;

    drawScene(ctx, W, H, px, py, angle, mz, mzSize,
      s.exitPos.x + 0.5, s.exitPos.y + 0.5, s);

    const mmS = mm.width;
    drawMinimap(mmCtx, mmS, px, py, angle, mz, mzSize, s);

    animRef.current = requestAnimationFrame(loop);
  }, [drawScene, drawMinimap]);

  // ── 캔버스 크기 조정 ──────────────────────────────────────────────────────
  const resize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const mm = mmRef.current;
    if (!container || !canvas || !mm) return;
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    const mmS = Math.min(110, container.clientWidth * 0.16);
    mm.width = mm.height = mmS;
    mm.style.width = mm.style.height = `${mmS}px`;
  }, []);

  // ── 게임 시작/재시작 시 초기화 및 루프 시작 ───────────────────────────────
  useEffect(() => {
    if (state.screen !== 'playing') {
      cancelAnimationFrame(animRef.current);
      return;
    }
    fpsPosRef.current  = { x: playerPos.x + 0.5, y: playerPos.y + 0.5 };
    targetPosRef.current = { x: playerPos.x + 0.5, y: playerPos.y + 0.5 };
    angleRef.current   = 0;
    targetAngleRef.current = 0;
    resize();
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen]);

  useEffect(() => {
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  // ── 키보드 이벤트 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.screen !== 'playing') return;

    function onKeyDown(e: KeyboardEvent) {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      keysRef.current[e.key] = true;

      if (activeModalRef.current !== null) {
        console.log('Modal is open, ignoring key input:', activeModalRef.current);
        return;
      }

      const isRepeat = lastKeyRef.current[e.key];

      // 회전 (한 번만 처리)
      if (!isRepeat) {
        if (e.key === 'a' || e.key === 'A') {
          targetAngleRef.current -= Math.PI / 2;
        }
        if (e.key === 'd' || e.key === 'D') {
          targetAngleRef.current += Math.PI / 2;
        }
      }

      // 이동 (키 반복 허용)
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        console.log('Up/W key pressed, angle:', targetAngleRef.current);
        const { dx, dy } = angleToDelta(targetAngleRef.current);
        console.log('Move direction:', { dx, dy });
        dispatch({ type: 'MOVE', dx, dy });
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        console.log('Down/S key pressed, angle:', targetAngleRef.current);
        const { dx, dy } = angleToDelta(targetAngleRef.current);
        console.log('Move direction:', { dx: -dx, dy: -dy });
        dispatch({ type: 'MOVE', dx: -dx, dy: -dy });
      }

      // 회전 (키 반복 허용)
      if (e.key === 'ArrowLeft') {
        targetAngleRef.current -= Math.PI / 2;
      }
      if (e.key === 'ArrowRight') {
        targetAngleRef.current += Math.PI / 2;
      }

      lastKeyRef.current[e.key] = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current[e.key] = false;
      lastKeyRef.current[e.key] = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [state.screen, dispatch]);

  // ── 인벤토리 아이템 렌더 ──────────────────────────────────────────────────
  function renderInvItems() {
    const inv = player.inventory;
    if (inv.length === 0) return (
      <div style={{ color:'#4b5563', fontSize:12, textAlign:'center', paddingTop:20 }}>
        아이템 없음
      </div>
    );
    return inv.map((item: Item, i: number) => {
      const isEquip = item.type === 'weapon' || item.type === 'armor';
      const isUsable = item.type === 'potion' || item.type === 'special';
      const isEquipped = item.id === player.equippedWeaponId || item.id === player.equippedArmorId;
      const spec = item.type === 'weapon' ? `⚔️ +${item.attack}`
                 : item.type === 'armor'  ? `🛡️ +${item.defense}`
                 : item.type === 'potion' ? `❤️ +${item.heal}`
                 : item.description;
      return (
        <div key={i} style={{
          background:'#1e293b', border:`1px solid ${isEquipped ? '#6366f1' : '#374151'}`,
          borderRadius:6, padding:'6px 8px',
          display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#d1d5db',
        }}>
          <span style={{ fontSize:18, flexShrink:0 }}>{item.emoji}</span>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:1, minWidth:0 }}>
            <span style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {item.name} {isEquipped && <span style={{ color:'#818cf8', fontSize:10 }}>착용</span>}
            </span>
            <span style={{ color:'#86efac', fontSize:10 }}>{spec}</span>
          </div>
          {isEquip && (
            <button onClick={() => dispatch({ type:'EQUIP_ITEM', itemIndex:i })}
              style={{ padding:'2px 6px', background:'#1e3a5f', border:'1px solid #6366f1',
                color:'#a5b4fc', borderRadius:4, fontSize:10, cursor:'pointer' }}>
              {isEquipped ? '해제' : '장착'}
            </button>
          )}
          {isUsable && (
            <button onClick={() => dispatch({ type:'USE_ITEM', itemIndex:i })}
              style={{ padding:'2px 6px', background:'#14532d', border:'1px solid #4ade80',
                color:'#86efac', borderRadius:4, fontSize:10, cursor:'pointer' }}>
              사용
            </button>
          )}
        </div>
      );
    });
  }

  // ── 터치 핸들러 ───────────────────────────────────────────────────────────
  function touchMove(forward: boolean) {
    if (activeModalRef.current !== null) return;
    const { dx, dy } = angleToDelta(targetAngleRef.current);
    dispatch({ type: 'MOVE', dx: forward ? dx : -dx, dy: forward ? dy : -dy });
  }
  function touchRotate(left: boolean) {
    targetAngleRef.current += left ? -Math.PI / 2 : Math.PI / 2;
  }

  const atk = getPlayerAttack(player);
  const def = getPlayerDefense(player);
  const hpPct  = (player.hp / player.maxHp) * 100;
  const mpPct  = (player.mp / player.maxMp) * 100;
  const hpColor = hpPct > 60 ? '#22c55e' : hpPct > 30 ? '#f59e0b' : '#ef4444';

  if (state.screen !== 'playing') return null;

  return (
    <div style={{
      height: '100dvh', // dynamic viewport height (최신 브라우저 지원) 테스트 필요
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
      overflow: 'hidden',
      padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
      boxSizing: 'border-box',
    }}>
      {/* 게임 메인 화면 영역 */}
      <div ref={containerRef} style={{
        position: 'relative',
        flex: 1,
        minHeight: 0, // flex 아이템이 줄어들 수 있게 함
        background: '#000',
        overflow: 'hidden',
      }}>
        {/* 메인 레이캐스팅 캔버스 */}
        <canvas ref={canvasRef} style={{ display:'block', width:'100%', height:'100%' }} />

        {/* 미니맵 */}
        <canvas ref={mmRef} style={{
          position:'absolute',
          top:'calc(10px + env(safe-area-inset-top))',
          right:'calc(10px + env(safe-area-inset-right))',
          border:'1px solid #334155', borderRadius:3,
          background:'rgba(0,0,0,0.75)',
        }} />

      {/* 조준점 */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)', pointerEvents:'none',
        width:14, height:14,
      }}>
        <div style={{ position:'absolute', top:'50%', left:0, width:'100%', height:2, background:'rgba(255,255,255,0.6)', transform:'translateY(-50%)' }} />
        <div style={{ position:'absolute', left:'50%', top:0, width:2, height:'100%', background:'rgba(255,255,255,0.6)', transform:'translateX(-50%)' }} />
      </div>

        {/* 알림 메시지 */}
        {state.message && (
          <div style={{
            position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
            background:'rgba(0,0,0,0.85)', border:'1px solid #4a4a6e',
            color:'#e8e8e8', padding:'8px 18px', borderRadius:8,
            fontSize:13, zIndex:30, pointerEvents:'none', whiteSpace:'nowrap',
          }}>
            {state.message}
          </div>
        )}
      </div>

      {/* ── 하단 UI 영역 ── */}
      <div style={{
        flexShrink: 0, // 이 영역은 줄어들지 않도록 함
        background:'rgba(0,0,16,0.95)', borderTop:'1px solid #1e3a5f',
        fontFamily:"'Courier New', monospace", fontSize:12,
        position: 'relative',
        paddingBottom: '12px', // 모바일에서 추가 하단 여백
        marginBottom: 'env(safe-area-inset-bottom)', // 안전 영역 확보
      }}>
        {/* HUD 정보 */}
        <div style={{
          padding:'8px 12px', display:'flex', flexDirection:'column', gap:6,
        }}>
          {/* 바 영역 */}
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {/* HP */}
            <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:120 }}>
              <span>❤️</span>
              <div style={{ flex:1, background:'#1e293b', borderRadius:4, height:8, minWidth:60, overflow:'hidden' }}>
                <div style={{ width:`${hpPct}%`, height:'100%', background:hpColor, borderRadius:4, transition:'width 0.3s' }} />
              </div>
              <span style={{ color:hpColor, fontSize:10, minWidth:45 }}>{player.hp}/{player.maxHp}</span>
            </div>
            {/* MP */}
            <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:120 }}>
              <span>💧</span>
              <div style={{ flex:1, background:'#1e293b', borderRadius:4, height:8, minWidth:60, overflow:'hidden' }}>
                <div style={{ width:`${mpPct}%`, height:'100%', background:'#3b82f6', borderRadius:4, transition:'width 0.3s' }} />
              </div>
              <span style={{ color:'#3b82f6', fontSize:10, minWidth:45 }}>{player.mp}/{player.maxMp}</span>
            </div>
            {/* 인벤토리 버튼 */}
            <button
              onClick={() => {
                const panel = document.getElementById('fps-inv-panel');
                if (panel) panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
              }}
              style={{
                marginLeft:'auto', background:'#1e293b', border:'1px solid #6366f1',
                color:'#a5b4fc', padding:'2px 8px', borderRadius:4, fontSize:10, cursor:'pointer',
              }}>
              🎒
            </button>
          </div>

          {/* 정보 줄 - 모바일에서는 간소화 */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', color:'#9ca3af', fontSize:10 }}>
            <span>👣 <b style={{ color:'#e5e7eb' }}>{steps}</b></span>
            <span>⏱ <b style={{ color:'#e5e7eb' }}>{formatTime(elapsedSeconds)}</b></span>
            <span>🗺 Stage <b style={{ color:'#a78bfa' }}>{stage}</b></span>
            <span>⚔️ <b style={{ color:'#fca5a5' }}>{atk}</b></span>
            <span>🛡️ <b style={{ color:'#93c5fd' }}>{def}</b></span>
          </div>

          {/* 모바일 터치 컨트롤 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            gap: 12,
          }}>
            {/* 왼쪽: 액션 버튼들 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const panel = document.getElementById('fps-inv-panel');
                  if (panel) panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
                }}
                style={{
                  background:'rgba(30,41,59,0.95)', border:'1px solid #4f46e5',
                  color:'#a5b4fc', fontSize:12, borderRadius:6, padding:'6px 10px',
                  cursor:'pointer', userSelect:'none', touchAction:'manipulation',
                }}>🎒</button>
              <button
                onClick={() => dispatch({ type:'SET_MODAL', modal:'crafting' })}
                style={{
                  background:'rgba(30,41,59,0.95)', border:'1px solid #7c3aed',
                  color:'#c4b5fd', fontSize:12, borderRadius:6, padding:'6px 10px',
                  cursor:'pointer', userSelect:'none', touchAction:'manipulation',
                }}>✨</button>
            </div>

            {/* 오른쪽: 이동 컨트롤 */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,45px)', gridTemplateRows:'repeat(2,45px)', gap:3 }}>
              <div />
              <button onPointerDown={() => touchMove(true)} style={padBtnStyle}>↑</button>
              <div />
              <button onPointerDown={() => touchRotate(true)} style={padBtnStyle}>←</button>
              <button onPointerDown={() => touchMove(false)} style={padBtnStyle}>↓</button>
              <button onPointerDown={() => touchRotate(false)} style={padBtnStyle}>→</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 인벤토리 패널 (전체 화면 오버레이) ── */}
      <div id="fps-inv-panel" style={{
        display:'none', flexDirection:'column',
        position:'fixed', top:0, left:0, right:0, bottom:0,
        background:'rgba(10,10,30,0.98)', zIndex:50,
      }}>
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'12px 16px', borderBottom:'1px solid #334155',
          color:'#7dd3fc', fontSize:16, fontWeight:'bold',
        }}>
          <span>🎒 인벤토리 ({player.inventory.length})</span>
          <button
            onClick={() => {
              const panel = document.getElementById('fps-inv-panel');
              if (panel) panel.style.display = 'none';
            }}
            style={{ background:'none', border:'none', color:'#94a3b8', fontSize:24, cursor:'pointer', lineHeight:1 }}>
            ✕
          </button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:8 }}>
          {renderInvItems()}
        </div>
        <div style={{ padding:'12px 16px', borderTop:'1px solid #334155' }}>
          <button
            onClick={() => dispatch({ type:'SET_MODAL', modal:'crafting' })}
            style={{
              width:'100%', background:'#1e293b', border:'1px solid #7c3aed',
              color:'#c4b5fd', padding:'12px', borderRadius:8, fontSize:14, cursor:'pointer',
            }}>
            ✨ 조합
          </button>
        </div>
      </div>
    </div>
  );
}

const padBtnStyle: React.CSSProperties = {
  background:'rgba(30,58,92,0.9)', border:'1px solid #334155',
  color:'#7dd3fc', fontSize:16, borderRadius:4, cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center',
  userSelect:'none', touchAction:'manipulation',
};
