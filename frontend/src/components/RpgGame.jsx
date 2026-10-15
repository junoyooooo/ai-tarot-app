import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Avatar from './Avatar';
import { rpgStart, rpgTurn } from '../lib/api';
import { playSfx } from '../lib/sound';
import { track } from '../lib/analytics';

const MAX_HP = 20;
const M_MAX = 18;

function Bar({ v, max, color, label }) {
  return (
    <div>
      <div className="flex justify-between text-[12px] font-bold text-ink">
        <span>{label}</span>
        <span>{Math.max(0, v)}/{max}</span>
      </div>
      <div className="mt-1 h-3 rounded-full bg-white/70 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, (v / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function Worry({ hurt }) {
  return (
    <svg viewBox="0 0 120 100" className={`w-28 h-24 ${hurt ? 'animate-pulse' : 'mascot-bounce'}`} aria-hidden="true">
      <path d="M20 70c-14 0-18-22 0-26-2-20 24-28 38-14 8-14 36-10 38 10 16 2 20 30 0 30z" fill="#9a8cc4" stroke="#4a3f7a" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="48" cy="52" r="5" fill="#2b2250" />
      <circle cx="74" cy="52" r="5" fill="#2b2250" />
      <path d="M50 68q10-8 20 0" fill="none" stroke="#2b2250" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function RpgGame({ main, equipped, onClose, onDone }) {
  const [run, setRun] = useState(null);
  const [st, setSt] = useState(null);
  const [log, setLog] = useState('');
  const [card, setCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [end, setEnd] = useState(null);
  const [err, setErr] = useState('');
  const [hit, setHit] = useState(false);

  const start = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await rpgStart();
      setRun(r.run_id);
      setSt(r.state);
      setLog('걱정덩어리가 나타났어요! 카드를 뽑아 물리쳐요.');
      track('rpg_start');
    } catch (e) {
      setErr(e.message || '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const turn = async (action) => {
    if (busy || !run) return;
    setBusy(true);
    try {
      if (action === 'card') {
        playSfx('pick');
        setCard(null);
      }
      const t = await rpgTurn(run, action);
      const l = t.log;
      if (l.card) {
        setCard(l.card);
        const parts = [`[${l.card.name}] ${l.card.desc}`];
        if (l.dealt) parts.push(`걱정덩어리에게 ${l.dealt} 피해!`);
        if (l.healed) parts.push(`체력 ${l.healed} 회복`);
        if (l.self) parts.push(`나도 ${l.self} 다쳤어요`);
        if (l.blocked) parts.push('반격을 막았어요!');
        else if (l.monster) parts.push(`반격으로 ${l.monster} 피해를 입었어요`);
        setLog(parts.join(' · '));
        setHit(true);
        setTimeout(() => setHit(false), 500);
      }
      setSt(t.state);
      if (t.state.over) {
        setEnd({ result: t.state.over, gain: t.gain, capped: t.capped });
        onDone?.(t);
        track('rpg_end');
      }
    } catch (e) {
      setErr(e.message || '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const title = { win: '걱정덩어리를 물리쳤어요!', lose: '이번엔 졌어요. 내일 다시!', flee: '도망쳤어요' };

  return createPortal(
    <div className="fixed inset-0 z-[95] bg-gradient-to-b from-[#ece4ff] to-[#ffe4ef] flex flex-col px-5 pt-5 pb-8" role="dialog" aria-modal="true" aria-label="걱정덩어리 물리치기">
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-extrabold text-ink">걱정덩어리 물리치기</h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="w-9 h-9 rounded-full bg-white/80 text-brand-700 flex items-center justify-center cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!st ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Worry />
          <p className="mt-4 text-[15px] text-ink break-keep">타로 카드를 뽑아 걱정덩어리를 물리쳐요.<br />이기면 별가루 3개, 하루 2판까지예요.</p>
          {err && <p className="mt-3 text-[13px] text-[#c0392b]">{err}</p>}
          <button type="button" onClick={start} disabled={busy} className="btn-primary mt-6 px-8 py-3 rounded-full text-[16px] font-extrabold cursor-pointer disabled:opacity-60">
            {busy ? '준비 중…' : '시작하기'}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="mt-4 grid gap-3">
            <Bar v={st.mhp} max={M_MAX} color="#9a8cc4" label="걱정덩어리" />
            <Bar v={st.hp} max={MAX_HP} color="#ff7aa8" label="나" />
          </div>
          <div className="mt-4 flex-1 flex items-center justify-around">
            <div className={hit ? 'animate-pulse' : ''}>
              <Avatar id={main} outfit={equipped} className="h-[120px]" />
            </div>
            {card && (
              <img src={`/tarot/card_${card.id}.webp`} alt={card.name} className="w-[86px] rounded-lg shadow-soft animate-fade-in-up" />
            )}
            <Worry hurt={hit} />
          </div>
          <p className="min-h-[44px] text-center text-[14px] font-semibold text-ink break-keep" aria-live="polite">{log}</p>
          {st.shield && !end && <p className="text-center text-[12.5px] font-bold text-brand-700">🛡 다음 반격을 막을 수 있어요</p>}
          {err && <p className="text-center text-[13px] text-[#c0392b]">{err}</p>}
          {end ? (
            <div className="mt-3 rounded-2xl bg-white/90 p-4 text-center">
              <p className="text-[17px] font-extrabold text-ink">{title[end.result]}</p>
              <p className="mt-1 text-[13.5px] text-mute">
                {end.gain ? `별가루 ${end.gain}개를 받았어요` : end.capped ? '오늘 별가루를 모두 모았어요' : '받은 별가루는 없어요'}
              </p>
              <button type="button" onClick={onClose} className="btn-primary mt-3 w-full py-3 rounded-xl text-[15px] font-bold cursor-pointer">마을로 돌아가기</button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button type="button" onClick={() => turn('card')} disabled={busy} className="btn-primary py-3.5 rounded-xl text-[16px] font-extrabold cursor-pointer disabled:opacity-60">카드 뽑기</button>
              <button type="button" onClick={() => turn('flee')} disabled={busy} className="btn-soft px-5 rounded-xl text-[14px] cursor-pointer">도망</button>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
