// 대표 마스코트와 입고 있는 아이템. 진짜 기록은 서버(별가루와 함께)에 있고, 이건 화면을 바로 그리기 위한 기기 안 복사본이에요.
import { useEffect, useState } from 'react';

import { keyPrefix } from './people';
const key = () => `${keyPrefix()}look`;
const EVENT = 'tarot-look';

export function getLook() {
  try {
    const v = JSON.parse(window.localStorage.getItem(key()) || '{}');
    return { main: Number.isInteger(v.main) && v.main >= 0 && v.main <= 21 ? v.main : 0, equipped: v.equipped && typeof v.equipped === 'object' ? v.equipped : {} };
  } catch {
    return { main: 0, equipped: {} };
  }
}

export function setLook(look) {
  try {
    window.localStorage.setItem(key(), JSON.stringify({ main: look.main, equipped: look.equipped || {} }));
  } catch {
    /* 저장이 막힌 환경이면 이번 화면에서만 */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useLook() {
  const [look, setState] = useState(getLook);
  useEffect(() => {
    const on = () => setState(getLook());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return look;
}
