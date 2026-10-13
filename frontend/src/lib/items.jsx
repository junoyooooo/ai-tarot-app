import React from 'react';

// 꾸미기 아이템 그림. 값(가격·이름)은 서버 카탈로그가 정하고, 여기서는 id 별 그림만 그려요.
// 좌표는 아이템마다 "자기 자리 기준"이고, Avatar 가 마스코트 위치에 맞춰 옮기고 키워요.
//  hat: 가운데 아래가 (0,0), 폭 100 · glasses: 눈 사이 거리가 60(눈 가운데 ±30) · clothes: 목 가운데가 (0,0), 폭 100
//  shoes: 발 가운데 아래가 (0,0), 폭 100
const INK = '#2b3a86';
const S = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: 'round', strokeLinecap: 'round' };

const starPath = (cx, cy, R, r, n = 5) => {
  const pts = [];
  for (let i = 0; i < n * 2; i += 1) {
    const rad = i % 2 === 0 ? R : r;
    const a = (Math.PI / n) * i - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};
const heartPath = (cx, cy, s) =>
  `M${cx},${cy + 0.9 * s} C${cx - 1.5 * s},${cy - 0.1 * s} ${cx - 0.9 * s},${cy - 1.1 * s} ${cx},${cy - 0.4 * s} C${cx + 0.9 * s},${cy - 1.1 * s} ${cx + 1.5 * s},${cy - 0.1 * s} ${cx},${cy + 0.9 * s}Z`;

export const ITEM_ART = {
  // ---- 모자
  h_beanie: {
    front: () => (
      <g {...S}>
        <path d="M-44,2 C-46,-50 46,-50 44,2 Z" fill="#e8545c" />
        <rect x="-50" y="-14" width="100" height="18" rx="8" fill="#b83a44" />
        <circle cx="0" cy="-52" r="10" fill="#fff" />
      </g>
    ),
  },
  h_party: {
    front: () => (
      <g {...S}>
        <path d="M-34,2 L0,-72 L34,2 Z" fill="#7e57e6" />
        <path d="M-22,-24 L22,-24 M-12,-46 L12,-46" stroke="#ffd43b" strokeWidth="5" />
        <circle cx="0" cy="-74" r="9" fill="#ffd43b" />
      </g>
    ),
  },
  h_cap: {
    front: () => (
      <g {...S}>
        <path d="M-42,2 C-44,-46 44,-46 42,2 Z" fill="#2d7ff9" />
        <path d="M8,-2 Q62,-10 64,6 L8,6 Z" fill="#1e5bc0" />
        <circle cx="0" cy="-42" r="5" fill="#1e5bc0" />
      </g>
    ),
  },
  h_straw: {
    front: () => (
      <g {...S}>
        <path d="M-30,-4 C-32,-46 32,-46 30,-4 Z" fill="#f5d98a" />
        <rect x="-31" y="-20" width="62" height="11" fill="#e8545c" />
        <ellipse cx="0" cy="-2" rx="58" ry="12" fill="#f2c96b" />
      </g>
    ),
  },
  h_crown: {
    front: () => (
      <g {...S}>
        <path d="M-40,2 L-44,-42 L-22,-20 L0,-52 L22,-20 L44,-42 L40,2 Z" fill="#ffd43b" />
        <circle cx="0" cy="-12" r="5" fill="#e8545c" />
        <circle cx="-22" cy="-10" r="3.5" fill="#4fa3ff" />
        <circle cx="22" cy="-10" r="3.5" fill="#4fa3ff" />
      </g>
    ),
  },
  // ---- 안경
  g_sun: {
    front: () => (
      <g {...S}>
        <path d="M-52,-6 L-58,-12 M52,-6 L58,-12" fill="none" />
        <rect x="-52" y="-16" width="44" height="34" rx="13" fill="#1f2330" />
        <rect x="8" y="-16" width="44" height="34" rx="13" fill="#1f2330" />
        <path d="M-8,-4 Q0,-10 8,-4" fill="none" />
        <path d="M-44,-8 L-36,-8 M16,-8 L24,-8" stroke="#fff" strokeWidth="3" opacity=".7" />
      </g>
    ),
  },
  g_round: {
    front: () => (
      <g {...S} fill="rgba(255,255,255,.28)">
        <circle cx="-30" cy="0" r="23" />
        <circle cx="30" cy="0" r="23" />
        <path d="M-7,-2 Q0,-8 7,-2" fill="none" />
      </g>
    ),
  },
  g_heart: {
    front: () => (
      <g {...S}>
        <path d={heartPath(-30, 0, 22)} fill="#ff5c8a" fillOpacity=".88" />
        <path d={heartPath(30, 0, 22)} fill="#ff5c8a" fillOpacity=".88" />
        <path d="M-8,-8 Q0,-14 8,-8" fill="none" />
      </g>
    ),
  },
  g_star: {
    front: () => (
      <g {...S}>
        <path d={starPath(-30, 0, 27, 12)} fill="#ffd43b" fillOpacity=".92" />
        <path d={starPath(30, 0, 27, 12)} fill="#ffd43b" fillOpacity=".92" />
        <path d="M-6,-4 Q0,-9 6,-4" fill="none" />
      </g>
    ),
  },
  // ---- 옷(목 주변)
  c_scarf: {
    front: () => (
      <g {...S}>
        <path d="M18,6 L42,6 L46,56 L26,60 Z" fill="#d0414b" />
        <rect x="-52" y="-10" width="104" height="24" rx="12" fill="#e8545c" />
        <path d="M-24,-8 L-24,12 M0,-8 L0,12 M24,-8 L24,12" stroke="#fff" strokeWidth="3" opacity=".55" />
      </g>
    ),
  },
  c_bow: {
    front: () => (
      <g {...S}>
        <path d="M0,0 L-36,-20 L-36,20 Z" fill="#7e57e6" />
        <path d="M0,0 L36,-20 L36,20 Z" fill="#7e57e6" />
        <circle cx="0" cy="0" r="8" fill="#a98bff" />
      </g>
    ),
  },
  c_necklace: {
    front: () => (
      <g {...S}>
        <path d="M-46,-8 Q0,40 46,-8" fill="none" stroke="#8a6d3b" strokeWidth="3.5" />
        <path d={starPath(0, 30, 13, 6)} fill="#ffd43b" />
      </g>
    ),
  },
  c_cape: {
    // 몸 뒤로 늘어지는 망토. h 는 목에서 발까지의 길이.
    back: ({ h }) => (
      <g {...S}>
        <path d={`M-46,-6 Q0,-16 46,-6 L${86},${h * 0.92} Q0,${h * 1.04} -86,${h * 0.92} Z`} fill="#7e57e6" />
        <path d={`M-30,6 Q0,0 30,6 L50,${h * 0.8} Q0,${h * 0.9} -50,${h * 0.8} Z`} fill="#9a7bff" stroke="none" opacity=".55" />
      </g>
    ),
    front: () => (
      <g {...S}>
        <circle cx="-30" cy="2" r="6" fill="#ffd43b" />
        <circle cx="30" cy="2" r="6" fill="#ffd43b" />
        <path d="M-30,2 Q0,12 30,2" fill="none" stroke="#ffd43b" strokeWidth="3" />
      </g>
    ),
  },
  // ---- 신발(한 짝)
  s_sneaker: {
    front: () => (
      <g {...S}>
        <path d="M-46,0 L-46,-20 Q-46,-34 -22,-34 L6,-34 Q46,-30 48,-8 L48,0 Z" fill="#fff" />
        <rect x="-50" y="-8" width="100" height="10" rx="5" fill="#e8545c" />
        <path d="M-6,-32 L10,-18 M-16,-32 L0,-18" stroke="#9aa3d4" strokeWidth="3" />
      </g>
    ),
  },
  s_boot: {
    front: () => (
      <g {...S}>
        <path d="M-34,0 L-34,-54 L22,-54 L22,-28 Q50,-26 50,-6 L50,0 Z" fill="#f2b34c" />
        <rect x="-36" y="-56" width="60" height="14" rx="5" fill="#d98f22" />
      </g>
    ),
  },
  s_slipper: {
    front: () => (
      <g {...S}>
        <path d="M-46,0 Q-46,-26 -10,-26 Q46,-24 48,0 Z" fill="#f48fb1" />
        <rect x="-48" y="-5" width="98" height="8" rx="4" fill="#fff" />
      </g>
    ),
  },
};

export const SLOT_LABEL = { hat: '모자', glasses: '안경', clothes: '옷', shoes: '신발' };
export const SLOTS = ['hat', 'glasses', 'clothes', 'shoes'];

/** 아이템 하나만 작게 보여 주는 미리보기용 viewBox */
export const ITEM_PREVIEW_BOX = {
  hat: '-60 -100 120 110',
  glasses: '-62 -34 124 68',
  clothes: '-62 -30 124 96',
  shoes: '-56 -62 112 70',
};
