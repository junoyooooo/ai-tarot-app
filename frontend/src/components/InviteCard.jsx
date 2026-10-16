import React, { useEffect, useState } from 'react';
import { Gift, Check } from 'lucide-react';
import { fetchInvite, redeemInvite } from '../lib/api';
import { copyText, SHARE_LINK } from '../lib/share';
import { track } from '../lib/analytics';
import { useWallet } from '../hooks/useWallet';

/** 내 정보의 친구 초대 카드: 초대 링크 공유 + 받은 코드 직접 입력. 보상은 별가루뿐이에요. */
export default function InviteCard() {
  const wallet = useWallet();
  const on = wallet?.config?.retention?.enabled;
  const [info, setInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!on) return;
    fetchInvite().then(setInfo).catch(() => {});
  }, [on]);

  if (!on || !info) return null;
  const link = `${SHARE_LINK}&ref=${info.code}`;
  const dust = info.stardust_enabled;

  const share = async () => {
    track('invite_share');
    const text = `토닥토닥 별빛타로에서 오늘의 카드 뽑아봐요 🔮\n${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: '토닥토닥 별빛타로', text });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const redeem = async () => {
    setMsg('');
    try {
      const r = await redeemInvite(code);
      track('invite_redeem');
      setMsg(r.gain ? `별가루 ${r.gain}개를 받았어요 ⭐` : '초대 코드가 등록됐어요.');
      setInfo({ ...info, redeemed: true });
    } catch (e) {
      setMsg(e.message || '사용할 수 없는 코드예요.');
    }
  };

  return (
    <section className="mt-4 rounded-[22px] bg-white shadow-soft px-5 py-4">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-brand-600" aria-hidden="true" />
        <h2 className="text-[16px] font-extrabold text-ink">친구 초대</h2>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink/75 break-keep">
        {dust
          ? `친구가 내 링크로 들어와 시작하면 둘 다 별가루 ${info.bonus_invitee}개를 받아요. (한 주에 최대 ${info.weekly_max}명)`
          : '내 링크로 친구를 초대해 보세요.'}
      </p>
      <p className="mt-1 text-[12px] text-mute">이번 주 {info.invited_week}명 · 지금까지 {info.invited_total}명 초대했어요</p>
      <button
        type="button"
        onClick={share}
        className="mt-3 w-full rounded-2xl bg-brand-600 text-white font-bold text-[14px] py-3 cursor-pointer active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
      >
        {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : null}
        {copied ? '초대 링크를 복사했어요' : '초대 링크 보내기'}
      </button>
      {!info.redeemed && (
        <div className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="받은 초대 코드"
            maxLength={12}
            className="flex-1 min-w-0 rounded-2xl border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-brand-400"
          />
          <button type="button" onClick={redeem} disabled={code.length < 4} className="rounded-2xl bg-brand-50 text-brand-700 font-bold text-[13px] px-4 disabled:opacity-50 cursor-pointer">
            등록
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-[12.5px] text-brand-700 break-keep">{msg}</p>}
    </section>
  );
}
