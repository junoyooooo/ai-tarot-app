import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { askFollowup } from '../lib/api';

const SUGGESTIONS = ['그래서 오늘 당장 뭘 하면 좋을까요?', '제가 놓치고 있는 건 뭘까요?', '이 흐름이 좋아지려면 뭐가 필요할까요?'];

/** 카드에게 더 물어보기: 질문마다 코인 1개(paywall 켜짐 시), 상담당 최대 횟수 제한. */
export default function FollowUp({ readingId, items = [], onChange }) {
  const w = useWallet();
  const cost = w?.config?.costs?.followup ?? 1;
  const max = w?.config?.followup_max ?? 3;
  const paid = Boolean(w?.enabled);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = Math.max(0, max - items.length);

  const send = async (text) => {
    const question = text.trim();
    if (question.length < 2 || busy) return;
    setError('');
    if (paid && (w.coins ?? 0) < cost) {
      w.openShop();
      return;
    }
    setBusy(true);
    try {
      const r = await askFollowup(readingId, question);
      if (paid) w.applyWallet(r);
      onChange([...items, { q: question, a: r.answer }]);
      setQ('');
    } catch (e) {
      if (e.code === 'insufficient_coins') w.openShop();
      else if (e.code === 'followup_limit') setError('이 상담에서는 더 이상 물어볼 수 없어요.');
      else if (e.code === 'reading_not_found') setError('이 상담은 서버에서 찾을 수 없어요. 새로 상담하면 이용할 수 있어요.');
      else setError(e.message || '답을 만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[28px] bg-[#e6f4ff] p-5">
      <p className="text-[16px] font-extrabold text-ink">카드에게 더 물어보기</p>
      <p className="mt-1 text-[13px] text-ink/70 break-keep">
        풀이를 읽고 더 궁금한 게 있나요?{paid ? ` 질문 1개에 🪙 ${cost}개,` : ''} 이 상담에서 {left}번 더 물어볼 수 있어요.
      </p>

      {items.length > 0 && (
        <ul className="mt-3.5 space-y-3">
          {items.map((it, i) => (
            <li key={i} className="space-y-2">
              <p className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-[14px] text-ink break-keep">{it.q}</p>
              <p className="max-w-[94%] rounded-2xl rounded-bl-md bg-white/70 px-3.5 py-3 text-[14.5px] leading-[1.8] text-ink/90 break-keep whitespace-pre-line">{it.a}</p>
            </li>
          ))}
        </ul>
      )}

      {left > 0 && (
        <>
          {items.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => setQ(s)}
                  className="text-[12.5px] font-semibold text-brand-700 bg-white/80 rounded-full px-3 py-1.5 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(q);
            }}
          >
            <textarea
              rows={2}
              maxLength={200}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="카드에게 이어서 물어보세요"
              aria-label="이어서 물어볼 내용"
              className="field resize-none flex-1 !py-2.5 text-[14px]"
            />
            <button
              type="submit"
              disabled={busy || q.trim().length < 2}
              aria-label="질문 보내기"
              className="btn-primary h-11 w-11 shrink-0 rounded-full flex items-center justify-center cursor-pointer"
            >
              {busy ? <span className="text-[11px]">…</span> : <Send className="w-4 h-4" aria-hidden="true" />}
            </button>
          </form>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[#c2255c] bg-white/80 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
    </section>
  );
}
