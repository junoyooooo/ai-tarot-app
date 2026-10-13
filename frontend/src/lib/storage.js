// 브라우저(localStorage)에 프로필·기록·오늘의 카드를 저장합니다.
// 시크릿 모드나 저장소가 막힌 환경에서도 앱이 죽지 않게 모든 접근을 try/catch로 감쌉니다.

const PREFIX = 'tarot.v1.';
const MAX_HISTORY = 100;

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const getProfile = () => read('profile', null);
export const saveProfile = (profile) => write('profile', profile);

export const getHistory = () => read('history', []);

export function addHistory(entry) {
  const list = [entry, ...getHistory().filter((e) => e.id !== entry.id)].slice(0, MAX_HISTORY);
  write('history', list);
  return list;
}

export function updateHistory(id, patch) {
  const list = getHistory().map((e) => (e.id === id ? { ...e, ...patch } : e));
  write('history', list);
  return list;
}

export function removeHistory(id) {
  const list = getHistory().filter((e) => e.id !== id);
  write('history', list);
  return list;
}

export const getDaily = () => read('daily', null);
export const saveDaily = (daily) => write('daily', daily);

export function clearAll() {
  try {
    ['profile', 'history', 'daily', 'collection'].forEach((k) => window.localStorage.removeItem(PREFIX + k));
    // 기기 ID(device)는 코인과 연결돼 있어 일부러 지우지 않습니다.
  } catch {
    /* 무시 */
  }
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function validateBirthdate(birthdate) {
  if (!/^\d{8}$/.test(birthdate)) return '생년월일은 숫자 8자리로 입력해 주세요. 예: 19980521';
  const y = Number(birthdate.slice(0, 4));
  const m = Number(birthdate.slice(4, 6));
  const d = Number(birthdate.slice(6, 8));
  const date = new Date(y, m - 1, d);
  if (y < 1900 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || date > new Date()) {
    return '올바른 생년월일을 입력해 주세요.';
  }
  return '';
}
