import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { requestAdviceCard } from '../lib/api';
import { getKoName } from '../tarotData';
import { playSfx } from '../lib/sound';

/** 조언 카드 한 장 더. 이미 뽑은 결과(advice)가 있으면 그대로 보여 준다. */
export default function AdviceCard({ readingId, advice, onDone }) {
  const w = useWallet();
  const cost = w?.config?.costs?.advice ?? 1;
  const paid = Boolean(w?.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const draw = async () => {
    setError('');
    if (paid && (w.coins ?? 0) < cost) {
      w.openShop();
      return;
    }
    setBusy(true);
    try {
      const r = await requestAdviceCard(readingId);
      if (paid) w.applyWallet(r);
      playSfx('reveal');
      onDone({ card: r.card, text: r.text });
    } catch (e) {
      if (e.code === 'insufficient_coins') w.openShop();
      else if (e.code === 'reading_not_found') setError('이 상담은 서버에서 찾을 수 없어요. 새로 상담하면 이용할 수 있어요.');
      else setError(e.message || '조언을 만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  if (advice) {
    return (
      <section className="rounded-[28px] bg-[#fff5d6] p-5 animate-fade-in-up">
        <span className="inline-block text-[12px] font-extrabold text-[#9a6b00] bg-white/80 rounded-full px-3 py-1">조언 카드</span>
        <div className="mt-3 flex gap-4 items-start">
          <div className="w-[84px] shrink-0 aspect-[768/1376] rounded-[12px] overflow-hidden shadow-card bg-[#0d0c1d]">
            <img src={`/tarot/card_${advice.card.id}.webp`} alt={advice.card.name} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[16px] font-extrabold text-ink break-keep">{getKoName(advice.card)}</h3>
            <p className="mt-2 text-[14.5px] leading-[1.85] text-ink/90 break-keep whitespace-pre-line">{advice.text}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] bg-[#fff5d6] p-5">
      <p className="text-[16px] font-extrabold text-ink">조언 카드 한 장 더</p>
      <p className="mt-1 text-[13px] text-ink/70 break-keep">풀이를 마친 뒤, 오늘 해볼 작은 행동을 새 카드 한 장에게 물어봐요.</p>
      <button
        type="button"
        onClick={draw}
        disabled={busy}
        className="btn-primary w-full mt-3.5 py-3.5 rounded-2xl text-[15px] cursor-pointer"
      >
        {busy ? '카드를 뽑는 중…' : paid ? `🪙 ${cost}개로 한 장 더 뽑기` : '한 장 더 뽑기'}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[#c2255c] bg-white/80 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
    </section>
  );
}
