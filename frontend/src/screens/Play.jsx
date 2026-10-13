import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import Avatar from '../components/Avatar';
import Mascot from '../components/Mascot';
import StarGame from '../components/StarGame';
import { ITEM_ART, ITEM_PREVIEW_BOX, SLOTS, SLOT_LABEL } from '../lib/items';
import { ANCHORS } from '../lib/mascotAnchors';
import { fetchPlay, playBuy, playEquip, playExchange } from '../lib/api';
import { getCollection } from '../lib/collection';
import { setLook } from '../lib/look';
import { playSfx } from '../lib/sound';
import { useWallet } from '../hooks/useWallet';
import { TAROT_CARDS, getKoName } from '../tarotData';

function ItemThumb({ id, slot }) {
  const art = ITEM_ART[id];
  if (!art) return null;
  return (
    <svg viewBox={ITEM_PREVIEW_BOX[slot]} className="w-full h-full" aria-hidden="true">
      {art.back?.({ h: 60 })}
      {art.front?.()}
    </svg>
  );
}

export default function Play({ onBack }) {
  const wallet = useWallet();
  const cfg = wallet?.config?.play;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [slot, setSlot] = useState('hat');
  const [pending, setPending] = useState(null); // 사려고 누른 아이템 id
  const [busy, setBusy] = useState(false);
  const [game, setGame] = useState(false);
  const [msg, setMsg] = useState('');
  const col = useMemo(() => getCollection(), []);

  const apply = useCallback((d) => {
    setData(d);
    setLook({ main: d.main, equipped: d.equipped });
    wallet?.applyWallet?.({ coins: d.coins });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    fetchPlay()
      .then((d) => alive && apply(d))
      .catch((e) => alive && setError(e.message || '불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
    return () => {
      alive = false;
    };
  }, [apply]);

  const flash = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2600);
  };

  const act = async (fn, okMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      const d = await fn();
      apply(d);
      if (okMsg) flash(okMsg);
      return true;
    } catch (e) {
      flash(e.message || '잠시 후 다시 시도해 주세요.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="px-5 pt-8 pb-32">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[14px] font-semibold text-mute cursor-pointer">
          <ChevronLeft className="w-5 h-5" aria-hidden="true" /> 뒤로
        </button>
        <p className="mt-10 text-center text-[15px] text-mute break-keep">{error}</p>
      </div>
    );
  }
  if (!data) {
    return <p className="pt-24 text-center text-[14px] text-mute">별똥별 마을을 여는 중…</p>;
  }

  const mainId = data.main;
  const anchor = ANCHORS[mainId] || ANCHORS[0];
  const blocked = { hat: anchor.noHat, glasses: anchor.noGlasses, shoes: anchor.noShoes };
  const catalog = data.catalog;
  // 안 산 아이템도 눌러 보면 미리 입어 볼 수 있어요 (이미 쓰고 있는 부위는 제외)
  const previewOutfit = pending && catalog[pending] && !blocked[slot] ? { ...data.equipped, [slot]: pending } : data.equipped;
  const slotItems = Object.entries(catalog).filter(([, v]) => v.slot === slot);
  const mainCard = TAROT_CARDS.find((c) => c.id === mainId);
  const discovered = TAROT_CARDS.filter((c) => col[c.id] || c.id === mainId);

  const equip = (id) => {
    if (blocked[slot]) return;
    const next = { ...data.equipped };
    if (next[slot] === id) delete next[slot];
    else next[slot] = id;
    playSfx('pick');
    act(() => playEquip(next, mainId));
  };

  return (
    <div className="px-5 pt-6 pb-32 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 -ml-1 text-[14px] font-semibold text-mute cursor-pointer">
          <ChevronLeft className="w-5 h-5" aria-hidden="true" /> 뒤로
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ece4ff] text-brand-700 font-extrabold text-[13px] px-3 py-1.5" aria-label={`별가루 ${data.stardust}개`}>
          ✨ {data.stardust}
        </span>
      </div>
      <h1 className="mt-2 text-[26px] font-extrabold tracking-tight text-ink">별똥별 마을</h1>

      {/* 내 마스코트 */}
      <div className="mt-4 rounded-[28px] bg-gradient-to-br from-[#ece4ff] to-[#d6e7ff] pt-10 pb-5 flex flex-col items-center">
        <div className="h-[190px] flex items-end">
          <Avatar id={mainId} outfit={previewOutfit} className="h-[170px] max-w-[260px]" bounce />
        </div>
        <p className="mt-3 text-[17px] font-extrabold text-ink">{mainCard ? getKoName(mainCard) : '운명이'}</p>
        <p className="text-[12px] text-mute">나의 대표 운명이</p>
      </div>

      {/* 별똥별 받기 */}
      <div className="mt-4 rounded-[24px] bg-gradient-to-br from-[#2a2465] to-[#5b3a9a] text-white p-5 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-extrabold">
            별똥별 받기 <span className="ml-1 align-middle text-[11px] font-bold bg-white/20 rounded-full px-2 py-0.5">미니게임</span>
          </p>
          <p className="mt-1 text-[12.5px] text-white/75 break-keep">
            {data.earned_today >= data.daily_cap
              ? `오늘 별가루를 모두 모았어요 (${data.earned_today}/${data.daily_cap})`
              : `오늘 남은 판 ${data.plays_left}번 · 별가루 ${data.earned_today}/${data.daily_cap}`}
          </p>
        </div>
        <button
          type="button"
          disabled={data.plays_left <= 0 || data.earned_today >= data.daily_cap}
          onClick={() => setGame(true)}
          className="shrink-0 bg-white text-[#3a2a7a] font-extrabold text-[14px] rounded-full px-5 py-2.5 cursor-pointer disabled:opacity-50 active:scale-95 transition-transform"
        >
          {data.plays_left <= 0 || data.earned_today >= data.daily_cap ? '내일 또!' : '게임하기'}
        </button>
      </div>

      {/* 꾸미기 */}
      <h2 className="mt-8 mb-3 text-[19px] font-extrabold text-ink">꾸미기</h2>
      <div className="flex gap-2 mb-3" role="tablist" aria-label="아이템 종류">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={slot === s}
            onClick={() => {
              setSlot(s);
              setPending(null);
            }}
            className={`flex-1 rounded-full py-2 text-[13.5px] font-bold cursor-pointer transition-colors ${slot === s ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-700'}`}
          >
            {SLOT_LABEL[s]}
          </button>
        ))}
      </div>
      {blocked[slot] && (
        <p className="mb-3 rounded-2xl bg-[#fff4d6] text-[#7a5a14] text-[13px] px-4 py-2.5 break-keep">
          이 친구는 이미 {SLOT_LABEL[slot]}을(를) {slot === 'shoes' ? '신을 수 없어요' : '쓰고 있어요'}. 다른 친구로 바꾸면 입혀 볼 수 있어요.
        </p>
      )}
      <ul className="grid grid-cols-3 gap-2.5">
        {slotItems.map(([id, it]) => {
          const owned = data.items.includes(id);
          const on = data.equipped[slot] === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => (owned ? equip(id) : setPending(pending === id ? null : id))}
                aria-pressed={owned ? on : undefined}
                className={`w-full rounded-[18px] px-2 pt-2.5 pb-2 text-center cursor-pointer transition-colors ${on ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-brand-50'} ${blocked[slot] ? 'opacity-50' : ''}`}
              >
                <div className="h-[56px] flex items-center justify-center">
                  <div className={`h-full w-[84px] ${owned ? '' : 'opacity-60'}`}>
                    <ItemThumb id={id} slot={slot} />
                  </div>
                </div>
                <p className="mt-1 text-[12px] font-bold text-ink break-keep">{it.name}</p>
                <p className="text-[11px] font-semibold text-mute">{owned ? (on ? '입는 중' : '가지고 있어요') : `✨ ${it.price}`}</p>
              </button>
            </li>
          );
        })}
      </ul>
      {pending && catalog[pending] && (
        <div className="mt-3 rounded-2xl bg-white border border-brand-100 shadow-soft px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[13.5px] text-ink break-keep">
            {blocked[slot] ? '' : '👀 입어 보는 중! '}<b>{catalog[pending].name}</b>을(를) 별가루 {catalog[pending].price}개로 살까요?
          </p>
          <button type="button" onClick={() => setPending(null)} className="shrink-0 text-[12px] font-bold text-mute cursor-pointer">취소</button>
          <button
            type="button"
            disabled={busy || data.stardust < catalog[pending].price}
            onClick={async () => {
              const id = pending;
              const ok = await act(() => playBuy(id), '새 아이템이 생겼어요 🎉');
              if (ok) {
                setPending(null);
                playSfx('coin');
              }
            }}
            className="shrink-0 btn-primary px-4 py-2 rounded-full text-[13px] cursor-pointer"
          >
            {data.stardust < catalog[pending].price ? '별가루가 모자라요' : '사기'}
          </button>
        </div>
      )}

      {/* 대표 마스코트 */}
      <h2 className="mt-8 mb-1 text-[19px] font-extrabold text-ink">대표 운명이</h2>
      <p className="mb-3 text-[12.5px] text-mute break-keep">상담이나 오늘의 카드에서 만난 친구만 고를 수 있어요.</p>
      <ul className="grid grid-cols-5 gap-2">
        {TAROT_CARDS.map((c) => {
          const seen = discovered.some((d) => d.id === c.id);
          const on = c.id === mainId;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!seen || busy}
                aria-label={seen ? getKoName(c) : '아직 만나지 못한 친구'}
                aria-pressed={on}
                onClick={() => {
                  playSfx('pick');
                  act(() => playEquip(data.equipped, c.id));
                }}
                className={`w-full aspect-square rounded-[16px] flex items-center justify-center cursor-pointer ${on ? 'bg-brand-100 ring-2 ring-brand-500' : seen ? 'bg-brand-50' : 'bg-[#f2f0f8]'}`}
              >
                <Mascot id={c.id} className={`h-[78%] w-auto ${seen ? '' : 'brightness-0 opacity-15'}`} />
              </button>
            </li>
          );
        })}
      </ul>

      {/* 별가루 → 코인 */}
      {cfg?.exchange_enabled && (
        <div className="mt-8 rounded-[22px] bg-gold-200/40 px-5 py-4">
          <p className="text-[15px] font-bold text-ink">별가루로 코인 받기</p>
          <p className="mt-1 text-[12.5px] text-mute break-keep">
            별가루 {cfg.exchange_cost}개를 코인 1개로 바꿀 수 있어요. 일주일에 한 번만 바꿀 수 있어요.
          </p>
          <button
            type="button"
            disabled={busy || data.exchange_used_this_week || data.stardust < cfg.exchange_cost}
            onClick={async () => {
              if (await act(() => playExchange(), '코인 1개를 받았어요 🪙')) playSfx('coin');
            }}
            className="mt-3 btn-primary px-5 py-2.5 rounded-full text-[14px] cursor-pointer"
          >
            {data.exchange_used_this_week ? '이번 주는 바꿨어요' : data.stardust < cfg.exchange_cost ? `별가루 ${cfg.exchange_cost - data.stardust}개 더 필요해요` : '코인으로 바꾸기'}
          </button>
        </div>
      )}

      {msg && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] max-w-[390px] w-[calc(100%-40px)] rounded-2xl bg-ink text-white text-[14px] font-semibold px-4 py-3 text-center shadow-card break-keep">
          {msg}
        </div>
      )}

      {game && (
        <StarGame
          mascotId={mainId}
          outfit={data.equipped}
          playsLeft={data.plays_left}
          onResult={(r) => apply(r)}
          onClose={() => setGame(false)}
        />
      )}
    </div>
  );
}
