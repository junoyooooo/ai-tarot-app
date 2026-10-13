import React from 'react';
import { useWallet } from '../hooks/useWallet';

export default function CoinChip({ className = '' }) {
  const w = useWallet();
  if (!w?.enabled) return null;
  return (
    <button
      type="button"
      onClick={w.openShop}
      aria-label={`보유 코인 ${w.coins ?? 0}개, 충전하기`}
      className={`inline-flex items-center gap-1.5 rounded-full bg-gold-200/70 text-[#7a5a14] font-extrabold text-[13px] pl-2.5 pr-3 py-1.5 cursor-pointer active:scale-95 transition-transform ${className}`}
    >
      <span aria-hidden="true">🪙</span>
      {w.coins ?? '–'}
    </button>
  );
}
