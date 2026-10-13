import { API_BASE, ApiError, deviceHeaders } from './api';
import { setDeviceId } from './device';

const ACCOUNT_KEY = 'tarot.v1.account';
const STATE_KEY = 'tarot.v1.kakaoState';

export const getAccount = () => {
  try {
    const a = JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) || 'null');
    return a && typeof a === 'object' ? a : null;
  } catch {
    return null;
  }
};

const saveAccount = (a) => {
  try {
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
  } catch {
    /* 무시 */
  }
};

export const logoutAccount = () => {
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* 무시 */
  }
};

export const redirectUri = () => `${window.location.origin}/`;

/** 카카오 로그인 화면으로 보냅니다. clientId 는 /api/config 의 auth.kakao.client_id */
export function startKakaoLogin(clientId) {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    window.localStorage.setItem(STATE_KEY, state);
  } catch {
    /* 무시 */
  }
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri(), response_type: 'code', state });
  window.location.href = `https://kauth.kakao.com/oauth/authorize?${q}`;
}

/** 주소에 카카오 로그인 결과(code, state)가 붙어 돌아왔는지 */
export function pendingKakaoCallback() {
  const p = new URLSearchParams(window.location.search);
  const code = p.get('code');
  const state = p.get('state');
  const error = p.get('error');
  if (!state && !error) return null;
  return { code, state, error };
}

export function clearCallbackFromUrl() {
  window.history.replaceState({}, '', window.location.pathname);
}

/** 서버에 코드를 보내 로그인을 마칩니다. 성공하면 기기 ID와 계정 표시가 바뀝니다. */
export async function finishKakaoLogin({ code, state, error }) {
  let saved = null;
  try {
    saved = window.localStorage.getItem(STATE_KEY);
    window.localStorage.removeItem(STATE_KEY);
  } catch {
    /* 무시 */
  }
  if (error || !code) throw new ApiError(0, 'cancelled', '로그인을 취소했어요.');
  if (!saved || saved !== state) throw new ApiError(0, 'bad_state', '로그인 확인에 실패했어요. 다시 시도해 주세요.');
  const res = await fetch(`${API_BASE}/api/auth/kakao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...deviceHeaders() },
    body: JSON.stringify({ code, redirect_uri: redirectUri() }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 본문 없음 */
  }
  if (!res.ok) {
    const d = data?.detail;
    throw new ApiError(res.status, d?.code, d?.message || '로그인에 실패했어요. 다시 시도해 주세요.');
  }
  setDeviceId(data.device_id);
  saveAccount({ nickname: data.nickname || '', provider: 'kakao' });
  return data;
}

let gsiPromise = null;
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = 'https://accounts.google.com/gsi/client';
      el.async = true;
      el.onload = resolve;
      el.onerror = () => {
        gsiPromise = null;
        reject(new Error('gsi'));
      };
      document.head.appendChild(el);
    });
  }
  return gsiPromise;
}

/** 구글 로그인 버튼을 container 안에 그려요. 로그인하면 onDone(data), 실패하면 onError(message). */
export async function mountGoogleButton(container, clientId, { onDone, onError, width = 280 }) {
  try {
    await loadGsi();
  } catch {
    onError?.('구글 로그인을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
    return;
  }
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: async ({ credential }) => {
      try {
        onDone(await finishGoogleLogin(credential));
      } catch (e) {
        onError?.(e.message || '로그인에 실패했어요. 다시 시도해 주세요.');
      }
    },
  });
  container.innerHTML = '';
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    locale: 'ko',
    width: Math.max(200, Math.min(400, width)),
  });
}

async function finishGoogleLogin(credential) {
  const res = await fetch(`${API_BASE}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...deviceHeaders() },
    body: JSON.stringify({ credential }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 본문 없음 */
  }
  if (!res.ok) {
    const d = data?.detail;
    throw new ApiError(res.status, d?.code, d?.message || '로그인에 실패했어요. 다시 시도해 주세요.');
  }
  setDeviceId(data.device_id);
  saveAccount({ nickname: data.nickname || '', provider: 'google' });
  return data;
}
