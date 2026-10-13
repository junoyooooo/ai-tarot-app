import React, { useState } from 'react';
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
import { getProfile, saveProfile, getHistory } from './lib/storage';

export default function App() {
  const wallet = useWallet();
  const [profile, setProfile] = useState(() => getProfile());
  const [history, setHistory] = useState(() => getHistory());
  const [tab, setTab] = useState('home');
  const [seed, setSeed] = useState(null); // 홈에서 분야를 골라 상담으로 넘어올 때 사용
  const [openId, setOpenId] = useState(null); // 기록 상세로 열려 있는 항목

  const goTab = (next) => {
    if (next === 'history') setOpenId(null);
    setTab(next);
    window.scrollTo({ top: 0 });
  };

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
          <Consult profile={profile} seed={seed} onSaved={setHistory} onGoHistory={() => goTab('history')} />
        </div>

        {tab === 'history' && (
          <History profile={profile} history={history} openId={openId} onOpenChange={setOpenId} onChanged={setHistory} />
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
