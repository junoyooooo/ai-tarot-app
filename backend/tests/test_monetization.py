import json
import pytest
import main, payments
from conftest import H, DEV

BODY = {"name": "준호", "birthdate": "19900101", "concern": "이직을 해야 할지 고민이에요", "category": "work"}
FULL = (
    "### 🌙 [지금 상황] 별 (The Star)\n> 희망의 카드\n지금은 이직 고민이 커요.\n\n"
    "### 🪨 [걸림돌] 탑 (The Tower)\n> 흔들림\n불안이 걸림돌이에요.\n\n"
    "### 🌅 [나아갈 길] 태양 (The Sun)\n> 밝음\nSECRET_FUTURE 이직 후에는 밝아요.\n\n"
    "### ✨ 마스터의 한마디\nSECRET_SUMMARY 천천히 가요."
)


def fake_stream(chunks):
    async def _s(user_prompt, system_prompt):
        for c in chunks:
            yield ("content", c)
        yield ("meta", {"one_line_summary": "요약", "hashtags": ["#a"]})
    return _s


def split(text, n):
    return [text[i:i + n] for i in range(0, len(text), n)]


def run(client, body=BODY, headers=None):
    r = client.post("/api/tarot/reading/stream", json=body, headers=headers if headers is not None else H())
    assert r.status_code == 200
    evs = [json.loads(l[6:]) for l in r.text.split("\n\n") if l.startswith("data: ")]
    return evs


def text_of(evs):
    return "".join(e["data"] for e in evs if e["type"] == "content")


@pytest.mark.parametrize("n", [1, 2, 3, 5, 7, 11, 50, 10000])
def test_lock_never_leaks(client, env, n):
    env.setattr(main, "stream_reading", fake_stream(split(FULL, n)))
    evs = run(client)
    t = text_of(evs)
    assert "SECRET" not in t and "나아갈 길" not in t and "마스터의 한마디" not in t
    assert "[걸림돌]" in t
    assert any(e["type"] == "locked" for e in evs)
    raw = json.dumps(evs, ensure_ascii=False)
    assert "SECRET" not in raw


def test_unlock_flow(client, env):
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    evs = run(client)
    rid = next(e for e in evs if e["type"] == "cards")["reading_id"]
    # welcome coin = 1
    assert client.get("/api/wallet", headers=H()).json()["coins"] == 1
    r = client.post(f"/api/reading/{rid}/unlock", headers=H())
    assert r.status_code == 200 and "SECRET_FUTURE" in r.json()["text"] and r.json()["coins"] == 0
    # idempotent: no second charge
    r2 = client.post(f"/api/reading/{rid}/unlock", headers=H())
    assert r2.status_code == 200 and r2.json()["charged"] is False and r2.json()["coins"] == 0


def test_unlock_insufficient_and_other_device(client, env):
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    env.setattr(main, "WELCOME_COINS", 0)
    evs = run(client)
    rid = next(e for e in evs if e["type"] == "cards")["reading_id"]
    r = client.post(f"/api/reading/{rid}/unlock", headers=H())
    assert r.status_code == 402 and r.json()["detail"]["code"] == "insufficient_coins"
    r = client.post(f"/api/reading/{rid}/unlock", headers=H("other_" + "b" * 20))
    assert r.status_code == 403


def test_paywall_off_everything_free(client, env):
    env.setenv("PAYWALL_ENABLED", "false")
    env.setattr(main, "stream_reading", fake_stream(split(FULL, 9)))
    evs = run(client, headers={})
    assert "SECRET_FUTURE" in text_of(evs) and "SECRET_SUMMARY" in text_of(evs)
    assert not any(e["type"] == "locked" for e in evs)


def test_crisis_never_locked(client, env):
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    evs = run(client, {**BODY, "concern": "죽고 싶어요"})
    assert not any(e["type"] == "locked" for e in evs)
    assert "SECRET_SUMMARY" in text_of(evs)


def test_device_required_when_paywall(client):
    r = client.post("/api/tarot/reading/stream", json=BODY)
    assert r.status_code == 400
    r = client.get("/api/wallet", headers={"X-Device-Id": "bad id!"})
    assert r.status_code == 400


def test_welcome_ip_cap(client, env):
    env.setattr(main, "WELCOME_PER_IP_DAILY", 2)
    got = [client.get("/api/wallet", headers=H(f"dev{i}_" + "c" * 20)).json()["coins"] for i in range(4)]
    assert got == [1, 1, 0, 0]
    assert client.get("/api/wallet", headers=H("dev0_" + "c" * 20)).json()["coins"] == 1


def test_checkout_sandbox_and_first_purchase(client, env):
    p = client.post("/api/checkout/prepare", json={"sku": "first_990"}, headers=H()).json()
    assert p["amount"] == 990 and p["coins"] == 2
    c = client.post("/api/checkout/sandbox-confirm", json={"order_id": p["order_id"]}, headers=H()).json()
    assert c["coins"] == 3 and c["granted"] == 2 and c["first_purchase_available"] is False
    again = client.post("/api/checkout/sandbox-confirm", json={"order_id": p["order_id"]}, headers=H()).json()
    assert again["coins"] == 3 and again["granted"] == 0
    r = client.post("/api/checkout/prepare", json={"sku": "first_990"}, headers=H())
    assert r.status_code == 409
    p2 = client.post("/api/checkout/prepare", json={"sku": "coin_5"}, headers=H()).json()
    assert p2["amount"] == 4900
    assert client.post("/api/checkout/prepare", json={"sku": "nope"}, headers=H()).status_code == 404


def test_checkout_modes(client, env):
    env.setenv("PAYMENTS_MODE", "off")
    assert client.post("/api/checkout/prepare", json={"sku": "coin_1"}, headers=H()).status_code == 503
    env.setenv("PAYMENTS_MODE", "toss")
    env.setenv("PAY_REQUIRES_LOGIN", "false")
    p = client.post("/api/checkout/prepare", json={"sku": "coin_1"}, headers=H()).json()
    assert client.post("/api/checkout/sandbox-confirm", json={"order_id": p["order_id"]}, headers=H()).status_code == 403
    # someone else's order
    r = client.post("/api/checkout/confirm", json={"paymentKey": "pk", "orderId": p["order_id"], "amount": 1000}, headers=H("zz_" + "d" * 20))
    assert r.status_code == 404


def test_toss_confirm(client, env):
    env.setenv("PAYMENTS_MODE", "toss")
    env.setenv("PAY_REQUIRES_LOGIN", "false")
    calls = []

    async def ok(pk, oid, amt, client=None):
        calls.append((pk, oid, amt))
        return {"status": "DONE"}

    env.setattr(payments, "toss_confirm", ok)
    p = client.post("/api/checkout/prepare", json={"sku": "coin_5"}, headers=H()).json()
    bad = client.post("/api/checkout/confirm", json={"paymentKey": "pk", "orderId": p["order_id"], "amount": 100}, headers=H())
    assert bad.status_code == 400 and not calls
    p = client.post("/api/checkout/prepare", json={"sku": "coin_5"}, headers=H()).json()
    good = client.post("/api/checkout/confirm", json={"paymentKey": "pk", "orderId": p["order_id"], "amount": 4900}, headers=H()).json()
    assert good["granted"] == 5 and good["coins"] == 6
    dup = client.post("/api/checkout/confirm", json={"paymentKey": "pk", "orderId": p["order_id"], "amount": 4900}, headers=H()).json()
    assert dup["granted"] == 0 and dup["coins"] == 6 and len(calls) == 1

    async def boom(pk, oid, amt, client=None):
        raise payments.TossError("REJECT_CARD_PAYMENT", "거절")

    env.setattr(payments, "toss_confirm", boom)
    p = client.post("/api/checkout/prepare", json={"sku": "coin_1"}, headers=H()).json()
    r = client.post("/api/checkout/confirm", json={"paymentKey": "pk2", "orderId": p["order_id"], "amount": 1000}, headers=H())
    assert r.status_code == 402 and client.get("/api/wallet", headers=H()).json()["coins"] == 6


def unlocked_reading(client, env, coins=5):
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    env.setattr(main, "WELCOME_COINS", coins)
    evs = run(client)
    rid = next(e for e in evs if e["type"] == "cards")["reading_id"]
    drawn = [c["id"] for c in next(e for e in evs if e["type"] == "cards")["data"]]
    assert client.post(f"/api/reading/{rid}/unlock", headers=H()).status_code == 200
    return rid, drawn


def test_advice_card(client, env):
    rid, drawn = unlocked_reading(client, env)
    async def gen(system, prompt, **kw):
        return "조언이에요."
    env.setattr(main, "generate_text", gen)
    r = client.post(f"/api/reading/{rid}/advice-card", headers=H()).json()
    assert r["card"]["id"] not in drawn and r["coins"] == 3 and r["charged"] is True
    r2 = client.post(f"/api/reading/{rid}/advice-card", headers=H()).json()
    assert r2["card"]["id"] == r["card"]["id"] and r2["coins"] == 3 and r2["charged"] is False


def test_advice_refund_on_failure(client, env):
    rid, _ = unlocked_reading(client, env)
    async def gen(system, prompt, **kw):
        raise RuntimeError("x")
    env.setattr(main, "generate_text", gen)
    r = client.post(f"/api/reading/{rid}/advice-card", headers=H())
    assert r.status_code == 502
    assert client.get("/api/wallet", headers=H()).json()["coins"] == 4


def test_advice_requires_unlock(client, env):
    env.setattr(main, "stream_reading", fake_stream([FULL]))
    evs = run(client)
    rid = next(e for e in evs if e["type"] == "cards")["reading_id"]
    r = client.post(f"/api/reading/{rid}/advice-card", headers=H())
    assert r.status_code == 403 and r.json()["detail"]["code"] == "locked"
    r = client.post(f"/api/reading/{rid}/followup", json={"question": "언제쯤이요?"}, headers=H())
    assert r.status_code == 403


def test_followup_limit_and_crisis(client, env):
    rid, _ = unlocked_reading(client, env, coins=10)
    async def gen(system, prompt, **kw):
        return "답이에요."
    env.setattr(main, "generate_text", gen)
    for i in range(3):
        r = client.post(f"/api/reading/{rid}/followup", json={"question": f"질문 {i} 입니다"}, headers=H()).json()
        assert r["remaining"] == 2 - i
    assert client.get("/api/wallet", headers=H()).json()["coins"] == 10 - 1 - 3
    r = client.post(f"/api/reading/{rid}/followup", json={"question": "또 물어봐요"}, headers=H())
    assert r.status_code == 429


def test_followup_crisis_free(client, env):
    rid, _ = unlocked_reading(client, env, coins=2)
    async def gen(system, prompt, **kw):
        raise AssertionError("AI must not be called")
    env.setattr(main, "generate_text", gen)
    r = client.post(f"/api/reading/{rid}/followup", json={"question": "죽고 싶어요"}, headers=H()).json()
    assert "109" in r["answer"] and r["charged"] is False and r["coins"] == 1


def test_config(client):
    c = client.get("/api/config").json()
    assert c["paywall_enabled"] is True and c["payments_mode"] == "sandbox" and c["toss_client_key"] == ""
    assert len(c["products"]) == 4


def test_first_followup_free_then_coin(client, env):
    env.setattr(main, "FOLLOWUP_FREE", 1)
    rid, _ = unlocked_reading(client, env, coins=2)  # 풀이 열기 1개 → 1개 남음
    async def gen(system, prompt, **kw):
        return "답이에요."
    env.setattr(main, "generate_text", gen)
    a = client.post(f"/api/reading/{rid}/followup", json={"question": "첫 질문이에요"}, headers=H()).json()
    assert a["charged"] is False and client.get("/api/wallet", headers=H()).json()["coins"] == 1
    b = client.post(f"/api/reading/{rid}/followup", json={"question": "둘째 질문이에요"}, headers=H()).json()
    assert b["charged"] is True and client.get("/api/wallet", headers=H()).json()["coins"] == 0
    c = client.post(f"/api/reading/{rid}/followup", json={"question": "셋째 질문이에요"}, headers=H())
    assert c.status_code == 402


def test_toss_requires_login_to_pay(client, env):
    import kakao_auth
    env.setenv("PAYMENTS_MODE", "toss")
    env.setenv("KAKAO_REST_API_KEY", "k")
    assert client.get("/api/config").json()["login_required_to_pay"] is True
    r = client.post("/api/checkout/prepare", json={"sku": "coin_1"}, headers=H())
    assert r.status_code == 403 and r.json()["detail"]["code"] == "login_required"
    # 로그인한 기기는 통과
    async def fp(code, uri):
        return "42", "준호"
    env.setattr(kakao_auth, "fetch_profile", fp)
    client.post("/api/auth/kakao", json={"code": "ok", "redirect_uri": "https://ai-tarot-app-tau.vercel.app/"}, headers=H())
    assert client.post("/api/checkout/prepare", json={"sku": "coin_1"}, headers=H()).status_code == 200
    # 로그인 수단이 꺼져 있으면 막지 않는다
    env.delenv("KAKAO_REST_API_KEY")
    assert client.get("/api/config").json()["login_required_to_pay"] is False
