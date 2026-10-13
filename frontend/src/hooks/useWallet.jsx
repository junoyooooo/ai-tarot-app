import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchConfig, fetchWallet, tossConfirm } from '../lib/api';

const WalletContext = createContext(null);
export const useWallet = () => useContext(WalletContext);

/**
 * 서버 설정(paywall_enabled 등)과 코인 잔액을 앱 전체에 나눠 주는 컨텍스트.
 * 서버에서 paywall 이 꺼져 있으면(기본값) 코인·잠금 UI 는 어디에도 나타나지 않습니다.
 */
export function WalletProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [coins, setCoins] = useState(null);
  const [firstPurchase, setFirstPurchase] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  const applyWallet = useCallback((w) => {
    if (!w) return;
    if (typeof w.coins === 'number') setCoins(w.coins);
    if (typeof w.first_purchase_available === 'boolean') setFirstPurchase(w.first_purchase_available);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyWallet(await fetchWallet());
    } catch {
      /* 잔액을 못 불러와도 앱은 계속 동작 */
    }
  }, [applyWallet]);

  useEffect(() => {
    let alive = true;
    fetchConfig()
      .then((c) => {
        if (!alive) return;
        setConfig(c);
        if (c.paywall_enabled) refresh();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refresh]);

  /* 토스페이먼츠 결제창에서 돌아온 경우(?payment=success&paymentKey=…&orderId=…&amount=…) */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const state = q.get('payment');
    if (!state) return;
    const clean = () => window.history.replaceState({}, '', window.location.pathname);
    if (state === 'fail') {
      clean();
      notify(q.get('message') || '결제가 취소되었어요. 코인은 차감되지 않았어요.');
      return;
    }
    const paymentKey = q.get('paymentKey');
    const orderId = q.get('orderId');
    const amount = Number(q.get('amount'));
    clean();
    if (!paymentKey || !orderId || !amount) return;
    tossConfirm(paymentKey, orderId, amount)
      .then((r) => {
        applyWallet(r);
        notify(r.granted ? `코인 ${r.granted}개가 충전되었어요 🪙` : '이미 처리된 결제예요.');
      })
      .catch((e) => notify(e.message || '결제 확인에 실패했어요. 문제가 계속되면 문의해 주세요.'));
  }, [applyWallet, notify]);

  const value = useMemo(
    () => ({
      config,
      enabled: Boolean(config?.paywall_enabled),
      coins,
      firstPurchase,
      applyWallet,
      refresh,
      shopOpen,
      openShop: () => setShopOpen(true),
      closeShop: () => setShopOpen(false),
      toast,
      notify,
    }),
    [config, coins, firstPurchase, applyWallet, refresh, shopOpen, toast, notify]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
