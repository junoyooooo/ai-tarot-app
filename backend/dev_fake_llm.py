"""API 키 없이 화면·결제 흐름을 확인하는 개발용 서버.  사용: python dev_fake_llm.py  (포트 8000)
실제 서비스에는 절대 사용하지 마세요."""
import asyncio, os
import uvicorn
import main


async def fake_stream(user_prompt, system_prompt):
    import re
    names = re.findall(r"^\d\. \[([^\]]+)\] (.+?) — ", user_prompt, re.M)
    cat_label = re.search(r"고민 분야: (.+)", user_prompt)
    pos = {p["label"]: p for sp in __import__("spreads").SPREADS.values() for p in sp["positions"]}
    labels = [pos[l] for l, _ in names]
    parts = []
    for p, (_, nm) in zip(labels, names):
        parts.append(
            f"### {p['emoji']} [{p['label']}] {nm} {p['tail']}\n> 이 카드는 흐름과 용기를 상징해요.\n"
            f"고민에 비춰 보면 지금은 {p['label']}을(를) 차분히 바라볼 때예요. 작은 것부터 해 보세요.\n\n"
        )
    parts.append("### ✨ 마스터의 한마디\n서두르지 않아도 괜찮아요. 오늘은 한 걸음만 가 보세요.")
    text = "".join(parts)
    for i in range(0, len(text), 6):
        await asyncio.sleep(0.02)
        yield ("content", text[i:i + 6])
    yield ("meta", {"one_line_summary": "작은 한 걸음이 흐름을 바꿔요", "hashtags": ["#타로", "#오늘의운세"]})


async def fake_text(system, prompt, **kw):
    await asyncio.sleep(0.3)
    return "이 카드는 한 걸음 물러나 바라보라고 말해요. 오늘은 마음에 걸리는 일 하나만 적어 보세요."


main.gemini_client = object()
main.stream_reading = fake_stream
main.generate_text = fake_text

if __name__ == "__main__":
    uvicorn.run(main.app, host="127.0.0.1", port=int(os.getenv("PORT", "8000")))
