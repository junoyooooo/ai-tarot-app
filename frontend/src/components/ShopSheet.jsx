import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { prepareCheckout, sandboxConfirm } from '../lib/api';
import { track } from '../lib/analytics';
import { playSfx } from '../lib/sound';
import { getAccount, startKakaoLogin } from '../lib/auth';
import GoogleButton from './GoogleButton';

const TOSS_SDK = 'https://js.tosspayments.com/v2/standard';

function loadToss() {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TOSS_SDK;
    s.onload = () => resolve(window.TossPayments);
    s.onerror = () => reject(new Error('결제 모듈을 불러오지 못했어요.'));
    document.head.appendChild(s);
  });
}

const won = (n) => `${n.toLocaleString('ko-KR')}원`;

export default function ShopSheet() {
  const w = useWallet();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (w?.shopOpen) {
      setError('');
      setBusy('');
      w.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.shopOpen]);

  if (!w?.enabled || !w.shopOpen) return null;
  const mode = w.config.payments_mode;
  const needLogin = Boolean(w.config.login_required_to_pay) && !getAccount();
  const kakao = w.config.auth?.kakao;
  const google = w.config.auth?.google;
  const products = (w.config.products || []).filter((p) => !p.first_only || w.firstPurchase);

  const buy = async (p) => {
    setError('');
    setBusy(p.sku);
    track('checkout_start', { sku: p.sku });
    try {
      const order = await prepareCheckout(p.sku);
      if (order.mode === 'sandbox') {
        const r = await sandboxConfirm(order.order_id);
        w.applyWallet(r);
        playSfx('coin');
        w.notify(`코인 ${r.granted}개가 충전되었어요 🪙 (테스트 결제)`);
        w.closeShop();
      } else if (order.mode === 'toss') {
        const TossPayments = await loadToss();
        const payment = TossPayments(order.client_key).payment({ customerKey: TossPayments.ANONYMOUS });
        const base = `${window.location.origin}${window.location.pathname}`;
        await payment.requestPayment({
          method: 'CARD',
          amount: { currency: 'KRW', value: order.amount },
          orderId: order.order_id,
          orderName: order.order_name,
          successUrl: `${base}?payment=success`,
          failUrl: `${base}?payment=fail`,
        });
      }
    } catch (e) {
      // 결제창을 사용자가 닫은 경우는 오류로 보여 주지 않는다.
      if (e?.code === 'USER_CANCEL' || e?.code === 'PAY_PROCESS_CANCELED') setError('');
      else setError(e.message || '결제를 시작하지 못했어요.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="코인 충전">
      <button type="button" aria-label="닫기" onClick={w.closeShop} className="absolute inset-0 bg-ink/45 cursor-default" />
      <div className="relative w-full max-w-[430px] rounded-t-[32px] bg-paper px-5 pt-5 pb-8 animate-fade-in-up max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-extrabold text-ink">코인 충전</h2>
          <button type="button" onClick={w.closeShop} aria-label="닫기" className="w-9 h-9 rounded-full flex items-center justify-center text-mute cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-1 text-[13px] text-mute">
          보유 코인 <b className="text-ink">🪙 {w.coins ?? 0}</b> · 코인 1개로 숨겨진 카드와 마스터의 한마디를 열어요.
        </p>

        {mode === 'off' ? (
          <div className="mt-5 rounded-[22px] bg-brand-50 px-5 py-6 text-center text-[14px] text-mute leading-relaxed break-keep">
            결제를 준비하고 있어요. 조금만 기다려 주세요 🌙
          </div>
        ) : needLogin ? (
          <div className="mt-5 rounded-[22px] bg-brand-50 px-5 py-6 text-center">
            <p className="text-[16px] font-extrabold text-ink">먼저 로그인해 주세요</p>
            <p className="mt-1.5 text-[13px] text-mute leading-relaxed break-keep">
              충전한 코인이 계정에 안전하게 보관돼요. 기기를 바꾸거나 브라우저 데이터를 지워도 그대로 이어져요.
            </p>
            <div className="mt-4 space-y-2.5">
              {google?.enabled && <GoogleButton clientId={google.client_id} onDone={() => window.location.replace('/')} />}
              {kakao?.enabled && (
                <button type="button" onClick={() => startKakaoLogin(kakao.client_id)} className="w-full rounded-full bg-[#FEE500] py-3 text-[14.5px] font-bold text-[#191919] cursor-pointer">
                  카카오로 계속하기
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {mode === 'sandbox' && (
              <p className="mt-4 rounded-xl bg-[#fff0bd] px-3.5 py-2 text-[12.5px] font-semibold text-[#7a5a14]">
                테스트 결제 모드예요. 실제 결제는 일어나지 않아요.
              </p>
            )}
            <ul className="mt-4 space-y-2.5">
              {products.map((p) => (
                <li key={p.sku}>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => buy(p)}
                    className={`w-full flex items-center gap-3 rounded-[22px] px-4 py-3.5 text-left cursor-pointer active:scale-[0.99] transition-transform disabled:opacity-60 ${
                      p.first_only ? 'bg-gradient-to-r from-[#ffe3ee] to-[#ece4ff] ring-2 ring-brand-300' : 'bg-brand-50'
                    }`}
                  >
                    <span className="text-[26px]" aria-hidden="true">🪙</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[16px] font-extrabold text-ink">코인 {p.coins}개</span>
                        {p.badge && <span className="text-[11px] font-extrabold text-white bg-brand-500 rounded-full px-2 py-0.5">{p.badge}</span>}
                      </span>
                      {p.first_only && <span className="block text-[12px] font-semibold text-brand-600">첫 구매 한정 혜택</span>}
                    </span>
                    <span className="text-[15px] font-extrabold text-ink">{busy === p.sku ? '…' : won(p.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-[#c2255c] bg-[#ffe3ee] rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}
        <p className="mt-5 text-[12px] text-mute leading-relaxed break-keep">
          코인은 이 기기에 저장돼요. 브라우저 데이터를 지우지 않으면 유지돼요. 충전한 코인의 환불은 사용 전에 한해 문의로 도와드려요.
        </p>
      </div>
    </div>
  );
}
