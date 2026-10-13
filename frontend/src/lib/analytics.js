// Umami(쿠키 없는 방문 분석). VITE_UMAMI_WEBSITE_ID 가 없으면 아무것도 하지 않습니다.
// 이름·생년월일·고민 내용 같은 개인정보는 절대 이벤트 데이터에 넣지 마세요.
export function initAnalytics() {
  const id = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (!id || document.getElementById('umami-script')) return;
  const s = document.createElement('script');
  s.id = 'umami-script';
  s.defer = true;
  s.src = import.meta.env.VITE_UMAMI_SRC || 'https://cloud.umami.is/script.js';
  s.setAttribute('data-website-id', id);
  document.head.appendChild(s);
}

export function track(name, data) {
  try {
    window.umami?.track(name, data);
  } catch {
    /* 분석 실패는 무시 */
  }
}
