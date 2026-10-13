import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { unlockReading } from '../lib/api';

/** 세 번째 카드 풀이와 마스터의 한마디가 잠겨 있을 때 보이는 영역. 잠긴 글은 서버가 아직 보내지 않았다. */
export default function LockedSection({ readingId, titles = [], cost = 1, onUnlocked }) {
  const w = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const unlock = async () => {
    setError('');
    if ((w.coins ?? 0) < cost) {
      w.openShop();
      return;
    }
    setBusy(true);
    try {
      const r = await unlockReading(readingId);
      w.applyWallet(r);
      onUnlocked(r.text);
    } catch (e) {
      if (e.code === 'insufficient_coins') {
        w.refresh();
        w.openShop();
      } else if (e.code === 'reading_not_found') {
        setError('이 상담은 서버에서 찾을 수 없어요. 새로 상담하면 다시 볼 수 있어요.');
      } else {
        setError(e.message || '열지 못했어요. 코인은 차감되지 않았어요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const shown = titles.length ? titles : ['마지막 카드의 이야기', '마스터의 한마디'];
  const enough = (w.coins ?? 0) >= cost;

  return (
    <section className="relative rounded-[28px] bg-gradient-to-br from-[#ece4ff] to-[#ffe4ef] p-5 overflow-hidden animate-fade-in-up">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-brand-600">
          <Lock className="w-4 h-4" aria-hidden="true" />
        </span>
        <p className="text-[16px] font-extrabold text-ink break-keep">아직 펼치지 않은 이야기가 있어요</p>
      </div>

      <ul className="mt-3 space-y-2" aria-label="잠긴 내용">
        {shown.map((t, i) => (
          <li key={i} className="rounded-2xl bg-white/70 px-4 py-3">
            <p className="text-[14px] font-bold text-ink break-keep">{t}</p>
            <div className="mt-2 space-y-1.5" aria-hidden="true">
              <div className="h-2 rounded-full bg-brand-200/60 w-full" />
              <div className="h-2 rounded-full bg-brand-200/60 w-4/5" />
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={unlock}
        disabled={busy || !w.enabled}
        className="btn-primary w-full mt-4 py-3.5 rounded-2xl text-[15px] cursor-pointer flex items-center justify-center gap-1.5"
      >
        {busy ? '여는 중…' : enough ? <>🪙 코인 {cost}개로 이어서 보기</> : <>코인 충전하고 이어서 보기</>}
      </button>
      <p className="mt-2 text-center text-[12px] text-ink/60">
        보유 코인 🪙 {w.coins ?? 0}
        {w.firstPurchase && !enough ? ' · 첫 구매는 990원에 코인 2개' : ''}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[#c2255c] bg-white/80 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
    </section>
  );
}
