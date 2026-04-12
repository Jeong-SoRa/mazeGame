import { useCallback, useEffect, useRef, useState } from 'react';
import { getInventoryCapacity, getPlayerAttack, getPlayerDefense } from '../game/CombatSystem';
import { getElementEmoji, getElementName } from '../game/ElementSystem';
import { useGame } from '../store/gameStore';
import { ItemImage } from './ItemImage';

// ── 상수 ────────────────────────────────────────────────────────────────────
const FOV       = Math.PI / 3;   // 60°
const NUM_RAYS  = 320;
const TURN_LERP = 0.18;
const MOVE_LERP = 0.14;

// 이동 방향 → grid dx/dy (북=0, 동=PI/2, 남=PI, 서=-PI/2)
function angleToDelta(angle: number): { dx: number; dy: number } {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  console.log(`angleToDelta: input=${angle}, normalized=${a}`);

  // 화면 좌표계 완전 일치: cos(angle) = dx, sin(angle) = dy
  // 0 = 동쪽(오른쪽), π/2 = 남쪽(아래쪽), π = 서쪽(왼쪽), 3π/2 = 북쪽(위쪽)
  if (a < Math.PI / 4 || a >= 7 * Math.PI / 4) {
    console.log('Direction: East (right) - screen match');
    return { dx: 1,  dy: 0 }; // 동쪽 (오른쪽)
  }
  if (a < 3 * Math.PI / 4) {
    console.log('Direction: South (down) - screen match');
    return { dx: 0,  dy: 1 }; // 남쪽 (아래쪽) ← 수정!
  }
  if (a < 5 * Math.PI / 4) {
    console.log('Direction: West (left) - screen match');
    return { dx: -1, dy: 0 }; // 서쪽 (왼쪽)
  }
  console.log('Direction: North (up) - screen match');
  return { dx: 0,  dy: -1 }; // 북쪽 (위쪽) ← 수정!
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
    player, steps, optimalSteps, elapsedSeconds, stage,
    activeModal, combatState, chestState, actionLogs = []
  } = state;

  // 보물상자 아이템 선택 상태 (기본: 전체 선택)
  const [selectedChestItems, setSelectedChestItems] = useState<number[]>([]);
  useEffect(() => {
    const next = chestState ? chestState.items.map((_, i) => i) : [];
    setSelectedChestItems(next);
    selectedChestItemsRef.current = next;
  }, [chestState]);

  // 로그 자동 스크롤
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [actionLogs]);

  // 버튼 상태 관리
  const [pressedButtons, setPressedButtons] = useState<Set<string>>(new Set());
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const buttonIntervalRef = useRef<Record<string, number>>({});

  // ── refs (렌더링 루프용) ────────────────────────────────────────────────
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mmRef      = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);

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
  const chestImgRef   = useRef<HTMLImageElement | null>(null);
  const selectedChestItemsRef = useRef<number[]>([]);

  // 보물상자 이미지 preload
  useEffect(() => {
    const img = new Image();
    img.src = '/common/chest.png';
    img.onload = () => { chestImgRef.current = img; };
  }, []);

  // 액션 로그 추가 함수
  const addActionLog = useCallback((message: string, type: 'move' | 'combat' | 'item' | 'system' = 'move') => {
    dispatch({ type: 'ADD_ACTION_LOG', logType: type, message });
  }, [dispatch]);

  // refs 동기화
  useEffect(() => { mazeRef.current = maze; }, [maze]);
  useEffect(() => { mazeSizeRef.current = mazeSize; }, [mazeSize]);
  useEffect(() => { activeModalRef.current = activeModal; }, [activeModal]);
  const moveCooldownRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
    moveCooldownRef.current = false;
  }, [state]);

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

      // 벽 충돌 체크: 플레이어와 몬스터 사이에 벽이 있으면 렌더링하지 않음
      const lineOfSight = castRay(px, py, mAngle, mz, mzSize);
      if (lineOfSight.dist < dist2 - 0.1) continue; // 0.1 여유분으로 벽에 가려진 몬스터 제외
      let relM = mAngle - angle;
      while (relM >  Math.PI) relM -= 2 * Math.PI;
      while (relM < -Math.PI) relM += 2 * Math.PI;
      if (Math.abs(relM) > FOV * 0.6) continue;
      const corrM = dist2 * Math.cos(relM);
      const isInCombat = s.combatState?.monsterKey === key;
      const maxSizeM = isInCombat ? H * 0.95 : H * 0.75;
      const sH = Math.min(maxSizeM, H / corrM * 0.9);
      const screenX = W / 2 + (relM / (FOV / 2)) * (W / 2);
      const top2 = (H - sH) / 2;
      ctx.save();
      ctx.font = `${sH * 0.6}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = isInCombat ? 1.0 : Math.max(0.2, 1 - corrM / 6);
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

    // 보물상자 빌보드
    for (const [key, chest] of Object.entries(s.chests)) {
      // 열린 상자라도 현재 활성 chestState면 계속 렌더링
      if (chest.opened && s.chestState?.chestKey !== key) continue;
      const [cx2, cy2] = key.split(',').map(Number);
      const cdx = (cx2 + 0.5) - px, cdy = (cy2 + 0.5) - py;
      const dist3 = Math.sqrt(cdx * cdx + cdy * cdy);
      if (dist3 > mzSize * 0.6) continue;
      const cAngle = Math.atan2(cdy, cdx);
      const lineOfSight2 = castRay(px, py, cAngle, mz, mzSize);
      if (lineOfSight2.dist < dist3 - 0.1) continue;
      let relC = cAngle - angle;
      while (relC >  Math.PI) relC -= 2 * Math.PI;
      while (relC < -Math.PI) relC += 2 * Math.PI;
      if (Math.abs(relC) > FOV * 0.6) continue;
      const corrC = dist3 * Math.cos(relC);
      const isActiveChest = s.chestState?.chestKey === key;
      const maxSizeC = isActiveChest ? H * 0.85 : H * 0.65;
      const sHC = Math.min(maxSizeC, H / corrC * 0.85);
      const screenXC = W / 2 + (relC / (FOV / 2)) * (W / 2);
      const topC = isActiveChest ? (H - sHC) / 2 : ((H - sHC) / 2) + 80;
      ctx.save();
      ctx.globalAlpha = isActiveChest ? 1.0 : Math.max(0.3, 1 - corrC / 6);
      if (chestImgRef.current) {
        ctx.drawImage(chestImgRef.current, screenXC - sHC / 2, topC, sHC, sHC*0.8);
      } else {
        ctx.font = `${sHC * 0.6}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', screenXC, topC + sHC / 2);
      }
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
    // 미니맵도 회전 버튼과 동일한 각도 사용
    const targetAngle = targetAngleRef.current;
    drawMinimap(mmCtx, mmS, px, py, targetAngle, mz, mzSize, s);

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

      const isRepeat = lastKeyRef.current[e.key];

      // 전투 중 키 처리
      if (stateRef.current.combatState !== null) {
        if (!isRepeat && e.key === ' ') {
          dispatch({ type: 'COMBAT_ATTACK' });
          addActionLog('공격했다.', 'combat');
        }
        if (!isRepeat && (e.key === 'z' || e.key === 'Z')) {
          dispatch({ type: 'COMBAT_FLEE' });
          addActionLog('도망을 시도했다.', 'combat');
        }
        lastKeyRef.current[e.key] = true;
        return;
      }

      // 보물상자 중 키 처리
      if (stateRef.current.chestState !== null) {
        if (!isRepeat && e.key === ' ') {
          const sel = selectedChestItemsRef.current;
          dispatch({ type: 'CHEST_TAKE_SELECTED', itemIndices: sel });
          addActionLog('보물상자를 열었다.', 'item');
        }
        if (!isRepeat && (e.key === 'z' || e.key === 'Z')) {
          dispatch({ type: 'CHEST_CLOSE' });
          addActionLog('상자를 그냥 지나쳤다.', 'item');
        }
        lastKeyRef.current[e.key] = true;
        return;
      }

      if (activeModalRef.current !== null) {
        console.log('Modal is open, ignoring key input:', activeModalRef.current);
        return;
      }

      // 도움말 토글 (한 번만 처리)
      if (!isRepeat && (e.key === 'h' || e.key === 'H')) {
        setShowHelp(prev => !prev);
        return;
      }

      // 가방 열기/닫기 (한 번만 처리)
      if (!isRepeat && (e.key === 'e' || e.key === 'E')) {
        const panel = document.getElementById('fps-inv-panel');
        const overlay = document.getElementById('fps-inv-overlay');
        if (panel) {
          const next = panel.style.display === 'flex' ? 'none' : 'flex';
          panel.style.display = next;
          if (overlay) overlay.style.display = next === 'flex' ? 'block' : 'none';
        }
        return;
      }

      // 만들기 모달 열기 (한 번만 처리)
      if (!isRepeat && (e.key === 'q' || e.key === 'Q')) {
        dispatch({ type:'SET_MODAL', modal:'crafting' });
        addActionLog('제작 도구를 열었다.', 'system');
        return;
      }

      // 회전 (한 번만 처리)
      if (!isRepeat) {
        if (e.key === 'a' || e.key === 'A') {
          targetAngleRef.current -= Math.PI / 2;
          addActionLog('왼쪽으로 돌았다.', 'move');
        }
        if (e.key === 'd' || e.key === 'D') {
          targetAngleRef.current += Math.PI / 2;
          addActionLog('오른쪽으로 돌았다.', 'move');
        }
      }

      // 이동 (키 반복 허용)
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        console.log('=== Keyboard Forward (Rotation Sync) ===');

        // 회전 버튼과 동일한 각도 사용
        const currentAngle = targetAngleRef.current;
        const { dx, dy } = angleToDelta(currentAngle);
        console.log(`Target angle: ${currentAngle}`);
        console.log(`angleToDelta result: {dx: ${dx}, dy: ${dy}}`);
        console.log(`Grid move: dx=${dx}, dy=${dy}`);

        // 레이캐스팅으로 이동 가능 여부 체크
        const currentPos = stateRef.current.playerPos;
        const px = currentPos.x + 0.5;
        const py = currentPos.y + 0.5;
        const maze = stateRef.current.maze as number[][];
        const mazeSize = stateRef.current.mazeSize;

        // 회전 버튼과 동일한 방향으로 레이캐스팅
        const rayAngle = currentAngle;
        console.log(`Forward ray angle: ${rayAngle}`);

        const rayResult = castRay(px, py, rayAngle, maze, mazeSize);
        console.log(`Raycast check: dist=${rayResult.dist}, can move=${rayResult.dist >= 1.0}`);

        // 레이캐스팅 거리가 1.0 이상이어야 이동 가능
        if (rayResult.dist < 1.0) {
          console.log('Movement blocked by raycast check');
          return;
        }

        if (moveCooldownRef.current) return;
        moveCooldownRef.current = true;
        const targetKey = `${currentPos.x + dx},${currentPos.y + dy}`;
        const willEncounter = !!stateRef.current.monsters[targetKey];
        dispatch({ type: 'MOVE', dx, dy, bypassWallCheck: true });
        if (!willEncounter) addActionLog('앞으로 전진했다.', 'move');
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        console.log('=== Keyboard Backward (Rotation Sync) ===');

        // 회전 버튼과 동일한 각도 사용
        const currentAngle = targetAngleRef.current;
        const { dx, dy } = angleToDelta(currentAngle);
        const finalDx = -dx;
        const finalDy = -dy;
        console.log(`Target angle: ${currentAngle}`);
        console.log(`angleToDelta result: {dx: ${dx}, dy: ${dy}}`);
        console.log(`Final move: dx=${finalDx}, dy=${finalDy}`);

        // 레이캐스팅으로 이동 가능 여부 체크
        const currentPos = stateRef.current.playerPos;
        const px = currentPos.x + 0.5;
        const py = currentPos.y + 0.5;
        const maze = stateRef.current.maze as number[][];
        const mazeSize = stateRef.current.mazeSize;

        // 회전 버튼과 동일한 반대 방향으로 레이캐스팅
        const rayAngle = currentAngle + Math.PI;
        console.log(`Backward ray angle: ${rayAngle}`);

        const rayResult = castRay(px, py, rayAngle, maze, mazeSize);
        console.log(`Raycast check: dist=${rayResult.dist}, can move=${rayResult.dist >= 1.0}`);

        // 레이캐스팅 거리가 1.0 이상이어야 이동 가능
        if (rayResult.dist < 1.0) {
          console.log('Movement blocked by raycast check');
          return;
        }

        if (moveCooldownRef.current) return;
        moveCooldownRef.current = true;
        const targetKey = `${currentPos.x + finalDx},${currentPos.y + finalDy}`;
        const willEncounter = !!stateRef.current.monsters[targetKey];
        dispatch({ type: 'MOVE', dx: finalDx, dy: finalDy, bypassWallCheck: true });
        if (!willEncounter) addActionLog('뒤로 후진했다.', 'move');
      }

      // 회전 (키 반복 허용)
      if (e.key === 'ArrowLeft') {
        targetAngleRef.current -= Math.PI / 2;
        addActionLog('왼쪽으로 돌았다.', 'move');
      }
      if (e.key === 'ArrowRight') {
        targetAngleRef.current += Math.PI / 2;
        addActionLog('오른쪽으로 돌았다.', 'move');
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
    return inv.map((slot, i: number) => {
      const item = slot.item;
      const isUsable = item.type === 'potion' || (item.type === 'special' && !item.capacity);
      const spec = item.type === 'weapon' ? `⚔️ +${item.attack}`
                 : item.type === 'armor'  ? `🛡️ +${item.defense}`
                 : item.type === 'potion' ? `❤️ +${item.heal}`
                 : item.capacity          ? `🎒 +${item.capacity}칸`
                 : item.description.slice(0, 12);
      return (
        <div key={i} style={{
          background:'#1e293b', border:'1px solid #374151',
          borderRadius:6, padding:'6px 8px',
          display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#d1d5db',
          position: 'relative',
        }}>
          <ItemImage itemId={item.id} emoji={item.emoji} size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:1, minWidth:0 }}>
            <span style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {item.name}
            </span>
            <span style={{ color:'#86efac', fontSize:10 }}>{spec}</span>
          </div>
          {slot.quantity > 1 && (
            <div style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: '#fbbf24',
              color: '#000',
              fontSize: 8,
              fontWeight: 'bold',
              borderRadius: 8,
              minWidth: 14,
              height: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}>
              {slot.quantity}
            </div>
          )}
          {isUsable && (
            <button onClick={() => dispatch({ type:'USE_ITEM', itemIndex:i })}
              style={{ padding:'2px 5px', background:'#14532d', border:'1px solid #4ade80',
                color:'#86efac', borderRadius:4, fontSize:10, cursor:'pointer' }}>
              사용
            </button>
          )}
          <button onClick={() => dispatch({ type:'DROP_ITEM', itemIndex:i })}
            style={{ padding:'2px 5px', background:'#450a0a', border:'1px solid #dc2626',
              color:'#fca5a5', borderRadius:4, fontSize:10, cursor:'pointer' }}>
            버리기
          </button>
        </div>
      );
    });
  }

  // ── 터치 핸들러 ───────────────────────────────────────────────────────────
  function handleTouchMove(direction: 'forward' | 'backward') {
    if (activeModalRef.current !== null) return;
    if (stateRef.current.combatState !== null) return;

    // 회전 버튼과 동일한 각도 사용
    const currentAngle = targetAngleRef.current;
    const { dx, dy } = angleToDelta(currentAngle);
    const finalDx = direction === 'forward' ? dx : -dx;
    const finalDy = direction === 'forward' ? dy : -dy;

    console.log(`=== Touch Move (Rotation Button Sync) ===`);
    console.log(`Direction: ${direction}, target angle: ${currentAngle}`);
    console.log(`angleToDelta result: {dx: ${dx}, dy: ${dy}}`);
    console.log(`Final move: dx=${finalDx}, dy=${finalDy}`);

    // 레이캐스팅으로 이동 가능 여부 체크
    const currentPos = stateRef.current.playerPos;
    const px = currentPos.x + 0.5;
    const py = currentPos.y + 0.5;
    const maze = stateRef.current.maze as number[][];
    const mazeSize = stateRef.current.mazeSize;

    // 회전 버튼과 동일한 방향으로 레이캐스팅
    const rayAngle = direction === 'forward' ? currentAngle : currentAngle + Math.PI;

    console.log(`Raycast angle: ${rayAngle}`);
    const rayResult = castRay(px, py, rayAngle, maze, mazeSize);
    console.log(`Raycast check: dist=${rayResult.dist}, can move=${rayResult.dist >= 1.0}`);

    // 레이캐스팅 거리가 1.0 이상이어야 이동 가능
    if (rayResult.dist < 1.0) {
      console.log('Movement blocked by raycast check');
      return;
    }

    if (moveCooldownRef.current) return;
    moveCooldownRef.current = true;
    const targetKey = `${currentPos.x + finalDx},${currentPos.y + finalDy}`;
    const willEncounter = !!stateRef.current.monsters[targetKey];
    dispatch({ type: 'MOVE', dx: finalDx, dy: finalDy, bypassWallCheck: true });
    if (!willEncounter) addActionLog(direction === 'forward' ? '앞으로 전진했다.' : '뒤로 후진했다.', 'move');
  }

  function handleTouchRotate(direction: 'left' | 'right') {
    if (activeModalRef.current !== null) {
      console.log('Modal is open, ignoring touch rotate');
      return;
    }
    if (stateRef.current.combatState !== null) return;

    console.log(`=== Touch rotate: ${direction} ===`);
    targetAngleRef.current += direction === 'left' ? -Math.PI / 2 : Math.PI / 2;
    console.log(`New angle: ${targetAngleRef.current}`);
  }

  // 버튼 누름 시작 - 임시로 인터벌 제거하고 단순 테스트
  function handleButtonPress(buttonType: 'up' | 'down' | 'left' | 'right') {
    console.log(`Button pressed: ${buttonType}`);

    if (activeModalRef.current !== null) {
      console.log('Modal open, ignoring');
      return;
    }

    setPressedButtons(prev => new Set(prev).add(buttonType));

    // 단순히 한 번만 실행 (인터벌 제거)
    if (buttonType === 'up') {
      handleTouchMove('forward');
    } else if (buttonType === 'down') {
      handleTouchMove('backward');
    } else if (buttonType === 'left') {
      handleTouchRotate('left');
    } else if (buttonType === 'right') {
      handleTouchRotate('right');
    }
  }

  // 버튼 누름 종료
  function handleButtonRelease(buttonType: 'up' | 'down' | 'left' | 'right') {
    setPressedButtons(prev => {
      const newSet = new Set(prev);
      newSet.delete(buttonType);
      return newSet;
    });

    // 인터벌 정리 (현재는 사용하지 않음)
    if (buttonIntervalRef.current[buttonType]) {
      clearInterval(buttonIntervalRef.current[buttonType]);
      delete buttonIntervalRef.current[buttonType];
    }
  }

  // 컴포넌트 언마운트 시 인터벌 정리
  useEffect(() => {
    return () => {
      Object.values(buttonIntervalRef.current).forEach(intervalId => {
        clearInterval(intervalId);
      });
    };
  }, []);

  const atk = getPlayerAttack(player);
  const def = getPlayerDefense(player);
  const capacity = getInventoryCapacity(player);
  const hpPct  = (player.hp / player.maxHp) * 100;
  const mpPct  = (player.mp / player.maxMp) * 100;
  const hpColor = hpPct > 60 ? '#22c55e' : hpPct > 30 ? '#f59e0b' : '#ef4444';

  if (state.screen !== 'playing') return null;

  return (
    <div style={{
      height: '100dvh',
      background: '#0a0a14',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'stretch',
      overflow: 'hidden',
    }}>
    <div style={{
      height: '100dvh',
      width: '100%',
      maxWidth: 690,
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
      overflow: 'hidden',
      padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
      boxSizing: 'border-box',
    }}>
      {/* 상단 메뉴 바 */}
      <div style={{
        background: 'rgba(26,26,46,0.9)',
        borderBottom: '1px solid #2a2a3e',
        padding: isMobile ? '5px 8px' : '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        fontSize: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 20 }}>
          <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: isMobile ? 12 : 14 }}>
           Stage {stage}
          </span>
          <div style={{ display: 'flex', gap: isMobile ? 8 : 16, alignItems: 'center' }}>
            <span style={{ color: '#9ca3af', fontSize: isMobile ? 10 : 12 }}>
              ⏱ <span style={{ color: '#fff' }}>{formatTime(elapsedSeconds)}</span>
            </span>
            <span style={{ color: '#9ca3af', fontSize: isMobile ? 10 : 12 }}>
              👣 <span style={{
                color: steps <= optimalSteps ? '#22c55e' : steps <= optimalSteps + 5 ? '#f59e0b' : '#ef4444',
                fontWeight: 700
              }}>
                {steps}
              </span>
              <span style={{ color: '#6b7280' }}>/{optimalSteps}</span>
            </span>
            <span style={{ color: '#9ca3af', fontSize: isMobile ? 11 : 12 }}>
              🎯 최적: <span style={{ color: '#22c55e', fontWeight: 700 }}>{optimalSteps}</span>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? 4 : 8 }}>
          <button
            onClick={() => dispatch({ type: 'RETURN_TO_STAGE_SELECT' })}
            style={{
              background: 'transparent',
              border: '1px solid #4338ca',
              color: '#a5b4fc',
              padding: isMobile ? '3px 6px' : '4px 8px',
              borderRadius: 4,
              fontSize: isMobile ? 9 : 10,
              cursor: 'pointer',
            }}
          >
            {isMobile ? '스테이지' : '스테이지 선택'}
          </button>
          <button
            onClick={() => dispatch({ type: 'RETURN_TO_SELECT' })}
            style={{
              background: 'transparent',
              border: '1px solid #dc2626',
              color: '#fca5a5',
              padding: isMobile ? '3px 6px' : '4px 8px',
              borderRadius: 4,
              fontSize: isMobile ? 9 : 10,
              cursor: 'pointer',
            }}
          >
            나가기
          </button>
          {!isMobile && (
            <button
              onClick={() => setShowHelp(prev => !prev)}
              style={{
                background: 'transparent',
                border: '1px solid #0891b2',
                color: '#67e8f9',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              도움(H)
            </button>
          )}
        </div>
      </div>

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


        {/* 전투 승리 오버레이 */}
        {combatState && combatState.phase === 'player-won' && (
          <VictoryOverlay
            monsterName={combatState.monster.name}
            isBoss={BOSS_IDS.has(combatState.monster.templateId)}
            onDone={() => dispatch({ type: 'COMBAT_NEXT_PHASE' })}
          />
        )}

        {/* 전투 중 오버레이 */}
        {combatState && (combatState.phase !== 'player-won' || !BOSS_IDS.has(combatState.monster.templateId)) && (
          <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            pointerEvents: 'none',
          }}>
            {/* 타이틀 */}
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#ef4444',
              textShadow: '0 0 8px rgba(239,68,68,0.8), 0 1px 3px #000',
              fontFamily: 'monospace',
            }}>⚔ 전투 중</span>
            {/* 몬스터 이름 */}
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#fff',
              textShadow: '0 0 12px rgba(239,68,68,0.6), 0 2px 6px #000',
              letterSpacing: '0.05em',
              lineHeight: 1,
            }}>
              {combatState.monster.name}
            </div>
            {/* HP 바 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#fca5a5', fontWeight: 600, letterSpacing: '0.05em' }}>HP</span>
                <span style={{ fontSize: 10, color: '#fca5a5', fontFamily: 'monospace' }}>
                  {combatState.monster.currentHp} / {combatState.monster.maxHp}
                </span>
              </div>
              <div style={{
                width: 180,
                height: 10,
                background: 'rgba(0,0,0,0.6)',
                borderRadius: 5,
                border: '1px solid rgba(239,68,68,0.4)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.max(0, (combatState.monster.currentHp / combatState.monster.maxHp) * 100)}%`,
                  height: '100%',
                  background: combatState.monster.currentHp / combatState.monster.maxHp > 0.5
                    ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                    : combatState.monster.currentHp / combatState.monster.maxHp > 0.25
                    ? 'linear-gradient(90deg, #ea580c, #f97316)'
                    : 'linear-gradient(90deg, #7f1d1d, #b91c1c)',
                  borderRadius: 5,
                  transition: 'width 0.3s ease',
                  boxShadow: '0 0 6px rgba(239,68,68,0.7)',
                }} />
              </div>
            </div>
            {/* 일반 몹 승리 텍스트 */}
            {combatState.phase === 'player-won' && (
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#fbbf24',
                textShadow: '0 0 8px rgba(251,191,36,0.8), 0 1px 4px #000',
                animation: 'normalVictoryFloat 0.5s ease-out',
                letterSpacing: '0.1em',
              }}>🏆 승리!</div>
            )}
          </div>
        )}

        {/* 보물상자 인라인 UI */}
        {chestState && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(17,24,39,0.95)',
            border: '1px solid #fbbf24',
            borderRadius: 8,
            padding: 12,
            minWidth: 260,
            maxWidth: 320,
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h4 style={{ color: '#fbbf24', margin: 0, fontSize: 14 }}>보물상자 발견!</h4>
            </div>
            {/* 아이템 목록 */}
            {chestState.items.length > 0 ? (
              <div style={{ marginBottom: 10 }}>
                {chestState.items.map((item, i) => {
                  const rarityColor: Record<string, string> = {
                    common: '#9ca3af',
                    uncommon: '#4ade80',
                    rare: '#60a5fa',
                    epic: '#c084fc',
                    legendary: '#fbbf24',
                  };
                  const color = rarityColor[item.rarity] ?? '#e2e8f0';
                  const stats: string[] = [];
                  if (item.attack) stats.push(`공격+${item.attack}`);
                  if (item.defense) stats.push(`방어+${item.defense}`);
                  if (item.heal) stats.push(`회복+${item.heal}`);
                  if (item.capacity) stats.push(`용량+${item.capacity}`);
                  const checked = selectedChestItems.includes(i);
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      padding: '4px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      cursor: 'pointer',
                    }} onClick={() => {
                      const next = checked
                        ? selectedChestItems.filter(idx => idx !== i)
                        : [...selectedChestItems, i];
                      setSelectedChestItems(next);
                      selectedChestItemsRef.current = next;
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        style={{ marginTop: 3, accentColor: '#f59e0b', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <ItemImage itemId={item.id} emoji={item.emoji} size={16} />
                      <div>
                        <div style={{ color, fontSize: 12, fontWeight: 600 }}>{item.name}</div>
                        {stats.length > 0 && (
                          <div style={{ color: '#94a3b8', fontSize: 10 }}>{stats.join(' / ')}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 10 }}>상자가 비어 있다.</div>
            )}
            <button
              onClick={() => {
                const sel = selectedChestItemsRef.current;
                dispatch({ type: 'CHEST_TAKE_SELECTED', itemIndices: sel });
                addActionLog('보물상자를 열었다.', 'item');
              }}
              disabled={selectedChestItems.length === 0}
              style={{
                display: 'block',
                width: 'calc(100% - 16px)',
                margin: '0 8px',
                boxSizing: 'border-box',
                background: selectedChestItems.length > 0
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'rgba(55,65,81,0.6)',
                color: selectedChestItems.length > 0 ? '#000' : '#6b7280',
                border: 'none',
                borderRadius: 4,
                padding: '6px 0',
                fontSize: 10,
                cursor: selectedChestItems.length > 0 ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              {selectedChestItems.length}개 획득 (Space)
            </button>
          </div>
        )}

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

      {/* ── 액션 로그 영역 ── */}
      <div style={{
        flexShrink: 0,
        height: isMobile ? '62px' : '100px',
        background: 'linear-gradient(to bottom, rgba(15,23,42,0.95), rgba(30,41,59,0.95))',
        borderTop: '1px solid #334155',
        borderBottom: '1px solid #334155',
        fontFamily: "'Courier New', monospace",
        fontSize: 12,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
      }}>

        {/* 캐릭터 프사 영역 */}
        <div style={{
          width: 88,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          borderRight: '1px solid #1e3a5f',
          padding: '6px 4px',
          background: 'rgba(10,20,40,0.6)',
        }}>
          {/* 캐릭터 이미지 */}
          <div style={{
            /* width: 66,
            height: 66, */
            borderRadius: 8,
            border: `2px solid ${
              player.hp / player.maxHp > 0.6 ? '#22c55e' :
              player.hp / player.maxHp > 0.3 ? '#f59e0b' : '#ef4444'
            }`,
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            {player.characterId ? (
              <img
                src={`player/player_${player.characterId}.png`}
                alt="character"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  imageRendering: 'pixelated',
                }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span style={{ fontSize: 28 }}>🧑</span>
            )}
            {/* HP 위기 오버레이 */}
            {player.hp / player.maxHp <= 0.3 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(239,68,68,0.15)',
                animation: 'pulse 1s ease-in-out infinite',
              }} />
            )}
          </div>
          
        </div>

        {/* 로그 목록 */}
        <div ref={logScrollRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          {actionLogs.length === 0 ? (
            <div style={{
              color: '#64748b',
              fontSize: 11,
              fontStyle: 'italic',
              textAlign: 'center',
              paddingTop: 20,
            }}>
              액션이 여기에 표시됩니다...
            </div>
          ) : (
            actionLogs.map((log, index) => {
              const isLatest = index === actionLogs.length - 1;

              // 타입별 스타일 계산
              type LogStyle = { color: string; bg: string; borderColor: string };
              const styleMap: Record<string, LogStyle> = {
                move:    { color: '#7dd3fc', bg: 'rgba(56,189,248,0.06)',  borderColor: '#0ea5e9' },
                item:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  borderColor: '#f59e0b' },
                system:  { color: '#cbd5e1', bg: 'rgba(203,213,225,0.05)', borderColor: '#94a3b8' },
                // combat subtypes
                attack:  { color: '#fb923c', bg: 'rgba(251,146,60,0.10)',  borderColor: '#f97316' },
                damage:  { color: '#f87171', bg: 'rgba(248,113,113,0.10)', borderColor: '#ef4444' },
                heal:    { color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  borderColor: '#22c55e' },
                victory: { color: '#facc15', bg: 'rgba(250,204,21,0.12)',  borderColor: '#eab308' },
                defeat:  { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', borderColor: '#64748b' },
                flee:    { color: '#c4b5fd', bg: 'rgba(196,181,253,0.08)', borderColor: '#a78bfa' },
                encounter:{ color: '#f87171', bg: 'rgba(248,113,113,0.08)',borderColor: '#ef4444' },
                element: { color: '#a5b4fc', bg: 'rgba(165,180,252,0.08)', borderColor: '#818cf8' },
                combat:  { color: '#fca5a5', bg: 'rgba(252,165,165,0.07)', borderColor: '#f87171' },
              };

              const key = log.type === 'combat' && log.subtype ? log.subtype : log.type;
              const s = styleMap[key] ?? styleMap.system;

              return (
                <div
                  key={log.id}
                  style={{
                    color: s.color,
                    background: isLatest ? s.bg : 'transparent',
                    fontSize: 11,
                    lineHeight: '1.4',
                    opacity: isLatest ? 1 : index >= actionLogs.length - 4 ? 0.75 : 0.5,
                    transition: 'all 0.25s ease',
                    padding: isLatest ? '3px 6px' : '1px 4px',
                    borderLeft: `2px solid ${isLatest ? s.borderColor : 'transparent'}`,
                    borderRadius: isLatest ? 3 : 0,
                    wordBreak: 'break-all',
                  }}
                >
                  {log.message}
                </div>
              );
            })
          )}
        </div>
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
          width:'100%',
          padding:'8px 12px', display:'flex', flexDirection:'column', gap:6,
          boxSizing:'border-box',
        }}>

          {/* 하단 컨트롤 영역 */}
          {isMobile ? (
            /* ── 모바일: 상단 스테이터스 바 + 하단 [액션버튼 2x2] [방향키] ── */
            <div style={{ display:'flex', flexDirection:'column', gap:4, width:'100%', padding:'4px 0' }}>

              {/* 스테이터스 가로 바 */}
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                background:'rgba(30,41,59,0.8)', border:'1px solid #374151',
                borderRadius:8, padding:'5px 10px', boxSizing:'border-box', width:'100%',
              }}>
                {/* HP */}
                <span style={{ color:hpColor, fontSize:11, whiteSpace:'nowrap', flexShrink:0 }}>❤️ {player.hp}/{player.maxHp}</span>
                {/* MP */}
                <span style={{ color:'#60a5fa', fontSize:11, whiteSpace:'nowrap', flexShrink:0 }}>💧 {player.mp}/{player.maxMp}</span>
                {/* 스탯 */}
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, fontSize:10 }}>
                  <span>{getElementEmoji(player.element)} <b style={{ color:'#a78bfa' }}>{getElementName(player.element)}</b></span>
                  <span>⚔️<b style={{ color:'#fca5a5' }}>{atk}</b></span>
                  <span>🛡️<b style={{ color:'#93c5fd' }}>{def}</b></span>
                  <span>🎒<b style={{ color: player.inventory.length >= capacity ? '#ef4444' : '#fbbf24' }}>{player.inventory.length}/{capacity}</b></span>
                </div>
              </div>

              {/* 버튼 행: [액션버튼 2x2] [방향키] */}
              <div style={{ display:'flex', justifyContent:'center', gap:8 }}>

              {/* 액션 버튼 2x2 (126px = 방향키와 동일) */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'repeat(2,40px)', gap:3, width:126, flexShrink:0 }}>
                
                <button
                  disabled={!combatState && !chestState}
                  onClick={() => {
                    if (combatState) dispatch({ type:'COMBAT_ATTACK' });
                    else if (chestState) {
                      const sel = selectedChestItemsRef.current;
                      dispatch({ type:'CHEST_TAKE_SELECTED', itemIndices: sel });
                      addActionLog('보물상자를 열었다.', 'item');
                    }
                  }}
                  style={{
                    background: combatState ? 'rgba(127,29,29,0.85)' : chestState ? 'rgba(146,64,14,0.85)' : 'rgba(55,65,81,0.6)',
                    border: `1px solid ${combatState ? '#ef4444' : chestState ? '#f59e0b' : '#4b5563'}`,
                    color: combatState ? '#fca5a5' : chestState ? '#fde68a' : '#6b7280',
                    fontSize:10, borderRadius:6,
                    cursor: (combatState || chestState) ? 'pointer' : 'not-allowed',
                    userSelect:'none', touchAction:'manipulation', fontWeight:'bold',
                    opacity: (combatState || chestState) ? 1 : 0.5,
                  }}>{chestState ? `${selectedChestItems.length}개 획득` : '공격'}</button>
                <button
                  disabled={!combatState && !chestState}
                  onClick={() => {
                    if (combatState) dispatch({ type:'COMBAT_FLEE' });
                    else if (chestState) dispatch({ type:'CHEST_CLOSE' });
                  }}
                  style={{
                    background: combatState ? 'rgba(20,83,45,0.85)' : chestState ? 'rgba(30,41,59,0.85)' : 'rgba(55,65,81,0.6)',
                    border: `1px solid ${combatState ? '#22c55e' : chestState ? '#60a5fa' : '#4b5563'}`,
                    color: combatState ? '#86efac' : chestState ? '#bfdbfe' : '#6b7280',
                    fontSize:10, borderRadius:6,
                    cursor: (combatState || chestState) ? 'pointer' : 'not-allowed',
                    userSelect:'none', touchAction:'manipulation', fontWeight:'bold',
                    opacity: (combatState || chestState) ? 1 : 0.5,
                  }}>
                  {chestState ? '떠나기' : '도망'}
                  {combatState && (
                    <span style={{ fontSize:8, fontWeight:'normal', color:'#f87171', marginLeft:2 }}>
                      {Math.round(Math.max(0.25, 0.55 - stage * 0.01) * 100)}%
                    </span>
                  )}
                  
                </button>
                <button
                  onClick={() => {
                    const panel = document.getElementById('fps-inv-panel');
                    const overlay = document.getElementById('fps-inv-overlay');
                    if (panel) {
                      const next = panel.style.display === 'flex' ? 'none' : 'flex';
                      panel.style.display = next;
                      if (overlay) overlay.style.display = next === 'flex' ? 'block' : 'none';
                    }
                  }}
                  style={{ background:'rgba(30,41,59,0.95)', border:'1px solid #4f46e5', color:'#a5b4fc', fontSize:10, borderRadius:6, cursor:'pointer', userSelect:'none', touchAction:'manipulation' }}>가방</button>
                <button
                  onClick={() => dispatch({ type:'SET_MODAL', modal:'crafting' })}
                  style={{ background:'rgba(30,41,59,0.95)', border:'1px solid #7c3aed', color:'#c4b5fd', fontSize:10, borderRadius:6, cursor:'pointer', userSelect:'none', touchAction:'manipulation' }}>만들기</button>
                
              </div>

              {/* 방향키 (3×40 + 2×3gap = 126px) */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,40px)', gridTemplateRows:'repeat(2,40px)', gap:3, position:'relative', flexShrink:0 }}>
                {combatState && (
                  <div style={{
                    position:'absolute', inset:0, zIndex:2,
                    background:'rgba(127,29,29,0.35)', border:'1px solid rgba(239,68,68,0.5)',
                    borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'all',
                  }}>
                    <span style={{ fontSize:9, color:'#fca5a5', fontWeight:'bold', textShadow:'0 1px 3px #000' }}>⚔️전투중</span>
                  </div>
                )}
                <div />
                <button disabled={!!combatState} onPointerDown={() => handleButtonPress('up')} onPointerUp={() => handleButtonRelease('up')} onPointerLeave={() => handleButtonRelease('up')} style={{ ...padBtnStyle, ...(pressedButtons.has('up') ? padBtnActiveStyle : {}), ...(combatState ? padBtnDisabledStyle : {}), width:40, height:40, fontSize:12 }}>↑</button>
                <div />
                <button disabled={!!combatState} onPointerDown={() => handleButtonPress('left')} onPointerUp={() => handleButtonRelease('left')} onPointerLeave={() => handleButtonRelease('left')} style={{ ...padBtnStyle, ...(pressedButtons.has('left') ? padBtnActiveStyle : {}), ...(combatState ? padBtnDisabledStyle : {}), width:40, height:40, fontSize:12 }}>←</button>
                <button disabled={!!combatState} onPointerDown={() => handleButtonPress('down')} onPointerUp={() => handleButtonRelease('down')} onPointerLeave={() => handleButtonRelease('down')} style={{ ...padBtnStyle, ...(pressedButtons.has('down') ? padBtnActiveStyle : {}), ...(combatState ? padBtnDisabledStyle : {}), width:40, height:40, fontSize:12 }}>↓</button>
                <button disabled={!!combatState} onPointerDown={() => handleButtonPress('right')} onPointerUp={() => handleButtonRelease('right')} onPointerLeave={() => handleButtonRelease('right')} style={{ ...padBtnStyle, ...(pressedButtons.has('right') ? padBtnActiveStyle : {}), ...(combatState ? padBtnDisabledStyle : {}), width:40, height:40, fontSize:12 }}>→</button>
              </div>

              </div>
            </div>
          ) : (
            /* ── PC: 좌 30% 스테이터스 / 우 70% 컨트롤 ── */
            <div style={{ display:'flex', alignItems:'stretch', padding:'8px 0', gap:0, width:'100%' }}>

              {/* 왼쪽 30%: 플레이어 스테이터스 */}
              <div style={{
                width:'30%',
                display:'flex', flexDirection:'column', justifyContent:'center',
                background:'rgba(30,41,59,0.8)', border:'1px solid #374151',
                borderRadius:8, padding:'6px 8px', gap:6, boxSizing:'border-box',
              }}>
                {/* HP */}
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:12 }}>❤️</span>
                  <div style={{ flex:1, background:'#1e293b', borderRadius:4, height:7, overflow:'hidden' }}>
                    <div style={{ width:`${hpPct}%`, height:'100%', background:hpColor, borderRadius:4, transition:'width 0.3s' }} />
                  </div>
                  <span style={{ color:hpColor, fontSize:10, whiteSpace:'nowrap', width:44, textAlign:'right' }}>{player.hp}/{player.maxHp}</span>
                </div>
                {/* MP */}
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:12 }}>💧</span>
                  <div style={{ flex:1, background:'#1e293b', borderRadius:4, height:7, overflow:'hidden' }}>
                    <div style={{ width:`${mpPct}%`, height:'100%', background:'#3b82f6', borderRadius:4, transition:'width 0.3s' }} />
                  </div>
                  <span style={{ color:'#3b82f6', fontSize:10, whiteSpace:'nowrap', width:44, textAlign:'right' }}>{player.mp}/{player.maxMp}</span>
                </div>
                {/* 스탯 */}
                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', fontSize:10 }}>
                  <span>{getElementEmoji(player.element)} <b style={{ color:'#a78bfa' }}>{getElementName(player.element)}</b></span>
                  <span>⚔️ <b style={{ color:'#fca5a5' }}>{atk}</b></span>
                  <span>🛡️ <b style={{ color:'#93c5fd' }}>{def}</b></span>
                  <span>🎒 <b style={{ color: player.inventory.length >= capacity ? '#ef4444' : '#fbbf24' }}>{player.inventory.length}/{capacity}</b></span>
                </div>
              </div>

              {/* 오른쪽 70%: 컨트롤 영역 */}
              <div style={{ width:'70%', display:'flex', alignItems:'flex-start', justifyContent:'right', paddingLeft:8, gap:8, boxSizing:'border-box' }}>
                {/* 왼쪽: 가방/만들기 버튼 */}
                <div style={{ padding:'0 12px 0 0', display:'flex', flexDirection:'column', gap:15 }}>
                  <button
                    onClick={() => {
                      const panel = document.getElementById('fps-inv-panel');
                      const overlay = document.getElementById('fps-inv-overlay');
                      if (panel) {
                        const next = panel.style.display === 'flex' ? 'none' : 'flex';
                        panel.style.display = next;
                        if (overlay) overlay.style.display = next === 'flex' ? 'block' : 'none';
                      }
                    }}
                    style={{ background:'rgba(30,41,59,0.95)', border:'1px solid #4f46e5', color:'#a5b4fc', fontSize:12, borderRadius:6, padding:'10px 14px', cursor:'pointer', userSelect:'none', touchAction:'manipulation' }}>가방(E)</button>
                  <button
                    onClick={() => dispatch({ type:'SET_MODAL', modal:'crafting' })}
                    style={{ background:'rgba(30,41,59,0.95)', border:'1px solid #7c3aed', color:'#c4b5fd', fontSize:12, borderRadius:6, padding:'10px 14px', cursor:'pointer', userSelect:'none', touchAction:'manipulation' }}>만들기(Q)</button>
                </div>

                {/* 가운데: 방향키 그리드 */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,45px)', gridTemplateRows:'repeat(2,45px)', gap:3, position:'relative' }}>
                  {combatState && (
                    <div style={{
                      position:'absolute', inset:0, zIndex:2,
                      background:'rgba(127,29,29,0.35)', border:'1px solid rgba(239,68,68,0.5)',
                      borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'all',
                    }}>
                      <span style={{ fontSize:11, color:'#fca5a5', fontWeight:'bold', textShadow:'0 1px 3px #000' }}>⚔️전투중</span>
                    </div>
                  )}
                  <div />
                  <button disabled={!!combatState} onPointerDown={() => handleButtonPress('up')} onPointerUp={() => handleButtonRelease('up')} onPointerLeave={() => handleButtonRelease('up')} style={{ ...padBtnStyle, ...(pressedButtons.has('up') ? padBtnActiveStyle : {}), ...(combatState ? padBtnDisabledStyle : {}) }}>↑(W)</button>
                  <div />
                  <button disabled={!!combatState} onPointerDown={() => handleButtonPress('left')} onPointerUp={() => handleButtonRelease('left')} onPointerLeave={() => handleButtonRelease('left')} style={{ ...padBtnStyle, ...(pressedButtons.has('left') ? padBtnActiveStyle : {}), ...(combatState ? padBtnDisabledStyle : {}) }}>←(A)</button>
                  <button disabled={!!combatState} onPointerDown={() => handleButtonPress('down')} onPointerUp={() => handleButtonRelease('down')} onPointerLeave={() => handleButtonRelease('down')} style={{ ...padBtnStyle, ...(pressedButtons.has('down') ? padBtnActiveStyle : {}), ...(combatState ? padBtnDisabledStyle : {}) }}>↓(S)</button>
                  <button disabled={!!combatState} onPointerDown={() => handleButtonPress('right')} onPointerUp={() => handleButtonRelease('right')} onPointerLeave={() => handleButtonRelease('right')} style={{ ...padBtnStyle, ...(pressedButtons.has('right') ? padBtnActiveStyle : {}), ...(combatState ? padBtnDisabledStyle : {}) }}>→(D)</button>
                </div>

                {/* 오른쪽: 공격/열기 · 도망/떠나기 버튼 */}
                <div style={{ padding:'0 0 0 12px', display:'flex', flexDirection:'column', gap:15 }}>
                  <button
                    disabled={!combatState && !chestState}
                    onClick={() => {
                      if (combatState) dispatch({ type:'COMBAT_ATTACK' });
                      else if (chestState) {
                        const sel = selectedChestItemsRef.current;
                        dispatch({ type:'CHEST_TAKE_SELECTED', itemIndices: sel });
                        addActionLog('보물상자를 열었다.', 'item');
                      }
                    }}
                    style={{
                      background: combatState ? 'rgba(127,29,29,0.85)' : chestState ? 'rgba(146,64,14,0.85)' : 'rgba(55,65,81,0.6)',
                      border: `1px solid ${combatState ? '#ef4444' : chestState ? '#f59e0b' : '#4b5563'}`,
                      color: combatState ? '#fca5a5' : chestState ? '#fde68a' : '#6b7280',
                      fontSize:12, borderRadius:6, padding:'10px 10px',
                      cursor: (combatState || chestState) ? 'pointer' : 'not-allowed',
                      userSelect:'none', touchAction:'manipulation', fontWeight:'bold',
                      opacity: (combatState || chestState) ? 1 : 0.5,
                    }}>{chestState ? `${selectedChestItems.length}개 획득(space)` : '공격(space)'}</button>
                  <button
                    disabled={!combatState && !chestState}
                    onClick={() => {
                      if (combatState) dispatch({ type:'COMBAT_FLEE' });
                      else if (chestState) dispatch({ type:'CHEST_CLOSE' });
                    }}
                    style={{
                      background: combatState ? 'rgba(20,83,45,0.85)' : chestState ? 'rgba(30,41,59,0.85)' : 'rgba(55,65,81,0.6)',
                      border: `1px solid ${combatState ? '#22c55e' : chestState ? '#60a5fa' : '#4b5563'}`,
                      color: combatState ? '#86efac' : chestState ? '#bfdbfe' : '#6b7280',
                      fontSize:12, borderRadius:6, padding:'10px 10px',
                      cursor: (combatState || chestState) ? 'pointer' : 'not-allowed',
                      userSelect:'none', touchAction:'manipulation', fontWeight:'bold',
                      opacity: (combatState || chestState) ? 1 : 0.5,
                    }}>
                    {chestState ? '떠나기(Z)' : '도망(Z)'}
                    {combatState && (
                      <span style={{ fontSize:9, fontWeight:'normal', color:'#f87171', marginLeft:3 }}>
                        {Math.round(Math.max(0.25, 0.55 - stage * 0.01) * 100)}%
                      </span>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ── 인벤토리 dark overlay ── */}
      <div id="fps-inv-overlay" style={{
        display: 'none',
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 49,
        pointerEvents: 'none',
      }} />

      {/* ── 인벤토리 패널 (전체 화면 오버레이) ── */}
      <div id="fps-inv-panel" style={{
        width: 'calc(50%)',
        height: 'calc(80%)',
        display:'none', flexDirection:'column',
        position:'fixed', right:30, bottom:20,
        background:'rgba(10,10,30,0.98)', zIndex:50,
      }}>
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'12px 16px', borderBottom:'1px solid #334155',
          color:'#7dd3fc', fontSize:16, fontWeight:'bold',
        }}>
          <span>🎒 인벤토리 ({player.inventory.length}/{getInventoryCapacity(player)})</span>
          <button
            onClick={() => {
              const panel = document.getElementById('fps-inv-panel');
              const overlay = document.getElementById('fps-inv-overlay');
              if (panel) panel.style.display = 'none';
              if (overlay) overlay.style.display = 'none';
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

      {/* ── 키보드 단축키 도움말 오버레이 ── */}
      {showHelp && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, bottom:0,
          background:'rgba(0,0,0,0.92)', zIndex:60,
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'20px',
        }}>
          <div style={{
            background:'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            border:'2px solid #6b68a4',
            borderRadius:16,
            maxWidth:500,
            width:'100%',
            maxHeight:'90vh',
            overflowY:'auto',
            boxShadow:'0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}>
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'13px 24px 10px', borderBottom:'2px solid #475569',
              background:'rgba(79, 70, 229, 0.1)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:26 }}>⌨️</span>
                <span style={{ color:'#e2e8f0', fontSize:20, fontWeight:'bold' }}>키보드 단축키</span>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  background:'rgba(239, 68, 68, 0.1)', border:'2px solid #ef4444',
                  color:'#fca5a5', fontSize:20, cursor:'pointer', lineHeight:1,
                  borderRadius:8, width:40, height:40,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}>
                ✕
              </button>
            </div>
            <div style={{ padding:'14px' }}>
              <div style={{ display:'grid', gap:8 }}>
                {/* 이동 컨트롤 */}
                <div style={{
                  background:'rgba(30, 41, 59, 0.8)',
                  padding:16,
                  borderRadius:12,
                  border:'1px solid #475569'
                }}>
                  <h3 style={{
                    color:'#60a5fa',
                    fontSize:13,
                    fontWeight:'bold',
                    margin:'0 0 8px 0',
                    display:'flex',
                    alignItems:'center',
                    gap:8
                  }}>
                    🏃 이동
                  </h3>
                  <div style={{ display:'grid', gap:6, fontSize:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0' }}>앞으로 이동</span>
                      <div style={{ display:'flex', gap:4 }}>
                        <kbd style={{
                          background:'#374151', color:'#f3f4f6', padding:'4px 8px',
                          borderRadius:6, fontSize:12, fontFamily:'monospace',
                          border:'1px solid #4b5563'
                        }}>W</kbd>
                        <kbd style={{
                          background:'#374151', color:'#f3f4f6', padding:'4px 8px',
                          borderRadius:6, fontSize:12, fontFamily:'monospace',
                          border:'1px solid #4b5563'
                        }}>↑</kbd>
                      </div>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0' }}>뒤로 이동</span>
                      <div style={{ display:'flex', gap:4 }}>
                        <kbd style={{
                          background:'#374151', color:'#f3f4f6', padding:'4px 8px',
                          borderRadius:6, fontSize:12, fontFamily:'monospace',
                          border:'1px solid #4b5563'
                        }}>S</kbd>
                        <kbd style={{
                          background:'#374151', color:'#f3f4f6', padding:'4px 8px',
                          borderRadius:6, fontSize:12, fontFamily:'monospace',
                          border:'1px solid #4b5563'
                        }}>↓</kbd>
                      </div>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0' }}>좌회전</span>
                      <div style={{ display:'flex', gap:4 }}>
                        <kbd style={{
                          background:'#374151', color:'#f3f4f6', padding:'4px 8px',
                          borderRadius:6, fontSize:12, fontFamily:'monospace',
                          border:'1px solid #4b5563'
                        }}>A</kbd>
                        <kbd style={{
                          background:'#374151', color:'#f3f4f6', padding:'4px 8px',
                          borderRadius:6, fontSize:12, fontFamily:'monospace',
                          border:'1px solid #4b5563'
                        }}>←</kbd>
                      </div>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0' }}>우회전</span>
                      <div style={{ display:'flex', gap:4 }}>
                        <kbd style={{
                          background:'#374151', color:'#f3f4f6', padding:'4px 8px',
                          borderRadius:6, fontSize:12, fontFamily:'monospace',
                          border:'1px solid #4b5563'
                        }}>D</kbd>
                        <kbd style={{
                          background:'#374151', color:'#f3f4f6', padding:'4px 8px',
                          borderRadius:6, fontSize:12, fontFamily:'monospace',
                          border:'1px solid #4b5563'
                        }}>→</kbd>
                      </div>
                    </div>
                  </div>

                  {/* 팁 섹션 */}
                  <div style={{
                    background:'none',
                    padding:'12px 0px 0px 0px',
                    borderRadius:12,
                    border:'none',
                  }}>
                    <p style={{
                      color:'#a7f3d0',
                      fontSize:13,
                      lineHeight:'1.4',
                      margin:0,
                    }}>
                      키를 누르고 있으면 계속 이동할 수 있어요! 미로를 빠르게 탐험해보세요.
                    </p>
                  </div>

                </div>

                {/* 기타 컨트롤 */}
                <div style={{
                  background:'rgba(30, 41, 59, 0.8)',
                  padding:16,
                  borderRadius:12,
                  border:'1px solid #475569'
                }}>
                  <div style={{ display:'grid', gap:6, fontSize:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0' }}>도움말 보기/숨기기</span>
                      <kbd style={{
                        background:'#374151', color:'#ffffff', padding:'4px 12px',
                        borderRadius:6, fontSize:12, fontFamily:'monospace',
                        border:'1px solid #4b5563'
                      }}>h / H</kbd>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0' }}>가방 열기/닫기</span>
                      <kbd style={{
                        background:'#374151', color:'#f3f4f6', padding:'4px 12px',
                        borderRadius:6, fontSize:12, fontFamily:'monospace',
                        border:'1px solid #4b5563'
                      }}>e / E</kbd>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0' }}>제작 메뉴</span>
                      <kbd style={{
                        background:'#374151', color:'#f3f4f6', padding:'4px 12px',
                        borderRadius:6, fontSize:12, fontFamily:'monospace',
                        border:'1px solid #4b5563'
                      }}>q / Q</kbd>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0' }}>공격 <span style={{ color:'#f87171', fontSize:11 }}>(전투 중)</span></span>
                      <kbd style={{
                        background:'#dc2626', color:'#ffffff', padding:'4px 12px',
                        borderRadius:6, fontSize:12, fontFamily:'monospace',
                        border:'1px solid #ef4444'
                      }}>Space</kbd>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0' }}>도망가기 <span style={{ color:'#f87171', fontSize:11 }}>(전투 중)</span></span>
                      <kbd style={{
                        background:'#374151', color:'#ffffff', padding:'4px 12px',
                        borderRadius:6, fontSize:12, fontFamily:'monospace',
                        border:'1px solid #4b5563'
                      }}>z / Z</kbd>
                    </div>
                  </div>
                </div>

                
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

const padBtnStyle: React.CSSProperties = {
  background:'rgba(30,58,92,0.9)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#334155',
  color:'#7dd3fc', fontSize:16, borderRadius:4, cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center',
  userSelect:'none', touchAction:'manipulation',
  transition: 'all 0.1s ease',
};

const padBtnActiveStyle: React.CSSProperties = {
  background:'rgba(59,130,246,0.8)',
  borderColor:'#3b82f6',
  color:'#ffffff',
  transform:'scale(0.95)',
  boxShadow:'inset 0 2px 4px rgba(0,0,0,0.3)',
};

const padBtnDisabledStyle: React.CSSProperties = {
  background:'rgba(30,10,10,0.7)',
  borderColor:'rgba(239,68,68,0.3)',
  color:'rgba(252,165,165,0.3)',
  cursor:'not-allowed',
  opacity:0.5,
};

const BOSS_IDS = new Set(['dark_knight', 'dragon']);

function VictoryOverlay({ monsterName, isBoss, onDone }: { monsterName: string; isBoss: boolean; onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const delay = isBoss ? 3000 : 1200;
    const t = setTimeout(() => onDoneRef.current(), delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isBoss) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        animation: 'bossVictoryIn 0.45s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.4em',
          color: '#fbbf24',
          textTransform: 'uppercase',
          textShadow: '0 0 20px rgba(251,191,36,1), 0 2px 6px #000',
          fontFamily: 'monospace',
        }}>🏆 VICTORY</span>
        <span style={{
          fontSize: 32,
          fontWeight: 900,
          color: '#fff',
          textShadow: '0 0 30px rgba(251,191,36,0.6), 0 4px 12px #000',
          letterSpacing: '0.06em',
        }}>{monsterName}</span>
        <span style={{
          fontSize: 12,
          color: 'rgba(251,191,36,0.7)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>처치!</span>
      </div>
      <style>{`
        @keyframes bossVictoryIn {
          from { opacity: 0; transform: scale(0.7) translateY(20px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
        @keyframes normalVictoryFloat {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
