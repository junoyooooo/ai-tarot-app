import React, { useMemo } from 'react';
import Mascot from './Mascot';
import { getCollection } from '../lib/collection';
import { TAROT_CARDS, getKoName } from '../tarotData';

/** 마스코트 도감: 카드를 만나면 해당 마스코트가 열려요. 항상 무료. */
export default function Collection({ refreshKey = 0 }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const col = useMemo(() => getCollection(), [refreshKey]);
  const total = TAROT_CARDS.length;
  const found = TAROT_CARDS.filter((c) => col[c.id]).length;

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-[19px] font-extrabold text-ink">운명이 도감</h2>
        <p className="text-[13px] font-bold text-brand-600">
          {found} / {total}
        </p>
      </div>
      <div className="h-2 rounded-full bg-brand-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={found} aria-label="도감 진행도">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(found / total) * 100}%` }} />
      </div>
      <ul className="mt-4 grid grid-cols-4 gap-2.5">
        {TAROT_CARDS.map((c) => {
          const seen = Boolean(col[c.id]);
          return (
            <li key={c.id} className={`rounded-[18px] px-1.5 pt-2 pb-2 text-center ${seen ? 'bg-brand-50' : 'bg-[#f2f0f8]'}`}>
              <div className="h-[58px] flex items-center justify-center">
                <Mascot id={c.id} className={`h-[54px] w-auto ${seen ? '' : 'brightness-0 opacity-15'}`} />
              </div>
              <p className={`mt-1 text-[11px] font-bold leading-tight break-keep min-h-[1.8rem] ${seen ? 'text-ink' : 'text-mute/70'}`}>
                {seen ? getKoName(c) : '???'}
              </p>
              {seen && col[c.id].count > 1 && <p className="text-[10px] text-mute">×{col[c.id].count}</p>}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12px] text-mute text-center">상담이나 오늘의 카드에서 만난 카드의 운명이가 열려요.</p>
    </section>
  );
}
