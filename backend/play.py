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


# ───────── 타로 RPG(걱정덩어리 물리치기): 승패·피해량은 전부 서버가 정해요 ─────────
RPG_PLAYER_HP = 20
RPG_MONSTER_HP = 18
RPG_MONSTER_DMG = (2, 5)
RPG_REWARD = {"win": 3, "lose": 1, "flee": 0}  # 별가루 (하루 총 상한은 별 게임과 함께 서버가 따로 걸어요)

# id(타로 번호) -> (이름, 종류, 최소, 최대, 한 줄 설명). 종류: attack | heal | shield | mix | risk
RPG_DECK = {
    1: ("마법사", "attack", 4, 8, "별빛 마법을 날려요"),
    3: ("여황제", "heal", 4, 8, "따뜻한 기운으로 체력을 회복해요"),
    7: ("전차", "attack", 3, 6, "힘차게 돌진해요"),
    8: ("힘", "mix", 3, 5, "공격하고 조금 회복해요"),
    9: ("은둔자", "shield", 0, 0, "다음 반격을 막아요"),
    13: ("죽음", "risk", 8, 11, "강력하지만 나도 3 다쳐요"),
    17: ("별", "mix", 2, 3, "작게 공격하고 크게 회복해요"),
    0: ("광대", "attack", 1, 12, "무슨 일이 생길지 몰라요"),
}


def rpg_new_state() -> dict:
    return {"hp": RPG_PLAYER_HP, "mhp": RPG_MONSTER_HP, "shield": False, "turn": 0, "over": None}


def rpg_turn(state: dict, action: str, rng) -> dict:
    """한 턴을 진행하고 (새 상태, 연출용 기록)을 돌려준다. rng 는 random.Random 같은 객체."""
    if state.get("over"):
        raise ValueError("over")
    s = dict(state)
    log = {"card": None, "dealt": 0, "healed": 0, "self": 0, "blocked": False, "monster": 0}
    if action == "flee":
        s["over"] = "flee"
        return s, log
    cid = rng.choice(list(RPG_DECK))
    name, kind, lo, hi, desc = RPG_DECK[cid]
    val = rng.randint(lo, hi) if hi else 0
    log["card"] = {"id": cid, "name": name, "kind": kind, "desc": desc}
    if kind == "attack" or kind == "risk":
        s["mhp"] -= val
        log["dealt"] = val
        if kind == "risk":
            s["hp"] -= 3
            log["self"] = 3
    elif kind == "heal":
        gain = min(val, RPG_PLAYER_HP - s["hp"])
        s["hp"] += gain
        log["healed"] = gain
    elif kind == "shield":
        s["shield"] = True
    elif kind == "mix":
        s["mhp"] -= val
        log["dealt"] = val
        gain = min(5 if cid == 17 else 2, RPG_PLAYER_HP - s["hp"])
        s["hp"] += gain
        log["healed"] = gain
    s["turn"] += 1
    if s["mhp"] <= 0:
        s["mhp"] = 0
        s["over"] = "win"
        return s, log
    if s["hp"] <= 0:
        s["hp"] = 0
        s["over"] = "lose"
        return s, log
    dmg = rng.randint(*RPG_MONSTER_DMG)
    if s["shield"]:
        s["shield"] = False
        log["blocked"] = True
        dmg = 0
    s["hp"] -= dmg
    log["monster"] = dmg
    if s["hp"] <= 0:
        s["hp"] = 0
        s["over"] = "lose"
    return s, log
