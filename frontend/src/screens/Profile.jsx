import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useLook } from '../lib/look';
import Collection from '../components/Collection';
import CoinChip from '../components/CoinChip';
import { useWallet } from '../hooks/useWallet';
import { getAccount, logoutAccount, startKakaoLogin } from '../lib/auth';
import GoogleButton from '../components/GoogleButton';
import { getSettings, setSetting, playSfx } from '../lib/sound';
import { saveProfile, validateBirthdate, clearAll } from '../lib/storage';
import { cleanName } from '../tarotData';

export default function Profile({ profile, historyCount, onProfileChange, onCleared, onOpenHelp, onOpenPlay }) {
  const look = useLook();
  const [form, setForm] = useState({ name: profile.name, birthdate: profile.birthdate });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const wallet = useWallet();
  const [prefs, setPrefs] = useState(() => getSettings());
  const toggle = (key) => {
    const next = setSetting(key, !prefs[key]);
    setPrefs(next);
    if (next[key]) playSfx(key === 'sound' ? 'pick' : 'tap');
  };

  const [account] = useState(() => getAccount());
  const kakao = wallet?.config?.auth?.kakao;
  const google = wallet?.config?.auth?.google;

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
        <div className="w-28 h-28 rounded-full bg-white flex items-end justify-center pb-3 shadow-soft">
          <Avatar id={look.main} outfit={look.equipped} className="h-[78px]" />
        </div>
        <p className="mt-3 text-[20px] font-extrabold text-ink">{cleanName(profile.name)}님</p>
        <p className="mt-0.5 text-[13px] text-mute">지금까지 {historyCount}번 상담했어요</p>
      </div>

      {(account || kakao?.enabled || google?.enabled) && (
        <div className="mt-4 rounded-[22px] bg-white shadow-soft px-5 py-4">
          {account ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-ink truncate">{account.provider === 'google' ? '구글' : '카카오'}로 로그인됨{account.nickname ? ` · ${account.nickname}` : ''}</p>
                <p className="text-[12px] text-mute break-keep">다른 기기에서 로그인하면 코인과 별가루가 그대로 이어져요.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  logoutAccount();
                  try {
                    window.localStorage.removeItem('tarot.v1.welcomed');
                  } catch {
                    /* 무시 */
                  }
                  window.location.replace('/'); // 로그아웃하면 시작(로그인) 화면으로 돌아가요
                }}
                className="shrink-0 text-[13px] font-semibold text-mute underline"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <>
              {kakao?.enabled && (
                <button
                  type="button"
                  onClick={() => startKakaoLogin(kakao.client_id)}
                  className="w-full rounded-2xl bg-[#FEE500] py-3.5 text-[15px] font-bold text-[#191919]"
                >
                  카카오로 시작하기
                </button>
              )}
              {google?.enabled && (
                <div className="mt-2.5">
                  <GoogleButton clientId={google.client_id} onDone={() => window.location.replace('/')} />
                </div>
              )}
              <p className="mt-2 text-[12px] text-mute text-center break-keep">로그인하면 코인·별가루·꾸미기가 다른 기기에서도 이어져요. 상담 기록은 이 기기에만 저장돼요.</p>
            </>
          )}
        </div>
      )}

      {!account && !wallet?.config && (
        <div className="mt-4 rounded-[22px] bg-white shadow-soft px-5 py-4 text-center">
          <p className="text-[13.5px] font-bold text-ink">로그인 정보를 불러오는 중이에요…</p>
          <p className="mt-1 text-[12px] text-mute break-keep">서버가 잠에서 깨는 중일 수 있어요. 잠시만 기다려 주세요.</p>
        </div>
      )}

      {wallet?.enabled && (
        <div className="mt-4 flex items-center justify-between rounded-[22px] bg-gold-200/40 px-5 py-3.5">
          <div>
            <p className="text-[13px] font-bold text-[#7a5a14]">보유 코인</p>
            <p className="text-[12px] text-mute">풀이 열기·조언 카드·더 물어보기에 써요</p>
          </div>
          <CoinChip />
        </div>
      )}

      {wallet?.config?.play?.enabled && (
        <button
          type="button"
          onClick={onOpenPlay}
          className="mt-4 w-full flex items-center justify-between rounded-[22px] bg-[#ece4ff] px-5 py-4 text-left cursor-pointer active:scale-[0.99] transition-transform"
        >
          <span>
            <span className="block text-[15px] font-bold text-ink">운명이 꾸미기</span>
            <span className="block text-[12px] text-mute">별똥별 받기, 아이템, 대표 운명이</span>
          </span>
          <ChevronRight className="w-5 h-5 text-ink/40" aria-hidden="true" />
        </button>
      )}

      <button
        type="button"
        onClick={onOpenHelp}
        className="mt-4 w-full flex items-center justify-between rounded-[22px] bg-brand-50 px-5 py-4 text-left cursor-pointer active:scale-[0.99] transition-transform"
      >
        <span>
          <span className="block text-[15px] font-bold text-ink">도움말·이용안내</span>
          <span className="block text-[12px] text-mute">사용법, 코인과 요금, 약관, 환불 규정</span>
        </span>
        <ChevronRight className="w-5 h-5 text-ink/40" aria-hidden="true" />
      </button>

      <Collection />

      <section className="mt-8">
        <h2 className="text-[19px] font-extrabold text-ink mb-3">소리와 진동</h2>
        <ul className="rounded-[22px] bg-brand-50 divide-y divide-brand-100 overflow-hidden">
          {[
            ['sound', '효과음', '카드를 고르고 뒤집을 때 소리가 나요'],
            ['haptic', '진동', '카드를 고를 때 살짝 진동해요 (지원하는 기기만)'],
          ].map(([key, label, desc]) => (
            <li key={key} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink">{label}</p>
                <p className="text-[12px] text-mute break-keep">{desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                aria-label={label}
                data-sfx="none"
                onClick={() => toggle(key)}
                className={`relative shrink-0 w-12 h-7 rounded-full transition-colors cursor-pointer ${prefs[key] ? 'bg-brand-500' : 'bg-[#cfc9e0]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${prefs[key] ? 'translate-x-5' : ''}`} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={submit} noValidate className="mt-8 space-y-4">
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
          프로필과 상담 기록은 이 기기의 브라우저에만 저장돼요. 리딩을 만들 때 이름, 생년월일, 고민 내용이 AI 서버로 전달돼요. 브라우저 데이터를 지우면 기록도 사라져요.{wallet?.enabled ? ' 코인은 ‘내 데이터 모두 삭제’를 눌러도 지워지지 않아요.' : ''}
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
