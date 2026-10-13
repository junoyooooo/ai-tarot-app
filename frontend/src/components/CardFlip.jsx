import React from 'react';
import { getKoName } from '../tarotData';

/** 뒤집을 수 있는 타로 카드 한 장. 비율은 카드 이미지(768×1376)와 같습니다. */
export default function CardFlip({ card, flipped, onFlip, delay = 0, label }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={flipped ? `${getKoName(card)} 카드` : `${label || ''} 카드 뒤집기`}
      onClick={() => !flipped && onFlip?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!flipped) onFlip?.();
        }
      }}
      className="w-full aspect-[768/1376] perspective-1200 cursor-pointer rounded-[14px] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
    >
      <div
        className={`w-full h-full relative card-3d-inner transform-style-3d ${flipped ? 'flipped' : 'card-float'}`}
        style={flipped ? undefined : { animationDelay: `${delay}s` }}
      >
        <div className="absolute inset-0 backface-hidden rounded-[14px] overflow-hidden shadow-card bg-[#0d0c1d]">
          <img src="/tarot/card_back.webp" alt="" className="w-full h-full object-cover" draggable={false} />
        </div>
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[14px] overflow-hidden shadow-card bg-[#0d0c1d]">
          {card.image_url ? (
            <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" draggable={false} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">{card.image_symbol || '🔮'}</div>
          )}
        </div>
      </div>
    </div>
  );
}
