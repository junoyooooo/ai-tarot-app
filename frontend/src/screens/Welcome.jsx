import React, { useMemo } from 'react';
import Mascot from '../components/Mascot';
import GoogleButton from '../components/GoogleButton';
import { startKakaoLogin } from '../lib/auth';

// 타이틀 화면에 모여 있는 운명이들
const CAST = [
  { id: 4, left: '1%', bottom: '3%', w: 84, r: -6 },
  { id: 3, left: '20%', bottom: '11%', w: 90, r: 5 },
  { id: 10, left: '41%', bottom: '0%', w: 96, r: -3 },
  { id: 19, left: '63%', bottom: '9%', w: 92, r: 6 },
  { id: 6, left: '80%', bottom: '1%', w: 98, r: -5 },
];

/** 게임 타이틀 같은 첫 화면: 별이 반짝이는 밤하늘 + 운명이들 + 로그인/시작 버튼 */
export default function Welcome({ auth, onStart }) {
  const stars = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({
      left: `${(i * 37 + 11) % 100}%`,
      top: `${(i * 53 + 7) % 62}%`,
      size: 2 + ((i * 7) % 4),
      delay: `${((i * 13) % 30) / 10}s`,
    })),
    [],
  );
  const kakao = auth?.kakao;
  const google = auth?.google;
  const hasLogin = kakao?.enabled || google?.enabled;

  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden text-white" style={{ background: 'linear-gradient(180deg,#1b1446 0%,#3a2a7a 55%,#6a4bb0 100%)' }}>
      {stars.map((s, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute rounded-full bg-white welcome-twinkle"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}

      <div className="relative px-7 pt-[12vh] text-center">
        <p className="text-[13px] font-bold tracking-[0.35em] text-[#ffd98a] animate-fade-in-up">✦ 별빛 타로 ✦</p>
        <h1 className="mt-3 text-[40px] leading-[1.12] font-extrabold tracking-tight animate-fade-in-up" style={{ animationDelay: '0.05s', textShadow: '0 4px 24px rgba(255,217,138,.45)' }}>
          토닥토닥
          <br />
          별빛타로
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/80 break-keep animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          운명이들이 마음을 토닥여 줄게요
        </p>
      </div>

      <div className="relative flex-1 min-h-[240px]">
        {CAST.map((m, i) => (
          <Mascot
            key={m.id}
            id={m.id}
            className="absolute animate-pop-in"
            style={{ left: m.left, bottom: m.bottom, width: m.w, transform: `rotate(${m.r}deg)`, animationDelay: `${0.15 + i * 0.08}s` }}
          />
        ))}
      </div>

      <div className="relative px-6 pb-8 pt-3 bg-gradient-to-t from-[#3a2a7a]/70 to-transparent">
        <button
          type="button"
          onClick={onStart}
          className="welcome-start w-full py-4 rounded-2xl text-[17px] font-extrabold text-[#3b2a00] cursor-pointer"
        >
          ✨ 시작하기
        </button>
        {hasLogin && (
          <>
            <p className="mt-4 mb-2.5 text-center text-[12px] text-white/70 break-keep">로그인하면 코인·별가루·꾸미기가 다른 기기에서도 이어져요</p>
            <div className="space-y-2.5">
              {google?.enabled && <GoogleButton dark clientId={google.client_id} onDone={() => window.location.replace('/')} />}
              {kakao?.enabled && (
                <button
                  type="button"
                  onClick={() => startKakaoLogin(kakao.client_id)}
                  className="w-full rounded-full bg-[#FEE500] py-3 text-[14.5px] font-bold text-[#191919] cursor-pointer"
                >
                  카카오로 계속하기
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
