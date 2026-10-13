import store as store_mod
from conftest import H
import main
import time


def seed_readings(n, dev, created=None):
    for i in range(n):
        main.STORE.save_reading({
            "id": f"r{dev}{i}{time.time()}", "device_id": dev, "category": "etc", "concern": "x",
            "cards": [], "free_text": "a", "locked_text": "", "meta": {}, "unlocked": True,
        })


def test_rank_and_bonus_once(client):
    dev = "c" * 20
    seed_readings(5, dev)
    r = client.post("/api/cardbox/claim", headers=H(dev)).json()
    assert r["total"] == 5 and r["rank"]["current"]["name"] == "카드 수집가"
    assert sum(g["stardust"] for g in r["granted"]) == 3  # 5장 계급(2) + 이번 달 3장 스티커(1)
    again = client.post("/api/cardbox/claim", headers=H(dev)).json()
    assert again["granted"] == []  # 두 번 받을 수 없다
    st = client.get("/api/play/state", headers=H(dev)).json()
    assert st["stardust"] == 3


def test_month_sticker_tiers(client):
    dev = "d" * 20
    seed_readings(8, dev)
    r = client.post("/api/cardbox/claim", headers=H(dev)).json()
    needs = sorted(s["need"] for s in r["stickers"])
    assert needs == [3, 8] and r["month_count"] == 8


def test_other_device_count_is_separate(client):
    seed_readings(3, "e" * 20)
    r = client.get("/api/cardbox", headers=H("f" * 20)).json()
    assert r["total"] == 0 and r["rank"]["current"] is None and r["rank"]["next"]["need"] == 1
