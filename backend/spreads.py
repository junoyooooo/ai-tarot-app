"""고민 분야별 스프레드(카드 3장의 '자리')와 상담 분야 이름."""
from typing import Dict, List

CATEGORY_LABELS: Dict[str, str] = {
    "love": "연애",
    "work": "직장·진로",
    "money": "재물",
    "study": "공부·시험",
    "relation": "인간관계",
    "etc": "그 밖의 고민",
}

# label: 화면에 보이는 자리 이름 / emoji: 소제목 이모지 / tail: 소제목 뒷부분 / role: 모델에게 알려 주는 자리의 역할
SPREADS: Dict[str, dict] = {
    "default": {
        "label": "과거·현재·미래",
        "positions": [
            {"label": "과거", "emoji": "🕰️", "tail": "카드가 비추는 지난 시간", "role": "이 고민이 생겨난 배경과 원인"},
            {"label": "현재", "emoji": "👁️", "tail": "카드가 짚어주는 지금", "role": "지금의 마음과 상황의 핵심"},
            {"label": "미래", "emoji": "🔮", "tail": "카드가 여는 앞으로의 길", "role": "이어질 흐름과 열려 있는 가능성"},
        ],
    },
    "love": {
        "label": "그 사람 마음",
        "positions": [
            {"label": "내 마음", "emoji": "💗", "tail": "카드가 말하는 내 마음", "role": "내가 진짜 바라는 것과 숨겨 둔 감정"},
            {"label": "상대 마음", "emoji": "💭", "tail": "카드가 전하는 그 사람의 마음", "role": "상대가 느끼고 있을 법한 감정과 입장(상대가 특정되지 않았다면 '다가올 인연'으로 풀이, 상대 마음을 단정하지 말 것)"},
            {"label": "우리의 흐름", "emoji": "🌙", "tail": "카드가 보여주는 우리의 흐름", "role": "관계가 앞으로 흘러갈 방향과 내가 할 수 있는 일"},
        ],
    },
    "work": {
        "label": "일의 방향",
        "positions": [
            {"label": "지금 상황", "emoji": "💼", "tail": "카드가 비추는 지금의 상황", "role": "현재 일과 환경의 핵심"},
            {"label": "걸림돌", "emoji": "🧱", "tail": "카드가 짚어주는 걸림돌", "role": "나아가는 데 발목을 잡는 요인(외부 요인과 내 마음 모두)"},
            {"label": "나아갈 길", "emoji": "🧭", "tail": "카드가 여는 나아갈 길", "role": "택할 수 있는 방향과 현실적인 다음 단계"},
        ],
    },
    "money": {
        "label": "돈의 흐름",
        "positions": [
            {"label": "지금 흐름", "emoji": "💰", "tail": "카드가 비추는 돈의 흐름", "role": "지금 돈과 맺고 있는 관계와 흐름"},
            {"label": "새는 곳", "emoji": "🕳️", "tail": "카드가 짚어주는 새는 곳", "role": "불안, 습관, 선택 중 돈이 새거나 막히는 지점"},
            {"label": "열리는 기회", "emoji": "🌱", "tail": "카드가 여는 기회", "role": "현실적으로 시도해 볼 수 있는 기회와 방향(투자 수익을 단정하지 말 것)"},
        ],
    },
    "study": {
        "label": "성장의 길",
        "positions": [
            {"label": "지금의 나", "emoji": "📖", "tail": "카드가 비추는 지금의 나", "role": "준비 상태와 지금의 마음가짐"},
            {"label": "걸림돌", "emoji": "🧱", "tail": "카드가 짚어주는 걸림돌", "role": "집중이나 성과를 막는 요인"},
            {"label": "힘이 될 것", "emoji": "✨", "tail": "카드가 건네는 힘", "role": "나를 밀어 줄 습관, 사람, 태도"},
        ],
    },
    "relation": {
        "label": "관계의 방향",
        "positions": [
            {"label": "나의 모습", "emoji": "🪞", "tail": "카드가 비추는 나의 모습", "role": "이 관계 속에서 내가 취하는 태도와 감정"},
            {"label": "상대 입장", "emoji": "🤝", "tail": "카드가 전하는 상대의 입장", "role": "상대가 처한 상황과 바라는 것(단정하지 말고 가능성으로)"},
            {"label": "관계의 방향", "emoji": "🧭", "tail": "카드가 여는 관계의 방향", "role": "관계가 나아갈 수 있는 모습과 내가 할 수 있는 일"},
        ],
    },
}

CATEGORY_SPREAD = {
    "love": "love",
    "work": "work",
    "money": "money",
    "study": "study",
    "relation": "relation",
    "etc": "default",
}


def spread_for(category: str) -> dict:
    key = CATEGORY_SPREAD.get(category, "default")
    return {"key": key, **SPREADS[key]}


def position_labels(category: str) -> List[str]:
    return [p["label"] for p in spread_for(category)["positions"]]
