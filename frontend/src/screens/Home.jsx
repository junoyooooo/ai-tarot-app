import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import Mascot from '../components/Mascot';
import CardFlip from '../components/CardFlip';
import CoinChip from '../components/CoinChip';
import Avatar from '../components/Avatar';
import InstallBanner from '../components/InstallBanner';
import { useWallet } from '../hooks/useWallet';
import { useLook } from '../lib/look';
import { recordCards } from '../lib/collection';
import { playSfx } from '../lib/sound';
import { upcomingSpecial } from '../lib/specialDays';
import { CATEGORIES, categoryByKey } from '../lib/categories';
import CheerShare from '../components/CheerShare';
import StreakCard from '../components/StreakCard';
import { fetchRetention, postCheckin } from '../lib/api';
import { track } from '../lib/analytics';
import { ensureInviteCode, redeemPendingRef } from '../lib/retention';
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

export default function Home({ profile, history, onStartConsult, onOpenEntry, onGoHistory, onOpenPlay }) {
  const wallet = useWallet();
  const look = useLook();
  const today = todayKey();
  const [daily, setDaily] = useState(() => {
    const saved = getDaily();
    return saved && saved.date === today ? saved : null;
  });
  const [flipped, setFlipped] = useState(false); // 이미 뽑은 날에도 들어올 때마다 뒤집힌 채로 시작해서 눌러 보게 한다
  const [showText, setShowText] = useState(false); // 카드가 뒤집힌 뒤 풀이가 스르륵 나타나도록 따로 관리
  const [replaying, setReplaying] = useState(false);
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const special = useMemo(() => upcomingSpecial(new Date(), 3), []);

  // 연속 출석: 오늘의 카드를 뽑으면 서버에 하루 한 번 기록돼요. (이미 뽑은 날 처음 열어도 한 번 확인해요)
  const retOn = wallet?.config?.retention?.enabled;
  const [ret, setRet] = useState(null);
  const notify = wallet?.notify;
  useEffect(() => {
    if (!retOn) return;
    let alive = true;
    fetchRetention()
      .then((r) => {
        if (!alive) return;
        setRet(r);
        if (daily && !r.checked_today) doCheckin();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retOn]);
  useEffect(() => {
    if (!retOn) return;
    track('app_open');
    ensureInviteCode().catch(() => {});
    redeemPendingRef().then((r) => {
      if (r?.gain && notify) notify(`친구 초대 보상으로 별가루 ${r.gain}개를 받았어요 ⭐`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retOn]);
  const doCheckin = () =>
    postCheckin()
      .then((r) => {
        setRet(r);
        if (!r.already) {
          track('checkin', { streak: r.streak });
          if (r.gain && notify) notify(`${r.streak}일 연속 출석! 별가루 ${r.gain}개를 받았어요 ⭐`);
        }
      })
      .catch(() => {});

  const name = cleanName(profile.name);
  const card = daily ? TAROT_CARDS.find((c) => c.id === daily.cardId) : getDailyCard(profile.name, profile.birthdate, today);

  const draw = () => {
    const next = { date: today, cardId: getDailyCard(profile.name, profile.birthdate, today).id };
    saveDaily(next);
    recordCards([next.cardId]);
    setDaily(next);
    setFlipped(true);
    revealText();
    track('daily_draw', { first: !daily });
    if (retOn) doCheckin();
  };

  const revealText = () =>
    later(() => {
      setShowText(true);
      setReplaying(false);
      playSfx('reveal');
    }, 700);

  // 이미 뽑은 카드를 눌러 다시 뒤집어 보기
  const replay = () => {
    if (replaying) return;
    setReplaying(true);
    setShowText(false);
    setFlipped(false);
    later(() => {
      playSfx('flip');
      setFlipped(true);
      revealText();
    }, 550);
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

      <InstallBanner historyCount={history?.length || 0} />

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

      {/* 별똥별 마을 */}
      {wallet?.config?.play?.enabled && (
        <button
          type="button"
          onClick={onOpenPlay}
          className="mt-3 w-full rounded-[24px] bg-gradient-to-br from-[#2a2465] to-[#5b3a9a] text-left px-5 py-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-extrabold text-white">
              별똥별 마을 <span className="ml-1 align-middle text-[11px] font-bold bg-white/20 rounded-full px-2 py-0.5">미니게임</span>
            </p>
            <p className="mt-0.5 text-[12.5px] text-white/75 break-keep">게임하고 별가루를 모아 운명이들을 꾸며 보세요</p>
          </div>
          <Avatar id={look.main} outfit={look.equipped} className="h-[64px] shrink-0" />
        </button>
      )}

      {/* 명절·기념일 안내 (오늘이거나 3일 안일 때만) */}
      {special && (
        <div className="mt-3 rounded-[24px] bg-gradient-to-br from-[#fff1c9] to-[#ffd9e6] px-5 py-4">
          <p className="text-[12px] font-bold text-[#a8385e]">
            {special.emoji} {special.name} · {special.diff === 0 ? '오늘' : `D-${special.diff}`}
          </p>
          <p className="mt-1 text-[14.5px] font-bold leading-snug text-ink break-keep">{special.line}</p>
          <button
            type="button"
            onClick={() => onStartConsult(special.category)}
            className="mt-3 inline-flex items-center gap-1 bg-white text-[#a8385e] font-bold text-[13px] rounded-full pl-4 pr-3 py-2 cursor-pointer active:scale-95 transition-transform"
          >
            카드에게 물어보기 <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* 오늘의 카드 */}
      <h2 className="mt-8 mb-3 text-[19px] font-extrabold text-ink">오늘의 카드</h2>
      <div className="rounded-[28px] bg-gradient-to-br from-[#ffd9b3] to-[#ffb8cf] p-4 flex gap-4 items-center">
        <div className="w-[104px] shrink-0">
          <CardFlip card={card} flipped={flipped} onFlip={draw} onReplay={replay} label="오늘의" />
        </div>
        <div className="flex-1 min-w-0">
          {flipped && showText ? (
            <div className="animate-fade-in-up">
              <p className="text-[12px] font-bold text-[#a8385e]">오늘을 응원하는 카드</p>
              <p className="mt-0.5 text-[20px] font-extrabold text-ink break-keep">{getKoName(card)}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink/80 line-clamp-5 break-keep">{getDailyMessage(card.id, name)}</p>
              <p className="mt-2 text-[11.5px] text-ink/45">카드를 누르면 다시 뒤집어 볼 수 있어요</p>
              <CheerShare card={card} dateKey={today} />
            </div>
          ) : flipped || replaying ? (
            <p className="text-[14px] font-bold text-[#a8385e] animate-pulse">카드가 이야기를 들려주려 해요…</p>
          ) : (
            <div>
              <p className="text-[12px] font-bold text-[#a8385e]">하루에 한 장</p>
              <p className="mt-0.5 text-[18px] font-extrabold text-ink leading-snug break-keep">카드를 터치해서 오늘의 카드를 확인해 보세요</p>
              <button
                type="button"
                onClick={draw}
                className="mt-3 inline-flex items-center gap-1.5 bg-white text-[#a8385e] font-bold text-[13px] rounded-full px-4 py-2 cursor-pointer active:scale-95 transition-transform"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" /> {daily ? '카드 확인하기' : '카드 뽑기'}
              </button>
            </div>
          )}
        </div>
      </div>

      <StreakCard ret={ret} onStartConsult={onStartConsult} />

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
