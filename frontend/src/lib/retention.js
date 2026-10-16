// 초대 코드(내 것·받은 것) 보관과 웹 푸시 구독 도우미.
import { fetchInvite, redeemInvite, pushSubscribe, pushUnsubscribe } from './api';
import { SHARE_LINK } from './share';

const MINE = 'tarot.v1.invite';
const PENDING = 'tarot.v1.pendingRef';

const get = (k) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k, v) => {
  try {
    if (v == null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* 저장이 막혀도 앱은 계속 동작 */
  }
};

export const getMyInviteCode = () => get(MINE) || '';

/** 내 초대 코드를 서버에서 받아 보관한다. (공유 링크에 자동으로 붙어요) */
export async function ensureInviteCode() {
  const cached = getMyInviteCode();
  if (cached) return cached;
  const r = await fetchInvite();
  set(MINE, r.code);
  return r.code;
}

/** 공유 주소 뒤에 내 초대 코드를 붙여요. 코드가 아직 없으면 기본 주소를 그대로 써요. */
export function refLink(base = SHARE_LINK) {
  const code = getMyInviteCode();
  return code ? `${base}${base.includes('?') ? '&' : '?'}ref=${code}` : base;
}

/** 주소의 ?ref=코드 를 읽어 두고 주소창에서는 지워요. */
export function captureRefFromUrl() {
  try {
    const u = new URL(window.location.href);
    const ref = u.searchParams.get('ref');
    if (!ref) return;
    if (!get(PENDING) && !get('tarot.v1.refDone')) set(PENDING, ref.replace(/[^A-Za-z0-9]/g, '').slice(0, 12));
    u.searchParams.delete('ref');
    window.history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash);
  } catch {
    /* 무시 */
  }
}

/** 받아 둔 초대 코드가 있으면 한 번 사용해 본다. 결과: {gain} | null */
export async function redeemPendingRef() {
  const code = get(PENDING);
  if (!code) return null;
  try {
    const r = await redeemInvite(code);
    set(PENDING, null);
    set('tarot.v1.refDone', '1');
    return r;
  } catch (e) {
    if (e.status && e.status >= 400 && e.status < 500) {
      set(PENDING, null); // 다시 시도해도 소용없는 경우(이미 사용·기간 지남 등)
      set('tarot.v1.refDone', '1');
    }
    return null;
  }
}

// ───────── 웹 푸시 ─────────
const b64ToU8 = (s) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** 알림 켜기. 결과: 'ok' | 'denied' | 'unsupported' | 'error' */
export async function enablePush(vapidPublicKey) {
  if (!pushSupported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(vapidPublicKey) });
    const j = sub.toJSON();
    await pushSubscribe({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    /* 무시 */
  }
  try {
    await pushUnsubscribe();
  } catch {
    /* 무시 */
  }
}
