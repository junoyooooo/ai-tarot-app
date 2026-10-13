import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Avatar from './Avatar';
import { ANCHORS } from '../lib/mascotAnchors';
import { playClaim, playStart } from '../lib/api';
import { playSfx } from '../lib/sound';
import { track } from '../lib/analytics';

const SECONDS = 20;
const INK = '#2b3a86';

function starPath(ctx, cx, cy, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? R : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + rad * Math.cos(a);
    const y = cy + rad * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawItem(ctx, it) {
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(it.rot);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = INK;
  if (it.type === 'cloud') {
    ctx.fillStyle = '#7b7f9e';
    ctx.beginPath();
    ctx.arc(-it.r * 0.5, 0, it.r * 0.55, 0, Math.PI * 2);
    ctx.arc(0, -it.r * 0.3, it.r * 0.65, 0, Math.PI * 2);
    ctx.arc(it.r * 0.5, 0, it.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-it.r * 0.35, -it.r * 0.05, it.r * 0.12, it.r * 0.22);
    ctx.fillRect(it.r * 0.18, -it.r * 0.05, it.r * 0.12, it.r * 0.22);
  } else {
    ctx.fillStyle = it.type === 'gold' ? '#ff9ec7' : '#ffd43b';
    starPath(ctx, 0, 0, it.r, it.r * 0.46);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath();
    ctx.arc(-it.r * 0.18, -it.r * 0.18, it.r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 별똥별 받기: 20초 동안 마스코트를 좌우로 움직여 별을 받아요.
 * 점수는 재미용이에요. 별가루는 서버가 하루 상한 안에서 정해 줘요.
 */
export default function StarGame({ mascotId, outfit, playsLeft, onClose, onResult }) {
  const [phase, setPhase] = useState('ready'); // ready | playing | result
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(SECONDS);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(playsLeft);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const mascotRef = useRef(null);
  const runRef = useRef(null);
  const g = useRef({ x: 0.5, tx: 0.5, items: [], spawn: 0.4, t: 0, score: 0, w: 0, h: 0, mw: 0, mh: 0, keys: {} });
  const aspect = (ANCHORS[mascotId] || ANCHORS[0]).w / (ANCHORS[mascotId] || ANCHORS[0]).h;

  const finish = useCallback(async () => {
    setPhase('result');
    const finalScore = g.current.score;
    setBusy(true);
    try {
      const r = await playClaim(runRef.current, finalScore);
      setResult({ ok: true, ...r });
      setLeft(r.plays_left);
      onResult?.(r);
      track('play_finish', { score: finalScore, gain: r.gain });
      if (r.gain) playSfx('reveal');
    } catch (e) {
      setResult({ ok: false, message: e.message || '별가루를 받지 못했어요. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
    }
  }, [onResult]);

  const start = async () => {
    setError('');
    setBusy(true);
    try {
      const r = await playStart();
      runRef.current = r.run_id;
      track('play_start');
    } catch (e) {
      setBusy(false);
      setError(e.message || '시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setBusy(false);
    const s = g.current;
    Object.assign(s, { x: 0.5, tx: 0.5, items: [], spawn: 0.5, t: 0, score: 0, keys: {} });
    setScore(0);
    setTimeLeft(SECONDS);
    setResult(null);
    setPhase('playing');
    playSfx('pick');
  };

  // 게임 루프
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    const s = g.current;
    let raf = 0;
    let last = performance.now();
    let lastShown = SECONDS;
    let ended = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.w = wrap.clientWidth;
      s.h = wrap.clientHeight;
      canvas.width = s.w * dpr;
      canvas.height = s.h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const m = mascotRef.current;
      if (m) {
        s.mh = m.clientHeight;
        s.mw = m.clientWidth;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const spawn = () => {
      const roll = Math.random();
      const type = roll < 0.13 ? 'cloud' : roll < 0.22 ? 'gold' : 'star';
      const r = type === 'gold' ? 19 : type === 'cloud' ? 20 : 15;
      s.items.push({
        type,
        r,
        x: r + Math.random() * (s.w - r * 2),
        y: -r - 4,
        vy: s.h * (0.3 + Math.random() * 0.16) * (1 + s.t / SECONDS * 0.35),
        rot: Math.random() * 0.8 - 0.4,
        vr: Math.random() * 1.6 - 0.8,
      });
    };

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      s.t += dt;
      // 키보드
      if (s.keys.ArrowLeft) s.tx = Math.max(0, s.tx - dt * 1.1);
      if (s.keys.ArrowRight) s.tx = Math.min(1, s.tx + dt * 1.1);
      s.x += (s.tx - s.x) * Math.min(1, dt * 14);
      const mx = s.x * s.w;
      s.spawn -= dt;
      if (s.spawn <= 0) {
        spawn();
        s.spawn = 0.42 + Math.random() * 0.3;
      }
      const top = s.h - s.mh - 14;
      const bottom = s.h - 14;
      ctx.clearRect(0, 0, s.w, s.h);
      for (let i = s.items.length - 1; i >= 0; i -= 1) {
        const it = s.items[i];
        it.y += it.vy * dt;
        it.rot += it.vr * dt;
        const caught = Math.abs(it.x - mx) < s.mw * 0.5 + it.r * 0.3 && it.y + it.r * 0.6 >= top && it.y - it.r <= bottom;
        if (caught) {
          const gain = it.type === 'gold' ? 3 : it.type === 'cloud' ? -2 : 1;
          s.score = Math.max(0, s.score + gain);
          setScore(s.score);
          playSfx(it.type === 'cloud' ? 'soft' : it.type === 'gold' ? 'coin' : 'pick');
          s.items.splice(i, 1);
          continue;
        }
        if (it.y - it.r > s.h) {
          s.items.splice(i, 1);
          continue;
        }
        drawItem(ctx, it);
      }
      if (mascotRef.current) mascotRef.current.style.transform = `translateX(${mx - s.mw / 2}px)`;
      const remain = Math.max(0, Math.ceil(SECONDS - s.t));
      if (remain !== lastShown) {
        lastShown = remain;
        setTimeLeft(remain);
      }
      if (s.t >= SECONDS && !ended) {
        ended = true;
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        s.keys[e.key] = e.type === 'keydown';
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [phase, finish]);

  const move = (e) => {
    if (phase !== 'playing') return;
    const rect = wrapRef.current.getBoundingClientRect();
    g.current.tx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-center bg-[#12123a]" role="dialog" aria-modal="true" aria-label="별똥별 받기">
      <div
        ref={wrapRef}
        className="relative w-full max-w-[430px] h-full overflow-hidden bg-gradient-to-b from-[#1d1b52] via-[#3a2a7a] to-[#6b3f9e] touch-none"
        onPointerDown={move}
        onPointerMove={move}
      >
        {/* 별빛 배경 */}
        <div aria-hidden="true" className="absolute inset-0 opacity-70" style={{ backgroundImage: 'radial-gradient(2px 2px at 20% 15%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 25%, #fff, transparent), radial-gradient(2px 2px at 40% 55%, #fff8, transparent), radial-gradient(1.5px 1.5px at 85% 60%, #fff, transparent), radial-gradient(2px 2px at 10% 75%, #fff8, transparent)' }} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {phase !== 'ready' && (
          <div className="absolute left-0 right-0 bottom-3.5 pointer-events-none">
            <div ref={mascotRef} className="will-change-transform inline-block" style={{ height: 'min(120px, 17vh)', width: `calc(min(120px, 17vh) * ${aspect})` }}>
              <Avatar id={mascotId} outfit={outfit} className="h-full w-full" />
            </div>
          </div>
        )}

        {phase === 'playing' && (
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 pt-[max(14px,env(safe-area-inset-top))] text-white pointer-events-none">
            <span className="font-extrabold text-[18px] tabular-nums">⏱ {timeLeft}</span>
            <span className="font-extrabold text-[18px] tabular-nums">⭐ {score}</span>
          </div>
        )}

        {phase !== 'playing' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute top-[max(10px,env(safe-area-inset-top))] right-3 z-10 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        {phase === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white">
            <Avatar id={mascotId} outfit={outfit} className="h-[140px]" bounce />
            <h2 className="mt-6 text-[26px] font-extrabold">별똥별 받기</h2>
            <span className="mt-1.5 inline-block text-[12px] font-bold bg-white/15 rounded-full px-3 py-0.5">미니게임</span>
            <p className="mt-2 text-[15px] leading-relaxed text-white/85 break-keep">
              화면을 누르거나 끌어서 운명이를 움직여요.
              <br />
              ⭐ 별은 +1, 분홍 별은 +3, 먹구름은 −2예요.
            </p>
            <p className="mt-3 text-[13px] text-white/60">오늘 남은 판 {left}번 · 한 판은 20초</p>
            {error && <p role="alert" className="mt-3 text-[13px] bg-white/15 rounded-xl px-4 py-2">{error}</p>}
            <button type="button" onClick={start} disabled={busy || left <= 0} className="mt-6 btn-primary px-10 py-3.5 rounded-2xl text-[16px] cursor-pointer">
              {left <= 0 ? '오늘은 모두 했어요' : busy ? '준비 중…' : '시작하기'}
            </button>
          </div>
        )}

        {phase === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white bg-[#12123a]/70">
            <p className="text-[14px] font-bold text-white/70">이번 판 점수</p>
            <p className="text-[48px] font-extrabold leading-none mt-1">{g.current.score}</p>
            {busy && <p className="mt-5 text-[14px] text-white/75">별가루를 담는 중…</p>}
            {result?.ok && (
              <div className="mt-5 animate-fade-in-up">
                <p className="text-[22px] font-extrabold">{result.gain > 0 ? `별가루 +${result.gain} ✨` : '오늘 별가루는 다 모았어요'}</p>
                <p className="mt-1.5 text-[13px] text-white/75 break-keep">
                  {result.capped && result.gain === 0
                    ? '하루에 모을 수 있는 별가루를 모두 모았어요. 내일 또 만나요!'
                    : result.earned_today >= result.daily_cap
                    ? `오늘 별가루를 모두 모았어요 (${result.earned_today}/${result.daily_cap}). 내일 또 만나요! · 지금 ${result.stardust}개`
                    : `오늘 모은 별가루 ${result.earned_today}/${result.daily_cap} · 지금 ${result.stardust}개`}
                </p>
              </div>
            )}
            {result && !result.ok && <p role="alert" className="mt-5 text-[14px] bg-white/15 rounded-xl px-4 py-2.5 break-keep">{result.message}</p>}
            <div className="mt-7 flex gap-2.5">
              {result?.ok && result.plays_left > 0 && result.earned_today < result.daily_cap && (
                <button type="button" onClick={() => setPhase('ready')} className="px-6 py-3 rounded-2xl bg-white/15 text-white font-bold text-[15px] cursor-pointer">
                  한 번 더 ({result.plays_left})
                </button>
              )}
              <button type="button" onClick={onClose} className="btn-primary px-8 py-3 rounded-2xl text-[15px] cursor-pointer">
                {result?.ok ? '꾸미러 가기' : '닫기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
