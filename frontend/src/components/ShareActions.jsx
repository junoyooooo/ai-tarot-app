import React, { useRef, useState } from 'react';
import { Camera, Share2, Download, X, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import { getKoName, cleanName } from '../tarotData';

const CAPTURE_BG = '#f4e9ff';

/* 인스타 스토리용 9:16 캡처 뷰 (화면 밖에서 렌더링). html2canvas는 blur 필터를 지원하지 않아서 그라데이션만 씁니다. */
function ShareCard({ forwardedRef, name, cards, summary, hashtags }) {
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
      className="relative px-9 py-10 flex flex-col justify-between overflow-hidden font-sans text-ink"
    >
      <div className="relative text-center">
        <p className="text-[12px] font-bold tracking-[0.35em] text-brand-600">AI TAROT</p>
        <p className="text-[28px] font-extrabold mt-3 leading-tight">
          {name ? `${name}님의 오늘의 타로` : '오늘의 타로'}
        </p>
      </div>

      <div className="relative w-full h-[330px] flex items-center justify-center">
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
        <p className="text-[11px] text-mute/80 mt-6">ai-tarot-app-tau.vercel.app</p>
      </div>
    </div>
  );
}

/** 이미지 저장 / 바로 공유 버튼 + 저장 안내 팝업 + 화면 밖 캡처 뷰 */
export default function ShareActions({ name, cards, summary, hashtags }) {
  const shareRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);

  const displayName = cleanName(name);
  const tags = hashtags && hashtags.length ? hashtags : ['#오늘의타로', '#마음의소리', '#작은위로'];
  const summaryText = summary || `${displayName}님을 기다리는 가장 다정한 전환점`;
  const fileName = `AI타로_${displayName}.png`;

  const capture = async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 200));
    return html2canvas(shareRef.current, { scale: 2, useCORS: true, backgroundColor: CAPTURE_BG, logging: false });
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
    setPreviewImg(dataUrl); // 모바일은 직접 저장이 막히는 경우가 있어 '꾹 눌러 저장' 안내도 함께 띄움
  };

  const handleSave = async () => {
    if (!shareRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
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
              await navigator.share({ files: [file], title: `${displayName}님의 AI 타로`, text: summaryText });
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

      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <ShareCard forwardedRef={shareRef} name={displayName} cards={cards} summary={summaryText} hashtags={tags} />
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
