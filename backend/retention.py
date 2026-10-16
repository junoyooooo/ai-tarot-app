"""재방문 장치: 연속 출석(스트릭) 보상, 달 주기·주간 시즌 이벤트, 친구 초대 규칙.

비용 안전 원칙: 모든 보상은 별가루뿐이고(AI 호출 0원), 하루 한 번 / 초대는 주간 상한이 서버에 있어요.
"""
from datetime import date, timedelta
from typing import Dict, Optional

# 연속 N일째에 추가로 받는 별가루 (기본 매일 1)
STREAK_BASE = 1
STREAK_MILESTONES: Dict[int, int] = {3: 1, 7: 3, 14: 4, 30: 8}
LUNAR_BONUS = 2  # 새달·보름달 날 보너스

INVITE_BONUS_INVITER = 5
INVITE_BONUS_INVITEE = 5
INVITE_WEEKLY_MAX = 5  # 한 사람이 한 주에 초대로 받을 수 있는 최대 횟수
INVITE_PER_IP_DAILY = 2
INVITE_MAX_ACCOUNT_AGE_DAYS = 7  # 가입(처음 접속) 후 이 기간 안에만 초대 코드를 쓸 수 있어요

# (이름, 이모지, 한 줄, 추천 고민 종류) — 주차(ISO week)마다 돌아가요
SEASONS = [
    ("새싹 주간", "🌱", "작은 시작을 응원하는 한 주예요. 미뤄 둔 일을 카드에게 물어볼까요?", "work"),
    ("달빛 주간", "🌙", "마음이 차분해지는 한 주예요. 지난 일을 돌아보는 상담이 잘 어울려요.", "etc"),
    ("하트 주간", "💗", "관계를 돌보는 한 주예요. 연애·인간관계 고민을 꺼내 보세요.", "love"),
    ("별빛 주간", "✨", "원하는 걸 선명하게 그려 보는 한 주예요. 진로·목표를 물어보세요.", "work"),
]

_SYNODIC = 29.530588853
_REF_NEW_MOON_JD = 2451550.26  # 2000-01-06 18:14 UTC


def streak_reward(streak: int) -> int:
    return STREAK_BASE + STREAK_MILESTONES.get(streak, 0)


def next_milestone(streak: int) -> Optional[Dict[str, int]]:
    for n in sorted(STREAK_MILESTONES):
        if n > streak:
            return {"day": n, "bonus": STREAK_MILESTONES[n], "left": n - streak}
    return None


def _jd_noon_kst(day: str) -> float:
    d = date.fromisoformat(day)
    # 한국 시간 정오 = 03:00 UTC
    n = d.toordinal() - date(2000, 1, 1).toordinal()
    return 2451544.5 + n + 3 / 24


def moon_age(day: str) -> float:
    return (_jd_noon_kst(day) - _REF_NEW_MOON_JD) % _SYNODIC


def lunar_event(day: str) -> Optional[Dict[str, object]]:
    """새달(삭)·보름달(망) 근처 하루. 천문 계산을 단순화한 근사라 실제와 하루쯤 차이 날 수 있어요."""
    age = moon_age(day)
    if age <= 0.5 or age >= _SYNODIC - 0.5:
        return {"key": "new", "name": "새달", "emoji": "🌑", "line": "새로 시작하기 좋은 날이에요. 소원 하나를 정해 보세요.", "bonus": LUNAR_BONUS}
    if abs(age - _SYNODIC / 2) <= 0.5:
        return {"key": "full", "name": "보름달", "emoji": "🌕", "line": "마음이 가득 차오르는 날이에요. 고마운 일을 떠올려 보세요.", "bonus": LUNAR_BONUS}
    return None


def season_for(day: str) -> Dict[str, object]:
    d = date.fromisoformat(day)
    wk = d.isocalendar()[1]
    name, emoji, line, cat = SEASONS[wk % len(SEASONS)]
    return {"name": name, "emoji": emoji, "line": line, "category": cat}


def yesterday_of(day: str) -> str:
    return (date.fromisoformat(day) - timedelta(days=1)).isoformat()


def push_message(streak: int, checked_today: bool, day: str) -> Dict[str, str]:
    lunar = lunar_event(day)
    if lunar:
        return {"title": f"{lunar['emoji']} 오늘은 {lunar['name']}이에요", "body": f"카드 한 장 뽑고 별가루 {lunar['bonus']}개 더 받아가세요."}
    if streak >= 2 and not checked_today:
        return {"title": f"🔥 {streak}일 연속 중이에요", "body": "오늘의 카드를 뽑으면 연속 기록이 이어져요."}
    options = [
        ("🔮 오늘의 카드가 도착했어요", "토닥토닥 별빛타로가 오늘 하루를 응원해요."),
        ("✨ 카드 한 장, 확인해 볼까요?", "오늘의 한마디가 기다리고 있어요."),
        ("🌙 마음에 걸리는 일 있나요?", "카드에게 가볍게 물어보세요."),
    ]
    t, b = options[date.fromisoformat(day).toordinal() % len(options)]
    return {"title": t, "body": b}
