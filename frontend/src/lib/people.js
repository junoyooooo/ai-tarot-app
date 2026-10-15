// 사람(프로필) 여러 명: 나 + 가족·친구 최대 4명. 코인·별가루·아이템은 기기(계정) 하나를 같이 쓰고,
// 상담 기록·도감·오늘의 카드·보관함·대표 캐릭터는 사람마다 따로 저장돼요.
// 나('me')는 예전 저장 키를 그대로 써서 기존 사용자의 기록이 그대로 남아요. 지인 정보는 이 기기 안에만 저장해요.
export const MAX_PEOPLE = 5;
const LIST_KEY = 'tarot.v1.people';
const ACTIVE_KEY = 'tarot.v1.activePerson';

function load() {
  try {
    const v = JSON.parse(window.localStorage.getItem(LIST_KEY) || '[]');
    return Array.isArray(v) ? v.filter((p) => p && typeof p.id === 'string') : [];
  } catch {
    return [];
  }
}
function save(list) {
  try {
    window.localStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    /* 저장이 막힌 환경 */
  }
}

export const getExtraPeople = () => load();

export function getActiveId() {
  try {
    const id = window.localStorage.getItem(ACTIVE_KEY) || 'me';
    return id === 'me' || load().some((p) => p.id === id) ? id : 'me';
  } catch {
    return 'me';
  }
}

/** 저장 키 앞부분. 나는 예전 그대로('tarot.v1.'), 다른 사람은 사람별로 나눠요. */
export function keyPrefix() {
  const id = getActiveId();
  return id === 'me' ? 'tarot.v1.' : `tarot.v1.p_${id}.`;
}

export function setActive(id) {
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* 무시 */
  }
}

export function addPerson({ name, birthdate }) {
  const list = load();
  if (list.length >= MAX_PEOPLE - 1) return null;
  const id = Math.random().toString(36).slice(2, 8);
  list.push({ id, name: name.trim().slice(0, 12), birthdate });
  save(list);
  return id;
}

export function removePerson(id) {
  save(load().filter((p) => p.id !== id));
  try {
    const pre = `tarot.v1.p_${id}.`;
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(pre))
      .forEach((k) => window.localStorage.removeItem(k));
    if (window.localStorage.getItem(ACTIVE_KEY) === id) window.localStorage.setItem(ACTIVE_KEY, 'me');
  } catch {
    /* 무시 */
  }
}

/** 지인의 이름·생년월일은 해당 사람 프로필 키(profile)에 들어가요. 처음 만들 때 한 번 채워 둬요. */
export function seedPersonProfile(id, { name, birthdate }) {
  try {
    window.localStorage.setItem(`tarot.v1.p_${id}.profile`, JSON.stringify({ name: name.trim().slice(0, 12), birthdate }));
  } catch {
    /* 무시 */
  }
}

export function allPeopleLabels(myName) {
  return [{ id: 'me', name: myName || '나' }, ...load().map((p) => ({ id: p.id, name: p.name }))];
}
