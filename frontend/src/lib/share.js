// 공유 주소 설정. 도메인(또는 짧은 주소)을 나중에 바꾸려면 Vercel 환경변수 VITE_SHARE_URL 만 바꾸면 됩니다.
const BASE = (import.meta.env.VITE_SHARE_URL || 'https://ai-tarot-app-tau.vercel.app').replace(/\/+$/, '');

/** 공유로 들어온 방문을 Umami 가 자동으로 구분하도록 utm 값을 붙인 주소 (QR·공유 글에 사용) */
export const SHARE_LINK = `${BASE}/?utm_source=share`;

/** 사람이 읽거나 직접 입력하기 쉬운 표시용 주소 (https:// 와 파라미터 제외) */
export const SHARE_DISPLAY = BASE.replace(/^https?:\/\//, '');

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
