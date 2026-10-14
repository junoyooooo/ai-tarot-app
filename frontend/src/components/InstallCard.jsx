import React, { useEffect, useState } from 'react';
import { installMode, onInstallChange, promptInstall } from '../lib/pwa';

/** 내 정보 화면의 "홈 화면에 설치" 카드. 이미 설치했거나 설치할 수 없는 브라우저에서는 보이지 않아요. */
export default function InstallCard() {
  const [mode, setMode] = useState(() => installMode());
  const [open, setOpen] = useState(false);
  useEffect(() => onInstallChange(() => setMode(installMode())), []);
  if (mode === 'installed' || mode === 'none') return null;
  return (
    <section className="rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="h-11 w-11 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-ink">홈 화면에 앱처럼 설치</p>
          <p className="text-[12px] text-ink/60 break-keep">아이콘을 눌러 바로 열고, 주소창 없이 크게 볼 수 있어요</p>
        </div>
        <button
          type="button"
          onClick={() => (mode === 'prompt' ? promptInstall() : setOpen((v) => !v))}
          className="shrink-0 rounded-full bg-brand-500 px-4 py-2 text-[13px] font-bold text-white"
        >
          {mode === 'prompt' ? '설치' : '방법 보기'}
        </button>
      </div>
      {mode === 'ios' && open && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12.5px] text-ink/75 break-keep">
          <li>Safari 아래쪽의 공유 버튼(네모에 화살표)을 눌러요.</li>
          <li>"홈 화면에 추가"를 골라요.</li>
          <li>오른쪽 위 "추가"를 누르면 끝이에요.</li>
        </ol>
      )}
    </section>
  );
}
