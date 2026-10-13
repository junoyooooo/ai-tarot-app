# AI 타로

세 장의 카드로 고민을 들어주는 AI 타로 웹앱.

- **frontend**: React + Vite + Tailwind (Vercel)
- **backend**: FastAPI + Google Gemini (Render)

## 실행

```bash
# backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
echo "GEMINI_API_KEY=여기에_키" > .env
uvicorn main:app --reload

# frontend
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
```

## 환경변수

| 위치 | 이름 | 설명 |
|---|---|---|
| backend | `GEMINI_API_KEY` | 필수 |
| backend | `GEMINI_MODEL` | 기본 `gemini-2.5-flash` |
| backend | `ALLOWED_ORIGINS` | 쉼표 구분 허용 도메인 (기본: 배포 도메인 + localhost) |
| backend | `RATE_PER_MINUTE` / `RATE_PER_DAY` | IP당 요청 제한 (기본 4 / 40) |
| frontend | `VITE_API_BASE_URL` | 백엔드 주소 |

## 동작 방식

`POST /api/tarot/reading/stream` 이 SSE로 `cards → content* → meta → done` 순서로 보냅니다.
서버가 느리거나 실패하면 프론트가 `tarotData.js`의 로컬 리딩으로 자동 전환합니다.
