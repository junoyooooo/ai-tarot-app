import React, { useEffect, useRef, useState } from 'react';
import { Camera, Share2, Download, X, Sparkles, Link2, Check } from 'lucide-react';
import { toCanvas } from 'html-to-image';
import QRCodeStyling from 'qr-code-styling';
import { SHARE_LINK, SHARE_DISPLAY, copyText } from '../lib/share';
import { track } from '../lib/analytics';
import { getKoName, cleanName } from '../tarotData';

const CAPTURE_BG = '#f4e9ff';

/* 인스타 스토리용 9:16 캡처 뷰 (화면 밖에서 렌더링). 하단에 앱 주소와 QR 코드가 들어갑니다. */
function ShareCard({ forwardedRef, name, cards, summary, hashtags, qr }) {
  const fan = [
    { t: 'translateX(-84px) translateY(14px) rotate(-12deg)', z: 10 },
    { t: 'translateY(-10px) rotate(0deg)', z: 20 },
    { t: 'translateX(84px) translateY(14px) rotate(12deg)', z: 10 },
  ];
  return (
    <div
      ref={forwardedRef}
      style={{
        width: '450px',
        height: '800px',
        backgroundImage: 'linear-gradient(170deg, #efe2ff 0%, #ffe4ef 52%, #fff1d9 100%)',
      }}
      className="relative px-9 pt-9 pb-7 flex flex-col justify-between overflow-hidden font-sans text-ink"
    >
      <div className="relative text-center">
        <p className="text-[12px] font-bold tracking-[0.35em] text-brand-600">AI TAROT</p>
        <p className="text-[28px] font-extrabold mt-3 leading-tight">
          {name ? `${name}님의 타로 한 장면` : '타로 한 장면'}
        </p>
      </div>

      <div className="relative w-full h-[300px] flex items-center justify-center">
        {cards.length === 3 &&
          cards.map((card, i) => (
            <div
              key={card.id}
              style={{
                position: 'absolute',
                width: 150,
                height: 269,
                transform: fan[i].t,
                zIndex: fan[i].z,
                borderRadius: 14,
                boxShadow: '0 16px 26px rgba(60,30,120,0.35)',
              }}
            >
              <img src={card.image_url} alt="" style={{ display: 'block', width: 150, height: 269, borderRadius: 14 }} />
            </div>
          ))}
      </div>

      <div className="relative text-center">
        <p className="text-[12px] font-bold tracking-[0.3em] text-brand-500 mb-3">TODAY&apos;S MESSAGE</p>
        <p className="text-[24px] font-extrabold leading-snug break-keep px-2">“{summary}”</p>
        <p className="text-[13px] text-mute mt-4">{cards.map((c) => getKoName(c)).join(' · ')}</p>
        <p style={{ marginTop: 16, fontSize: 15, fontWeight: 700, color: '#6a2fc2', lineHeight: '24px' }}>
          {hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join('   ')}
        </p>
      </div>

      <div
        style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 22, padding: '10px 16px 10px 12px' }}
        className="relative flex items-center gap-3"
      >
        {qr ? (
          <img src={qr} alt="" style={{ width: 64, height: 64, display: 'block', borderRadius: 8 }} />
        ) : (
          <div style={{ width: 64, height: 64 }} />
        )}
        <div className="text-left min-w-0">
          <p style={{ fontSize: 15, fontWeight: 800, color: '#1d1836' }}>나도 타로 보기</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6a2fc2', marginTop: 2 }}>{SHARE_DISPLAY}</p>
          <p style={{ fontSize: 11, color: '#6f6a8a', marginTop: 2 }}>QR을 찍거나 주소를 입력해 보세요</p>
        </div>
      </div>
    </div>
  );
}

/** 이미지 저장 / 바로 공유 버튼 + 저장 안내 팝업 + 화면 밖 캡처 뷰 */
export default function ShareActions({ name, cards, summary, hashtags }) {
  const shareRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  const displayName = cleanName(name);
  const tags = hashtags && hashtags.length ? hashtags : ['#오늘의타로', '#마음의소리', '#작은위로'];
  const summaryText = summary || `${displayName}님을 기다리는 가장 다정한 전환점`;
  const fileName = `AI타로_${displayName}.png`;

  /* 공유 주소 QR 을 한 번 만들어 이미지(data URL)로 둔다. 캡처할 때 그림으로 들어가 깨질 일이 없다. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const code = new QRCodeStyling({
          width: 256,
          height: 256,
          type: 'canvas',
          data: SHARE_LINK,
          margin: 0,
          qrOptions: { errorCorrectionLevel: 'M' },
          dotsOptions: { color: '#2a1457', type: 'square' },
          cornersSquareOptions: { color: '#2a1457', type: 'square' },
          backgroundOptions: { color: '#ffffff' },
        });
        const blob = await code.getRawData('png');
        if (!blob || !alive) return;
        const reader = new FileReader();
        reader.onload = () => alive && setQr(String(reader.result));
        reader.readAsDataURL(blob);
      } catch {
        /* QR 을 못 만들어도 주소 문구는 이미지에 들어간다 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const shareText = `${summaryText}\n\n나도 타로 보기 👉 ${SHARE_LINK}`;

  const copyLink = async () => {
    const ok = await copyText(SHARE_LINK);
    track('share_copy_link');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
    return ok;
  };

  const capture = async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 200));
    const opts = { pixelRatio: 2, backgroundColor: CAPTURE_BG, cacheBust: true };
    try {
      return await toCanvas(shareRef.current, opts);
    } catch (e) {
      // 웹폰트 CSS 를 못 읽는 환경(네트워크 차단 등)에서도 이미지는 만들어지도록 폰트 내장 없이 다시 시도
      console.warn('폰트 내장 실패, 기본 글꼴로 다시 만듭니다:', e);
      return toCanvas(shareRef.current, { ...opts, skipFonts: true });
    }
  };

  const saveCanvas = (canvas) => {
    const dataUrl = canvas.toDataURL('image/png');
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
    copyText(SHARE_LINK); // 스토리 링크 스티커에 바로 붙여 넣을 수 있게 주소를 미리 복사(브라우저가 막으면 버튼으로 복사)
    setPreviewImg(dataUrl); // 모바일은 직접 저장이 막히는 경우가 있어 '꾹 눌러 저장' 안내도 함께 띄움
  };

  const handleSave = async () => {
    if (!shareRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      track('share_save');
      saveCanvas(await capture());
    } catch (e) {
      console.error('이미지 캡처 실패:', e);
      alert('이미지 생성 중 문제가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleShare = async () => {
    if (!shareRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const canvas = await capture();
      if (navigator.share && navigator.canShare) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const file = new File([blob], fileName, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            try {
              track('share_native');
              await navigator.share({ files: [file], title: `${displayName}님의 AI 타로`, text: shareText });
              return;
            } catch (err) {
              if (err?.name === 'AbortError') return;
            }
          }
        }
      }
      saveCanvas(canvas);
    } catch (e) {
      console.error('공유 이미지 생성 실패:', e);
      alert('이미지 생성 중 문제가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={isCapturing}
          className="btn-primary py-3.5 rounded-2xl text-[14px] flex items-center justify-center gap-2 cursor-pointer"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          {isCapturing ? '만드는 중…' : '이미지 저장'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={isCapturing}
          className="btn-soft py-3.5 rounded-2xl text-[14px] flex items-center justify-center gap-2 cursor-pointer"
        >
          <Share2 className="w-4 h-4" aria-hidden="true" />
          바로 공유
        </button>
      </div>

      <button
        type="button"
        onClick={copyLink}
        className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-700 py-2 cursor-pointer"
      >
        {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Link2 className="w-4 h-4" aria-hidden="true" />}
        {copied ? '주소를 복사했어요' : `앱 주소 복사 · ${SHARE_DISPLAY}`}
      </button>

      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <ShareCard forwardedRef={shareRef} name={displayName} cards={cards} summary={summaryText} hashtags={tags} qr={qr} />
      </div>

      {previewImg && (
        <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="공유 이미지">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5 text-brand-600 font-bold text-sm">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                이미지가 완성됐어요
              </div>
              <button
                type="button"
                onClick={() => setPreviewImg(null)}
                aria-label="닫기"
                className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[12px] text-mute text-center mb-3 leading-relaxed">
              휴대폰에서는 이미지를 <strong className="text-ink">1초간 꾹 누른 뒤</strong> [사진에 저장]을 선택하세요.
            </p>
            <div className="mb-3 rounded-2xl bg-brand-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink/80 break-keep">
              <b className="text-ink">인스타 스토리에 올릴 때</b>
              <br />
              이미지를 올리고 스티커 → <b>링크</b>에 아래 주소를 붙여 넣으면, 친구가 바로 눌러서 들어올 수 있어요.
              <button
                type="button"
                onClick={copyLink}
                className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[13px] font-bold text-brand-700 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Link2 className="w-4 h-4" aria-hidden="true" />}
                {copied ? '복사했어요! 링크 스티커에 붙여 넣으세요' : '주소 복사하기'}
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-line mb-4 flex justify-center bg-brand-50">
              <img src={previewImg} alt="공유 이미지" className="w-full max-h-[50vh] object-contain" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = previewImg;
                  a.download = fileName;
                  a.click();
                }}
                className="btn-soft py-3 rounded-xl text-[13px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                파일로 받기
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewImg(null);
                  handleShare();
                }}
                className="btn-primary py-3 rounded-xl text-[13px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                SNS로 보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
