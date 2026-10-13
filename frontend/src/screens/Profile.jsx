import React, { useState } from 'react';
import Mascot from '../components/Mascot';
import { saveProfile, validateBirthdate, clearAll } from '../lib/storage';
import { cleanName } from '../tarotData';

export default function Profile({ profile, historyCount, onProfileChange, onCleared }) {
  const [form, setForm] = useState({ name: profile.name, birthdate: profile.birthdate });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const dirty = form.name.trim() !== profile.name || form.birthdate !== profile.birthdate;

  const submit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return setError('이름이나 별명을 입력해 주세요.');
    const birthError = validateBirthdate(form.birthdate);
    if (birthError) return setError(birthError);
    const next = { name, birthdate: form.birthdate };
    saveProfile(next);
    onProfileChange(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="px-5 pt-8 pb-32 animate-fade-in-up">
      <h1 className="text-[26px] font-extrabold tracking-tight text-ink">내 정보</h1>

      <div className="mt-5 flex flex-col items-center rounded-[28px] bg-gradient-to-br from-[#ece4ff] to-[#d6e7ff] py-7">
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-soft">
          <Mascot id={0} className="w-16 h-[72px]" />
        </div>
        <p className="mt-3 text-[20px] font-extrabold text-ink">{cleanName(profile.name)}님</p>
        <p className="mt-0.5 text-[13px] text-mute">지금까지 {historyCount}번 상담했어요</p>
      </div>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <div>
          <label htmlFor="pf-name" className="block text-[13px] font-semibold text-ink mb-1.5 pl-1">
            이름 (또는 별명)
          </label>
          <input
            id="pf-name"
            className="field"
            maxLength={20}
            autoComplete="off"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setError('');
            }}
          />
        </div>
        <div>
          <label htmlFor="pf-birth" className="block text-[13px] font-semibold text-ink mb-1.5 pl-1">
            생년월일 (8자리)
          </label>
          <input
            id="pf-birth"
            className="field"
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
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
        <button type="submit" disabled={!dirty} className="btn-primary w-full py-3.5 rounded-2xl text-[15px] cursor-pointer">
          {saved ? '저장했어요 ✓' : '저장하기'}
        </button>
      </form>

      <div className="mt-8 rounded-[24px] bg-brand-50 px-5 py-4">
        <p className="text-[14px] font-bold text-ink">데이터 안내</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-mute break-keep">
          프로필과 상담 기록은 이 기기의 브라우저에만 저장돼요. 리딩을 만들 때 이름, 생년월일, 고민 내용이 AI 서버로 전달돼요. 브라우저 데이터를 지우면 기록도 사라져요.
        </p>
      </div>

      <div className="mt-6 text-center">
        {confirmClear ? (
          <div className="inline-flex flex-wrap items-center justify-center gap-2">
            <span className="text-[13px] text-mute">프로필과 기록을 모두 지울까요?</span>
            <button
              type="button"
              onClick={() => {
                clearAll();
                onCleared();
              }}
              className="text-[13px] font-bold text-[#c2255c] bg-[#ffe3ee] rounded-full px-3.5 py-1.5 cursor-pointer"
            >
              모두 삭제
            </button>
            <button type="button" onClick={() => setConfirmClear(false)} className="text-[13px] font-semibold text-mute px-2 py-1.5 cursor-pointer">
              취소
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmClear(true)} className="text-[13px] font-semibold text-mute cursor-pointer">
            내 데이터 모두 삭제
          </button>
        )}
      </div>

      <p className="mt-8 text-center text-[12px] text-mute leading-relaxed break-keep">
        타로는 재미와 위로를 위한 콘텐츠예요.
        <br />
        중요한 결정은 신중하게 내려 주세요.
      </p>
    </div>
  );
}
