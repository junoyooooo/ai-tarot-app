import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { fetchRetention } from '../lib/api';
import { disablePush, enablePush, pushSupported } from '../lib/retention';
import { isIOS, isStandalone } from '../lib/pwa';
import { track } from '../lib/analytics';

/** 내 정보의 알림 카드: 하루 한 번 "오늘의 카드가 도착했어요" 알림. 켜고 끄는 건 언제든 가능해요. */
export default function PushCard() {
  const wallet = useWallet();
  const cfg = wallet?.config?.retention;
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!cfg?.enabled || !cfg?.push) return;
    fetchRetention().then((r) => setOn(!!r.push_on)).catch(() => {});
  }, [cfg?.enabled, cfg?.push]);

  if (!cfg?.enabled || !cfg?.push) return null;

  const needsInstall = isIOS() && !isStandalone();
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setMsg('');
    if (on) {
      await disablePush();
      setOn(false);
      track('push_off');
    } else {
      const r = await enablePush(cfg.vapid_public_key);
      if (r === 'ok') {
        setOn(true);
        track('push_on');
      } else {
        setMsg(
          r === 'denied'
            ? '브라우저에서 알림이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.'
            : r === 'unsupported'
              ? '이 브라우저는 알림을 지원하지 않아요.'
              : '알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.'
        );
      }
    }
    setBusy(false);
  };

  return (
    <section className="mt-4 rounded-[22px] bg-white shadow-soft px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bell className="w-5 h-5 text-brand-600 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold text-ink">오늘의 카드 알림</h2>
            <p className="text-[12.5px] text-mute break-keep">하루에 한 번, 아침에 알려 드려요</p>
          </div>
        </div>
        {pushSupported() && !needsInstall ? (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            role="switch"
            aria-checked={on}
            aria-label="오늘의 카드 알림"
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer ${on ? 'bg-brand-500' : 'bg-brand-200'}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        ) : null}
      </div>
      {needsInstall && <p className="mt-2 text-[12.5px] text-ink/70 break-keep">아이폰은 홈 화면에 설치한 뒤에 알림을 켤 수 있어요. 위의 “홈 화면에 앱처럼 설치”를 먼저 해 주세요.</p>}
      {!pushSupported() && !needsInstall && <p className="mt-2 text-[12.5px] text-ink/70 break-keep">이 브라우저는 알림을 지원하지 않아요.</p>}
      {msg && <p className="mt-2 text-[12.5px] text-brand-700 break-keep">{msg}</p>}
    </section>
  );
}
