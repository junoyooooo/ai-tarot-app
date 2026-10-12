import json
import random
import os
import asyncio
from typing import List, Optional, AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# .env 파일 로드
ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_PATH)

app = FastAPI(title="AI Tarot Reading API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 타로 카드 데이터 로드
CARDS_FILE = os.path.join(os.path.dirname(__file__), "tarot_cards.json")
try:
    with open(CARDS_FILE, "r", encoding="utf-8") as f:
        TAROT_DB = json.load(f).get("cards", [])
except Exception as e:
    TAROT_DB = []

# Google AI Studio (Gemini) 클라이언트 초기화
gemini_client = None
gemini_api_key = os.getenv("GEMINI_API_KEY")

if gemini_api_key:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=gemini_api_key)
        print("✅ Google AI Studio (Gemini) Client successfully initialized.")
    except Exception as e:
        print(f"⚠️ Google GenAI initialization failed: {e}")

class TarotCard(BaseModel):
    id: int
    name: str
    arcana: Optional[str] = "Major"
    meaning: str
    image_symbol: Optional[str] = "🔮"
    image_url: Optional[str] = None
    position: Optional[str] = None  # 과거, 현재, 미래

class ReadingRequest(BaseModel):
    name: str = Field(..., description="내담자 이름")
    birthdate: str = Field(..., description="생년월일 (YYYYMMDD)")
    concern: str = Field(..., description="고민 내용")

class ReadingResponse(BaseModel):
    cards: List[TarotCard]
    reading: str
    one_line_summary: str = Field(..., description="뼈를 때리거나 감동을 주는 인스타 공유용 1줄 요약")
    hashtags: List[str] = Field(..., description="인스타 스토리 공유용 해시태그 목록")

SYSTEM_PROMPT = """너는 판에 박힌 해석을 하는 기계가 아니라, 아늑한 카페에서 내담자의 이야기를 진심으로 들어주는 세련되고 따뜻한 20년 경력의 타로 마스터야. 내담자의 '이름', '생년월일', '고민'을 바탕으로 소름 돋을 정도로 정확하고 위로가 되는 리딩을 제공해.

반드시 다음 5가지 원칙을 지켜서 JSON의 'reading' 필드를 작성해:
1. **기계적인 포맷 절대 금지**: '과거/현재/미래 카드는~', '첫째/둘째', '요약하자면', '결론적으로' 같은 AI 특유의 뻔한 접속사와 템플릿을 절대 쓰지 마. 매번 글의 시작과 전개 방식을 다르게(랜덤하게) 구성해.
2. **완벽한 개인화**: 내담자의 '이름'을 다정하게 부르고, '생년월일'이 주는 계절감이나 기운(예: 봄에 태어난, 겨울의 단단함을 가진 등)을 은유적으로 살짝 녹여내서 '이건 진짜 나만을 위한 이야기다'라고 느끼게 만들어.
3. **스토리텔링**: 3장의 카드를 개별적으로 설명하지 마. 카드의 이름과 상징을 내담자의 '고민' 상황에 100% 빗대어 하나의 연결된 에세이처럼 부드럽게 엮어내.
4. **뼈 때리는 통찰과 다정한 위로의 믹스**: 무조건 좋은 말만 하지 마. 고민에 대한 깊은 공감(위로)을 주면서도, 카드가 말하는 현실적인 문제점(통찰)을 짚어주고, 당장 내일 실천할 수 있는 아주 작은 행동(액션 플랜)을 제안해.
5. **말투**: 다정하고 따뜻한 '해요체'를 사용하고, 마지막엔 내담자의 마음이 몽글몽글해져서 내일 또 찾아오고 싶게 만드는 감동적인 응원 한 줄로 마무리해. 문단은 읽기 편하게 3~4개로 나눠줘.

추가로 인스타그램 스토리 공유와 바이럴을 위해 다음 2가지 필드를 정성껏 작성해:
- **one_line_summary**: 내담자의 마음을 관통하거나 소름 돋게 감동을 주는 핵심 1줄 요약 (인스타 스토리에 크게 적힐 문구이므로 여운이 남고 흡입력 있게)
- **hashtags**: 고민 및 미래의 운명을 축복하는 트렌디하고 감각적인 해시태그 3~5개 (예: ["#인생의터닝포인트", "#결국해낼당신", "#마음의소리"])

반드시 지정된 JSON 규격으로만 응답해."""

def pick_three_cards() -> List[dict]:
    if len(TAROT_DB) < 3:
        raise HTTPException(status_code=500, detail="타로 카드 데이터가 부족합니다.")
    selected = random.sample(TAROT_DB, 3)
    positions = ["과거", "현재", "미래"]
    result = []
    for pos, card in zip(positions, selected):
        card_copy = dict(card)
        card_copy["position"] = pos
        result.append(card_copy)
    return result

def build_user_prompt(req: ReadingRequest, cards: List[dict]) -> str:
    cards_info = ", ".join([
        f"[{c['position']}] {c['name']} ({c['meaning']})" for c in cards
    ])
    return f"""내담자 이름: {req.name}
생년월일: {req.birthdate}
내담자의 현재 고민: {req.concern}
뽑힌 3장의 카드: {cards_info}

위 정보를 바탕으로, 내담자의 마음을 완벽하게 읽어내고 눈시울이 붉어질 만큼 감동적이고 예리한 리딩과 함께, 인스타 공유용 one_line_summary와 hashtags가 포함된 JSON을 작성해 줘."""

def generate_gemini_json(user_prompt: str) -> dict:
    from google.genai import types
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.85,
        response_mime_type="application/json",
        response_schema={
            "type": "OBJECT",
            "properties": {
                "reading": {"type": "STRING"},
                "one_line_summary": {"type": "STRING"},
                "hashtags": {"type": "ARRAY", "items": {"type": "STRING"}}
            },
            "required": ["reading", "one_line_summary", "hashtags"]
        }
    )
    response = gemini_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_prompt,
        config=config
    )
    return json.loads(response.text)

@app.get("/")
def read_root():
    return {
        "message": "AI Tarot API Server is running",
        "engine": "Google AI Studio (Gemini 2.5 Flash)" if gemini_client else "Simulation Mode"
    }

@app.post("/api/tarot/reading", response_model=ReadingResponse)
async def tarot_reading(req: ReadingRequest):
    """일반 단일 JSON 응답 엔드포인트"""
    cards = pick_three_cards()
    user_prompt = build_user_prompt(req, cards)
    
    if not gemini_client:
        return ReadingResponse(
            cards=[TarotCard(**c) for c in cards],
            reading=f"{req.name}님, 당신의 걸음 속에 보이지 않는 별빛이 함께하고 있습니다. 자신을 믿으세요.",
            one_line_summary=f"흔들림 끝에 피어날 {req.name}님만의 가장 눈부신 계절",
            hashtags=["#결국해낼사람", "#새로운시작", "#우주의응원"]
        )

    try:
        data = await asyncio.to_thread(generate_gemini_json, user_prompt)
        return ReadingResponse(
            cards=[TarotCard(**c) for c in cards],
            reading=data.get("reading", ""),
            one_line_summary=data.get("one_line_summary", ""),
            hashtags=data.get("hashtags", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API 호출 실패: {str(e)}")

@app.post("/api/tarot/reading/stream")
async def tarot_reading_stream(req: ReadingRequest):
    """Server-Sent Events(SSE) 실시간 스트리밍 엔드포인트 (타이핑 효과 + 인스타 메타데이터 전달)"""
    cards = pick_three_cards()
    user_prompt = build_user_prompt(req, cards)

    async def event_generator() -> AsyncGenerator[str, None]:
        # 1. 뽑힌 카드 정보 먼저 전달
        cards_data = json.dumps({"type": "cards", "data": cards}, ensure_ascii=False)
        yield f"data: {cards_data}\n\n"

        if not gemini_client:
            sample_reading = f"{req.name}님, 지나온 시간은 결코 헛되지 않았습니다. 다가올 미래는 찬란합니다."
            for char in sample_reading:
                yield f"data: {json.dumps({'type': 'content', 'data': char}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.02)
            meta = {
                "one_line_summary": f"가장 어두운 밤을 지나 곧 밝아올 {req.name}님의 아침",
                "hashtags": ["#운명의신탁", "#믿는대로된다", "#꽃길예약"]
            }
            yield f"data: {json.dumps({'type': 'meta', 'data': meta}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        try:
            # Gemini 2.5 Flash에서 구조화된 JSON 생성
            data = await asyncio.to_thread(generate_gemini_json, user_prompt)
            reading_text = data.get("reading", "")
            meta_data = {
                "one_line_summary": data.get("one_line_summary", ""),
                "hashtags": data.get("hashtags", [])
            }

            # 글자가 타이핑되듯 부드럽게 청크 단위 스트리밍
            chunk_size = 3
            for i in range(0, len(reading_text), chunk_size):
                chunk = reading_text[i:i + chunk_size]
                yield f"data: {json.dumps({'type': 'content', 'data': chunk}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.015)

            # 인스타 공유용 메타데이터 전달
            yield f"data: {json.dumps({'type': 'meta', 'data': meta_data}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            err_data = json.dumps({"type": "error", "data": str(e)}, ensure_ascii=False)
            yield f"data: {err_data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
