import React from 'react';
import { ChevronRight } from 'lucide-react';

const DOTS = [1, 2, 3, 4, 5, 6, 7];

/** 홈의 연속 출석 카드: 연속 일수, 오늘 보상, 달 주기·주간 시즌 안내. */
export default function StreakCard({ ret, onStartConsult }) {
  if (!ret) return null;
  const { streak, checked_today: done, next_reward: reward, next_milestone: ms, lunar, season, stardust_enabled: dust } = ret;
  const filled = streak === 0 ? 0 : ((streak - 1) % 7) + 1;
  return (
    <div className="mt-3 rounded-[24px] bg-white shadow-soft px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-brand-600">연속 출석</p>
          <p className="mt-0.5 text-[18px] font-extrabold text-ink break-keep">
            {streak > 0 ? `🔥 ${streak}일째 이어가는 중` : '오늘 첫 카드를 뽑아 봐요'}
          </p>
        </div>
        {dust && (
          <span className="shrink-0 rounded-full bg-[#fff1c9] text-[#a8700b] text-[12px] font-bold px-3 py-1.5">
            {done ? '오늘 받았어요 ✓' : `오늘 ⭐ +${reward + (lunar ? lunar.bonus : 0)}${lunar ? ` · ${lunar.name} 보너스 포함` : ''}`}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1.5" aria-label={`이번 주 출석 ${filled}/7`}>
        {DOTS.map((d) => (
          <span key={d} className={`h-2 flex-1 rounded-full ${d <= filled ? 'bg-gradient-to-r from-[#b48cf2] to-[#ff8fb8]' : 'bg-brand-100'}`} />
        ))}
      </div>
      {ms && (
        <p className="mt-2 text-[12px] text-mute break-keep">
          {ms.day}일 연속까지 {ms.left}일 남았어요{dust ? ` · 보너스 ⭐ +${ms.bonus}` : ''}
        </p>
      )}
      <p className="mt-1 text-[11.5px] text-mute/80 break-keep">
        하루를 건너뛰면 1일부터 다시 시작해요{dust ? ' · ⭐ 별가루는 운명이 꾸미기와 코인 교환에 써요' : ''}
      </p>
      {(lunar || season) && (
        <div className="mt-3 rounded-2xl bg-brand-50 px-3.5 py-3">
          <p className="text-[12.5px] font-bold text-ink">
            {lunar ? `${lunar.emoji} 오늘은 ${lunar.name}` : `${season.emoji} ${season.name}`}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink/75 break-keep">{lunar ? lunar.line : season.line}</p>
          {!lunar && season?.category && (
            <button
              type="button"
              onClick={() => onStartConsult(season.category)}
              className="mt-2 inline-flex items-center gap-0.5 text-[12.5px] font-bold text-brand-700 cursor-pointer"
            >
              이번 주 상담 해보기 <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
