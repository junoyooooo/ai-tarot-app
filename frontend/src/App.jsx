import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Wand2, RefreshCw, Camera, Share2, Download, X, FastForward, Moon } from 'lucide-react';
import html2canvas from 'html2canvas';
import ReactMarkdown from 'react-markdown';
import { pickThreeCards, generateLocalReading, getKoName, cleanName } from './tarotData';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://ai-tarot-app-tznp.onrender.com';
const FIRST_BYTE_TIMEOUT_MS = 20000; // 서버가 첫 응답을 줄 때까지 기다리는 시간
const IDLE_TIMEOUT_MS = 25000; // 응답이 시작된 뒤 데이터가 끊긴 채로 기다리는 최대 시간
const MIN_USABLE_CHARS = 200; // 이보다 적게 받고 끊기면 자체 해석 엔진으로 대체
const CAPTURE_BG = '#0a0915';

const LOADING_TEXTS = [
  '카드를 섞는 중이에요…',
  '적어 주신 이야기를 읽고 있어요…',
  '카드가 건넬 말을 고르고 있어요…',
  '거의 다 됐어요…',
];

/* --------------------------------------------------------------------------
   입력 검증
   -------------------------------------------------------------------------- */
function validateForm({ name, birthdate, concern }) {
  if (!name) return '이름이나 별명을 입력해 주세요.';
  if (!/^\d{8}$/.test(birthdate)) return '생년월일은 숫자 8자리로 입력해 주세요. 예: 19980521';
  const y = Number(birthdate.slice(0, 4));
  const m = Number(birthdate.slice(4, 6));
  const d = Number(birthdate.slice(6, 8));
  const date = new Date(y, m - 1, d);
  if (y < 1900 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || date > new Date()) {
    return '올바른 생년월일을 입력해 주세요.';
  }
  if (concern.length < 2) return '고민을 한두 문장이라도 적어 주세요.';
  return '';
}

/* --------------------------------------------------------------------------
   글자가 한 자씩 나오는 동안 열린 채로 남는 **굵게** 표시를 임시로 정리
   (그대로 두면 `**공정함, 진` 처럼 별표가 화면에 보임)
   -------------------------------------------------------------------------- */
function closeOpenMarkdown(text) {
  let t = text;
  if (/(^|[^*])\*$/.test(t)) t = t.slice(0, -1); // 막 입력되는 별표 한 개
  const count = (t.match(/\*\*/g) || []).length;
  if (count % 2 === 0) return t;
  if (t.endsWith('**')) return t.slice(0, -2);
  return `${t}**`;
}

/* --------------------------------------------------------------------------
   리딩 본문 마크다운 스타일
   -------------------------------------------------------------------------- */
const markdownComponents = {
  h3: ({ node, ...props }) => (
    <h3
      className="font-serif text-lg sm:text-xl text-gold-300 mt-9 first:mt-0 mb-3 pb-2 border-b border-gold-400/20"
      {...props}
    />
  ),
  p: ({ node, ...props }) => <p className="text-slate-300 leading-[1.95] mb-4" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-gold-200" {...props} />,
  em: ({ node, ...props }) => <em className="text-slate-200" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-2 border-gold-400/50 pl-4 my-5 text-slate-400 [&>p]:mb-0 [&>p]:text-slate-400" {...props} />
  ),
  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-1 text-slate-300" {...props} />,
  li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
};

export default function App() {
  const [formData, setFormData] = useState({ name: '', birthdate: '', concern: '' });
  const [formError, setFormError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepText, setLoadingStepText] = useState(LOADING_TEXTS[0]);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([false, false, false]);
  const [aiReading, setAiReading] = useState('');
  const [shareMetadata, setShareMetadata] = useState({ one_line_summary: '', hashtags: [] });
  const [isCapturing, setIsCapturing] = useState(false);
  const [isStreamComplete, setIsStreamComplete] = useState(false);
  const [previewModalImg, setPreviewModalImg] = useState(null);
  const [submittedName, setSubmittedName] = useState('');

  const readingRef = useRef(null);
  const shareCardRef = useRef(null);

  // 글자 출력 엔진: 서버/자체 엔진 어느 쪽이든 받은 글을 큐에 쌓고 일정한 속도로 화면에 흘려 보냄
  const pendingRef = useRef('');
  const drainTimerRef = useRef(null);
  const streamDoneRef = useRef(false);
  const skipRef = useRef(false);
  const receivedLenRef = useRef(0);
  const runIdRef = useRef(0);
  const abortRef = useRef(null);

  /* ---------------- 서버 미리 깨우기 (무료 호스팅은 잠들어 있는 경우가 많음) ---------------- */
  useEffect(() => {
    fetch(`${API_BASE}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  }, []);

  /* ---------------- 로딩 문구 회전 + 오래 걸릴 때 안내 ---------------- */
  useEffect(() => {
    if (!isLoading) {
      setLoadingSlow(false);
      return undefined;
    }
    let i = 0;
    setLoadingStepText(LOADING_TEXTS[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, LOADING_TEXTS.length - 1);
      setLoadingStepText(LOADING_TEXTS[i]);
    }, 2200);
    const slowTimer = setTimeout(() => setLoadingSlow(true), 8000);
    return () => {
      clearInterval(interval);
      clearTimeout(slowTimer);
    };
  }, [isLoading]);

  /* ---------------- 3장이 모두 뒤집히면 리딩으로 스크롤 ---------------- */
  useEffect(() => {
    const allFlipped = flippedCards.length === 3 && flippedCards.every(Boolean);
    if (allFlipped && readingRef.current) {
      const t = setTimeout(() => {
        readingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [flippedCards]);

  /* ---------------- 언마운트 정리 ---------------- */
  useEffect(
    () => () => {
      if (drainTimerRef.current) clearInterval(drainTimerRef.current);
      abortRef.current?.abort();
    },
    []
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const next = name === 'birthdate' ? value.replace(/\D/g, '').slice(0, 8) : value;
    setFormData((prev) => ({ ...prev, [name]: next }));
    if (formError) setFormError('');
  };

  /* ==============================================================
     글자 출력 엔진
     ============================================================== */
  const stopDrain = () => {
    if (drainTimerRef.current) {
      clearInterval(drainTimerRef.current);
      drainTimerRef.current = null;
    }
  };

  const startDrain = () => {
    if (drainTimerRef.current) return;
    let last = Date.now();
    drainTimerRef.current = setInterval(() => {
      const now = Date.now();
      const dt = now - last; // 탭이 백그라운드여서 타이머가 늦어져도 경과 시간만큼 보정
      last = now;
      const pending = pendingRef.current;

      if (!pending) {
        if (streamDoneRef.current) {
          stopDrain();
          setIsStreamComplete(true);
        }
        return;
      }

      let n;
      if (skipRef.current) {
        n = pending.length;
      } else {
        const cps = Math.min(300, 90 + pending.length * 0.1); // 밀린 글이 많으면 조금 빠르게
        n = Math.max(1, Math.round((dt / 1000) * cps));
      }
      let chunk = pending.slice(0, n);
      const lastCode = chunk.charCodeAt(chunk.length - 1);
      if (lastCode >= 0xd800 && lastCode <= 0xdbff && chunk.length < pending.length) {
        chunk = pending.slice(0, n + 1); // 이모지가 반쪽으로 잘리지 않게
      }
      pendingRef.current = pending.slice(chunk.length);
      setAiReading((prev) => prev + chunk);
    }, 33);
  };

  const enqueueText = (text) => {
    if (!text) return;
    receivedLenRef.current += text.length;
    pendingRef.current += text;
    startDrain();
  };

  const markStreamDone = () => {
    streamDoneRef.current = true;
    startDrain();
  };

  const resetReadingState = () => {
    stopDrain();
    pendingRef.current = '';
    streamDoneRef.current = false;
    skipRef.current = false;
    receivedLenRef.current = 0;
    setAiReading('');
    setIsStreamComplete(false);
    setShareMetadata({ one_line_summary: '', hashtags: [] });
  };

  const skipTyping = () => {
    skipRef.current = true;
    startDrain();
  };

  /* ==============================================================
     자체 해석 엔진 (서버가 꺼져 있거나 지연될 때)
     ============================================================== */
  const runFallbackReading = (payload, existingCards) => {
    const selected = existingCards && existingCards.length === 3 ? existingCards : pickThreeCards();
    const result = generateLocalReading(payload.name, payload.birthdate, payload.concern, selected);
    resetReadingState();
    setCards(result.cards);
    setIsLoading(false);
    setShareMetadata({ one_line_summary: result.one_line_summary, hashtags: result.hashtags });
    enqueueText(result.reading);
    markStreamDone();
  };

  /* ==============================================================
     카드 뽑기 + 스트리밍 리딩
     ============================================================== */
  const handleDrawCards = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name.trim(),
      birthdate: formData.birthdate.trim(),
      concern: formData.concern.trim(),
    };
    const errorMessage = validateForm(payload);
    if (errorMessage) {
      setFormError(errorMessage);
      return;
    }
    setFormError('');

    // (유료화할 경우 이 지점에서 결제 확인 후 진행하세요.)

    const runId = ++runIdRef.current;
    abortRef.current?.abort();
    resetReadingState();
    setSubmittedName(cleanName(payload.name));
    setIsLoading(true);
    setCards([]);
    setFlippedCards([false, false, false]);

    const controller = new AbortController();
    abortRef.current = controller;
    let timeoutId = setTimeout(() => controller.abort(), FIRST_BYTE_TIMEOUT_MS);
    const rearm = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
    };

    let receivedCards = null;
    let finished = false;

    try {
      const response = await fetch(`${API_BASE}/api/tarot/reading/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`서버 응답 오류 (${response.status})`);
      rearm();

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (runId !== runIdRef.current) {
          reader.cancel().catch(() => {});
          return;
        }
        rearm();

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';

        for (const evt of events) {
          for (const line of evt.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue;
            const dataStr = line.replace(/^data:\s*/, '').trim();
            if (!dataStr) continue;

            let parsed;
            try {
              parsed = JSON.parse(dataStr);
            } catch (err) {
              console.error('SSE JSON 파싱 스킵:', err);
              continue;
            }

            if (parsed.type === 'cards') {
              receivedCards = parsed.data;
              setCards(parsed.data);
              setIsLoading(false);
            } else if (parsed.type === 'content') {
              enqueueText(parsed.data);
            } else if (parsed.type === 'meta') {
              setShareMetadata({
                one_line_summary: parsed.data.one_line_summary || '',
                hashtags: parsed.data.hashtags || [],
              });
            } else if (parsed.type === 'done') {
              finished = true;
              markStreamDone();
            } else if (parsed.type === 'error') {
              throw new Error(`스트리밍 오류: ${parsed.data}`);
            }
          }
        }
      }

      clearTimeout(timeoutId);
      if (!finished) {
        // done 없이 연결이 끝난 경우: 충분히 받았으면 그대로 마무리, 아니면 자체 엔진으로 대체
        if (receivedLenRef.current >= MIN_USABLE_CHARS) markStreamDone();
        else throw new Error('스트림이 중간에 종료되었습니다.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (runId !== runIdRef.current) return; // 사용자가 이미 '다시 하기'를 눌렀다면 무시
      console.warn('서버 응답 문제로 자체 해석 엔진을 사용합니다:', err);
      if (receivedLenRef.current >= MIN_USABLE_CHARS) {
        markStreamDone(); // 이미 충분히 받은 글은 그대로 보여 줌
      } else {
        runFallbackReading(payload, receivedCards);
      }
    }
  };

  const flipCard = (index) => {
    setFlippedCards((prev) => {
      const updated = [...prev];
      updated[index] = true;
      return updated;
    });
  };

  const flipAllCards = () => setFlippedCards([true, true, true]);

  const handleReset = () => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    resetReadingState();
    setCards([]);
    setFlippedCards([false, false, false]);
    setIsLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ==============================================================
     스토리 이미지 저장 / 공유
     ============================================================== */
  const captureStory = async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 200));
    return html2canvas(shareCardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: CAPTURE_BG,
      logging: false,
    });
  };

  const storyFileName = () => `AI타로_인스타스토리_${submittedName || '운명'}.png`;

  const saveCanvas = (canvas) => {
    const dataUrl = canvas.toDataURL('image/png');
    canvas.toBlob((blob) => {
      if (!blob) return;
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = storyFileName();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    }, 'image/png');
    // 모바일은 직접 저장이 막히는 경우가 있어 '꾹 눌러 저장' 안내 팝업도 함께 띄움
    setPreviewModalImg(dataUrl);
  };

  const handleDownloadStoryImage = async () => {
    if (!shareCardRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      saveCanvas(await captureStory());
    } catch (error) {
      console.error('스토리 이미지 캡처 실패:', error);
      alert('이미지 생성 중 문제가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleShareNative = async () => {
    if (!shareCardRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const canvas = await captureStory();
      if (navigator.share && navigator.canShare) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const file = new File([blob], storyFileName(), { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: `${submittedName || '내담자'}님의 AI 타로`,
                text: shareMetadata.one_line_summary || '오늘의 AI 타로 결과',
              });
              return;
            } catch (shareErr) {
              if (shareErr?.name === 'AbortError') return; // 사용자가 공유창을 닫음
              console.log('공유 실패, 저장으로 전환:', shareErr);
            }
          }
        }
      }
      // Web Share를 쓸 수 없는 환경은 저장으로 연결
      saveCanvas(canvas);
    } catch (error) {
      console.error('공유 이미지 생성 실패:', error);
      alert('이미지 생성 중 문제가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setIsCapturing(false);
    }
  };

  const allFlipped = flippedCards.length === 3 && flippedCards.every(Boolean);
  const showSkip = !isStreamComplete && aiReading.length > 0;
  const summaryText =
    shareMetadata.one_line_summary ||
    (submittedName ? `${submittedName}님을 기다리는 가장 다정한 전환점` : '당신의 마음이 가리키는 곳으로 걸어가세요.');
  const hashtagList =
    shareMetadata.hashtags && shareMetadata.hashtags.length > 0
      ? shareMetadata.hashtags
      : ['#오늘의타로', '#마음의소리', '#작은위로'];

  return (
    <div className="relative min-h-screen text-slate-200 font-sans">
      <div className="starfield" aria-hidden="true" />

      <div className="relative z-10 min-h-screen flex flex-col justify-between py-8 px-4 sm:px-6 md:py-12">
        <div className="max-w-md md:max-w-xl lg:max-w-3xl mx-auto w-full flex-1 flex flex-col items-center">
          {/* 헤더 */}
          <header className="w-full text-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-3 text-[11px] tracking-[0.35em] uppercase text-gold-300/80 mb-4">
              <span className="h-px w-8 bg-gold-400/40" />
              <span>AI Tarot Guide</span>
              <span className="h-px w-8 bg-gold-400/40" />
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl gold-text tracking-tight">운명의 AI 타로</h1>
            <p className="text-slate-400 text-sm mt-3">
              세 장의 카드가 지금 마음에 걸린 이야기를 들려줄 거예요.
            </p>
          </header>

          <main className="w-full flex-1 flex flex-col items-center">
            {/* 1. 입력 폼 */}
            {cards.length === 0 && !isLoading && (
              <div className="w-full max-w-xl glass rounded-3xl p-6 sm:p-8 animate-fade-in-up">
                <div className="mb-6">
                  <h2 className="font-serif text-xl sm:text-2xl text-gold-200 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-gold-400" aria-hidden="true" />
                    고민을 들려주세요
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                    적어 주신 내용으로 카드를 읽어 드려요.
                  </p>
                </div>

                <form onSubmit={handleDrawCards} className="space-y-4 sm:space-y-5" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">
                        이름 (또는 별명)
                      </label>
                      <input
                        id="name"
                        type="text"
                        name="name"
                        maxLength={20}
                        autoComplete="off"
                        placeholder="이름을 입력하세요"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="field"
                      />
                    </div>
                    <div>
                      <label htmlFor="birthdate" className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">
                        생년월일 (8자리)
                      </label>
                      <input
                        id="birthdate"
                        type="text"
                        name="birthdate"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={8}
                        placeholder="예: 19980521"
                        value={formData.birthdate}
                        onChange={handleInputChange}
                        className="field"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="concern" className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">
                      지금 마음에 품은 고민
                    </label>
                    <textarea
                      id="concern"
                      name="concern"
                      rows={4}
                      maxLength={500}
                      placeholder="어떤 고민이 있으신가요? 편하게 적어 주세요."
                      value={formData.concern}
                      onChange={handleInputChange}
                      className="field resize-none"
                    />
                    <p className="text-right text-[11px] text-slate-500 mt-1 pr-1">{formData.concern.length} / 500</p>
                  </div>

                  {formError && (
                    <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-xl px-4 py-2.5">
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn-gold w-full py-4 px-6 rounded-2xl text-base flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Wand2 className="w-5 h-5" aria-hidden="true" />
                    운명의 카드 3장 뽑기
                  </button>
                </form>
              </div>
            )}

            {/* 2. 로딩 */}
            {isLoading && (
              <div
                className="w-full max-w-xl glass rounded-3xl px-8 py-14 sm:py-16 flex flex-col items-center text-center my-auto animate-fade-in-up"
                role="status"
                aria-live="polite"
              >
                <div className="relative w-16 h-16 mb-7">
                  <div className="loader-ring absolute inset-0" />
                  <Moon className="absolute inset-0 m-auto w-6 h-6 text-gold-300" aria-hidden="true" />
                </div>
                <p className="font-serif text-lg text-gold-200">{loadingStepText}</p>
                <p className="text-xs text-slate-500 mt-2 min-h-[1rem]">
                  {loadingSlow ? '서버를 깨우는 중이라 처음에는 조금 더 걸릴 수 있어요.' : ''}
                </p>
              </div>
            )}

            {/* 3. 카드 + 리딩 */}
            {cards.length > 0 && (
              <div className="w-full flex flex-col items-center space-y-7">
                {/* 안내 바 */}
                <div className="w-full glass rounded-2xl px-4 py-3 flex flex-wrap gap-y-2 justify-between items-center">
                  <span className="text-xs sm:text-sm text-slate-300">
                    {allFlipped ? '카드가 모두 열렸어요' : '카드를 한 장씩 눌러 뒤집어 보세요'}
                  </span>
                  <div className="flex gap-2">
                    {!allFlipped && (
                      <button
                        onClick={flipAllCards}
                        className="btn-gold text-xs px-3.5 py-2 rounded-xl cursor-pointer"
                      >
                        모두 뒤집기
                      </button>
                    )}
                    <button
                      onClick={handleReset}
                      className="btn-ghost text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden="true" /> 다시 하기
                    </button>
                  </div>
                </div>

                {/* 카드 3장 (모바일에서도 한 줄에 3장) */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-6 w-full max-w-3xl items-start">
                  {cards.map((card, idx) => {
                    const isFlipped = flippedCards[idx];
                    return (
                      <div key={card.id ?? idx} className="flex flex-col items-center w-full min-w-0">
                        <span className="text-[11px] sm:text-xs font-semibold tracking-widest text-gold-300/90 mb-2.5">
                          {card.position}
                        </span>

                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={isFlipped ? `${getKoName(card)} 카드` : `${card.position} 카드 뒤집기`}
                          onClick={() => flipCard(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              flipCard(idx);
                            }
                          }}
                          className="w-full max-w-[240px] aspect-[768/1376] perspective-1200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 rounded-2xl"
                        >
                          <div
                            className={`w-full h-full relative card-3d-inner transform-style-3d rounded-2xl ${
                              isFlipped ? 'flipped burst-glow' : 'card-float hover:brightness-110'
                            }`}
                            style={isFlipped ? undefined : { animationDelay: `${idx * 0.5}s` }}
                          >
                            {/* 뒷면 */}
                            <div className="absolute inset-0 backface-hidden rounded-2xl overflow-hidden border border-gold-400/40 bg-night-900 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)]">
                              <img
                                src="/tarot/card_back.webp"
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-x-0 bottom-2.5 sm:bottom-3 flex justify-center">
                                <span className="text-[9px] sm:text-[11px] font-semibold text-gold-200 bg-night-950/75 px-2.5 sm:px-3.5 py-1 rounded-full border border-gold-400/30">
                                  터치하여 확인
                                </span>
                              </div>
                            </div>

                            {/* 앞면 */}
                            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl overflow-hidden border border-gold-300/60 bg-night-900 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)]">
                              {card.image_url ? (
                                <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-5xl">
                                  {card.image_symbol || '🔮'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 카드 설명 */}
                        <div className="w-full max-w-[240px] mt-3 text-center min-h-[2.5rem]">
                          {isFlipped ? (
                            <div className="animate-fade-in-up">
                              <h3 className="font-serif text-sm sm:text-base text-gold-200 leading-snug break-keep">
                                {getKoName(card)}
                              </h3>
                              <p className="hidden sm:block text-xs text-slate-400 mt-1.5 leading-relaxed break-keep">
                                {card.meaning}
                              </p>
                            </div>
                          ) : (
                            <span className="hidden sm:inline text-[11px] text-slate-500">카드를 눌러 의미를 열어 보세요</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 리딩 */}
                {allFlipped && (
                  <div
                    ref={readingRef}
                    className="w-full glass rounded-3xl p-6 sm:p-9 animate-fade-in-up scroll-mt-6"
                  >
                    <div className="flex items-center justify-between gap-3 pb-5 mb-6 border-b border-gold-400/15">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center">
                          <Moon className="w-5 h-5 text-gold-300" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-serif text-base sm:text-lg text-gold-200">타로 마스터의 리딩</h3>
                          <p className="text-xs text-slate-400 truncate">{submittedName}님을 위한 맞춤 리딩</p>
                        </div>
                      </div>
                      {!isStreamComplete && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gold-300/90 animate-pulse">작성 중…</span>
                          {showSkip && (
                            <button
                              onClick={skipTyping}
                              className="btn-ghost text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <FastForward className="w-3 h-3" aria-hidden="true" /> 건너뛰기
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-[15px] sm:text-base">
                      {aiReading ? (
                        <ReactMarkdown components={markdownComponents}>
                          {isStreamComplete ? aiReading : closeOpenMarkdown(aiReading)}
                        </ReactMarkdown>
                      ) : (
                        <div className="py-10 text-center text-slate-500 text-sm">답변을 준비하고 있어요…</div>
                      )}
                    </div>

                    {isStreamComplete && (
                      <div className="mt-8 animate-fade-in-up">
                        {/* 오늘의 한 줄 */}
                        <div className="rounded-2xl border border-gold-400/20 bg-gold-400/[0.05] px-5 py-5 text-center mb-6">
                          <p className="text-[11px] tracking-[0.3em] text-gold-300/80 uppercase mb-2">Today&apos;s Message</p>
                          <p className="font-serif text-lg sm:text-xl text-gold-100 leading-snug break-keep text-gold-200">
                            “{summaryText}”
                          </p>
                          <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                            {hashtagList.map((tag, i) => (
                              <span
                                key={i}
                                className="text-[11px] text-slate-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full"
                              >
                                {tag.startsWith('#') ? tag : `#${tag}`}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <button
                            onClick={handleDownloadStoryImage}
                            disabled={isCapturing}
                            className="btn-gold flex-1 py-3.5 px-5 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Camera className="w-4 h-4" aria-hidden="true" />
                            <span>{isCapturing ? '이미지 만드는 중…' : '스토리 이미지 저장'}</span>
                          </button>
                          <button
                            onClick={handleShareNative}
                            disabled={isCapturing}
                            className="btn-ghost py-3.5 px-5 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Share2 className="w-4 h-4" aria-hidden="true" />
                            <span>바로 공유</span>
                          </button>
                          <button
                            onClick={handleReset}
                            className="btn-ghost py-3.5 px-5 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" aria-hidden="true" />
                            <span>다시 점치기</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        <footer className="text-center text-[11px] text-slate-500 mt-10 leading-relaxed">
          타로는 재미와 위로를 위한 콘텐츠예요. 중요한 결정은 신중하게 내려 주세요.
          <br />© 2026 AI Tarot
        </footer>
      </div>

      {/* 저장 안내 모달 */}
      {previewModalImg && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="스토리 이미지"
        >
          <div className="relative w-full max-w-sm glass rounded-3xl p-5 shadow-2xl flex flex-col items-center max-h-[92vh] overflow-y-auto bg-night-900">
            <div className="w-full flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5 text-gold-300 font-semibold text-xs">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>스토리 이미지가 완성됐어요</span>
              </div>
              <button
                onClick={() => setPreviewModalImg(null)}
                aria-label="닫기"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full rounded-2xl border border-gold-400/25 bg-night-950/60 text-slate-300 p-3 text-center text-xs leading-relaxed mb-3">
              <p className="font-semibold text-gold-200 mb-0.5">📱 휴대폰에서 저장하려면</p>
              <p className="text-[11px] text-slate-400">
                아래 이미지를 <strong className="text-gold-200">1초간 꾹 누른 뒤</strong> [사진에 저장]을 선택하세요.
              </p>
            </div>

            <div className="w-full rounded-2xl overflow-hidden border border-gold-400/25 mb-4 bg-night-950 flex justify-center">
              <img src={previewModalImg} alt="AI 타로 인스타 스토리" className="w-full max-h-[50vh] object-contain select-auto" />
            </div>

            <div className="w-full grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewModalImg;
                  link.download = storyFileName();
                  link.click();
                }}
                className="btn-ghost py-3 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>파일로 받기</span>
              </button>
              <button
                onClick={() => {
                  setPreviewModalImg(null);
                  handleShareNative();
                }}
                className="btn-gold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                <span>SNS로 보내기</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          인스타 스토리용 9:16 캡처 뷰 (화면 밖에서 렌더링)
          html2canvas는 blur 필터를 지원하지 않아서 그라데이션만 사용합니다.
          ============================================================== */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <div
          ref={shareCardRef}
          id="share-card-view"
          style={{
            width: '450px',
            height: '800px',
            backgroundImage:
              'radial-gradient(ellipse 90% 45% at 50% -5%, rgba(124,92,230,0.45), rgba(124,92,230,0) 70%), radial-gradient(ellipse 70% 35% at 100% 100%, rgba(224,185,90,0.16), rgba(224,185,90,0) 70%), linear-gradient(170deg, #1a1442 0%, #0d0b22 55%, #07070f 100%)',
          }}
          className="relative p-9 flex flex-col justify-between overflow-hidden text-slate-100 font-sans"
        >
          {/* 별 */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 160px 60px, rgba(236,210,139,0.8), transparent), radial-gradient(1px 1px at 90px 120px, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 210px 180px, rgba(255,255,255,0.6), transparent)',
              backgroundSize: '240px 240px',
            }}
          />
          {/* 금빛 테두리 */}
          <div
            className="absolute rounded-[28px]"
            style={{ inset: '14px', border: '1px solid rgba(224,185,90,0.4)' }}
          />

          {/* 상단 */}
          <div className="relative z-10 text-center pt-3">
            <p className="text-[11px] tracking-[0.4em] text-gold-300/90 uppercase">✦ Cosmic Tarot ✦</p>
            <p className="font-serif text-[26px] mt-3 text-gold-200 leading-tight">
              {submittedName ? `${submittedName}님의 운명 신탁` : '당신을 위한 운명 신탁'}
            </p>
          </div>

          {/* 카드 부채꼴 */}
          <div className="relative z-10 w-full">
            <div className="relative w-full h-[300px] flex items-center justify-center">
              {cards.length === 3 &&
                [
                  { t: 'translateX(-62px) translateY(10px) rotate(-13deg)', z: 10 },
                  { t: 'translateY(-12px) rotate(0deg)', z: 20 },
                  { t: 'translateX(62px) translateY(10px) rotate(13deg)', z: 10 },
                ].map((pose, i) => (
                  <div
                    key={i}
                    className="absolute w-[150px] rounded-xl overflow-hidden"
                    style={{
                      aspectRatio: '768 / 1376',
                      transform: pose.t,
                      zIndex: pose.z,
                      border: '1px solid rgba(236,210,139,0.7)',
                      boxShadow: '0 18px 36px -10px rgba(0,0,0,0.8)',
                      background: '#0d0c1d',
                    }}
                  >
                    <img
                      src={cards[i].image_url}
                      alt={cards[i].name}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  </div>
                ))}
            </div>
            {cards.length === 3 && (
              <div className="grid grid-cols-3 text-center mt-2">
                {cards.map((card, i) => (
                  <div key={i}>
                    <p className="text-[10px] tracking-[0.25em] text-gold-300/80">{card.position}</p>
                    <p className="font-serif text-[15px] text-slate-100 mt-0.5">{getKoName(card)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 한 줄 메시지 */}
          <div
            className="relative z-10 w-full rounded-3xl p-5"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(236,210,139,0.28)' }}
          >
            <p className="text-[11px] tracking-[0.25em] text-gold-300/80 mb-2.5 uppercase">
              {submittedName ? `${submittedName}님을 위한 한마디` : "Today's Message"}
            </p>
            <p className="font-serif text-[19px] leading-snug text-gold-100 text-gold-200 break-keep mb-4">
              “{summaryText}”
            </p>
            <div className="flex flex-wrap gap-1.5">
              {hashtagList.map((tag, i) => (
                <span
                  key={i}
                  className="text-[11px] text-slate-200 px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}
                >
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          </div>

          {/* 하단 */}
          <div className="relative z-10 text-center pb-1">
            <p className="text-[12px] text-slate-300">내 카드도 뽑아 보기</p>
            <p className="text-[11px] text-gold-300/90 mt-0.5 tracking-wide">ai-tarot-app-tau.vercel.app</p>
          </div>
        </div>
      </div>
    </div>
  );
}
