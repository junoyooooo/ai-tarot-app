import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import Mascot from '../components/Mascot';
import ReadingView from '../components/ReadingView';
import ShareActions from '../components/ShareActions';
import LockedSection from '../components/LockedSection';
import ReadingExtras from '../components/ReadingExtras';
import { categoryByKey } from '../lib/categories';
import { removeHistory, updateHistory, getMemos, setMemo, MEMO_MAX, todayKey } from '../lib/storage';
import { isoKey, specialOn, specialsInMonth } from '../lib/specialDays';
import { TAROT_CARDS, getKoName, cleanName } from '../tarotData';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function fmt(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${DOW[d.getDay()]}`;
}

function hydrate(entry) {
  return entry.cards.map((c) => ({ ...TAROT_CARDS.find((t) => t.id === c.id), position: c.position }));
}

/* ------------------------- 상세 보기 ------------------------- */
function Detail({ entry, profile, onBack, onDelete, onChanged }) {
  const [confirm, setConfirm] = useState(false);
  const cat = categoryByKey(entry.category);
  const cards = useMemo(() => hydrate(entry), [entry]);
  const name = cleanName(profile.name);

  return (
    <div className="px-5 pt-6 pb-32 animate-slide-in">
      <button type="button" onClick={onBack} className="flex items-center gap-0.5 text-[14px] font-semibold text-mute cursor-pointer -ml-1">
        <ChevronLeft className="w-5 h-5" aria-hidden="true" /> 기록
      </button>

      <div className={`mt-4 ${cat.bg} rounded-[26px] p-5`}>
        <div className="flex items-center gap-3">
          <Mascot id={cat.mascot} className="w-14 h-16 shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-ink/60">
              {fmt(entry.ts)} · {cat.label}
            </p>
            <p className="mt-0.5 text-[16px] font-extrabold text-ink leading-snug break-keep">{entry.summary || '그날의 리딩'}</p>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-ink/70 bg-white/60 rounded-2xl px-3.5 py-2.5 break-keep">“{entry.concern}”</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="min-w-0 flex flex-col items-center">
            <span className="mb-2 text-[12px] font-extrabold text-brand-600 bg-brand-50 rounded-full px-3 py-1">{c.position}</span>
            <div className="w-full aspect-[768/1376] rounded-[14px] overflow-hidden shadow-card bg-[#0d0c1d]">
              <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
            </div>
            <p className="mt-2 text-[13px] font-bold text-ink text-center break-keep">{getKoName(c)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <ReadingView
          reading={entry.reading}
          isComplete
          cards={cards}
          footer={
            entry.locked && entry.readingId ? (
              <LockedSection
                readingId={entry.readingId}
                titles={entry.lockedTitles}
                cost={entry.lockedCost || 1}
                onUnlocked={(text) =>
                  onChanged(updateHistory(entry.id, { reading: `${entry.reading.trimEnd()}\n\n${text}`, locked: false, lockedTitles: [] }))
                }
              />
            ) : null
          }
        />
      </div>

      {!entry.locked && (
        <ReadingExtras
          readingId={entry.readingId}
          advice={entry.advice}
          followups={entry.followups}
          onAdvice={(a) => onChanged(updateHistory(entry.id, { advice: a }))}
          onFollowups={(list) => onChanged(updateHistory(entry.id, { followups: list }))}
        />
      )}

      {!/자살예방 상담전화 109/.test(entry.reading) && (
        <div className="mt-5">
          <ShareActions name={name} cards={cards} summary={entry.summary} hashtags={entry.hashtags} />
        </div>
      )}

      <div className="mt-6 text-center">
        {confirm ? (
          <div className="inline-flex items-center gap-2">
            <span className="text-[13px] text-mute">이 기록을 삭제할까요?</span>
            <button type="button" onClick={() => onDelete(entry.id)} className="text-[13px] font-bold text-[#c2255c] bg-[#ffe3ee] rounded-full px-3.5 py-1.5 cursor-pointer">
              삭제
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="text-[13px] font-semibold text-mute px-2 py-1.5 cursor-pointer">
              취소
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute cursor-pointer">
            <Trash2 className="w-4 h-4" aria-hidden="true" /> 이 기록 삭제
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------- 목록 + 달력 ------------------------- */
export default function History({ profile, history, openId, onOpenChange, onChanged, onStartConsult }) {
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState(null);
  const [memos, setMemos] = useState(() => getMemos());
  const [draft, setDraft] = useState('');
  const [memoSaved, setMemoSaved] = useState(false);

  const open = openId ? history.find((e) => e.id === openId) : null;
  if (open) {
    return (
      <Detail
        entry={open}
        profile={profile}
        onBack={() => onOpenChange(null)}
        onChanged={onChanged}
        onDelete={(id) => {
          onChanged(removeHistory(id));
          onOpenChange(null);
        }}
      />
    );
  }

  const byDay = history.reduce((acc, e) => {
    (acc[dayKey(e.ts)] = acc[dayKey(e.ts)] || []).push(e);
    return acc;
  }, {});

  const first = new Date(month.y, month.m, 1);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const shiftMonth = (delta) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setSelectedDay(null);
  };

  const isoOf = (day) => isoKey(month.y, month.m + 1, day);
  const selectDay = (day) => {
    const next = selectedDay === day ? null : day;
    setSelectedDay(next);
    setDraft(next ? memos[isoOf(next)] || '' : '');
    setMemoSaved(false);
  };
  const saveMemo = () => {
    setMemos(setMemo(isoOf(selectedDay), draft));
    setMemoSaved(true);
    setTimeout(() => setMemoSaved(false), 1500);
  };
  const monthSpecials = specialsInMonth(month.y, month.m + 1);
  const selSpecial = selectedDay ? specialOn(isoOf(selectedDay)) : null;
  const selIsFuture = selectedDay ? isoOf(selectedDay) >= todayKey() : false;

  const list = selectedDay ? history.filter((e) => dayKey(e.ts) === `${month.y}-${month.m}-${selectedDay}`) : history;
  const todayStr = dayKey(Date.now());

  return (
    <div className="px-5 pt-8 pb-32 animate-fade-in-up">
      <h1 className="text-[26px] font-extrabold tracking-tight text-ink">기록</h1>

      {/* 달력 */}
      <div className="mt-5 rounded-[28px] bg-brand-50 px-4 py-4">
        <div className="flex items-center justify-between px-1 mb-2">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="이전 달" className="w-9 h-9 rounded-full flex items-center justify-center text-brand-700 cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-[16px] font-extrabold text-ink">
            {month.y}년 {month.m + 1}월
          </p>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="다음 달" className="w-9 h-9 rounded-full flex items-center justify-center text-brand-700 cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {DOW.map((d) => (
            <span key={d} className="py-1.5 text-[12px] font-semibold text-mute">
              {d}
            </span>
          ))}
          {cells.map((day, i) => {
            if (!day) return <span key={`e${i}`} />;
            const key = `${month.y}-${month.m}-${day}`;
            const entries = byDay[key] || [];
            const iso = isoOf(day);
            const special = specialOn(iso);
            const hasMemo = Boolean(memos[iso]);
            const isSel = selectedDay === day;
            const isToday = key === todayStr;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(day)}
                aria-label={`${month.m + 1}월 ${day}일${special ? ` ${special.name}` : ''}${hasMemo ? ', 메모 있음' : ''}`}
                className={`relative h-11 flex flex-col items-center justify-center rounded-2xl text-[14px] font-semibold cursor-pointer ${
                  isSel ? 'bg-brand-500 text-white' : special ? 'bg-[#fff1c9] text-ink' : isToday ? 'text-brand-600 font-extrabold' : 'text-ink'
                }`}
              >
                {day}
                {special && <span className="absolute top-0 right-0.5 text-[10px] leading-none" aria-hidden="true">{special.emoji}</span>}
                {(entries.length > 0 || hasMemo) && (
                  <span className="absolute bottom-1 flex gap-0.5" aria-hidden="true">
                    {entries.length > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-brand-400'}`} />}
                    {hasMemo && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/80' : 'bg-[#f2a93b]'}`} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 이번 달 특별한 날 */}
      {monthSpecials.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {monthSpecials.map((sp) => (
            <button
              key={sp.day}
              type="button"
              onClick={() => selectDay(sp.day)}
              className="inline-flex items-center gap-1 rounded-full bg-[#fff1c9] px-3 py-1.5 text-[12.5px] font-bold text-ink cursor-pointer"
            >
              <span aria-hidden="true">{sp.emoji}</span> {month.m + 1}/{sp.day} {sp.name}
            </button>
          ))}
        </div>
      )}

      {/* 고른 날: 특별한 날 안내 + 한 줄 메모 */}
      {selectedDay && (
        <div className="mt-3 rounded-[24px] bg-white shadow-soft px-4 py-4 space-y-3">
          {selSpecial && (
            <div className="rounded-2xl bg-gradient-to-br from-[#fff1c9] to-[#ffd9e6] px-4 py-3">
              <p className="text-[12px] font-bold text-[#a8385e]">
                {selSpecial.emoji} {selSpecial.name}
              </p>
              <p className="mt-0.5 text-[14px] font-bold leading-snug text-ink break-keep">{selSpecial.line}</p>
              {selIsFuture && onStartConsult && (
                <button
                  type="button"
                  onClick={() => onStartConsult(selSpecial.category)}
                  className="mt-2.5 inline-flex items-center gap-1 bg-white text-[#a8385e] font-bold text-[13px] rounded-full pl-3.5 pr-2.5 py-1.5 cursor-pointer"
                >
                  카드에게 물어보기 <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <div>
            <label htmlFor="day-memo" className="text-[12.5px] font-bold text-mute">
              {month.m + 1}월 {selectedDay}일 메모
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="day-memo"
                value={draft}
                maxLength={MEMO_MAX}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveMemo()}
                placeholder="기념일이나 한 줄 메모 (최대 40자)"
                className="min-w-0 flex-1 rounded-2xl bg-brand-50 px-4 py-2.5 text-[14px] text-ink placeholder:text-mute/70 outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="button" onClick={saveMemo} className="shrink-0 rounded-2xl bg-brand-500 text-white font-bold text-[14px] px-4 cursor-pointer">
                {memoSaved ? '저장됨' : '저장'}
              </button>
            </div>
            <p className="mt-1.5 text-[11.5px] text-mute">비워서 저장하면 메모가 지워져요. 메모는 이 기기에만 저장돼요.</p>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className="mt-7 mb-3 flex items-center justify-between">
        <h2 className="text-[19px] font-extrabold text-ink">{selectedDay ? `${month.m + 1}월 ${selectedDay}일` : '모든 기록'}</h2>
        {selectedDay && (
          <button type="button" onClick={() => setSelectedDay(null)} className="text-[13px] font-semibold text-brand-600 cursor-pointer">
            전체 보기
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-[24px] bg-brand-50 px-5 py-8 flex flex-col items-center text-center">
          <Mascot id={9} className="w-16 h-[72px]" />
          <p className="mt-3 text-[14px] leading-relaxed text-mute break-keep">
            {history.length === 0 && !selectedDay ? '아직 기록이 없어요. 첫 상담을 해 보세요.' : '이 날의 상담 기록은 없어요.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {list.map((e) => {
            const cat = categoryByKey(e.category);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpenChange(e.id)}
                  className={`w-full ${cat.bg} rounded-[22px] px-4 py-3.5 flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform`}
                >
                  <Mascot id={cat.mascot} className="w-11 h-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-ink/60">
                      {fmt(e.ts)} · {cat.label}
                    </p>
                    <p className="text-[14.5px] font-bold text-ink truncate">
                      {e.locked && <span aria-label="잠긴 풀이가 있어요">🔒 </span>}
                      {e.summary || e.concern}
                    </p>
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
