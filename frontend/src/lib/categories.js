// 고민 분야. mascot 은 public/mascots/{id}.webp (카드 번호와 같은 캐릭터)
export const CATEGORIES = [
  { key: 'love', label: '연애', hint: '마음이 가는 사람, 이별, 관계의 온도', mascot: 6, bg: 'bg-[#ffe0ec]', ring: 'ring-[#ffb3cf]' },
  { key: 'work', label: '직장·진로', hint: '이직, 일의 방향, 회사 사람들', mascot: 7, bg: 'bg-[#cdeff0]', ring: 'ring-[#8fd6d9]' },
  { key: 'money', label: '재물', hint: '돈의 흐름, 투자, 지출 고민', mascot: 10, bg: 'bg-[#fff0bd]', ring: 'ring-[#ffd966]' },
  { key: 'study', label: '공부·시험', hint: '시험, 준비, 도전과 성장', mascot: 1, bg: 'bg-[#e4dcff]', ring: 'ring-[#c5b4ff]' },
  { key: 'relation', label: '인간관계', hint: '가족, 친구, 불편한 사람', mascot: 14, bg: 'bg-[#d6e7ff]', ring: 'ring-[#a9c9ff]' },
  { key: 'etc', label: '그 밖의 고민', hint: '딱 한 줄로 말하기 어려운 마음', mascot: 0, bg: 'bg-[#ffe3cc]', ring: 'ring-[#ffc299]' },
];

export const categoryByKey = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

// 리딩 섹션(과거/현재/미래/한마디)별 색
export const SECTION_STYLES = [
  { bg: 'bg-[#ffe3ee]', accent: 'text-[#d6336c]', bar: 'bg-[#ff8fb5]' },
  { bg: 'bg-[#ffecd2]', accent: 'text-[#d9730d]', bar: 'bg-[#ffb35c]' },
  { bg: 'bg-[#d4f3ee]', accent: 'text-[#0f8f82]', bar: 'bg-[#4cc9b8]' },
  { bg: 'bg-[#ece4ff]', accent: 'text-[#6a2fc2]', bar: 'bg-[#a98bf0]' },
];

export const mascotSrc = (id) => `/mascots/${id}.webp`;
