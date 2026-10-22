# 수익화 기능 가이드

모든 기능은 기본이 **꺼짐(전부 무료)** 입니다. 서버(Render) 환경변수로 켭니다.

| 변수 | 값 | 설명 |
|---|---|---|
| PAYWALL_ENABLED | true | 세 번째 카드 + 마스터의 한마디를 코인으로 잠금, 코인/상점 UI 표시 |
| PAYMENTS_MODE | off / sandbox / toss | off: "결제 준비 중" / sandbox: 가짜 결제(테스트 전용) / toss: 토스페이먼츠 |
| TOSS_CLIENT_KEY, TOSS_SECRET_KEY | 토스 키 | toss 모드에서 필요 |
| DB_PATH | 예: /var/data/tarot.db | 영구 디스크 필수 (Render 무료는 재시작 시 코인 소실) |
| GEMINI_MODEL_PREMIUM | 예: gemini-2.5-pro | 조언 카드·후속 질문에 쓸 모델 |
| UNLOCK_COST / ADVICE_COST / FOLLOWUP_COST / FOLLOWUP_MAX / WELCOME_COINS | 숫자 | 기본 1/1/1/3/1 |
| FOLLOWUP_FREE | 0 | 상담마다 코인 없이 물어볼 수 있는 횟수. 기본 0이라 코인이 없으면 "더 물어보기"가 잠겨 보여요 |

주의: sandbox 는 운영에서 절대 켜지 마세요. 위기(109) 응답은 어떤 경우에도 잠기거나 유료가 되지 않습니다.
개발용: `python backend/dev_fake_llm.py` (API 키 없이 화면 확인), 테스트: `pip install -r backend/requirements-dev.txt && pytest backend`.
미구현(추후): 월간 리포트.

## 공유·분석 설정 (프론트엔드, Vercel 환경변수)
- VITE_SHARE_URL: 공유 이미지 QR·주소·공유 글에 들어가는 앱 주소 (도메인/짧은 주소로 바꾸면 여기만 수정)
- VITE_UMAMI_WEBSITE_ID, VITE_UMAMI_SRC: Umami 분석 (비우면 꺼짐). 공유로 들어온 방문은 utm_source=share 로 구분돼요.
- 기록하는 이벤트: consult_start, unlock, checkout_start, share_save, share_native, share_copy_link (개인정보는 보내지 않음)

## 사업자 정보 (Vercel 환경변수, 도움말 > 사업자 정보에 표시)
VITE_BIZ_NAME, VITE_BIZ_REP, VITE_BIZ_REG_NO, VITE_BIZ_ECOMM_NO, VITE_BIZ_ADDRESS, VITE_BIZ_EMAIL, VITE_BIZ_PHONE
비워 두면 '준비 중'으로 보여요. 이용약관·환불 규정(frontend/src/screens/Help.jsx)은 초안이니 결제를 열기 전에 꼭 검토해 주세요.

## 하루 이용 한도 (Render 환경변수, 한국시간 자정 초기화)
| 변수 | 기본 | 설명 |
|---|---|---|
| LIMITS_ENABLED | true | false 면 한도 전체 해제 |
| LIMIT_READING_FREE | 3 | 코인을 쓴 적 없는 기기의 하루 상담 수 |
| LIMIT_READING_PAID | 10 | 코인을 충전한 적 있는 기기의 하루 상담 수 |
| LIMIT_EXTRA_FREE / LIMIT_EXTRA_PAID | 6 / 20 | 하루 조언 카드+후속 질문 합계 |
| LIMIT_GLOBAL_READINGS | 3000 | 서비스 전체 하루 상담 수 (비용 안전장치) |
한도에 걸리면 코인은 차감되지 않고, 생성 실패 시 횟수도 돌려줘요. 이미 한 상담의 잠금 해제와 위기(109) 응답은 한도와 무관해요.

## 별똥별 마을 (미니게임·별가루·꾸미기)
| 변수 | 기본 | 설명 |
|---|---|---|
| PLAY_ENABLED | true | false 면 게임·꾸미기 숨김 |
| PLAY_PLAYS_PER_DAY | 2 | 하루 판 수 |
| PLAY_DAILY_STARDUST | 6 | 하루 별가루 상한 (점수와 무관) |
| PLAY_MIN_SECONDS | 15 | 한 판이 최소 이 시간 이상이어야 정산 |
| RPG_PLAYS_PER_DAY | 2 | 타로 RPG(걱정덩어리 물리치기) 하루 판 수. 승패는 서버가 판정하고, 별가루는 별 게임과 같은 하루 상한(PLAY_DAILY_STARDUST)을 함께 써요 |
| PLAY_EXCHANGE_COST | 30 | 별가루 → 코인 1개 교환 비용 (결제 기능이 켜졌을 때만, 기기당 주 1회) |
| PLAY_EXCHANGE_PER_IP_WEEKLY | 2 | 같은 네트워크에서 주당 교환 가능 횟수 |
- 아이템 목록·가격: backend/play.py, 그림: frontend/src/lib/items.jsx (같은 id), 마스코트별 착용 위치: frontend/src/lib/mascotAnchors.js
- 새 마스코트 그림을 바꾸면 mascotAnchors.js 의 좌표도 다시 맞춰 주세요.
- 비용: 게임·아이템은 AI 호출이 없어 0원이에요. 코인으로 바뀌는 건 주 1회 상담 1회분(약 8원)이 최대예요.

## 카카오 로그인
- Render 환경변수: `KAKAO_REST_API_KEY`(필수, 비어 있으면 로그인 버튼이 안 보여요), `KAKAO_CLIENT_SECRET`(카카오에서 클라이언트 시크릿을 켠 경우).
- 리다이렉트 URI는 카카오 콘솔에 `https://<프론트 주소>/` 를 등록하세요. 서버는 `ALLOWED_ORIGINS`(또는 `KAKAO_REDIRECT_URIS`)에 있는 주소만 받아요.
- 로그인하면 카카오 회원번호가 기기 ID(코인·별가루가 묶인 키)에 연결돼요. 다른 기기에서 같은 회원이 로그인하면 처음 기기의 ID를 받아 같은 기록을 이어 써요. 상담 기록(풀이 내용)은 기기에만 저장돼요.
- 계정 표(`accounts`)도 SQLite라, 영구 디스크나 외부 DB로 옮기기 전에는 서버 재시작 때 연결이 사라질 수 있어요.

## 카드 보관함 (계급·월간 스티커)
- 상담이 끝나면 공유 카드가 자동으로 기기의 보관함에 담겨요(기록을 지워도 남음). 계급과 스티커는 서버에 저장된 상담 수로 세서 앱을 조작해도 늘릴 수 없고, 보상은 한 번씩만 받아요.
- 보상표는 `backend/cardbox.py`(계급: 1·5·10·20·40장, 월간 스티커: 3장·8장, 별가루 보너스 포함)에서 바꿔요. 별가루 보너스는 `PLAY_ENABLED`일 때만 지급돼요.


## 구글 로그인
- 구글 클라우드 콘솔 → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션) 만들기.
- 승인된 자바스크립트 원본에 `https://ai-tarot-app-tau.vercel.app` (테스트용 `http://localhost:5173`) 추가. 리디렉션 URI는 필요 없어요.
- Render 환경변수 `GOOGLE_CLIENT_ID` 에 클라이언트 ID(공개값)를 넣으면 로그인 버튼이 켜져요. 클라이언트 보안 비밀은 쓰지 않아요.

## 결제는 로그인한 사람만
- 실제 결제(`PAYMENTS_MODE=toss`)에서는 로그인(구글/카카오) 안 한 기기는 코인 충전이 막히고, 충전창에 로그인 안내가 떠요(서버도 403으로 막아요).
- 로그인 수단이 하나도 켜져 있지 않으면 막지 않아요. 끄려면 `PAY_REQUIRES_LOGIN=false`.
- 테스트 결제(sandbox)에서는 적용하지 않아요.


## 영구 DB (Turso)
- Render 무료 플랜의 디스크는 재시작 때 지워져요. 계정·코인·별가루를 지키려면 Turso(libSQL, 무료 플랜 있음)에 저장해요.
- Render 환경변수 `TURSO_DATABASE_URL`(libsql://… 주소)과 `TURSO_AUTH_TOKEN`(비밀, 채팅·코드에 올리지 않기)을 넣으면 자동으로 Turso를 써요. 없으면 예전처럼 파일 SQLite(`DB_PATH`)를 써요.
- 확인: 서버 주소 뒤에 `/health` 를 열어 `"db":"turso"` 가 보이면 연결된 거예요.
- Turso 주소가 설정돼 있는데 연결에 실패하면, 임시 파일 DB 로 조용히 넘어가지 않고 배포가 실패해요(데이터가 사라지는 걸 막기 위해). Render 는 실패한 배포 대신 이전 버전을 계속 유지해요.
- 시험: `TEST_STORE=libsql python -m pytest` 로 같은 테스트를 libsql 연결 껍데기로 돌려요.

## 오류 알림 (텔레그램)

서버에 오류(ERROR 로그)가 나면 텔레그램으로 알려 줘요. 환경변수 두 개를 Render 에만 넣으세요(채팅·코드에 붙이지 마세요).

- `TELEGRAM_BOT_TOKEN` : BotFather 가 준 봇 토큰
- `TELEGRAM_CHAT_ID` : 알림 받을 채팅 번호

없으면 꺼져 있어요. `…/health` 의 `"alerts": true` 로 켜졌는지 보고, `…/health?test_alert=true` 로 시험 알림을 보낼 수 있어요.
같은 오류는 10분에 한 번, 전체로 한 시간에 20개까지만 보내요.

## Gemini 분당 한도(429) 대응

Gemini 무료 등급은 분당·일일 요청 수가 제한돼요(숫자는 바뀌므로 AI Studio → 사용량/한도 화면에서 우리 프로젝트의 실제 값을 확인하세요).
한도에 닿으면 `GEMINI_MODEL_FALLBACK`(기본 `gemini-2.5-flash-lite`)로 한 번 더 시도해요. 모델마다 한도가 따로 계산돼서 버틸 여유가 생겨요. 끄려면 빈 값으로 설정하세요.
이용자가 늘면 Google AI Studio에서 결제(Tier 1)를 연결하는 것이 가장 확실한 해결책이에요.

## 재방문 장치 (연속 출석 · 달 주기/주간 시즌 · 친구 초대 · 웹 푸시)
보상은 전부 별가루(AI 비용 0원)이고, 서버가 하루 한 번·주간 상한으로 막아요. `backend/retention.py` 에서 숫자를 바꿔요.
| 변수 | 기본 | 설명 |
|---|---|---|
| RETENTION_ENABLED | true | false 면 출석·초대·알림 전부 숨김 |
| INVITE_WEEKLY_MAX | 5 | 한 사람이 한 주에 초대로 보상받을 수 있는 최대 횟수 |
| VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT | (없음) | 웹 푸시용. `python backend/gen_vapid.py` 로 만든 값을 Render 환경변수에 직접 넣어요(채팅·깃허브에 붙이지 마세요) |
| PUSH_CRON_SECRET | (없음) | 푸시 발송 주소를 보호하는 비밀 값. GitHub 저장소 Secrets 의 `PUSH_CRON_SECRET` 과 같은 값 |
- 연속 출석: 오늘의 카드를 뽑으면 하루 한 번 기록돼요. 기본 ⭐+1, 3·7·14·30일째 보너스(⭐+1/+3/+4/+8). 하루 건너뛰면 1일부터 다시 시작해요.
- 새달·보름달 날은 출석 보너스 ⭐+2 (천문 근사 계산이라 실제와 하루쯤 차이 날 수 있어요). 그 외에는 주간 시즌 안내(새싹·달빛·하트·별빛 주간)가 홈에 나와요.
- 친구 초대: 공유 링크·QR 에 `?ref=내코드` 가 자동으로 붙고, 새 기기가 처음 열면 서버가 한 번만 둘 다 ⭐+5 를 줘요(가입 7일 안, 같은 네트워크 하루 2명, 초대하는 쪽 주 5명까지).
- 웹 푸시: 매일 오전 9시 5분(한국)에 `.github/workflows/daily-push.yml` 이 `/api/push/send-daily` 를 불러요. 아이폰은 홈 화면에 설치한 뒤에만 알림을 켤 수 있어요.
- 분석 이벤트: app_open, daily_draw, checkin, share_copy_text, invite_share, invite_redeem, push_on/off, funnel(step: welcome_view → welcome_start → onboarding_1·2·… → onboarding_done) 로 첫 카드까지 이탈 지점을 볼 수 있어요.

## 앱인토스(토스 앱) 인앱결제
토스 앱(프론트가 `X-Platform: toss` 헤더를 보냄)에서만 코인·결제가 켜져요. 웹에는 영향이 없어요.
| 변수 | 설명 |
|---|---|
| TOSS_PAYWALL_ENABLED | true 면 토스 앱에서만 코인 잠금·충전 UI가 켜져요 |
| TOSS_MTLS_CERT_PATH / TOSS_MTLS_KEY_PATH | 앱인토스 콘솔에서 받은 mTLS 인증서·개인키 경로. Render Secret Files 는 `/etc/secrets/<파일이름>` |
| TOSS_IAP_SKU_COIN3 | 콘솔에 등록한 '별빛 코인 3개' 상품 ID (기본값 내장) |
- 서버는 `POST /api/checkout/toss-iap` 에서 앱인토스 `get-order-status`(mTLS)로 주문을 확인한 뒤(PAYMENT_COMPLETED/PURCHASED + sku 일치), 같은 주문 ID는 한 번만 지급해요.
- 인증서가 없으면 토스 앱의 충전 화면은 '준비 중'으로 보여요.
