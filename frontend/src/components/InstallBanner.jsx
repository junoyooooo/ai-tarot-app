import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { installMode, onInstallChange, promptInstall, snooze, snoozed, visitCount } from '../lib/pwa';

/** 홈 위쪽에 한 번 보여 주는 "홈 화면에 설치" 안내. 두 번째 방문부터(또는 상담을 해 본 뒤) 보이고, 닫으면 2주 동안 쉬어요. */
export default function InstallBanner({ historyCount = 0 }) {
  const [mode, setMode] = useState(() => installMode());
  const [hidden, setHidden] = useState(() => snoozed());
  const [steps, setSteps] = useState(false);
  useEffect(() => onInstallChange(() => setMode(installMode())), []);

  const ready = historyCount > 0 || visitCount() >= 2;
  if (hidden || !ready || mode === 'installed' || mode === 'none') return null;

  const close = () => {
    snooze(14);
    setHidden(true);
  };
  const act = async () => {
    if (mode === 'prompt') {
      const ok = await promptInstall();
      if (ok) setHidden(true);
    } else {
      setSteps((v) => !v);
    }
  };

  return (
    <div className="mt-4 rounded-[22px] bg-white p-3.5 shadow-sm ring-1 ring-brand-200/70">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-ink break-keep">홈 화면에 별빛타로를 놓아 두세요</p>
          <p className="text-[12px] text-ink/60 break-keep">아이콘 한 번으로 바로 열려요. 앱 설치 없이 무료예요</p>
        </div>
        <button type="button" onClick={close} aria-label="닫기" className="-mr-1 self-start p-1 text-ink/40">
          <X size={18} />
        </button>
      </div>
      <button
        type="button"
        onClick={act}
        className="mt-3 w-full rounded-full bg-brand-500 py-2.5 text-[13.5px] font-bold text-white active:scale-[0.99] transition-transform"
      >
        {mode === 'prompt' ? '홈 화면에 추가하기' : steps ? '접기' : '추가하는 방법 보기'}
      </button>
      {mode === 'ios' && steps && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12.5px] text-ink/75 break-keep">
          <li>Safari 아래쪽의 공유 버튼(네모에 화살표)을 눌러요.</li>
          <li>"홈 화면에 추가"를 골라요.</li>
          <li>오른쪽 위 "추가"를 누르면 끝이에요.</li>
        </ol>
      )}
    </div>
  );
}
