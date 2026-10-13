import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Moon, Sun, Wand2, RefreshCw, CreditCard, Lock, Camera, Share2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import ReactMarkdown from 'react-markdown';
import { pickThreeCards, generateLocalReading } from './tarotData';


export default function App() {
  const [formData, setFormData] = useState({
    name: '',
    birthdate: '',
    concern: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepText, setLoadingStepText] = useState('우주의 기운을 모으는 중...');
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([false, false, false]);
  const [aiReading, setAiReading] = useState('');
  const [shareMetadata, setShareMetadata] = useState({
    one_line_summary: '',
    hashtags: []
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [isStreamComplete, setIsStreamComplete] = useState(false);
  const readingRef = useRef(null);
  const shareCardRef = useRef(null);

  // 로딩 텍스트 회전 효과
  useEffect(() => {
    if (!isLoading) return;
    const texts = [
      '우주의 별빛을 읽는 중...',
      '당신의 운명의 실을 따라가는 중...',
      '시공간 너머의 진실을 마주하는 중...',
      '카드가 신비로운 메시지를 속삭입니다...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % texts.length;
      setLoadingStepText(texts[i]);
    }, 1800);
    return () => clearInterval(interval);
  }, [isLoading]);

  // 3장의 카드가 모두 뒤집히면 자동 스크롤
  useEffect(() => {
    const allFlipped = flippedCards.length === 3 && flippedCards.every(Boolean);
    if (allFlipped && readingRef.current) {
      setTimeout(() => {
        readingRef.current.scrollIntoView({ behavior: 'smooth' });
      }, 400);
    }
  }, [flippedCards]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* ==============================================================
     [결제 모듈 연동 부분]
     토스페이먼츠, 포트원(구 아임포트), 카카오페이 등 결제 SDK 연동 자리 표시기
     ============================================================== */
  const processPayment = async () => {
    // TODO: 결제 모듈(TossPayments, PortOne 등) 연동
    // 예시:
    // const tossPayments = await loadTossPayments(clientKey);
    // return await tossPayments.requestPayment('카드', { amount: 3900, orderId: '...', orderName: 'AI 타로 운세' });
    console.log('[결제 모듈 연동 자리] 결제가 성공했다고 가정하고 리딩을 진행합니다.');
    return true; // 현재는 테스트를 위해 무조건 성공으로 통과
  };

  const runFallbackReading = () => {
    const selectedCards = pickThreeCards();
    const result = generateLocalReading(formData.name, formData.birthdate, formData.concern, selectedCards);
    setCards(result.cards);
    setIsLoading(false);
    setShareMetadata({
      one_line_summary: result.one_line_summary,
      hashtags: result.hashtags
    });

    // 타자치듯 매끄러운 텍스트 타이핑 연출
    let currentText = '';
    const fullText = result.reading;
    const chunkSize = 3;
    let idx = 0;
    const timer = setInterval(() => {
      if (idx < fullText.length) {
        currentText += fullText.slice(idx, idx + chunkSize);
        setAiReading(currentText);
        idx += chunkSize;
      } else {
        clearInterval(timer);
        setIsStreamComplete(true);
      }
    }, 18);
  };

  const handleDrawCards = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.birthdate.trim() || !formData.concern.trim()) {
      alert('모든 필수 정보를 입력해 주세요.');
      return;
    }

    // 1. 결제 모듈 호출 (플레이스홀더)
    const paymentSuccess = await processPayment();
    if (!paymentSuccess) {
      alert('결제가 정상적으로 완료되지 않았습니다.');
      return;
    }

    // 초기화 및 로딩 시작
    setIsLoading(true);
    setCards([]);
    setFlippedCards([false, false, false]);
    setAiReading('');
    setIsStreamComplete(false);

    // 백엔드(Render) 연결 제한 시간 (10초 초과 시 스마트 자체 해석 엔진으로 즉각 전환)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://ai-tarot-app-tznp.onrender.com';
      const response = await fetch(`${apiBase}/api/tarot/reading/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('서버 응답 오류가 발생했습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';

        for (const evt of events) {
          const lines = evt.split(/\r?\n/);
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const dataStr = line.replace(/^data:\s*/, '').trim();
              if (!dataStr) continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'cards') {
                  setCards(parsed.data);
                  setIsLoading(false);
                } else if (parsed.type === 'content') {
                  setAiReading((prev) => prev + parsed.data);
                } else if (parsed.type === 'meta') {
                  setShareMetadata({
                    one_line_summary: parsed.data.one_line_summary || '',
                    hashtags: parsed.data.hashtags || []
                  });
                } else if (parsed.type === 'done') {
                  setIsStreamComplete(true);
                } else if (parsed.type === 'error') {
                  console.error('스트리밍 백엔드 에러:', parsed.data);
                  setAiReading((prev) => prev ? prev : '우주의 기운이 잠시 흔들렸습니다. 다시 시도해 주세요.');
                }
              } catch (err) {
                console.error('SSE JSON 파싱 스킵:', dataStr, err);
              }
            }
          }
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('백엔드 지연/미응답 감지, 클라이언트 스마트 리딩 엔진으로 완벽 복구:', err);
      // 서버가 꺼져 있거나 지연되어도 사용자에게 절대 에러를 띄우지 않고 100% 정상 작동 보장!
      runFallbackReading();
    }
  };

  const flipCard = (index) => {
    setFlippedCards((prev) => {
      const updated = [...prev];
      updated[index] = true;
      return updated;
    });
  };

  const flipAllCards = () => {
    setFlippedCards([true, true, true]);
  };

  const handleReset = () => {
    setCards([]);
    setFlippedCards([false, false, false]);
    setAiReading('');
    setShareMetadata({ one_line_summary: '', hashtags: [] });
    setIsStreamComplete(false);
  };

  const handleDownloadStoryImage = async () => {
    if (!shareCardRef.current) return;
    setIsCapturing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#D8B4E2',
        logging: false,
      });

      const fileName = `AI타로_인스타스토리_${formData.name || '운명'}.png`;

      // 1. 모바일 기기: Web Share API 지원 시 바로 사진 저장/인스타 공유 시트 띄우기
      if (navigator.share && navigator.canShare) {
        try {
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            const file = new File([blob], fileName, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: `${formData.name || '내담자'}님의 AI 타로 운명 신탁`,
                text: shareMetadata.one_line_summary || '오늘의 AI 타로 운세 결과',
              });
              setIsCapturing(false);
              return;
            }
          }
        } catch (shareErr) {
          console.log('Web Share 취소 또는 미지원, 일반 다운로드로 전환:', shareErr);
        }
      }

      // 2. 모바일 브라우저/PC 공통 Blob 다운로드 (iOS 사파리/안드로이드 크롬 완벽 호환)
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Canvas blob generation failed');
        }
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      }, 'image/png');

    } catch (error) {
      console.error('스토리 이미지 캡처 실패:', error);
      alert('이미지 생성 중 문제가 발생했습니다. 브라우저 설정을 확인해 주세요.');
    } finally {
      setIsCapturing(false);
    }
  };

  const allFlipped = flippedCards.length === 3 && flippedCards.every(Boolean);

  return (
    <div className="min-h-screen bg-[#D8B4E2] text-gray-800 flex flex-col justify-between py-6 px-4 sm:px-6 md:py-10 transition-colors">
      <div className="max-w-md md:max-w-xl lg:max-w-4xl mx-auto w-full flex-1 flex flex-col items-center">
        {/* 상단 캐주얼 헤더 */}
        <header className="w-full text-center mb-6 md:mb-8">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/70 text-purple-700 font-semibold text-xs mb-3 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>AI Tarot Guide</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
            운명의 AI 타로
          </h1>
          <p className="text-gray-700/80 text-xs sm:text-sm mt-1.5 font-medium">
            3장의 카드를 뽑고 당신의 고민에 대한 따뜻한 조언을 들어보세요.
          </p>
        </header>

        {/* 메인 콘텐츠 영역 */}
        <main className="w-full flex-1 flex flex-col items-center">
          {/* 1. 입력 폼 (흰색 카드, 둥근 모서리, 부드러운 그림자) */}
          {cards.length === 0 && !isLoading && (
            <div className="w-full bg-white rounded-3xl p-6 sm:p-8 md:p-10 shadow-sm border border-white/60">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <span>✨</span> 고민 시작하기
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  타로 마스터에게 물어볼 정보를 적어주세요.
                </p>
              </div>

              <form onSubmit={handleDrawCards} className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 pl-1">
                      이름 (또는 별명)
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="이름을 입력하세요"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full bg-gray-100 border-none rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 pl-1">
                      생년월일 (8자리)
                    </label>
                    <input
                      type="text"
                      name="birthdate"
                      required
                      maxLength={8}
                      placeholder="예: 19980521"
                      value={formData.birthdate}
                      onChange={handleInputChange}
                      className="w-full bg-gray-100 border-none rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 pl-1">
                    지금 마음에 품은 고민
                  </label>
                  <textarea
                    name="concern"
                    required
                    rows={4}
                    placeholder="어떤 고민이 있으신가요? 편하게 적어주세요."
                    value={formData.concern}
                    onChange={handleInputChange}
                    className="w-full bg-gray-100 border-none rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 transition resize-none"
                  ></textarea>
                </div>

                {/* 결제 모듈 안내 뱃지 */}
                <div className="flex items-center gap-3 p-3.5 bg-purple-50 rounded-2xl border border-purple-100">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-bold text-purple-900">첫 1회 무료 리딩 체험</p>
                    <p className="text-purple-600/80 text-[11px]">결제 연동 준비 완료 • 지금 바로 확인해보세요</p>
                  </div>
                  <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-6 rounded-2xl font-bold text-base bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md active:scale-[0.99] transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Wand2 className="w-5 h-5" />
                  운명의 카드 3장 뽑기
                </button>
              </form>
            </div>
          )}

          {/* 2. 로딩 화면 */}
          {isLoading && (
            <div className="w-full bg-white rounded-3xl p-10 sm:p-14 shadow-sm border border-white/60 flex flex-col items-center justify-center text-center my-auto">
              <div className="w-16 h-16 rounded-3xl bg-purple-100 flex items-center justify-center text-3xl mb-5 animate-bounce">
                🔮
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1">
                {loadingStepText}
              </p>
              <p className="text-xs text-gray-500">
                카드가 신비로운 답변을 정리하고 있어요.
              </p>
            </div>
          )}

          {/* 3. 카드 및 리딩 결과 화면 */}
          {cards.length > 0 && (
            <div className="w-full flex flex-col items-center space-y-6">
              {/* 상단 컨트롤 바 */}
              <div className="w-full flex justify-between items-center bg-white/70 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-sm border border-white/80">
                <span className="text-xs font-semibold text-gray-600">
                  카드를 터치해 앞면을 확인하세요
                </span>
                <div className="flex gap-2">
                  {!allFlipped && (
                    <button
                      onClick={flipAllCards}
                      className="text-xs px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition cursor-pointer"
                    >
                      모두 뒤집기
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold border border-gray-200 flex items-center gap-1 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> 다시 하기
                  </button>
                </div>
              </div>

              {/* 타로 카드 그리드 (이미지 원본 비율 유지 + 하단 별도 분리 설명칸 + 극적인 3D 회전) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-6 w-full items-start">
                {cards.map((card, idx) => {
                  const isFlipped = flippedCards[idx];
                  return (
                    <div
                      key={card.id || idx}
                      className="flex flex-col items-center w-full"
                    >
                      {/* 상단 위치 뱃지 (과거, 현재, 미래) */}
                      <span className="text-xs font-bold text-purple-700 bg-white/90 px-3.5 py-1 rounded-full shadow-xs mb-2.5">
                        {card.position}
                      </span>

                      {/* 3D 플립 카드 본체 (768:1376 원본 비율 유지하여 이미지 잘림 현상 100% 방지) */}
                      <div
                        onClick={() => flipCard(idx)}
                        className="w-full max-w-[260px] aspect-[768/1376] perspective-1200 cursor-pointer group"
                      >
                        <div
                          className={`w-full h-full relative card-3d-inner transform-style-3d rounded-3xl ${
                            isFlipped ? 'flipped burst-glow' : 'hover:-translate-y-2 hover:shadow-xl'
                          }`}
                        >
                          {/* 카드 뒷면 (Back) - 원본 이미지 100% 온전하게 표시 */}
                          <div className="absolute inset-0 w-full h-full backface-hidden rounded-3xl bg-white p-1.5 shadow-md border-2 border-purple-200 overflow-hidden">
                            <div className="w-full h-full rounded-2xl overflow-hidden relative">
                              <img
                                src="/tarot/card_back.png"
                                alt="Tarot Card Back"
                                className="w-full h-full object-contain rounded-2xl bg-slate-900"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-x-0 bottom-3 flex justify-center">
                                <span className="text-[11px] font-bold text-white bg-purple-900/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-white/20 shadow-sm animate-pulse">
                                  터치하여 확인 ✨
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 카드 앞면 (Front) - 22장 아르카나 이미지 100% 온전하게 표시 */}
                          <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-3xl bg-white p-1.5 shadow-md border-2 border-purple-300 overflow-hidden">
                            <div className="w-full h-full rounded-2xl overflow-hidden relative bg-slate-950 flex items-center justify-center">
                              {card.image_url ? (
                                <img
                                  src={card.image_url}
                                  alt={card.name}
                                  className="w-full h-full object-contain rounded-2xl"
                                />
                              ) : (
                                <div className="text-6xl">{card.image_symbol || '🔮'}</div>
                              )}
                              <span className="absolute top-2.5 right-2.5 text-[10px] font-bold text-purple-700 bg-white/95 backdrop-blur-sm px-2.5 py-0.5 rounded-full shadow-xs">
                                NO. {card.id}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 카드 하단 별도 설명 분리 칸 (카드가 뒤집혔을 때 부드럽게 등장) */}
                      {isFlipped ? (
                        <div className="w-full max-w-[260px] bg-white rounded-2xl p-3.5 mt-3 shadow-sm border border-purple-100 text-center animate-fade-in-up">
                          <h3 className="font-extrabold text-gray-900 text-sm md:text-base">
                            {card.name}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                            {card.meaning}
                          </p>
                          <div className="mt-2 text-center text-[10px] font-bold text-purple-700 bg-purple-50 py-1 rounded-lg">
                            {card.position}의 카드
                          </div>
                        </div>
                      ) : (
                        <div className="w-full max-w-[260px] py-2 mt-3 text-center">
                          <span className="text-[11px] text-purple-800/70 font-medium">
                            카드를 탭하여 의미를 열어보세요
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 4. 타로 마스터 조언 패널 (모든 카드가 뒤집혔을 때) */}
              {allFlipped && (
                <div
                  ref={readingRef}
                  className="w-full bg-white rounded-3xl p-6 sm:p-8 md:p-10 shadow-sm border border-white/60 animate-fade-in-up mt-2"
                >
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center text-xl">
                        🧙‍♂️
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">
                          타로 마스터의 조언
                        </h3>
                        <p className="text-xs text-gray-500">
                          {formData.name}님을 위한 3문단 리딩
                        </p>
                      </div>
                    </div>
                    {!isStreamComplete && (
                      <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full animate-pulse">
                        작성 중...
                      </span>
                    )}
                  </div>

                  <div className="text-gray-800 text-sm sm:text-base leading-relaxed">
                    {aiReading ? (
                      <ReactMarkdown
                        components={{
                          h3: ({ node, ...props }) => (
                            <h3
                              className="text-base sm:text-lg font-extrabold text-purple-900 mt-5 mb-2 pb-1 border-b border-purple-100 flex items-center gap-1.5"
                              {...props}
                            />
                          ),
                          p: ({ node, ...props }) => (
                            <p
                              className="text-gray-700 leading-[1.8] mb-4 font-normal tracking-normal"
                              {...props}
                            />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong
                              className="font-bold text-purple-900 bg-purple-50 px-1 py-0.5 rounded"
                              {...props}
                            />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="leading-relaxed" {...props} />
                          )
                        }}
                      >
                        {aiReading}
                      </ReactMarkdown>
                    ) : (
                      <div className="py-6 text-center text-gray-400">
                        답변을 준비하고 있습니다...
                      </div>
                    )}
                  </div>

                  {isStreamComplete && (
                    <div className="mt-8 pt-5 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* 인스타 스토리에 자랑하기 메인 버튼 */}
                      <button
                        onClick={handleDownloadStoryImage}
                        disabled={isCapturing}
                        className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transform active:scale-95 transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4 text-pink-200" />
                        <span>{isCapturing ? '스토리 이미지 제작 중...' : '📸 인스타 스토리에 자랑하기'}</span>
                      </button>

                      <button
                        onClick={handleReset}
                        className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs sm:text-sm transition cursor-pointer"
                      >
                        새로운 고민 점치기
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* 푸터 */}
      <footer className="text-center text-xs text-purple-900/60 mt-8">
        © 2026 AI Tarot. All rights reserved.
      </footer>

      {/* ==============================================================
          [인스타 스토리 공유용 9:16 캡처 뷰 (화면 밖 렌더링)]
          극도의 감성과 바이럴을 유도하는 몽환적 파스텔 오로라 & 부채꼴 카드 배치
          ============================================================== */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        <div
          ref={shareCardRef}
          id="share-card-view"
          style={{ width: '450px', height: '800px' }}
          className="relative bg-gradient-to-br from-indigo-300 via-purple-200 to-pink-300 p-8 flex flex-col justify-between overflow-hidden shadow-2xl text-gray-900 font-sans"
        >
          {/* 오로라 블러 & 몽환적 조명 레이어 */}
          <div className="absolute top-[-80px] left-[-80px] w-80 h-80 bg-purple-400/40 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-[-60px] right-[-60px] w-80 h-80 bg-pink-400/40 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/20 rounded-full blur-2xl pointer-events-none"></div>

          {/* 1. 상단 브랜딩 & 타로 본 사람의 이름 (000님) */}
          <div className="relative z-10 flex justify-between items-center pt-2">
            <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-xs border border-white/70">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[11px] font-black text-purple-900 tracking-wider">COSMIC TAROT</span>
            </div>
            
            {/* 타로 본 사람 이름 강조 뱃지 */}
            <div className="flex items-center gap-1.5 bg-purple-900/85 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full shadow-md border border-purple-300/40">
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping"></span>
              <span className="text-xs font-black tracking-wide">
                {formData.name ? `${formData.name}님의 운명 신탁` : '당신을 위한 운명 신탁'}
              </span>
            </div>
          </div>

          {/* 2. 중앙 부채꼴(Fan Spread) 카드 배치 */}
          <div className="relative z-10 w-full h-72 flex items-center justify-center my-auto">
            {cards.length === 3 && (
              <>
                {/* 1번 카드 (과거) - 왼쪽 회전 */}
                <div
                  className="absolute w-40 aspect-[768/1376] rounded-2xl bg-white p-1 shadow-2xl border-2 border-white/80 transition transform origin-bottom"
                  style={{
                    transform: 'translateX(-54px) translateY(8px) rotate(-14deg)',
                    zIndex: 10
                  }}
                >
                  <img
                    src={cards[0].image_url}
                    alt={cards[0].name}
                    className="w-full h-full object-contain rounded-xl bg-slate-900"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-[9px] font-bold text-white px-2 py-0.5 rounded-full">
                    과거
                  </div>
                </div>

                {/* 2번 카드 (현재) - 중앙 살짝 돌출 */}
                <div
                  className="absolute w-40 aspect-[768/1376] rounded-2xl bg-white p-1 shadow-2xl border-2 border-purple-200 transition transform origin-bottom"
                  style={{
                    transform: 'translateY(-12px) rotate(0deg)',
                    zIndex: 20
                  }}
                >
                  <img
                    src={cards[1].image_url}
                    alt={cards[1].name}
                    className="w-full h-full object-contain rounded-xl bg-slate-900 ring-2 ring-purple-400/40"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute top-2 left-2 bg-purple-700/80 backdrop-blur-xs text-[9px] font-bold text-white px-2 py-0.5 rounded-full">
                    현재
                  </div>
                </div>

                {/* 3번 카드 (미래) - 오른쪽 회전 */}
                <div
                  className="absolute w-40 aspect-[768/1376] rounded-2xl bg-white p-1 shadow-2xl border-2 border-white/80 transition transform origin-bottom"
                  style={{
                    transform: 'translateX(54px) translateY(8px) rotate(14deg)',
                    zIndex: 10
                  }}
                >
                  <img
                    src={cards[2].image_url}
                    alt={cards[2].name}
                    className="w-full h-full object-contain rounded-xl bg-slate-900"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-[9px] font-bold text-white px-2 py-0.5 rounded-full">
                    미래
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. 하단 글래스모피즘 박스 (내담자 이름 + 원라인 요약 + 해시태그) */}
          <div className="relative z-10 w-full bg-white/75 backdrop-blur-xl border border-white/80 p-5 rounded-3xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-purple-700 text-xs font-bold">
                <span>🔮</span>
                <span>{formData.name ? `${formData.name}님을 위한 한마디` : '오늘의 마스터 한마디'}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">AI Oracle</span>
            </div>
            
            <p className="text-gray-900 font-black text-[15px] leading-snug tracking-tight mb-3.5">
              "{shareMetadata.one_line_summary || (formData.name ? `${formData.name}님을 기다리는 가장 찬란한 운명의 전환점` : '당신의 마음이 가리키는 곳으로 담대하게 걸어가세요.')}"
            </p>

            <div className="flex flex-wrap gap-1.5">
              {(shareMetadata.hashtags && shareMetadata.hashtags.length > 0
                ? shareMetadata.hashtags
                : ['#운명의타로', '#결국해낼사람', '#내편이되어줄우주']
              ).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-bold text-purple-800 bg-purple-100/80 px-2.5 py-1 rounded-full border border-purple-200/60"
                >
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          </div>

          {/* 4. 바이럴 훅 (인스타 스티커 스타일의 가짜 링크 버튼) */}
          <div className="relative z-10 w-full flex justify-center pb-1">
            <div className="w-full py-3 px-4 rounded-full bg-white/95 backdrop-blur-md text-gray-900 font-black text-xs text-center shadow-md border border-purple-200 flex items-center justify-center gap-2">
              <span className="text-purple-600 text-sm">👉</span>
              <span>내 운세도 무료로 보기 : <span className="text-purple-700 underline underline-offset-2">운명의 AI 타로 신탁</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
