import React, { useEffect, useRef, useState } from 'react';
import { Send, X, Share2, Camera } from 'lucide-react';
import { toCanvas } from 'html-to-image';
import QRCodeStyling from 'qr-code-styling';
import { SHARE_LINK, SHARE_DISPLAY } from '../lib/share';
import { refLink } from '../lib/retention';
import { track } from '../lib/analytics';
import { cheerLine } from '../lib/cheer';
import { getKoName } from '../tarotData';

const LINK = `${SHARE_LINK}&utm_content=cheer`;

function CheerCard({ r, card, to, line, qr, ratio }) {
  const h = ratio === 'square' ? 450 : 800;
  return (
    <div
      ref={r}
      style={{ width: 450, height: h, backgroundImage: 'linear-gradient(170deg, #efe2ff 0%, #ffe4ef 52%, #fff1d9 100%)' }}
      className="relative px-9 py-8 flex flex-col items-center justify-between overflow-hidden font-sans text-ink"
    >
      <p className="text-[12px] font-bold tracking-[0.2em] text-brand-600">오늘의 응원 카드</p>
      <img
        src={card.image_url}
        alt=""
        style={{ width: h === 800 ? 190 : 120, height: h === 800 ? 341 : 215, borderRadius: 14, boxShadow: '0 16px 26px rgba(60,30,120,0.35)' }}
      />
      <div className="text-center">
        <p className="text-[13px] font-bold text-brand-500">{getKoName(card)}</p>
        <p className={`${h === 800 ? 'text-[23px]' : 'text-[18px]'} font-extrabold leading-snug break-keep mt-2 px-1`}>“{line}”</p>
        {to && <p className="text-[12px] text-mute mt-3">{to}님에게 보내는 오늘의 응원</p>}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 20, padding: '8px 14px 8px 10px' }} className="flex items-center gap-3">
        {qr ? <img src={qr} alt="" style={{ width: 54, height: 54, borderRadius: 8 }} /> : <div style={{ width: 54, height: 54 }} />}
        <div className="text-left">
          <p style={{ fontSize: 14, fontWeight: 800, color: '#1d1836' }}>나도 오늘의 카드 뽑기</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#6a2fc2', marginTop: 2 }}>{SHARE_DISPLAY}</p>
        </div>
      </div>
    </div>
  );
}

/** 오늘의 카드 아래 "친구에게 응원 보내기" 버튼 + 보내기 시트 */
export default function CheerShare({ card, dateKey }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [ratio, setRatio] = useState('story');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const to2 = to.trim();
  const line = cheerLine(card.id, to2, dateKey);

  useEffect(() => {
    if (!open || qr) return;
    (async () => {
      try {
        const code = new QRCodeStyling({ width: 256, height: 256, type: 'canvas', data: refLink(LINK), margin: 0, qrOptions: { errorCorrectionLevel: 'M' }, dotsOptions: { color: '#2a1457', type: 'square' }, backgroundOptions: { color: '#ffffff' } });
        const blob = await code.getRawData('png');
        const fr = new FileReader();
        fr.onload = () => setQr(String(fr.result));
        fr.readAsDataURL(blob);
      } catch {
        /* QR 없이도 주소 문구는 들어가요 */
      }
    })();
  }, [open, qr]);

  const make = async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 150));
    const o = { pixelRatio: 2, backgroundColor: '#f4e9ff', cacheBust: true };
    try {
      return await toCanvas(ref.current, o);
    } catch {
      return toCanvas(ref.current, { ...o, skipFonts: true });
    }
  };

  const send = async (mode) => {
    if (busy || !ref.current) return;
    setBusy(true);
    try {
      const canvas = await make();
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], '오늘의응원카드.png', { type: 'image/png' });
      track(mode === 'save' ? 'cheer_save' : 'cheer_share');
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: `${line}\n\n나도 오늘의 카드 뽑기 👉 ${refLink(LINK)}` });
          return;
        } catch (e) {
          if (e?.name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '오늘의응원카드.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      console.error(e);
      alert('이미지를 만들지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); track('cheer_open'); }}
        className="mt-3 w-full rounded-full bg-white/90 text-[#a8385e] font-bold text-[14px] py-2.5 inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
      >
        <Send className="w-4 h-4" aria-hidden="true" /> 친구에게 응원 보내기
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] bg-ink/60 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="오늘의 응원 카드 보내기">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 max-h-[94vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <p className="font-extrabold text-ink">오늘의 응원 카드</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[13px] font-bold text-ink">
              누구에게 보낼까요? <span className="font-normal text-mute">(비워도 돼요)</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value.slice(0, 8))}
                placeholder="예: 민지"
                className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-[15px] font-normal"
              />
            </label>
            <div className="mt-2 flex gap-2" role="group" aria-label="이미지 크기">
              {[['story', '스토리 9:16'], ['square', '정사각형']].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={ratio === k} onClick={() => setRatio(k)} className={`flex-1 rounded-full py-1.5 text-[12.5px] font-bold cursor-pointer ${ratio === k ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-700'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-center overflow-hidden rounded-2xl bg-brand-50" style={{ height: ratio === 'story' ? 400 : 225 }}>
              <div style={{ transform: 'scale(0.5)', transformOrigin: 'top center', width: 450, height: ratio === 'story' ? 800 : 450 }}>
                <CheerCard r={ref} card={card} to={to2} line={line} qr={qr} ratio={ratio} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => send('save')} className="btn-soft py-3 rounded-xl text-[13px] flex items-center justify-center gap-1.5 cursor-pointer">
                <Camera className="w-4 h-4" aria-hidden="true" /> 이미지 저장
              </button>
              <button type="button" disabled={busy} onClick={() => send('share')} className="btn-primary py-3 rounded-xl text-[13px] flex items-center justify-center gap-1.5 cursor-pointer">
                <Share2 className="w-4 h-4" aria-hidden="true" /> {busy ? '만드는 중…' : '보내기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
