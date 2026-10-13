// 달력에 표시하는 특별한 날. 음력 명절은 양력으로 바꾼 값을 연도별로 적어 둡니다. (2026~2028)
// category 는 "타로 보러 가기"를 눌렀을 때 미리 골라 두는 고민 분야예요.

const FIXED = [
  { md: '01-01', name: '새해 첫날', emoji: '🎍', category: 'etc', line: '올해의 흐름을 카드에게 먼저 물어볼까요?' },
  { md: '02-04', name: '입춘', emoji: '🌱', category: 'etc', line: '봄이 시작되는 날이에요. 새로 시작할 일이 있나요?' },
  { md: '02-14', name: '밸런타인데이', emoji: '💝', category: 'love', line: '마음을 전하고 싶은 사람이 있다면 카드에게 물어봐요.' },
  { md: '03-14', name: '화이트데이', emoji: '🍬', category: 'love', line: '달콤한 날, 그 사람의 마음이 궁금하지 않나요?' },
  { md: '05-08', name: '어버이날', emoji: '🌸', category: 'relation', line: '가족에게 하고 싶은 말이 있다면 카드와 정리해 봐요.' },
  { md: '11-11', name: '빼빼로데이', emoji: '🍫', category: 'love', line: '작은 마음을 전하기 전, 카드 한 장 어때요?' },
  { md: '12-25', name: '크리스마스', emoji: '🎄', category: 'etc', line: '한 해의 끝자락, 소원을 카드에게 말해 볼까요?' },
  { md: '12-31', name: '한 해의 마지막 날', emoji: '✨', category: 'etc', line: '올해를 정리하고 내년의 흐름을 살짝 들여다봐요.' },
];

const LUNAR = {
  seol: { name: '설날', emoji: '🎎', category: 'etc', line: '새해 복 많이 받으세요. 올 한 해의 흐름을 살짝 볼까요?' },
  boreum: { name: '정월대보름', emoji: '🌕', category: 'etc', line: '보름달에 소원을 빌듯, 올해의 바람을 카드와 나눠 봐요.' },
  dano: { name: '단오', emoji: '🍃', category: 'etc', line: '한 해의 반을 향해 가는 길, 마음을 한 번 점검해 봐요.' },
  chilseok: { name: '칠석', emoji: '🌠', category: 'love', line: '견우와 직녀가 만나는 날, 인연의 흐름을 물어볼까요?' },
  chuseok: { name: '추석', emoji: '🌕', category: 'relation', line: '가족을 만나기 전 마음이 복잡하다면 카드에게 털어놔요.' },
  dongji: { name: '동지', emoji: '🌙', category: 'etc', line: '가장 긴 밤이에요. 긴 밤 끝에 올 변화를 물어봐요.' },
};

// 연도별 (월-일)
const BY_YEAR = {
  2026: { seol: '02-17', boreum: '03-03', dano: '06-19', chilseok: '08-19', chuseok: '09-25', dongji: '12-22' },
  2027: { seol: '02-07', boreum: '02-21', dano: '06-09', chilseok: '08-08', chuseok: '09-15', dongji: '12-22' },
  2028: { seol: '01-27', boreum: '02-10', dano: '05-28', chilseok: '08-26', chuseok: '10-03', dongji: '12-21' },
};

const pad = (n) => String(n).padStart(2, '0');
export const isoKey = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`; // m 은 1~12

/** 한 해의 특별한 날을 { 'YYYY-MM-DD': {name, emoji, line, category} } 로 */
function yearMap(y) {
  const map = {};
  FIXED.forEach((f) => {
    map[`${y}-${f.md}`] = f;
  });
  const lunar = BY_YEAR[y];
  if (lunar) {
    Object.entries(lunar).forEach(([k, md]) => {
      map[`${y}-${md}`] = LUNAR[k];
    });
  }
  return map;
}

/** 해당 날짜(YYYY-MM-DD)의 특별한 날. 없으면 null */
export const specialOn = (iso) => yearMap(Number(iso.slice(0, 4)))[iso] || null;

/** 그 달의 특별한 날 목록 [{ day, ...info }] (날짜 순) */
export function specialsInMonth(y, m) {
  const map = yearMap(y);
  return Object.entries(map)
    .filter(([k]) => Number(k.slice(5, 7)) === m)
    .map(([k, v]) => ({ day: Number(k.slice(8, 10)), ...v }))
    .sort((a, b) => a.day - b.day);
}

/** 오늘부터 withinDays 일 안에 있는 가장 가까운 특별한 날 [{ iso, diff, ...info }] */
export function upcomingSpecial(date = new Date(), withinDays = 3) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (let i = 0; i <= withinDays; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const iso = isoKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const s = specialOn(iso);
    if (s) return { iso, diff: i, ...s };
  }
  return null;
}
