import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import Mascot from '../components/Mascot';
import ReadingView from '../components/ReadingView';
import ShareActions from '../components/ShareActions';
import LockedSection from '../components/LockedSection';
import ReadingExtras from '../components/ReadingExtras';
import { categoryByKey } from '../lib/categories';
import { removeHistory, updateHistory } from '../lib/storage';
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

      <div className="mt-5">
        <ShareActions name={name} cards={cards} summary={entry.summary} hashtags={entry.hashtags} />
      </div>

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
export default function History({ profile, history, openId, onOpenChange, onChanged }) {
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState(null);

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
            const isSel = selectedDay === day;
            const isToday = key === todayStr;
            return (
              <button
                key={key}
                type="button"
                disabled={entries.length === 0}
                onClick={() => setSelectedDay(isSel ? null : day)}
                className={`relative h-11 flex flex-col items-center justify-center rounded-2xl text-[14px] font-semibold ${
                  isSel ? 'bg-brand-500 text-white' : isToday ? 'text-brand-600 font-extrabold' : 'text-ink'
                } ${entries.length ? 'cursor-pointer' : 'cursor-default text-ink/70'}`}
              >
                {day}
                {entries.length > 0 && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-brand-400'}`} />}
              </button>
            );
          })}
        </div>
      </div>

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
            {history.length === 0 ? '아직 기록이 없어요. 첫 상담을 해 보세요.' : '이 날의 기록은 없어요.'}
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
