import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Mascot from '../components/Mascot';
import { validateBirthdate } from '../lib/storage';

// 시작 화면 하단에 모여 있는 마스코트 (id, 위치/크기/회전)
const CLUSTER = [
  { id: 4, left: '2%', bottom: '2%', w: 88, r: -6 },
  { id: 3, left: '22%', bottom: '10%', w: 92, r: 5 },
  { id: 10, left: '44%', bottom: '0%', w: 92, r: -4 },
  { id: 19, left: '66%', bottom: '8%', w: 96, r: 6 },
  { id: 6, left: '80%', bottom: '0%', w: 100, r: -5 },
  { id: 18, left: '12%', bottom: '26%', w: 76, r: 8 },
  { id: 1, left: '57%', bottom: '24%', w: 78, r: -7 },
];

function Dots({ step }) {
  return (
    <div className="flex justify-center gap-1.5" aria-hidden="true">
      {[1, 2].map((i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${step === i ? 'w-5 bg-brand-500' : 'w-1.5 bg-brand-200'}`} />
      ))}
    </div>
  );
}

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(1); // 0번 화면은 Welcome 타이틀이 대신해요
  const [form, setForm] = useState({ name: '', birthdate: '' });
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return setError('이름이나 별명을 입력해 주세요.');
    const birthError = validateBirthdate(form.birthdate);
    if (birthError) return setError(birthError);
    onDone({ name, birthdate: form.birthdate });
  };

  if (step === 0) {
    return (
      <div className="relative min-h-[100dvh] flex flex-col bg-gradient-to-b from-paper via-paper to-[#efe3ff]">
        <div className="px-7 pt-20">
          <p className="text-[13px] font-bold tracking-[0.3em] text-brand-500 animate-fade-in-up">AI TAROT</p>
          <h1 className="mt-3 text-[44px] leading-[1.1] font-extrabold tracking-tight text-ink animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            운명의
            <br />
            AI 타로
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-mute break-keep animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            세 장의 카드가 지금 마음에 걸린
            <br />
            이야기를 다정하게 들려줘요.
          </p>
        </div>

        <div className="relative flex-1 min-h-[300px]">
          {CLUSTER.map((m, i) => (
            <Mascot
              key={m.id}
              id={m.id}
              className="absolute animate-pop-in"
              style={{ left: m.left, bottom: m.bottom, width: m.w, transform: `rotate(${m.r}deg)`, animationDelay: `${0.15 + i * 0.07}s` }}
            />
          ))}
        </div>

        <div className="px-6 pb-8 pt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="btn-primary w-full py-4 rounded-2xl text-[16px] flex items-center justify-center gap-2 cursor-pointer"
          >
            시작하기 <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  if (step === 1 || step === 2) {
    const slides = {
      1: { mascot: 0, blob: 'bg-[#ffd9e8]', title: '카드 세 장이 이야기해 줘요', sub: '과거, 현재, 미래를 한 장씩 뽑아서 지금 마음에 걸린 고민을 함께 살펴봐요.' },
      2: { mascot: 17, blob: 'bg-[#d3e3ff]', title: '하루 한 장, 오늘의 카드', sub: '고민이 없는 날에도 오늘을 응원하는 카드 한 장을 뽑아 볼 수 있어요.' },
    }[step];
    return (
      <div className="min-h-[100dvh] flex flex-col px-7 pt-16 pb-8 animate-slide-in" key={step}>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className={`relative w-64 h-64 rounded-[46%_54%_52%_48%/55%_45%_55%_45%] ${slides.blob} flex items-center justify-center`}>
            <Mascot id={slides.mascot} bounce className="w-40 h-44" />
          </div>
          <h2 className="mt-10 text-[26px] leading-snug font-extrabold text-ink break-keep">{slides.title}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mute break-keep max-w-[300px]">{slides.sub}</p>
        </div>
        <Dots step={step} />
        <button
          type="button"
          onClick={() => setStep(step + 1)}
          className="btn-primary w-full mt-6 py-4 rounded-2xl text-[16px] cursor-pointer"
        >
          다음
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="min-h-[100dvh] flex flex-col px-7 pt-16 pb-8 animate-slide-in">
      <div className="flex-1">
        <Mascot id={14} bounce className="w-20 h-24" />
        <h2 className="mt-4 text-[28px] leading-tight font-extrabold text-ink">
          먼저 서로
          <br />
          인사해요
        </h2>
        <p className="mt-2 text-[14px] text-mute">부르실 이름과 생년월일을 알려 주세요.</p>

        <div className="mt-8 space-y-4">
          <div>
            <label htmlFor="ob-name" className="block text-[13px] font-semibold text-ink mb-1.5 pl-1">
              이름 (또는 별명)
            </label>
            <input
              id="ob-name"
              className="field"
              maxLength={20}
              autoComplete="off"
              placeholder="예: 하늘"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setError('');
              }}
            />
          </div>
          <div>
            <label htmlFor="ob-birth" className="block text-[13px] font-semibold text-ink mb-1.5 pl-1">
              생년월일 (8자리)
            </label>
            <input
              id="ob-birth"
              className="field"
              inputMode="numeric"
              maxLength={8}
              autoComplete="off"
              placeholder="예: 19980521"
              value={form.birthdate}
              onChange={(e) => {
                setForm({ ...form, birthdate: e.target.value.replace(/\D/g, '').slice(0, 8) });
                setError('');
              }}
            />
          </div>
          {error && (
            <p role="alert" className="text-[13px] text-[#c2255c] bg-[#ffe3ee] rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}
        </div>
      </div>

      <p className="text-[12px] text-mute leading-relaxed mb-4 text-center break-keep">
        입력한 내용은 이 기기에 저장돼요. 리딩을 만들 때만 AI 서버로 전달돼요.
      </p>
      <button type="submit" className="btn-primary w-full py-4 rounded-2xl text-[16px] cursor-pointer">
        시작할게요
      </button>
    </form>
  );
}
