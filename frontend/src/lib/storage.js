// 브라우저(localStorage)에 프로필·기록·오늘의 카드를 저장합니다.
// 시크릿 모드나 저장소가 막힌 환경에서도 앱이 죽지 않게 모든 접근을 try/catch로 감쌉니다.

import { keyPrefix } from './people';

const MAX_HISTORY = 100;

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(keyPrefix() + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(keyPrefix() + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const getProfile = () => read('profile', null);
export const saveProfile = (profile) => write('profile', profile);

export const getHistory = () => read('history', []);

export function addHistory(entry) {
  addCardBox(entry); // 상담이 끝나면 공유 카드는 누르지 않아도 자동으로 보관함에 담긴다
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
    ['profile', 'history', 'daily', 'collection', 'memos', 'cardbox', 'look'].forEach((k) => window.localStorage.removeItem('tarot.v1.' + k));
    // 함께 저장된 가족·친구 프로필도 지워요
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith('tarot.v1.p_') || k === 'tarot.v1.people' || k === 'tarot.v1.activePerson')
      .forEach((k) => window.localStorage.removeItem(k));
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

// 달력 한 줄 메모 (날짜 'YYYY-MM-DD' → 짧은 글). 길게 쓰지 않도록 40자까지.
export const MEMO_MAX = 40;
export const getMemos = () => read('memos', {});
export function setMemo(iso, text) {
  const memos = { ...getMemos() };
  const t = String(text || '').trim().slice(0, MEMO_MAX);
  if (t) memos[iso] = t;
  else delete memos[iso];
  write('memos', memos);
  return memos;
}

// 카드 보관함: 공유 카드를 다시 그릴 수 있는 최소한의 정보만 담는다. 기록을 지워도 남고, 보관함에서만 지울 수 있다.
const MAX_CARDBOX = 300;
const toBoxItem = (e) => ({
  id: e.id,
  ts: e.ts,
  category: e.category,
  summary: e.summary,
  hashtags: e.hashtags || [],
  cards: (e.cards || []).map((c) => ({ id: c.id, position: c.position })),
});
export const boxable = (e) => e && e.summary && Array.isArray(e.cards) && e.cards.length === 3 && !/자살예방 상담전화 109/.test(e.reading || '');

export function getCardBox() {
  const saved = read('cardbox', null);
  if (saved) return saved;
  const seeded = getHistory().filter(boxable).map(toBoxItem); // 처음 열 때 지금까지의 기록을 옮겨 담는다
  write('cardbox', seeded);
  return seeded;
}

export function addCardBox(entry) {
  if (!boxable(entry)) return getCardBox();
  const list = [toBoxItem(entry), ...getCardBox().filter((c) => c.id !== entry.id)].slice(0, MAX_CARDBOX);
  write('cardbox', list);
  return list;
}

export function removeCardBox(id) {
  const list = getCardBox().filter((c) => c.id !== id);
  write('cardbox', list);
  return list;
}
