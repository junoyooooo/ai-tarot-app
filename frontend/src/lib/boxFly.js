import { playSfx } from './sound';

// 상담이 끝나 카드가 보관함에 담길 때: 카드가 아래 '기록' 탭으로 쏙 들어가고 안내 문구가 잠깐 나온다.
export function flyToCardBox(imageUrl) {
  if (typeof document === 'undefined') return;
  const target = document.querySelector('[data-tab-icon="history"]');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const made = [];
  const cleanup = () => made.forEach((el) => el.remove());

  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.textContent = '✓ 카드 보관함에 담겼어요';
  Object.assign(toast.style, {
    position: 'fixed', left: '50%', bottom: '112px', transform: 'translateX(-50%)', zIndex: '95',
    background: '#1d1836', color: '#fff', fontWeight: '700', fontSize: '14px', padding: '10px 18px',
    borderRadius: '999px', boxShadow: '0 8px 24px rgba(29,24,54,0.3)', whiteSpace: 'nowrap', opacity: '0',
  });
  document.body.appendChild(toast);
  made.push(toast);

  const showToast = () => {
    toast.animate(
      [
        { opacity: 0, transform: 'translateX(-50%) translateY(10px)' },
        { opacity: 1, transform: 'translateX(-50%) translateY(0)', offset: 0.15 },
        { opacity: 1, transform: 'translateX(-50%) translateY(0)', offset: 0.8 },
        { opacity: 0, transform: 'translateX(-50%) translateY(-6px)' },
      ],
      { duration: 2400, fill: 'forwards' }
    ).onfinish = cleanup;
  };

  if (!target || reduce || !imageUrl) {
    playSfx('pick');
    showToast();
    return;
  }

  const to = target.getBoundingClientRect();
  const w = 74;
  const h = Math.round((w * 1376) / 768);
  const startX = window.innerWidth / 2 - w / 2;
  const startY = window.innerHeight * 0.42 - h / 2;
  const endX = to.left + to.width / 2 - w / 2;
  const endY = to.top + to.height / 2 - h / 2;

  const card = document.createElement('img');
  card.src = imageUrl;
  card.alt = '';
  Object.assign(card.style, {
    position: 'fixed', left: `${startX}px`, top: `${startY}px`, width: `${w}px`, height: `${h}px`, zIndex: '95',
    borderRadius: '10px', boxShadow: '0 14px 30px rgba(60,30,120,0.4)', pointerEvents: 'none', opacity: '0',
  });
  document.body.appendChild(card);
  made.push(card);

  const dx = endX - startX;
  const dy = endY - startY;
  const fly = card.animate(
    [
      { opacity: 0, transform: 'scale(0.6) rotate(-6deg)' },
      { opacity: 1, transform: 'scale(1.08) rotate(0deg)', offset: 0.25 },
      { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: 0.45 },
      { opacity: 0.9, transform: `translate(${dx}px, ${dy}px) scale(0.18) rotate(10deg)`, offset: 0.95 },
      { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.1) rotate(10deg)` },
    ],
    { duration: 1300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
  );
  fly.onfinish = () => {
    card.remove();
    playSfx('pick');
    target.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }],
      { duration: 480, easing: 'ease-out' }
    );
    showToast();
  };
}
