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
