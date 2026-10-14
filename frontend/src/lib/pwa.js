// 홈 화면 설치(PWA) 도우미: 서비스 워커 등록 + 설치 버튼용 상태.
let deferred = null;
const listeners = new Set();

export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

export function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

/** 설치 방법: 'installed' | 'prompt'(버튼 한 번) | 'ios'(공유→홈 화면에 추가) | 'none' */
export function installMode() {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  return 'none';
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach((f) => f());
  return outcome === 'accepted';
}

export function initPwa() {
  if (typeof window === 'undefined') return;
  countVisit();
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
  // 개발 서버(vite dev)에서는 서비스 워커를 쓰지 않아요.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

const VISITS = 'tarot.v1.visits';
const SNOOZE = 'tarot.v1.installSnooze';

/** 방문 횟수를 센다(앱을 연 날 기준으로 하루에 한 번). */
export function countVisit() {
  try {
    const today = new Date().toDateString();
    const v = JSON.parse(localStorage.getItem(VISITS) || '{"n":0,"d":""}');
    if (v.d !== today) localStorage.setItem(VISITS, JSON.stringify({ n: (v.n || 0) + 1, d: today }));
  } catch {
    /* 저장이 막혀 있어도 괜찮아요 */
  }
}

export function visitCount() {
  try {
    return JSON.parse(localStorage.getItem(VISITS) || '{}').n || 0;
  } catch {
    return 0;
  }
}

export function snoozed() {
  try {
    return Date.now() < Number(localStorage.getItem(SNOOZE) || 0);
  } catch {
    return false;
  }
}

export function snooze(days = 14) {
  try {
    localStorage.setItem(SNOOZE, String(Date.now() + days * 86400000));
  } catch {
    /* 무시 */
  }
}
