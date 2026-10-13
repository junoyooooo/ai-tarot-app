// 로그인 없이 코인을 이 기기에 묶어 두기 위한 익명 기기 ID. (브라우저 저장소가 막힌 환경에서는 새로고침 전까지만 유지)
const KEY = 'tarot.v1.device';
let memoryId = null;

function makeId() {
  const bytes = new Uint8Array(18);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return 'd' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getDeviceId() {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return saved;
    const id = makeId();
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    if (!memoryId) memoryId = makeId();
    return memoryId;
  }
}

// 카카오 로그인으로 기존 회원의 기록을 이어 받을 때, 그 회원의 기기 ID로 바꿉니다.
export function setDeviceId(id) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) return;
  memoryId = id;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* 저장소가 막힌 환경: 이번 접속 동안만 유지 */
  }
}
