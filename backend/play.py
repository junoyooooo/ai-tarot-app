"""별똥별 받기(미니게임) · 별가루 · 꾸미기 아이템 카탈로그.

비용 안전 원칙: 별가루 보상은 하루 상한(PLAY_DAILY_STARDUST)이 서버에 있어 점수와 상관없이 넘지 않고,
코인으로 바꾸는 것은 기기당 일주일에 한 번뿐입니다. 아이템은 모양만 바꾸는 것이라 비용이 들지 않습니다.
"""
from typing import Dict

SLOTS = ("hat", "glasses", "clothes", "shoes")

# id -> (슬롯, 이름, 별가루 가격). 그림은 프론트(frontend/src/lib/items.jsx)에 같은 id 로 있어요.
ITEMS: Dict[str, dict] = {
    "g_sun": {"slot": "glasses", "name": "선글라스", "price": 0},  # 처음 선물
    "g_round": {"slot": "glasses", "name": "동글 안경", "price": 8},
    "g_heart": {"slot": "glasses", "name": "하트 안경", "price": 10},
    "g_star": {"slot": "glasses", "name": "별 안경", "price": 12},
    "h_beanie": {"slot": "hat", "name": "비니", "price": 8},
    "h_party": {"slot": "hat", "name": "파티 고깔", "price": 8},
    "h_cap": {"slot": "hat", "name": "야구 모자", "price": 10},
    "h_straw": {"slot": "hat", "name": "밀짚모자", "price": 10},
    "h_crown": {"slot": "hat", "name": "왕관", "price": 16},
    "c_scarf": {"slot": "clothes", "name": "빨간 목도리", "price": 12},
    "c_bow": {"slot": "clothes", "name": "나비넥타이", "price": 10},
    "c_necklace": {"slot": "clothes", "name": "별 목걸이", "price": 12},
    "c_cape": {"slot": "clothes", "name": "망토", "price": 18},
    "s_slipper": {"slot": "shoes", "name": "슬리퍼", "price": 8},
    "s_sneaker": {"slot": "shoes", "name": "운동화", "price": 10},
    "s_boot": {"slot": "shoes", "name": "장화", "price": 12},
}
STARTER = tuple(i for i, v in ITEMS.items() if v["price"] == 0)


def reward_for(score: int) -> int:
    """한 판 보상: 기본 1, 점수가 높으면 +1, +1. (하루 상한은 서버가 따로 걸어요)"""
    s = max(0, int(score))
    return 1 + (1 if s >= 10 else 0) + (1 if s >= 20 else 0)
