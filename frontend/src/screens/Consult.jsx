import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FastForward, RefreshCw, Wand2 } from 'lucide-react';
import Mascot from '../components/Mascot';
import CardFlip from '../components/CardFlip';
import ReadingView from '../components/ReadingView';
import ShareActions from '../components/ShareActions';
import LockedSection from '../components/LockedSection';
import ReadingExtras from '../components/ReadingExtras';
import useReading from '../hooks/useReading';
import { CATEGORIES, categoryByKey } from '../lib/categories';
import { addHistory, updateHistory } from '../lib/storage';
import { recordCards } from '../lib/collection';
import { track } from '../lib/analytics';
import { getKoName, cleanName } from '../tarotData';

const MAX_CONCERN = 450;
// 위기 안내(109)가 나온 상담에는 공유·홍보 UI 를 보여 주지 않는다.
const CRISIS_SHOWN = /자살예방 상담전화 109/;

export default function Consult({ profile, seed, onSaved, onGoHistory }) {
  const reading = useReading();
  const [step, setStep] = useState('category'); // category → write → run
  const [category, setCategory] = useState(null);
  const [concern, setConcern] = useState('');
  const [error, setError] = useState('');
  const [flipped, setFlipped] = useState([false, false, false]);
  const [runInfo, setRunInfo] = useState({ concern: '', category: 'etc' });
  const readingRef = useRef(null);
  const savedRef = useRef(false);
  const entryIdRef = useRef(null);
  const [advice, setAdvice] = useState(null);
  const [followups, setFollowups] = useState([]);
  const topRef = useRef(null);

  /* 홈에서 분야를 골라 들어오면 그 단계부터 시작 */
  useEffect(() => {
    if (!seed) return;
    reading.reset();
    setFlipped([false, false, false]);
    setConcern('');
    setError('');
    if (seed.category) {
      setCategory(seed.category);
      setStep('write');
    } else {
      setCategory(null);
      setStep('category');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  /* 3장이 모두 뒤집히면 리딩으로 스크롤 */
  const allFlipped = flipped.every(Boolean);
  useEffect(() => {
    if (!allFlipped || !readingRef.current) return undefined;
    const t = setTimeout(() => readingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600);
    return () => clearTimeout(t);
  }, [allFlipped]);

  /* 리딩이 끝나면 기록에 저장 */
  useEffect(() => {
    if (!reading.isComplete || savedRef.current || reading.cards.length !== 3 || !reading.reading) return;
    savedRef.current = true;
    const entryId = String(Date.now());
    entryIdRef.current = entryId;
    recordCards(reading.cards.map((c) => c.id));
    const entry = {
      id: entryId,
      ts: Date.now(),
      category: runInfo.category,
      concern: runInfo.concern,
      cards: reading.cards.map((c) => ({ id: c.id, position: c.position })),
      reading: reading.reading,
      summary: reading.meta.one_line_summary,
      hashtags: reading.meta.hashtags,
      readingId: reading.readingId,
      locked: Boolean(reading.locked),
      lockedTitles: reading.locked?.titles || [],
      lockedCost: reading.locked?.cost || 1,
    };
    onSaved(addHistory(entry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading.isComplete]);

  const persist = (patch) => {
    if (entryIdRef.current) onSaved(updateHistory(entryIdRef.current, patch));
  };

  const handleUnlocked = (text) => {
    const full = `${reading.reading.trimEnd()}\n\n${text}`;
    reading.applyUnlock(text);
    persist({ reading: full, locked: false, lockedTitles: [] });
  };

  const name = cleanName(profile.name);
  const cat = categoryByKey(category);

  const submit = (e) => {
    e.preventDefault();
    const text = concern.trim();
    if (text.length < 2) {
      setError('고민을 한두 문장이라도 적어 주세요.');
      return;
    }
    setError('');
    savedRef.current = false;
    entryIdRef.current = null;
    setAdvice(null);
    setFollowups([]);
    setFlipped([false, false, false]);
    setRunInfo({ concern: text, category: cat.key });
    setStep('run');
    track('consult_start', { category: cat.key });
    reading.start({
      name: profile.name,
      birthdate: profile.birthdate,
      concern: text.slice(0, 500),
      category: cat.key,
    });
    topRef.current?.scrollIntoView({ block: 'start' });
  };

  const restart = () => {
    reading.reset();
    setFlipped([false, false, false]);
    setConcern('');
    setCategory(null);
    setStep('category');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const flip = (i) => setFlipped((prev) => prev.map((v, idx) => (idx === i ? true : v)));

  /* ---------------------------- 1. 분야 고르기 ---------------------------- */
  if (step === 'category') {
    return (
      <div ref={topRef} className="px-5 pt-10 pb-32 animate-fade-in-up">
        <Mascot id={18} bounce className="w-16 h-20" />
        <h1 className="mt-3 text-[26px] leading-tight font-extrabold text-ink">
          {name}님,
          <br />
          어떤 고민이에요?
        </h1>
        <p className="mt-2 text-[14px] text-mute">가까운 걸 하나 골라 주세요.</p>
        <ul className="mt-6 space-y-2.5">
          {CATEGORIES.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => {
                  setCategory(c.key);
                  setStep('write');
                }}
                className={`w-full ${c.bg} rounded-[22px] px-4 py-3 flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform`}
              >
                <Mascot id={c.mascot} className="w-12 h-13 shrink-0" style={{ height: 52 }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-extrabold text-ink">{c.label}</p>
                  <p className="text-[12.5px] text-ink/60 truncate">{c.hint}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-ink/40 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* ---------------------------- 2. 고민 적기 ---------------------------- */
  if (step === 'write') {
    return (
      <form ref={topRef} onSubmit={submit} noValidate className="px-5 pt-6 pb-32 animate-slide-in">
        <button
          type="button"
          onClick={() => setStep('category')}
          className="flex items-center gap-0.5 text-[14px] font-semibold text-mute cursor-pointer -ml-1"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" /> 다시 고르기
        </button>

        <div className={`mt-4 ${cat.bg} rounded-[26px] p-5 flex items-center gap-3`}>
          <Mascot id={cat.mascot} className="w-[72px] h-[84px] shrink-0" />
          <div>
            <p className="text-[12px] font-bold text-ink/60">{cat.label}</p>
            <h1 className="text-[20px] leading-snug font-extrabold text-ink break-keep">편하게 이야기해 주세요</h1>
          </div>
        </div>

        <label htmlFor="concern" className="block mt-6 mb-2 text-[14px] font-bold text-ink pl-1">
          지금 마음에 품은 고민
        </label>
        <textarea
          id="concern"
          rows={6}
          maxLength={MAX_CONCERN}
          className="field resize-none leading-relaxed"
          placeholder="어떤 상황인지, 무엇이 가장 마음에 걸리는지 적어 주세요."
          value={concern}
          onChange={(e) => {
            setConcern(e.target.value);
            setError('');
          }}
        />
        <p className="text-right text-[12px] text-mute mt-1.5 pr-1">
          {concern.length} / {MAX_CONCERN}
        </p>

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-[#c2255c] bg-[#ffe3ee] rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full mt-5 py-4 rounded-2xl text-[16px] flex items-center justify-center gap-2 cursor-pointer">
          <Wand2 className="w-5 h-5" aria-hidden="true" />
          카드 3장 뽑기
        </button>
      </form>
    );
  }

  /* ---------------------------- 3. 로딩 ---------------------------- */
  if (reading.isLoading) {
    return (
      <div ref={topRef} className="min-h-[80dvh] px-8 flex flex-col items-center justify-center text-center animate-fade-in-up" role="status" aria-live="polite">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <div className="loader-ring absolute inset-0" />
          <Mascot id={cat.mascot} bounce className="w-24 h-28" />
        </div>
        <p className="mt-8 text-[19px] font-extrabold text-ink">{reading.loadingText}</p>
        <p className="mt-2 text-[13px] text-mute min-h-[1.25rem] break-keep">
          {reading.loadingSlow ? '서버를 깨우는 중이라 처음에는 조금 더 걸릴 수 있어요.' : ''}
        </p>
      </div>
    );
  }

  /* ---------------------------- 4. 카드 + 리딩 ---------------------------- */
  const showSkip = !reading.isComplete && reading.reading.length > 0;
  const summaryText = reading.meta.one_line_summary || `${name}님을 기다리는 가장 다정한 전환점`;
  const tags = reading.meta.hashtags?.length ? reading.meta.hashtags : ['#오늘의타로', '#마음의소리', '#작은위로'];

  return (
    <div ref={topRef} className="px-5 pt-8 pb-32 animate-fade-in-up">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-brand-500">{cat.label} 상담</p>
          <h1 className="mt-0.5 text-[22px] font-extrabold text-ink leading-tight break-keep">
            {allFlipped ? '카드가 모두 열렸어요' : '카드를 눌러 뒤집어 보세요'}
          </h1>
        </div>
        {!allFlipped && (
          <button
            type="button"
            onClick={() => setFlipped([true, true, true])}
            className="btn-soft shrink-0 text-[13px] px-3.5 py-2 rounded-full cursor-pointer"
          >
            모두 뒤집기
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 items-start">
        {reading.cards.map((card, i) => (
          <div key={card.id ?? i} className="min-w-0 flex flex-col items-center">
            <span className="mb-2 text-[12px] font-extrabold text-brand-600 bg-brand-50 rounded-full px-3 py-1">{card.position}</span>
            <CardFlip card={card} flipped={flipped[i]} onFlip={() => flip(i)} delay={i * 0.4} label={card.position} />
            <p className="mt-2.5 text-[13px] font-bold text-ink text-center break-keep min-h-[2.4rem]">
              {flipped[i] ? getKoName(card) : <span className="text-mute font-medium">눌러서 열기</span>}
            </p>
          </div>
        ))}
      </div>

      {allFlipped && (
        <div ref={readingRef} className="mt-6 scroll-mt-4 animate-fade-in-up">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[19px] font-extrabold text-ink">{name}님을 위한 리딩</h2>
            {!reading.isComplete && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-brand-500 animate-pulse">작성 중…</span>
                {showSkip && (
                  <button
                    type="button"
                    onClick={reading.skip}
                    className="btn-soft text-[12px] px-2.5 py-1.5 rounded-full flex items-center gap-1 cursor-pointer"
                  >
                    <FastForward className="w-3 h-3" aria-hidden="true" /> 건너뛰기
                  </button>
                )}
              </div>
            )}
          </div>

          <ReadingView
            reading={reading.reading}
            isComplete={reading.isComplete}
            cards={reading.cards}
            footer={
              reading.isComplete && reading.locked && reading.readingId ? (
                <LockedSection
                  readingId={reading.readingId}
                  titles={reading.locked.titles}
                  cost={reading.locked.cost}
                  onUnlocked={handleUnlocked}
                />
              ) : null
            }
          />

          {reading.isComplete && (
            <div className="mt-5 animate-fade-in-up">
              <div className="rounded-[28px] bg-gradient-to-br from-[#ece4ff] to-[#ffe4ef] px-5 py-6 text-center mb-4">
                <p className="text-[11px] font-extrabold tracking-[0.25em] text-brand-500">TODAY&apos;S MESSAGE</p>
                <p className="mt-2 text-[20px] font-extrabold leading-snug text-ink break-keep">“{summaryText}”</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                  {tags.map((t, i) => (
                    <span key={i} className="text-[12px] font-semibold text-brand-700 bg-white/80 rounded-full px-3 py-1">
                      {t.startsWith('#') ? t : `#${t}`}
                    </span>
                  ))}
                </div>
              </div>

              {!reading.locked && (
                <ReadingExtras
                  readingId={reading.readingId}
                  advice={advice}
                  followups={followups}
                  onAdvice={(a) => {
                    setAdvice(a);
                    persist({ advice: a });
                  }}
                  onFollowups={(list) => {
                    setFollowups(list);
                    persist({ followups: list });
                  }}
                />
              )}

              <div className="mt-4" />
              {!CRISIS_SHOWN.test(reading.reading) && (
                <ShareActions name={name} cards={reading.cards} summary={reading.meta.one_line_summary} hashtags={reading.meta.hashtags} />
              )}

              <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                <button type="button" onClick={onGoHistory} className="btn-soft py-3.5 rounded-2xl text-[14px] cursor-pointer">
                  기록 보기
                </button>
                <button type="button" onClick={restart} className="btn-soft py-3.5 rounded-2xl text-[14px] flex items-center justify-center gap-1.5 cursor-pointer">
                  <RefreshCw className="w-4 h-4" aria-hidden="true" /> 다시 상담하기
                </button>
              </div>
              <p className="mt-5 text-center text-[12px] text-mute leading-relaxed break-keep">
                타로는 재미와 위로를 위한 콘텐츠예요. 중요한 결정은 신중하게 내려 주세요.
              </p>
            </div>
          )}
        </div>
      )}

      {!allFlipped && (
        <button type="button" onClick={restart} className="mx-auto mt-8 flex items-center gap-1.5 text-[13px] font-semibold text-mute cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> 처음부터 다시
        </button>
      )}
    </div>
  );
}
