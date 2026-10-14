import React, { useEffect, useState } from 'react';
import TabBar from './components/TabBar';
import ShopSheet from './components/ShopSheet';
import { useWallet } from './hooks/useWallet';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import Consult from './screens/Consult';
import History from './screens/History';
import Profile from './screens/Profile';
import Help from './screens/Help';
import Play from './screens/Play';
import Welcome from './screens/Welcome';
import { getProfile, saveProfile, getHistory } from './lib/storage';
import { getAccount, pendingKakaoCallback, finishKakaoLogin, clearCallbackFromUrl } from './lib/auth';

export default function App() {
  const wallet = useWallet();
  const [profile, setProfile] = useState(() => getProfile());
  const [history, setHistory] = useState(() => getHistory());
  const [tab, setTab] = useState('home');
  // 처음 열면 타이틀(로그인) 화면을 한 번 보여 줘요. 시작하기를 누르거나 로그인하면 다시 안 나와요.
  const [welcomed, setWelcomed] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).has('welcome')) return false; // 주소 뒤에 ?welcome 을 붙이면 시작 화면을 다시 볼 수 있어요
      return !!window.localStorage.getItem('tarot.v1.welcomed') || !!getAccount();
    } catch {
      return false;
    }
  });
  const finishWelcome = () => {
    try {
      window.localStorage.setItem('tarot.v1.welcomed', '1');
    } catch {
      /* 무시 */
    }
    setWelcomed(true);
  };
  const [historyView, setHistoryView] = useState('log'); // 기록 탭 안: 'log' 상담 기록 | 'box' 카드 보관함
  const [seed, setSeed] = useState(null); // 홈에서 분야를 골라 상담으로 넘어올 때 사용
  const [openId, setOpenId] = useState(null); // 기록 상세로 열려 있는 항목

  // 카카오 로그인 화면에서 돌아온 경우: 코드를 서버에 보내 로그인을 마무리하고 화면을 새로 불러옵니다.
  const [auth, setAuth] = useState(() => (pendingKakaoCallback() ? { busy: true } : null));
  useEffect(() => {
    const cb = pendingKakaoCallback();
    if (!cb) return;
    finishKakaoLogin(cb)
      .then(() => {
        clearCallbackFromUrl();
        window.location.replace('/');
      })
      .catch((e) => {
        clearCallbackFromUrl();
        setAuth({ busy: false, message: e.message || '로그인에 실패했어요. 다시 시도해 주세요.' });
      });
  }, []);

  const startConsult = (category) => {
    setSeed({ category, nonce: Date.now() });
    setTab('consult');
    window.scrollTo({ top: 0 });
  };

  const goTab = (next) => {
    if (next === 'history') setOpenId(null);
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  if (auth) {
    return (
      <div className="app-shell">
        <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
          <p className="text-[17px] font-extrabold text-ink break-keep">
            {auth.busy ? '카카오 로그인 중이에요…' : auth.message}
          </p>
          {!auth.busy && (
            <button type="button" onClick={() => setAuth(null)} className="mt-5 rounded-full bg-brand-600 text-white font-bold px-6 py-3">
              돌아가기
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!welcomed) {
    return (
      <div className="app-shell">
        <Welcome auth={wallet?.config?.auth} onStart={finishWelcome} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app-shell">
        <Onboarding
          onDone={(p) => {
            saveProfile(p);
            setProfile(p);
            setTab('home');
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main>
        {tab === 'home' && (
          <Home
            profile={profile}
            history={history}
            onStartConsult={(category) => {
              setSeed({ category, nonce: Date.now() });
              goTab('consult');
            }}
            onOpenEntry={(entry) => {
              setOpenId(entry.id);
              setTab('history');
              window.scrollTo({ top: 0 });
            }}
            onGoHistory={() => goTab('history')}
            onOpenPlay={() => goTab('play')}
          />
        )}

        {/* 상담 화면은 다른 탭에 다녀와도 진행 중인 리딩이 끊기지 않게 계속 켜 둡니다. */}
        <div className={tab === 'consult' ? '' : 'hidden'}>
          <Consult
            profile={profile}
            seed={seed}
            onSaved={setHistory}
            onGoHistory={() => {
              setHistoryView('log');
              goTab('history');
            }}
            onGoCardBox={() => {
              setHistoryView('box');
              goTab('history');
            }}
          />
        </div>

        {tab === 'history' && (
          <History profile={profile} history={history} openId={openId} onOpenChange={setOpenId} onChanged={setHistory} onStartConsult={startConsult} view={historyView} onViewChange={setHistoryView} />
        )}

        {tab === 'help' && <Help onBack={() => goTab('profile')} />}

        {tab === 'play' && <Play onBack={() => goTab('home')} />}

        {tab === 'profile' && (
          <Profile
            onOpenHelp={() => goTab('help')}
            onOpenPlay={() => goTab('play')}
            profile={profile}
            historyCount={history.length}
            onProfileChange={setProfile}
            onCleared={() => {
              setProfile(null);
              setHistory([]);
              setSeed(null);
              setOpenId(null);
              setTab('home');
            }}
          />
        )}
      </main>

      <TabBar active={tab === 'help' ? 'profile' : tab === 'play' ? 'home' : tab} onChange={goTab} />
      <ShopSheet />
      {wallet?.toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] max-w-[390px] w-[calc(100%-40px)] rounded-2xl bg-ink text-white text-[14px] font-semibold px-4 py-3 text-center shadow-card break-keep">
          {wallet.toast}
        </div>
      )}
    </div>
  );
}
