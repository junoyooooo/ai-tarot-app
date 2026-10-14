import { useCallback, useEffect, useRef, useState } from 'react';
import { pickThreeCards, generateLocalReading } from '../tarotData';
import { API_BASE, deviceHeaders } from '../lib/api';
import { CATEGORIES } from '../lib/categories';

export { API_BASE };
const FIRST_BYTE_TIMEOUT_MS = 20000; // 서버가 첫 응답을 줄 때까지 기다리는 시간
const IDLE_TIMEOUT_MS = 25000; // 응답이 시작된 뒤 데이터가 끊긴 채로 기다리는 최대 시간
const MIN_USABLE_CHARS = 200; // 이보다 적게 받고 끊기면 자체 해석 엔진으로 대체

export const LOADING_TEXTS = [
  '카드를 섞는 중이에요…',
  '적어 주신 이야기를 읽고 있어요…',
  '카드가 건넬 말을 고르고 있어요…',
  '거의 다 됐어요…',
];

/**
 * 카드 뽑기 + 스트리밍 리딩 + 글자 출력 엔진을 한곳에 모은 훅.
 * 서버가 느리거나 실패하면 tarotData.js 의 자체 해석 엔진으로 자동 전환합니다.
 */
export default function useReading() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(LOADING_TEXTS[0]);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [cards, setCards] = useState([]);
  const [reading, setReading] = useState('');
  const [meta, setMeta] = useState({ one_line_summary: '', hashtags: [] });
  const [isComplete, setIsComplete] = useState(false);
  const [readingId, setReadingId] = useState(null); // 서버가 저장한 리딩 ID (자체 해석 엔진으로 전환되면 null)
  const [limit, setLimit] = useState(null); // 하루 이용 한도에 닿았을 때 { scope, message }
  const [locked, setLocked] = useState(null); // { titles, cost } 잠긴 구간이 있을 때

  const pendingRef = useRef('');
  const drainTimerRef = useRef(null);
  const streamDoneRef = useRef(false);
  const skipRef = useRef(false);
  const receivedLenRef = useRef(0);
  const runIdRef = useRef(0);
  const abortRef = useRef(null);
  const pausedRef = useRef(false); // 카드를 고르는 동안 글자 출력을 잠시 멈춘다

  /* 서버 미리 깨우기 (무료 호스팅은 잠들어 있는 경우가 많음) */
  useEffect(() => {
    let first = false;
    try {
      first = !sessionStorage.getItem('visit_pinged');
      if (first) sessionStorage.setItem('visit_pinged', '1');
    } catch { /* 저장소를 못 쓰면 접속 신호만 건너뛰어요 */ }
    fetch(`${API_BASE}/health${first ? '?visit=1' : ''}`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  }, []);

  /* 로딩 문구 회전 + 오래 걸릴 때 안내 */
  useEffect(() => {
    if (!isLoading) {
      setLoadingSlow(false);
      return undefined;
    }
    let i = 0;
    setLoadingText(LOADING_TEXTS[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, LOADING_TEXTS.length - 1);
      setLoadingText(LOADING_TEXTS[i]);
    }, 2200);
    const slowTimer = setTimeout(() => setLoadingSlow(true), 8000);
    return () => {
      clearInterval(interval);
      clearTimeout(slowTimer);
    };
  }, [isLoading]);

  useEffect(
    () => () => {
      if (drainTimerRef.current) clearInterval(drainTimerRef.current);
      abortRef.current?.abort();
    },
    []
  );

  /* ---------------- 글자 출력 엔진 ---------------- */
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
      if (pausedRef.current) {
        last = now;
        return;
      }
      const dt = now - last; // 탭이 백그라운드여서 타이머가 늦어져도 경과 시간만큼 보정
      last = now;
      const pending = pendingRef.current;

      if (!pending) {
        if (streamDoneRef.current) {
          stopDrain();
          setIsComplete(true);
        }
        return;
      }

      let n;
      if (skipRef.current) {
        n = pending.length;
      } else {
        const cps = Math.min(300, 90 + pending.length * 0.1);
        n = Math.max(1, Math.round((dt / 1000) * cps));
      }
      let chunk = pending.slice(0, n);
      const lastCode = chunk.charCodeAt(chunk.length - 1);
      if (lastCode >= 0xd800 && lastCode <= 0xdbff && chunk.length < pending.length) {
        chunk = pending.slice(0, n + 1); // 이모지가 반쪽으로 잘리지 않게
      }
      pendingRef.current = pending.slice(chunk.length);
      setReading((prev) => prev + chunk);
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
    setReading('');
    setIsComplete(false);
    setMeta({ one_line_summary: '', hashtags: [] });
    setReadingId(null);
    setLocked(null);
    setLimit(null);
  };

  const skip = useCallback(() => {
    skipRef.current = true;
    startDrain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- 자체 해석 엔진 ---------------- */
  const runFallback = (payload, existingCards) => {
    const selected = existingCards && existingCards.length === 3 ? existingCards : pickThreeCards();
    const label = CATEGORIES.find((c) => c.key === payload.category)?.label;
    const concern = label ? `(${label} 고민) ${payload.concern}`.slice(0, 500) : payload.concern;
    const result = generateLocalReading(payload.name, payload.birthdate, concern, selected);
    resetReadingState();
    setCards(result.cards);
    setIsLoading(false);
    setMeta({ one_line_summary: result.one_line_summary, hashtags: result.hashtags });
    enqueueText(result.reading);
    markStreamDone();
  };

  /* ---------------- 시작 / 초기화 ---------------- */
  const start = async (payload, { hold = false } = {}) => {
    pausedRef.current = hold;
    const runId = ++runIdRef.current;
    abortRef.current?.abort();
    resetReadingState();
    setIsLoading(true);
    setCards([]);

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
        headers: { 'Content-Type': 'application/json', ...deviceHeaders() },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        // 하루 이용 한도: 안내를 보여 주고 끝낸다(자체 해석 엔진으로 우회하지 않는다)
        if (response.status === 429) {
          let detail = null;
          try {
            detail = (await response.json()).detail;
          } catch {
            /* 본문 없음 */
          }
          if (detail && detail.code === 'daily_limit') {
            clearTimeout(timeoutId);
            if (runId === runIdRef.current) {
              setLimit({ scope: detail.scope, message: detail.message });
              setIsLoading(false);
            }
            return;
          }
        }
        throw new Error(`서버 응답 오류 (${response.status})`);
      }
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
              // 서버가 준 이미지 경로 대신 프론트에 있는 카드 이미지를 항상 사용
              receivedCards = parsed.data.map((c) => ({ ...c, image_url: `/tarot/card_${c.id}.webp` }));
              setCards(receivedCards);
              setReadingId(parsed.reading_id || null);
              setIsLoading(false);
            } else if (parsed.type === 'content') {
              enqueueText(parsed.data);
            } else if (parsed.type === 'meta') {
              setMeta({
                one_line_summary: parsed.data.one_line_summary || '',
                hashtags: parsed.data.hashtags || [],
              });
            } else if (parsed.type === 'locked') {
              setLocked({ titles: parsed.data.titles || [], cost: parsed.data.cost || 1 });
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
        if (receivedLenRef.current >= MIN_USABLE_CHARS) markStreamDone();
        else throw new Error('스트림이 중간에 종료되었습니다.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (runId !== runIdRef.current) return;
      console.warn('서버 응답 문제로 자체 해석 엔진을 사용합니다:', err);
      if (receivedLenRef.current >= MIN_USABLE_CHARS) markStreamDone();
      else runFallback(payload, receivedCards);
    }
  };

  /* 잠금 해제로 받은 나머지 풀이를 이어 붙인다. (스트리밍이 끝난 뒤에만 호출됨) */
  const applyUnlock = useCallback((text) => {
    setReading((prev) => `${prev.trimEnd()}\n\n${text}`);
    setLocked(null);
  }, []);

  /* 카드를 다 고른 뒤 호출: 멈춰 둔 글자 출력을 시작한다 */
  const resume = useCallback(() => {
    pausedRef.current = false;
    startDrain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    pausedRef.current = false;
    runIdRef.current += 1;
    abortRef.current?.abort();
    resetReadingState();
    setCards([]);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isLoading, loadingText, loadingSlow, cards, reading, meta, isComplete, readingId, locked, limit, start, skip, reset, resume, applyUnlock };
}
