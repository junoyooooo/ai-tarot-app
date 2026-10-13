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

주의: sandbox 는 운영에서 절대 켜지 마세요. 위기(109) 응답은 어떤 경우에도 잠기거나 유료가 되지 않습니다.
개발용: `python backend/dev_fake_llm.py` (API 키 없이 화면 확인), 테스트: `pip install -r backend/requirements-dev.txt && pytest backend`.
미구현(추후): 카카오 로그인, 친구 초대 코인, 월간 리포트.
