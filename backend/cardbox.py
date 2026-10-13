"""카드 보관함: 상담(공유 카드)을 모을수록 올라가는 계급과 월간 스티커.
장수는 서버에 저장된 상담 수로 세기 때문에 앱을 조작해서 늘릴 수 없고, 보상은 한 번씩만 받는다."""
from typing import Dict, List, Tuple

# (필요 장수, 칭호, 아이콘, 별가루 보너스)
RANKS: List[Tuple[int, str, str, int]] = [
    (1, "새싹 점술가", "🌱", 0),
    (5, "카드 수집가", "🃏", 2),
    (10, "달빛 점술가", "🌙", 2),
    (20, "별자리 안내자", "✨", 3),
    (40, "운명의 마스터", "🔮", 5),
]

# 한 달에 이만큼 모으면 그 달 스티커 (필요 장수, 이름, 별가루 보너스)
MONTH_TIERS: List[Tuple[int, str, int]] = [
    (3, "스티커", 1),
    (8, "반짝 스티커", 2),
]


def rank_for(total: int) -> Dict:
    cur = None
    for need, name, icon, _ in RANKS:
        if total >= need:
            cur = {"need": need, "name": name, "icon": icon}
    nxt = next(({"need": n, "name": nm, "icon": ic} for n, nm, ic, _ in RANKS if total < n), None)
    return {"current": cur, "next": nxt}


def eligible(total: int, by_month: Dict[str, int]) -> List[Tuple[str, int, str]]:
    """지금까지 도달한 보상 [(키, 별가루, 이름)]. 이미 받은 것은 호출한 쪽에서 걸러낸다."""
    out: List[Tuple[str, int, str]] = []
    for need, name, icon, bonus in RANKS:
        if total >= need:
            out.append((f"rank:{need}", bonus, f"{icon} {name}"))
    for month, n in by_month.items():
        for need, name, bonus in MONTH_TIERS:
            if n >= need:
                out.append((f"month:{month}:{need}", bonus, f"{int(month[5:7])}월 {name}"))
    return out
