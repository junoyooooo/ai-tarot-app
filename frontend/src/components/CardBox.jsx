import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import Mascot from './Mascot';
import ShareActions from './ShareActions';
import { claimCardbox } from '../lib/api';
import { getCardBox, removeCardBox } from '../lib/storage';
import { TAROT_CARDS, cleanName } from '../tarotData';

const MONTH_EMOJI = ['⛄', '💝', '🌷', '🌸', '🌿', '🌊', '🌻', '🍉', '🌕', '🍂', '🍁', '🎄'];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const hydrate = (item) => item.cards.map((c) => ({ ...TAROT_CARDS.find((t) => t.id === c.id), position: c.position }));
const fmt = (ts) => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}`;
};

function Bar({ value, max }) {
  const pct = Math.max(4, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="h-2 rounded-full bg-white/60 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="h-full rounded-full bg-gradient-to-r from-[#8a45e0] to-[#ff6fa5]" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** 카드 보관함: 상담이 끝난 카드가 자동으로 모이고, 모을수록 계급이 오르고 달마다 스티커를 받아요. */
export default function CardBox({ profile }) {
  const [items, setItems] = useState(() => getCardBox());
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const name = cleanName(profile.name);

  useEffect(() => {
    let alive = true;
    claimCardbox()
      .then((r) => alive && setInfo(r))
      .catch(() => {
        /* 서버에 연결하지 못해도 보관함 자체는 쓸 수 있다 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const total = info ? info.total : items.length;
  const rank = info?.rank;
  const year = new Date().getFullYear();
  const earned = {};
  (info?.stickers || []).forEach((s) => {
    if (s.month.startsWith(String(year))) earned[Number(s.month.slice(5))] = Math.max(earned[Number(s.month.slice(5))] || 0, s.need);
  });
  const tiers = info?.month_tiers || [];
  const nextTier = tiers.find((t) => (info?.month_count || 0) < t.need);
  const goldNeed = tiers.length ? tiers[tiers.length - 1].need : 0;

  const close = () => {
    setOpen(null);
    setConfirm(false);
  };

  return (
    <div className="mt-5">
      {info?.granted?.length > 0 && (
        <div role="status" className="mb-3 rounded-2xl bg-[#fff1c9] px-4 py-3 text-[13.5px] font-bold text-ink animate-pop-in break-keep">
          🎉 {info.granted.map((g) => g.name).join(', ')} 달성!
          {info.granted.reduce((a, g) => a + g.stardust, 0) > 0 && <> 별가루 +{info.granted.reduce((a, g) => a + g.stardust, 0)}를 받았어요.</>}
        </div>
      )}

      {/* 계급 */}
      <div className="rounded-[28px] bg-gradient-to-br from-[#efe2ff] to-[#ffe4ef] px-5 py-5">
        <p className="text-[12px] font-bold text-brand-600">내 계급</p>
        <p className="mt-1 text-[22px] font-extrabold text-ink">
          {rank?.current ? `${rank.current.icon} ${rank.current.name}` : '아직 계급이 없어요'}
        </p>
        <p className="mt-0.5 text-[13px] text-mute">모은 카드 {total}장</p>
        {rank?.next ? (
          <div className="mt-3">
            <Bar value={total} max={rank.next.need} />
            <p className="mt-1.5 text-[12.5px] text-ink/70 break-keep">
              {rank.next.need - total}장 더 모으면 <b>{rank.next.icon} {rank.next.name}</b>
            </p>
          </div>
        ) : (
          rank && <p className="mt-2 text-[12.5px] text-ink/70">가장 높은 계급이에요. 멋져요!</p>
        )}
      </div>

      {/* 월간 스티커 */}
      <div className="mt-3 rounded-[28px] bg-white shadow-soft px-5 py-5">
        <p className="text-[15px] font-extrabold text-ink">{year}년 스티커</p>
        {info && (
          <p className="mt-0.5 text-[12.5px] text-mute break-keep">
            이번 달 {info.month_count}장{nextTier ? ` · ${nextTier.need - info.month_count}장 더 모으면 ${nextTier.name}` : ' · 이번 달은 다 모았어요'}
          </p>
        )}
        <div className="mt-3 grid grid-cols-6 gap-y-3 gap-x-2">
          {MONTH_EMOJI.map((e, i) => {
            const tier = earned[i + 1] || 0;
            const gold = goldNeed && tier >= goldNeed;
            return (
              <div key={e} className="flex flex-col items-center" aria-label={`${i + 1}월 ${tier ? (gold ? '반짝 스티커' : '스티커') : '아직 없어요'}`}>
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-[22px] ${
                    tier
                      ? gold
                        ? 'bg-[#fff1c9] ring-2 ring-[#f2a93b]'
                        : 'bg-brand-50 ring-2 ring-brand-300'
                      : 'bg-brand-50/60 opacity-35 grayscale'
                  }`}
                >
                  {e}
                </span>
                <span className="mt-1 text-[11px] text-mute">{i + 1}월</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 모은 카드 */}
      <h2 className="mt-7 mb-3 text-[19px] font-extrabold text-ink">모은 카드 {items.length > 0 && <span className="text-mute font-bold text-[15px]">{items.length}</span>}</h2>
      {items.length === 0 ? (
        <div className="rounded-[24px] bg-brand-50 px-5 py-8 flex flex-col items-center text-center">
          <Mascot id={9} className="w-16 h-[72px]" />
          <p className="mt-3 text-[14px] leading-relaxed text-mute break-keep">상담이 끝나면 카드가 자동으로 여기에 모여요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {items.map((it) => {
            const cs = hydrate(it);
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => setOpen(it)}
                  className="w-full rounded-[22px] bg-gradient-to-br from-[#efe2ff] via-[#ffe4ef] to-[#fff1d9] p-3 text-left cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="relative h-[92px] flex items-center justify-center">
                    {cs.map((c, i) => (
                      <img
                        key={c.id}
                        src={c.image_url}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="absolute h-[84px] w-auto rounded-md shadow-card"
                        style={{ transform: `translateX(${(i - 1) * 34}px) rotate(${(i - 1) * 9}deg)`, zIndex: i === 1 ? 2 : 1 }}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[12.5px] font-bold text-ink line-clamp-2 break-keep min-h-[2.4em]">“{it.summary}”</p>
                  <p className="mt-1 text-[11.5px] text-mute">{fmt(it.ts)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && createPortal(
        <div className="fixed inset-0 z-[80] bg-ink/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="보관한 카드">
          <div className="w-full max-w-[430px] bg-white rounded-t-[28px] sm:rounded-[28px] p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-bold text-ink">{fmt(open.ts)}의 카드</p>
              <button type="button" onClick={close} aria-label="닫기" className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mb-4 text-[16px] font-extrabold leading-snug text-ink break-keep">“{open.summary}”</p>
            <ShareActions name={name} cards={hydrate(open)} summary={open.summary} hashtags={open.hashtags} />
            <div className="mt-4 text-center">
              {confirm ? (
                <div className="inline-flex items-center gap-2">
                  <span className="text-[13px] text-mute">보관함에서 삭제할까요?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setItems(removeCardBox(open.id));
                      close();
                    }}
                    className="text-[13px] font-bold text-[#c2255c] bg-[#ffe3ee] rounded-full px-3.5 py-1.5 cursor-pointer"
                  >
                    삭제
                  </button>
                  <button type="button" onClick={() => setConfirm(false)} className="text-[13px] font-semibold text-mute px-2 py-1.5 cursor-pointer">
                    취소
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute cursor-pointer">
                  <Trash2 className="w-4 h-4" aria-hidden="true" /> 보관함에서 삭제
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
