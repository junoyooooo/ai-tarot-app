// 마스코트 도감: 카드를 만날 때마다 이 기기에 기록합니다. (서버·결제와 무관, 항상 무료)
import { keyPrefix } from './people';
const key = () => `${keyPrefix()}collection`;

export function getCollection() {
  try {
    const raw = window.localStorage.getItem(key());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordCards(ids) {
  const col = getCollection();
  const now = Date.now();
  ids.forEach((id) => {
    if (typeof id !== 'number') return;
    const prev = col[id];
    col[id] = { first: prev?.first || now, count: (prev?.count || 0) + 1 };
  });
  try {
    window.localStorage.setItem(key(), JSON.stringify(col));
  } catch {
    /* 무시 */
  }
  return col;
}
