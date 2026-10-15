import main
from conftest import H


def play_once(client, score=25, dev=None):
    h = H(dev) if dev else H()
    r = client.post("/api/play/start", headers=h)
    if r.status_code != 200:
        return r
    return client.post("/api/play/claim", json={"run_id": r.json()["run_id"], "score": score}, headers=h)


def test_state_has_starter_and_catalog(client):
    d = client.get("/api/play/state", headers=H()).json()
    assert d["stardust"] == 0 and "g_sun" in d["items"] and d["plays_left"] == 2
    assert d["catalog"]["h_crown"]["price"] == 16


def test_too_fast_claim_rejected(client):
    r = client.post("/api/play/start", headers=H()).json()
    c = client.post("/api/play/claim", json={"run_id": r["run_id"], "score": 99}, headers=H())
    assert c.status_code == 400 and c.json()["detail"]["code"] == "too_fast"


def test_daily_cap_and_play_limit(client, env):
    env.setattr(main, "PLAY_MIN_SECONDS", 0)
    a = play_once(client, 25).json()
    assert a["gain"] == 3 and a["stardust"] == 3 and a["plays_left"] == 1
    b = play_once(client, 25).json()
    assert b["gain"] == 3 and b["stardust"] == 6
    assert b["plays_left"] == 0
    c = play_once(client, 25)  # 기본은 하루 2판
    assert c.status_code == 429 and c.json()["detail"]["code"] == "play_limit"


def test_cap_stops_extra_stardust(client, env):
    env.setattr(main, "PLAY_MIN_SECONDS", 0)
    env.setattr(main, "PLAY_PLAYS_PER_DAY", 3)
    play_once(client, 25)
    play_once(client, 25)
    c = play_once(client, 25).json()
    assert c["gain"] == 0 and c["capped"] and c["stardust"] == 6  # 하루 상한 6


def test_score_cannot_exceed_reward_tiers(client, env):
    env.setattr(main, "PLAY_MIN_SECONDS", 0)
    assert play_once(client, 0).json()["gain"] == 1
    assert play_once(client, 10).json()["gain"] == 2


def test_double_claim_rejected(client, env):
    env.setattr(main, "PLAY_MIN_SECONDS", 0)
    run = client.post("/api/play/start", headers=H()).json()["run_id"]
    assert client.post("/api/play/claim", json={"run_id": run, "score": 5}, headers=H()).status_code == 200
    r = client.post("/api/play/claim", json={"run_id": run, "score": 5}, headers=H())
    assert r.status_code == 400 and r.json()["detail"]["code"] == "already_claimed"


def test_other_device_cannot_claim_run(client, env):
    env.setattr(main, "PLAY_MIN_SECONDS", 0)
    run = client.post("/api/play/start", headers=H()).json()["run_id"]
    r = client.post("/api/play/claim", json={"run_id": run, "score": 5}, headers=H("z" * 20))
    assert r.status_code == 400


def test_buy_deducts_and_equip_validates(client, env):
    env.setattr(main, "PLAY_MIN_SECONDS", 0)
    env.setattr(main, "PLAY_DAILY_STARDUST", 100)
    env.setattr(main, "PLAY_PLAYS_PER_DAY", 3)
    for _ in range(3):
        play_once(client, 25)  # 9
    d = client.post("/api/play/buy", json={"item_id": "h_beanie"}, headers=H()).json()
    assert d["stardust"] == 1 and "h_beanie" in d["items"]
    resp = client.post("/api/play/equip", json={"equipped": {"hat": "h_beanie", "glasses": "g_sun"}, "main": 5}, headers=H())
    ok = resp.json()
    assert ok["equipped"] == {"hat": "h_beanie", "glasses": "g_sun"} and ok["main"] == 5
    bad = client.post("/api/play/equip", json={"equipped": {"hat": "h_crown"}}, headers=H())
    assert bad.status_code == 400  # 안 산 아이템
    wrong = client.post("/api/play/equip", json={"equipped": {"shoes": "h_beanie"}}, headers=H())
    assert wrong.status_code == 400  # 슬롯 불일치


def test_exchange_weekly_once_and_needs_stardust(client, env):
    env.setattr(main, "PLAY_MIN_SECONDS", 0)
    env.setattr(main, "PLAY_DAILY_STARDUST", 1000)
    env.setattr(main, "PLAY_PLAYS_PER_DAY", 100)
    assert client.post("/api/play/exchange", headers=H()).status_code == 402
    for _ in range(25):
        play_once(client, 25)  # 75
    base = client.get("/api/wallet", headers=H()).json()["coins"]
    d = client.post("/api/play/exchange", headers=H()).json()
    assert d["stardust"] == 45 and d["coins"] == base + 1
    again = client.post("/api/play/exchange", headers=H())
    assert again.status_code == 429 and again.json()["detail"]["code"] == "exchange_weekly"


def test_exchange_ip_weekly_cap(client, env):
    env.setattr(main, "PLAY_MIN_SECONDS", 0)
    env.setattr(main, "PLAY_DAILY_STARDUST", 1000)
    env.setattr(main, "PLAY_PLAYS_PER_DAY", 100)
    codes = []
    for i in range(3):
        dev = f"ipdev{i}_" + "q" * 16
        for _ in range(10):
            play_once(client, 25, dev)
        codes.append(client.post("/api/play/exchange", headers=H(dev)).status_code)
    assert codes == [200, 200, 429]


def test_exchange_closed_when_paywall_off(client, env):
    env.setenv("PAYWALL_ENABLED", "false")
    assert client.post("/api/play/exchange", headers=H()).status_code == 400


def test_play_requires_device(client):
    assert client.get("/api/play/state").status_code == 400


# ── 타로 RPG: 승패는 서버가 정한다 ──
def rpg_full(client, h=None):
    h = h or H()
    r = client.post("/api/rpg/start", headers=h)
    if r.status_code != 200:
        return r, None
    run = r.json()["run_id"]
    for _ in range(60):
        t = client.post("/api/rpg/turn", json={"run_id": run, "action": "card"}, headers=h).json()
        if t["state"]["over"]:
            return r, t
    raise AssertionError("끝나지 않음")


def test_rpg_finishes_and_rewards_within_cap(client):
    _, t = rpg_full(client)
    assert t["state"]["over"] in ("win", "lose")
    assert t["gain"] == (3 if t["state"]["over"] == "win" else 1)
    assert t["stardust"] == t["gain"]
    assert t["earned_today"] <= t["daily_cap"]


def test_rpg_daily_play_limit_and_no_turn_after_over(client):
    _, t1 = rpg_full(client)
    rpg_full(client)
    r3, _ = rpg_full(client)
    assert r3.status_code == 429
    run = client.post("/api/rpg/start", headers=H("o" * 20)).json()["run_id"]
    for _ in range(60):
        t = client.post("/api/rpg/turn", json={"run_id": run, "action": "card"}, headers=H("o" * 20)).json()
        if t["state"]["over"]:
            break
    again = client.post("/api/rpg/turn", json={"run_id": run, "action": "card"}, headers=H("o" * 20))
    assert again.status_code == 400


def test_rpg_run_belongs_to_device_and_flee_gives_nothing(client):
    run = client.post("/api/rpg/start", headers=H("a" * 20)).json()["run_id"]
    steal = client.post("/api/rpg/turn", json={"run_id": run, "action": "card"}, headers=H("b" * 20))
    assert steal.status_code == 400
    f = client.post("/api/rpg/turn", json={"run_id": run, "action": "flee"}, headers=H("a" * 20)).json()
    assert f["state"]["over"] == "flee" and f["gain"] == 0
