import React, { useState } from 'react';
import TabBar from './components/TabBar';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import Consult from './screens/Consult';
import History from './screens/History';
import Profile from './screens/Profile';
import { getProfile, saveProfile, getHistory } from './lib/storage';

export default function App() {
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
          />
        )}

        {/* 상담 화면은 다른 탭에 다녀와도 진행 중인 리딩이 끊기지 않게 계속 켜 둡니다. */}
        <div className={tab === 'consult' ? '' : 'hidden'}>
          <Consult profile={profile} seed={seed} onSaved={setHistory} onGoHistory={() => goTab('history')} />
        </div>

        {tab === 'history' && (
          <History profile={profile} history={history} openId={openId} onOpenChange={setOpenId} onChanged={setHistory} />
        )}

        {tab === 'profile' && (
          <Profile
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

      <TabBar active={tab} onChange={goTab} />
    </div>
  );
}
