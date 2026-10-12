# AI 타로 웹앱 (AI Tarot Web App)

AI 기반 운세 및 조언을 제공하는 타로 웹 애플리케이션 1단계 보일러플레이트입니다.

## 📁 프로젝트 구조
```text
ai-tarot-app/
├── backend/
│   ├── main.py              # FastAPI 서버, OpenAI GPT-4o 연동 및 SSE 스트리밍
│   ├── tarot_cards.json     # 타로 카드 데이터베이스 (테스트용 및 확장 가능)
│   ├── requirements.txt     # Python 의존성 목록
│   └── .env.example         # 환경변수 예시 파일
└── frontend/
    ├── src/
    │   ├── App.jsx          # 타로 입력 폼, 결제 모듈 자리, 3D 플립 애니메이션, 스트리밍 뷰
    │   ├── main.jsx         # 엔트리 포인트
    │   └── index.css        # Tailwind 및 3D 플립 스타일 정의
    ├── index.html           # 신비로운 우주 테마 HTML 및 폰트
    ├── tailwind.config.js   # Tailwind 커스텀 테마
    ├── vite.config.js       # Vite 프록시 및 번들러 설정
    └── package.json
```

---

## 🚀 실행 방법

### 1. 백엔드 실행 (FastAPI)
```bash
cd backend

# 가상환경 생성 및 활성화 (선택)
python3 -m venv venv
source venv/bin/activate

# 의존성 패키지 설치
pip install -r requirements.txt

# OpenAI API Key 환경변수 설정
export OPENAI_API_KEY="sk-..."

# 서버 실행 (포트 8000)
uvicorn main:app --reload --port 8000
```
> **참고**: `OPENAI_API_KEY`가 설정되지 않은 경우에도 정상적으로 테스트할 수 있도록 시뮬레이션 리딩 데이터가 자동으로 반환됩니다.

### 2. 프론트엔드 실행 (React + Vite)
```bash
cd frontend

# 패키지 설치 (이미 완료됨)
npm install

# 개발 서버 실행 (포트 5173)
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

---

## 🌟 구현된 핵심 기능
1. **FastAPI & OpenAI (GPT-4o)**:
   - 과거, 현재, 미래 3장 랜덤 추첨 및 Temperature 0.85 적용.
   - 단일 JSON 응답(`/api/tarot/reading`) 및 **실시간 SSE 스트리밍(`/api/tarot/reading/stream`)** 구현.
2. **신비로운 우주 다크 테마**:
   - `bg-slate-950`, 퍼플/인디고 그라데이션 및 별빛 배경.
   - 모바일 반응형 완벽 대응.
3. **타로 카드 3D 플립(Flip) 애니메이션**:
   - 카드 클릭 시 3D `rotateY` 회전 효과로 앞면 공개.
   - 3장의 카드가 모두 뒤집히면 타로 마스터의 3문단 조언 영역이 부드럽게 나타남.
4. **결제 모듈(토스페이먼츠 등) 플레이스홀더**:
   - `handleDrawCards` 및 `processPayment` 함수 내에 결제 모듈 연동 가이드 및 자리 표시기 포함.
