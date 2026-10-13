import React, { useEffect, useRef, useState } from 'react';
import { playSfx } from '../lib/sound';

const COUNT = 13; // 펼쳐 둘 카드 수
const PICK = 3;
const MAX_ANGLE = 32;
const CARD_W = 72;
const CARD_H = Math.round((CARD_W * 1376) / 768);

/**
 * 카드를 부채꼴로 펼쳐 놓고 마음이 가는 3장을 고르는 화면.
 * 어떤 카드가 나올지는 서버가 정하고, 여기서는 '고르는 의식'과 순서만 정한다.
 */
export default function CardPicker({ slots, onComplete }) {
  const [phase, setPhase] = useState('shuffle'); // shuffle → spread
  const [picked, setPicked] = useState([]);
  const doneRef = useRef(false);

  useEffect(() => {
    playSfx('shuffle');
    const t = setTimeout(() => setPhase('spread'), 1000);
    return () => clearTimeout(t);
  }, []);

  const complete = picked.length === PICK;
  useEffect(() => {
    if (!complete || doneRef.current) return undefined;
    doneRef.current = true;
    const t = setTimeout(() => onComplete(picked), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const toggle = (i) => {
    if (phase !== 'spread' || complete) return;
    if (picked.includes(i)) {
      playSfx('unpick');
      setPicked(picked.filter((x) => x !== i));
    } else {
      playSfx('pick');
      setPicked([...picked, i]);
    }
  };

  const spread = phase === 'spread';
  const step = (MAX_ANGLE * 2) / (COUNT - 1);

  return (
    <div className="px-5 pt-10 pb-32 animate-fade-in-up">
      <p className="text-[12px] font-bold text-brand-500">카드 고르기</p>
      <h1 className="mt-1 text-[24px] font-extrabold leading-tight text-ink break-keep">
        {complete ? '좋아요, 이 카드들이에요' : spread ? '마음이 가는 카드 3장을 골라 보세요' : '카드를 섞고 있어요…'}
      </h1>
      <p className="mt-1.5 text-[13px] text-mute min-h-[1.25rem]" aria-live="polite">
        {spread && !complete ? `${picked.length} / ${PICK}장 · 다시 누르면 취소돼요` : ''}
      </p>

      {/* 고른 카드가 들어갈 자리 */}
      <ol className="mt-6 grid grid-cols-3 gap-3" aria-label="고른 카드 자리">
        {slots.map((label, i) => {
          const filled = i < picked.length;
          return (
            <li key={label} className="flex flex-col items-center">
              <span className="mb-2 text-[12px] font-extrabold text-brand-600 bg-brand-50 rounded-full px-3 py-1 break-keep text-center">{label}</span>
              <div
                className={`w-full aspect-[768/1376] rounded-[12px] border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                  filled ? 'border-transparent' : 'border-brand-200 bg-brand-50/60'
                }`}
              >
                {filled ? (
                  <img key={picked[i]} src="/tarot/card_back.webp" alt="" className="w-full h-full object-cover rounded-[12px] shadow-card animate-pop-in" draggable={false} />
                ) : (
                  <span className="text-[18px] font-extrabold text-brand-300" aria-hidden="true">
                    {i + 1}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* 부채꼴 카드 */}
      <div
        className={`relative mx-auto mt-10 ${phase === 'shuffle' ? 'deck-shake' : ''}`}
        style={{ width: '100%', height: CARD_H + 70 }}
        role="group"
        aria-label="펼쳐진 카드"
      >
        {Array.from({ length: COUNT }, (_, i) => {
          const angle = spread ? -MAX_ANGLE + step * i : (i - COUNT / 2) * 0.35;
          const order = picked.indexOf(i);
          const isPicked = order !== -1;
          const lift = isPicked ? 26 : 0;
          return (
            <button
              key={i}
              type="button"
              data-sfx="none"
              aria-label={isPicked ? `${i + 1}번 카드, ${order + 1}번째로 선택됨` : `${i + 1}번 카드`}
              aria-pressed={isPicked}
              disabled={!spread || (complete && !isPicked)}
              onClick={() => toggle(i)}
              className="absolute cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 rounded-[10px]"
              style={{
                width: CARD_W,
                height: CARD_H,
                left: `calc(50% - ${CARD_W / 2}px)`,
                bottom: 24,
                transformOrigin: `50% ${CARD_H + 100}px`,
                transform: `rotate(${angle}deg) translateY(${-lift}px)`,
                transition: `transform ${spread ? 0.7 : 0.25}s cubic-bezier(0.2, 0.9, 0.3, 1.1) ${spread ? i * 0.025 : 0}s, opacity 0.3s`,
                opacity: complete && !isPicked ? 0.35 : 1,
                zIndex: isPicked ? 40 : i,
              }}
            >
              <img src="/tarot/card_back.webp" alt="" draggable={false} className="w-full h-full object-cover rounded-[10px] shadow-card" />
              {isPicked && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-brand-500 text-white text-[12px] font-extrabold flex items-center justify-center animate-pop-in shadow">
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
