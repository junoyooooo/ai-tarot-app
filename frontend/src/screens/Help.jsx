import React, { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import Mascot from '../components/Mascot';
import { useWallet } from '../hooks/useWallet';
import { BUSINESS, SERVICE_NAME } from '../lib/business';

const won = (n) => `${n.toLocaleString('ko-KR')}원`;

function Section({ id, title, open, onToggle, children }) {
  return (
    <section className="rounded-[22px] bg-brand-50 overflow-hidden">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`help-${id}`}
          onClick={() => onToggle(id)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer"
        >
          <span className="text-[16px] font-extrabold text-ink">{title}</span>
          <ChevronDown className={`w-5 h-5 text-brand-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h2>
      {open && (
        <div id={`help-${id}`} className="px-5 pb-5 text-[14px] leading-[1.8] text-ink/85 break-keep space-y-3">
          {children}
        </div>
      )}
    </section>
  );
}

const Steps = ({ items }) => (
  <ol className="space-y-2.5">
    {items.map(([t, d], i) => (
      <li key={t} className="flex gap-3">
        <span className="shrink-0 w-6 h-6 rounded-full bg-brand-500 text-white text-[12px] font-extrabold flex items-center justify-center mt-0.5">{i + 1}</span>
        <p>
          <b className="text-ink">{t}</b>
          <br />
          <span className="text-ink/75">{d}</span>
        </p>
      </li>
    ))}
  </ol>
);

const FAQ = [
  ['AI가 직접 풀이를 쓰나요?', '네. 뽑힌 카드와 적어 주신 고민을 바탕으로 AI가 풀이를 써요. 같은 카드가 나와도 고민에 따라 이야기가 달라져요.'],
  ['풀이가 꼭 맞나요?', '타로는 재미와 위로를 위한 콘텐츠예요. 미래를 단정하지 않고 생각해 볼 방향을 건네는 용도로 봐 주세요. 건강, 법률, 투자 같은 중요한 결정은 전문가와 상의해 주세요.'],
  ['제 기록은 어디에 저장되나요?', '상담 기록과 프로필은 이 기기의 브라우저에만 저장돼요. 브라우저 데이터를 지우거나 다른 기기로 바꾸면 볼 수 없어요.'],
  ['코인이 사라졌어요.', '코인은 이 기기에 묶여 있어요. 브라우저 데이터를 지우거나 다른 기기·다른 브라우저로 접속하면 보이지 않을 수 있어요. 아래 문의처로 알려 주세요.'],
  ['결제했는데 코인이 안 들어왔어요.', '화면을 새로고침해 보세요. 그래도 없으면 결제 내역과 함께 문의해 주세요. 결제는 되고 코인이 지급되지 않은 경우 확인 후 바로 처리해 드려요.'],
  ['상담을 더 못 하겠다고 나와요.', '서비스를 안정적으로 유지하려고 하루에 이용할 수 있는 횟수가 정해져 있어요. 한국 시간 자정이 지나면 다시 이용할 수 있어요. 자세한 횟수는 위 ‘하루 이용 횟수’를 확인해 주세요.'],
  ['처음에 서버가 느려요.', '오래 사용하지 않으면 서버가 잠들어 있어서 첫 응답이 조금 늦을 수 있어요. 잠시 기다리면 정상으로 돌아와요.'],
  ['효과음을 끄고 싶어요.', '내 정보 → 소리와 진동에서 끌 수 있어요.'],
];

export default function Help({ onBack }) {
  const wallet = useWallet();
  const [open, setOpen] = useState('how');
  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));
  const cfg = wallet?.config;

  return (
    <div className="px-5 pt-6 pb-32 animate-slide-in">
      <button type="button" onClick={onBack} className="flex items-center gap-0.5 text-[14px] font-semibold text-mute cursor-pointer -ml-1">
        <ChevronLeft className="w-5 h-5" aria-hidden="true" /> 내 정보
      </button>

      <div className="mt-4 flex items-center gap-3">
        <Mascot id={18} className="w-14 h-16 shrink-0" />
        <div>
          <h1 className="text-[24px] font-extrabold text-ink leading-tight">도움말</h1>
          <p className="text-[13px] text-mute">사용법부터 요금, 약관까지 한곳에서 볼 수 있어요.</p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <Section id="how" title="이렇게 사용해요" open={open === 'how'} onToggle={toggle}>
          <Steps
            items={[
              ['분야 고르기', '연애, 직장·진로, 재물처럼 지금 가장 가까운 고민을 골라요. 분야마다 카드가 놓이는 자리가 달라져요.'],
              ['고민 적기', '어떤 상황인지, 무엇이 마음에 걸리는지 한두 문장이라도 구체적으로 적을수록 풀이가 가까워져요.'],
              ['카드 3장 고르기', '펼쳐진 카드 중에서 마음이 가는 3장을 골라요. 다시 누르면 취소할 수 있어요.'],
              ['카드 뒤집어 보기', '카드를 눌러 하나씩 뒤집거나 ‘모두 뒤집기’를 눌러요. 카드마다 내 고민에 맞춘 풀이가 나와요.'],
              ['기록·공유', '상담은 기록 탭에 쌓여요. 결과는 이미지로 저장하거나 친구에게 보낼 수 있어요.'],
            ]}
          />
          <p>
            <b className="text-ink">그 밖의 기능</b>
            <br />
            홈에서 하루에 한 장 ‘오늘의 카드’를 뽑을 수 있어요. 상담이 끝나면 조언 카드를 한 장 더 뽑거나, 카드에게 이어서 물어볼 수 있어요. 만난 카드의 운명이는 내 정보의 도감에 모여요.
          </p>
        </Section>

        <Section id="install" title="홈 화면에 앱처럼 설치하기" open={open === 'install'} onToggle={toggle}>
          <p>별빛타로는 앱스토어 없이 홈 화면에 아이콘을 놓고 앱처럼 쓸 수 있어요. 무료이고 용량도 거의 차지하지 않아요.</p>
          <p>
            <b className="text-ink">안드로이드(크롬)</b>
            <br />
            내 정보 탭이나 홈의 안내에서 ‘설치’를 누르거나, 크롬 오른쪽 위 ⋮ 메뉴에서 ‘홈 화면에 추가’를 골라요.
          </p>
          <p>
            <b className="text-ink">아이폰(사파리)</b>
            <br />
            아래쪽 공유 버튼을 누르고 ‘홈 화면에 추가’ → ‘추가’를 눌러요.
          </p>
          <p className="text-[13px] text-ink/70">카카오톡 안에서 연 화면에서는 설치가 안 돼요. 오른쪽 아래 ‘다른 브라우저로 열기’로 크롬·사파리에서 열어 주세요.</p>
        </Section>
        <Section id="coin" title="코인과 요금" open={open === 'coin'} onToggle={toggle}>
          {!cfg?.paywall_enabled ? (
            <p>지금은 모든 기능을 무료로 이용할 수 있어요. 앞으로 일부 기능에 코인이 필요해질 수 있고, 그때는 미리 알려 드릴게요.</p>
          ) : (
            <>
              <p>코인으로 풀이의 나머지 부분(마지막 카드와 마스터의 한마디), 조언 카드, 이어서 묻기를 이용해요.</p>
              <ul className="rounded-2xl bg-white/70 divide-y divide-brand-100 text-[14px]">
                <li className="flex justify-between px-4 py-2.5"><span>숨겨진 풀이 열기</span><b>🪙 {cfg.costs.unlock}</b></li>
                <li className="flex justify-between px-4 py-2.5"><span>조언 카드 한 장 더</span><b>🪙 {cfg.costs.advice}</b></li>
                <li className="flex justify-between px-4 py-2.5"><span>카드에게 더 물어보기 (상담당 최대 {cfg.followup_max}번)</span><b>🪙 {cfg.costs.followup}</b></li>
              </ul>
              {cfg.payments_mode !== 'off' && (
                <ul className="rounded-2xl bg-white/70 divide-y divide-brand-100 text-[14px]">
                  {cfg.products.map((p) => (
                    <li key={p.sku} className="flex justify-between px-4 py-2.5">
                      <span>
                        코인 {p.coins}개{p.first_only ? ' (첫 구매 한정)' : ''}
                      </span>
                      <b>{won(p.price)}</b>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[13px] text-ink/70">처음 오신 분께는 가입 코인이 한 번 주어져요. 가입 코인은 현금으로 환불되지 않아요.</p>
            </>
          )}
        </Section>

        {cfg?.limits?.enabled && (
          <Section id="limit" title="하루 이용 횟수" open={open === 'limit'} onToggle={toggle}>
            <p>서비스를 안정적으로 운영하려고 하루 이용 횟수에 한도를 두고 있어요. 한도는 한국 시간 자정에 다시 채워져요.</p>
            <ul className="rounded-2xl bg-white/70 divide-y divide-brand-100 text-[14px]">
              <li className="flex justify-between gap-3 px-4 py-2.5">
                <span>상담</span>
                <b className="text-right">하루 {cfg.limits.reading_free}번</b>
              </li>
              <li className="flex justify-between gap-3 px-4 py-2.5">
                <span>조언 카드 + 더 물어보기</span>
                <b className="text-right">합쳐서 하루 {cfg.limits.extra_free}번</b>
              </li>
              <li className="flex justify-between gap-3 px-4 py-2.5">
                <span>코인을 충전한 적이 있다면</span>
                <b className="text-right">상담 {cfg.limits.reading_paid}번, 조언·질문 {cfg.limits.extra_paid}번</b>
              </li>
            </ul>
            <p>한도 때문에 이용이 막힐 때는 코인이 차감되지 않아요. 이미 한 상담의 숨겨진 풀이를 여는 것은 한도와 상관없이 언제든 할 수 있어요.</p>
            <p>이용자가 한꺼번에 몰리면 새 상담이 하루 일찍 마감될 수 있어요. 마음이 힘든 이야기를 적어 주시면 한도와 상관없이 언제든 도움이 될 안내를 드려요.</p>
          </Section>
        )}

        {cfg?.play?.enabled && (
          <Section id="play" title="별똥별 마을·별가루" open={open === 'play'} onToggle={toggle}>
            <p>별똥별 받기 게임으로 별가루를 모아 운명이들에게 모자·안경·옷·신발을 입혀 줄 수 있어요. 게임은 무료예요.</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>하루 {cfg.play.plays_per_day}판까지 할 수 있고, 하루에 모을 수 있는 별가루는 최대 {cfg.play.daily_stardust}개예요. 점수가 높아도 이 상한은 그대로예요.</li>
              <li>대표 운명이는 상담이나 오늘의 카드에서 만난 친구 중에서 고를 수 있어요.</li>
              <li>이미 모자나 안경을 쓰고 있는 친구는 그 칸을 꾸밀 수 없어요.</li>
              {cfg.play.exchange_enabled && <li>별가루 {cfg.play.exchange_cost}개는 코인 1개로 바꿀 수 있어요. 일주일에 한 번만 바꿀 수 있어요.</li>}
              <li>별가루와 아이템은 이 기기에 연결돼요. 브라우저 데이터를 지워도 서버에는 남지만, 다른 기기로는 옮길 수 없어요.</li>
            </ul>
          </Section>
        )}

        <Section id="faq" title="자주 묻는 질문" open={open === 'faq'} onToggle={toggle}>
          <dl className="space-y-3.5">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt className="font-bold text-ink">{q}</dt>
                <dd className="text-ink/75">{a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="privacy" title="개인정보 안내" open={open === 'privacy'} onToggle={toggle}>
          <p>풀이를 만들 때 이름(또는 별명), 생년월일, 고민 내용이 AI 서버로 전달돼요. 풀이를 만드는 목적 외에는 사용하지 않아요.</p>
          <p>프로필과 상담 기록은 이 기기의 브라우저에 저장돼요. ‘내 정보 → 내 데이터 모두 삭제’로 언제든 지울 수 있어요.</p>
          <p>코인과 이어서 묻기·조언 카드를 위해 상담 내용이 서버에 임시로 보관될 수 있어요. 서버에 남은 기록의 삭제를 원하면 아래 문의처로 요청해 주세요.</p>
          <p>이용 통계는 개인을 식별하지 않는 방식으로만 수집해요.</p>
          <p><a href="/privacy" className="font-semibold text-brand-600 underline">개인정보처리방침 전체 보기</a></p>
        </Section>

        <Section id="terms" title="이용약관" open={open === 'terms'} onToggle={toggle}>
          <p><b className="text-ink">1. 서비스</b><br />{SERVICE_NAME}는 카드 풀이를 통해 재미와 위로를 드리는 엔터테인먼트 서비스예요. 풀이는 의학·법률·투자 등 전문적인 조언이 아니며, 결과에 따른 판단과 책임은 이용자에게 있어요.</p>
          <p><b className="text-ink">2. 이용자의 책임</b><br />타인의 정보를 도용하거나 서비스를 자동화 도구로 과도하게 호출하는 등 정상적인 이용을 방해하는 행위는 할 수 없어요. 위반 시 이용이 제한될 수 있어요.</p>
          <p><b className="text-ink">3. 코인</b><br />코인은 서비스 안에서만 쓰는 이용권이며 현금으로 바꾸거나 다른 사람에게 양도할 수 없어요. 코인은 이 기기에 연결돼 있어서 브라우저 데이터를 지우면 확인이 어려울 수 있어요. 충전한 코인은 구매일로부터 5년간 사용할 수 있어요.</p>
          <p><b className="text-ink">4. 서비스 변경·중단</b><br />기능과 가격은 미리 안내한 뒤 바꿀 수 있어요. 불가피하게 서비스를 종료할 때는 남은 유료 코인을 환불해 드려요.</p>
          <p><b className="text-ink">5. 면책</b><br />AI가 만든 풀이에는 부정확한 내용이 있을 수 있어요. 천재지변, 외부 서비스 장애 등 통제할 수 없는 사유로 서비스가 지연·중단되어도 책임이 제한될 수 있어요.</p>
          <p><a href="/terms" className="font-semibold text-brand-600 underline">이용약관 전체 보기</a></p>
        </Section>

        <Section id="refund" title="환불 규정" open={open === 'refund'} onToggle={toggle}>
          <p><b className="text-ink">구매 후 7일 이내, 사용하지 않은 코인</b>은 결제 취소(환불)할 수 있어요.</p>
          <p>코인을 일부 사용했다면, 이미 열람한 풀이·조언 카드·답변은 제공이 끝난 디지털 콘텐츠여서 그 부분은 환불되지 않아요. 남은 코인은 아래 문의처로 요청하면 확인 후 안내해 드려요.</p>
          <p>결제가 됐는데 코인이 지급되지 않았거나, 풀이가 생성되지 못했는데 코인이 차감된 경우에는 확인 즉시 지급·복구해 드려요. (풀이 생성에 실패하면 코인은 자동으로 돌려드려요.)</p>
          <p>가입 코인과 이벤트로 받은 코인은 환불 대상이 아니에요. 결제 취소 후 환불까지는 카드사에 따라 영업일 기준 며칠이 걸릴 수 있어요.</p>
        </Section>

        <Section id="biz" title="사업자 정보·문의" open={open === 'biz'} onToggle={toggle}>
          <dl className="rounded-2xl bg-white/70 divide-y divide-brand-100">
            {BUSINESS.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-[13.5px]">
                <dt className="text-mute shrink-0">{k}</dt>
                <dd className="text-right font-semibold text-ink break-all">{v || <span className="text-mute font-medium">준비 중</span>}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      <p className="mt-8 text-center text-[12px] text-mute leading-relaxed break-keep">
        타로는 재미와 위로를 위한 콘텐츠예요.
        <br />
        중요한 결정은 신중하게 내려 주세요.
      </p>
    </div>
  );
}
