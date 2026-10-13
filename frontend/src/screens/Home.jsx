import React, { useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import Mascot from '../components/Mascot';
import CardFlip from '../components/CardFlip';
import CoinChip from '../components/CoinChip';
import { recordCards } from '../lib/collection';
import { CATEGORIES, categoryByKey } from '../lib/categories';
import { getDaily, saveDaily, todayKey } from '../lib/storage';
import { getDailyCard, getDailyMessage, getKoName, TAROT_CARDS, cleanName } from '../tarotData';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(d = new Date()) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
}

function formatShort(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Home({ profile, history, onStartConsult, onOpenEntry, onGoHistory }) {
  const today = todayKey();
  const [daily, setDaily] = useState(() => {
    const saved = getDaily();
    return saved && saved.date === today ? saved : null;
  });
  const [flipped, setFlipped] = useState(Boolean(daily));

  const name = cleanName(profile.name);
  const card = daily ? TAROT_CARDS.find((c) => c.id === daily.cardId) : getDailyCard(profile.name, profile.birthdate, today);

  const draw = () => {
    const next = { date: today, cardId: getDailyCard(profile.name, profile.birthdate, today).id };
    saveDaily(next);
    recordCards([next.cardId]);
    setDaily(next);
    setFlipped(true);
  };

  const recent = history.slice(0, 3);

  return (
    <div className="px-5 pt-8 pb-32 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-mute">{formatDate()}</p>
        <CoinChip />
      </div>
      <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-ink leading-tight">
        {name}님, 안녕하세요
      </h1>

      {/* 상담 시작 배너 */}
      <button
        type="button"
        onClick={() => onStartConsult(null)}
        className="mt-5 w-full relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#b48cf2] to-[#8a45e0] text-left p-5 pr-3 flex items-center cursor-pointer shadow-soft active:scale-[0.99] transition-transform"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[19px] font-extrabold text-white leading-snug break-keep">마음에 걸리는 일,
            <br />카드에게 물어볼까요?</p>
          <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 bg-white rounded-full pl-3.5 pr-2.5 py-1.5">
            상담 시작하기 <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </span>
        </div>
        <Mascot id={1} className="w-[104px] h-[124px] shrink-0 -mb-2" />
      </button>

      {/* 오늘의 카드 */}
      <h2 className="mt-8 mb-3 text-[19px] font-extrabold text-ink">오늘의 카드</h2>
      <div className="rounded-[28px] bg-gradient-to-br from-[#ffd9b3] to-[#ffb8cf] p-4 flex gap-4 items-center">
        <div className="w-[104px] shrink-0">
          <CardFlip card={card} flipped={flipped} onFlip={draw} label="오늘의" />
        </div>
        <div className="flex-1 min-w-0">
          {flipped ? (
            <div className="animate-fade-in-up">
              <p className="text-[12px] font-bold text-[#a8385e]">오늘을 응원하는 카드</p>
              <p className="mt-0.5 text-[20px] font-extrabold text-ink break-keep">{getKoName(card)}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink/80 line-clamp-5 break-keep">{getDailyMessage(card.id, name)}</p>
            </div>
          ) : (
            <div>
              <p className="text-[12px] font-bold text-[#a8385e]">하루에 한 장</p>
              <p className="mt-0.5 text-[18px] font-extrabold text-ink leading-snug break-keep">오늘의 카드를 뽑아 볼까요?</p>
              <button
                type="button"
                onClick={draw}
                className="mt-3 inline-flex items-center gap-1.5 bg-white text-[#a8385e] font-bold text-[13px] rounded-full px-4 py-2 cursor-pointer active:scale-95 transition-transform"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" /> 카드 뽑기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 고민 종류 */}
      <h2 className="mt-8 mb-3 text-[19px] font-extrabold text-ink">어떤 고민이 있어요?</h2>
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onStartConsult(c.key)}
            className={`relative overflow-hidden rounded-[24px] ${c.bg} p-4 h-[112px] text-left cursor-pointer active:scale-[0.97] transition-transform`}
          >
            <span className="text-[16px] font-extrabold text-ink break-keep">{c.label}</span>
            <Mascot id={c.mascot} className="absolute right-1.5 bottom-0 w-[64px] h-[72px]" />
          </button>
        ))}
      </div>

      {/* 최근 기록 */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-[19px] font-extrabold text-ink">최근 기록</h2>
        {recent.length > 0 && (
          <button type="button" onClick={onGoHistory} className="text-[13px] font-semibold text-brand-600 cursor-pointer">
            전체 보기
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <div className="rounded-[24px] bg-brand-50 px-5 py-6 flex items-center gap-4">
          <Mascot id={18} className="w-14 h-16 shrink-0" />
          <p className="text-[14px] leading-relaxed text-mute break-keep">아직 기록이 없어요. 첫 상담을 하면 여기에 차곡차곡 쌓여요.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {recent.map((e) => {
            const cat = categoryByKey(e.category);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpenEntry(e)}
                  className={`w-full ${cat.bg} rounded-[22px] px-4 py-3.5 flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform`}
                >
                  <Mascot id={cat.mascot} className="w-11 h-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-ink/60">{formatShort(e.ts)} · {cat.label}</p>
                    <p className="text-[14.5px] font-bold text-ink truncate">{e.summary || e.concern}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ink/40 shrink-0" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
