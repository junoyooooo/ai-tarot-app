// 효과음: 파일 없이 브라우저(Web Audio)에서 직접 만든 가벼운 소리. 저작권·용량 걱정이 없어요.
// 브라우저 규칙상 첫 터치 이후에만 소리가 납니다. 설정은 이 기기에만 저장돼요.
const KEY = 'tarot.v1.settings';
const DEFAULTS = { sound: true, haptic: true };

let settings = null;
let ctx = null;
let master = null;

export function getSettings() {
  if (settings) return settings;
  try {
    const raw = window.localStorage.getItem(KEY);
    settings = { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    settings = { ...DEFAULTS };
  }
  return settings;
}

export function setSetting(key, value) {
  settings = { ...getSettings(), [key]: Boolean(value) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 저장이 막혀도 이번 접속 동안은 적용 */
  }
  return settings;
}

function audio() {
  if (!getSettings().sound) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(c, { f, to, dur = 0.12, type = 'sine', gain = 0.12, at = 0 }) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(c, { dur = 0.08, from = 1200, to = 2600, gain = 0.1, at = 0, q = 1.2 }) {
  const t0 = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, B5: 987.77, C6: 1046.5, E6: 1318.5, G4: 392 };

const SOUNDS = {
  tap: (c) => tone(c, { f: 560, to: 430, dur: 0.07, type: 'triangle', gain: 0.07 }),
  shuffle: (c) => {
    for (let i = 0; i < 9; i += 1) noise(c, { at: i * 0.055, dur: 0.05, from: 900 + i * 90, to: 2400, gain: 0.07 });
  },
  pick: (c) => {
    tone(c, { f: NOTE.E5, dur: 0.18, gain: 0.1 });
    tone(c, { f: NOTE.B5, dur: 0.26, gain: 0.08, at: 0.07 });
  },
  unpick: (c) => tone(c, { f: 420, to: 320, dur: 0.1, type: 'triangle', gain: 0.06 }),
  flip: (c) => {
    noise(c, { dur: 0.16, from: 700, to: 3000, gain: 0.09 });
    tone(c, { f: NOTE.G5, dur: 0.3, gain: 0.05, at: 0.12 });
  },
  reveal: (c) => [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(c, { f, dur: 0.34, gain: 0.07, at: i * 0.075 })),
  coin: (c) => {
    tone(c, { f: NOTE.B5, dur: 0.1, type: 'triangle', gain: 0.08 });
    tone(c, { f: NOTE.E6, dur: 0.32, type: 'triangle', gain: 0.08, at: 0.08 });
  },
  soft: (c) => tone(c, { f: NOTE.G4, to: 300, dur: 0.18, type: 'triangle', gain: 0.07 }),
};

const VIBRATE = { pick: 12, flip: 14, reveal: [16, 40, 16], coin: 10 };

export function playSfx(name) {
  const c = audio();
  if (c && SOUNDS[name]) {
    try {
      SOUNDS[name](c);
    } catch {
      /* 소리 실패는 무시 */
    }
  }
  if (getSettings().haptic && VIBRATE[name] && navigator.vibrate) {
    try {
      navigator.vibrate(VIBRATE[name]);
    } catch {
      /* 무시 */
    }
  }
}

/** 버튼을 누르면 기본 '톡' 소리. 직접 소리를 내는 버튼은 data-sfx="none" 으로 제외한다. */
export function installGlobalTapSound() {
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target instanceof Element ? e.target.closest('button, [role="button"], a') : null;
      if (!el || el.disabled) return;
      const sfx = el.getAttribute('data-sfx');
      if (sfx === 'none') return;
      playSfx(sfx || 'tap');
    },
    true
  );
}
