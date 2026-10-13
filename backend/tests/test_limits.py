import json
import main
from conftest import H
from test_monetization import BODY, FULL, fake_stream, run, unlocked_reading


def post_reading(client, body=BODY, dev=None):
    return client.post("/api/tarot/reading/stream", json=body, headers=H(dev) if dev else H())


def test_free_device_daily_reading_limit(client, env):
    env.setenv("PAYWALL_ENABLED", "false")
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    for _ in range(3):
        assert post_reading(client).status_code == 200
    r = post_reading(client)
    assert r.status_code == 429
    d = r.json()["detail"]
    assert d["code"] == "daily_limit" and d["scope"] == "device"
    # 다른 기기는 영향 없음
    assert post_reading(client, dev="other_" + "e" * 20).status_code == 200


def test_paid_device_gets_higher_limit(client, env):
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    p = client.post("/api/checkout/prepare", json={"sku": "coin_5"}, headers=H()).json()
    client.post("/api/checkout/sandbox-confirm", json={"order_id": p["order_id"]}, headers=H())
    codes = [post_reading(client).status_code for _ in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429


def test_global_limit_blocks_new_readings_only(client, env):
    env.setattr(main, "LIMIT_GLOBAL_READINGS", 2)
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    assert post_reading(client, dev="a1_" + "f" * 20).status_code == 200
    assert post_reading(client, dev="a2_" + "f" * 20).status_code == 200
    r = post_reading(client, dev="a3_" + "f" * 20)
    assert r.status_code == 429 and r.json()["detail"]["scope"] == "global"


def test_failed_generation_returns_quota(client, env):
    env.setenv("PAYWALL_ENABLED", "false")

    async def boom(u, s):
        raise RuntimeError("x")
        yield  # pragma: no cover

    env.setattr(main, "stream_reading", boom)
    for _ in range(5):
        r = post_reading(client)
        assert r.status_code == 200 and "generation_failed" in r.text
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    assert post_reading(client).status_code == 200  # 실패한 5번은 횟수에 포함되지 않음


def test_crisis_is_never_limited(client, env):
    env.setenv("PAYWALL_ENABLED", "false")
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    for _ in range(3):
        post_reading(client)
    assert post_reading(client).status_code == 429
    assert post_reading(client, {**BODY, "concern": "죽고 싶어요"}).status_code == 200


def test_extra_limit_and_no_charge_when_blocked(client, env):
    env.setattr(main, "LIMIT_EXTRA_FREE", 1)
    rid, _ = unlocked_reading(client, env, coins=5)

    async def gen(system, prompt, **kw):
        return "답이에요."

    env.setattr(main, "generate_text", gen)
    assert client.post(f"/api/reading/{rid}/followup", json={"question": "첫 질문이에요"}, headers=H()).status_code == 200
    coins = client.get("/api/wallet", headers=H()).json()["coins"]
    r = client.post(f"/api/reading/{rid}/followup", json={"question": "둘째 질문이에요"}, headers=H())
    assert r.status_code == 429 and r.json()["detail"]["code"] == "daily_limit"
    assert client.get("/api/wallet", headers=H()).json()["coins"] == coins  # 코인 차감 없음
    # 풀이 열기는 한도와 무관하게 계속 가능 (이미 만든 상담)
    assert client.post(f"/api/reading/{rid}/unlock", headers=H()).status_code == 200


def test_insufficient_coins_does_not_burn_quota(client, env):
    env.setattr(main, "LIMIT_EXTRA_FREE", 1)
    env.setattr(main, "FOLLOWUP_FREE", 0)
    rid, _ = unlocked_reading(client, env, coins=1)  # 풀이 열기에 1개 쓰고 0개
    r = client.post(f"/api/reading/{rid}/followup", json={"question": "코인이 없어요"}, headers=H())
    assert r.status_code == 402

    async def gen(system, prompt, **kw):
        return "답이에요."

    env.setattr(main, "generate_text", gen)
    client.post("/api/checkout/prepare", json={"sku": "coin_1"}, headers=H())
    p = client.post("/api/checkout/prepare", json={"sku": "coin_1"}, headers=H()).json()
    client.post("/api/checkout/sandbox-confirm", json={"order_id": p["order_id"]}, headers=H())
    r = client.post(f"/api/reading/{rid}/followup", json={"question": "이제 코인이 있어요"}, headers=H())
    assert r.status_code == 200  # 402 로 막힌 시도는 횟수를 쓰지 않았다


def test_limits_can_be_disabled_and_config(client, env):
    c = client.get("/api/config").json()
    assert c["limits"]["reading_free"] == 3 and c["limits"]["extra_paid"] == 20
    env.setattr(main, "LIMITS_ENABLED", False)
    env.setenv("PAYWALL_ENABLED", "false")
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    assert all(post_reading(client).status_code == 200 for _ in range(6))
