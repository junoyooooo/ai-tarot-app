import main
import retention
from conftest import H


def at(env, day):
    env.setattr(main, "today_kst", lambda: day)


def test_checkin_once_per_day_and_streak(client, env):
    at(env, "2026-10-14")
    a = client.post("/api/checkin", headers=H()).json()
    assert a["streak"] == 1 and a["gain"] == 1 and not a["already"]
    assert client.post("/api/checkin", headers=H()).json()["already"] is True
    at(env, "2026-10-15")
    assert client.post("/api/checkin", headers=H()).json()["streak"] == 2
    at(env, "2026-10-18")  # 하루 건너뜀 → 다시 1
    b = client.post("/api/checkin", headers=H()).json()
    assert b["streak"] == 1 and b["best"] == 2


def test_milestone_bonus_and_stardust(client, env):
    for d in ("2026-10-01", "2026-10-02", "2026-10-03"):
        at(env, d)
        r = client.post("/api/checkin", headers=H()).json()
    assert r["streak"] == 3 and r["gain"] == 2  # 기본 1 + 3일 보너스 1
    assert client.get("/api/play/state", headers=H()).json()["stardust"] == 1 + 1 + 2


def test_lunar_bonus_on_full_moon(client, env):
    at(env, "2026-10-26")
    r = client.post("/api/checkin", headers=H()).json()
    assert r["gain"] == 1 + retention.LUNAR_BONUS and r["lunar"]["key"] == "full"


def test_retention_state_streak_resets_display(client, env):
    at(env, "2026-10-10")
    client.post("/api/checkin", headers=H())
    at(env, "2026-10-13")
    s = client.get("/api/retention", headers=H()).json()
    assert s["streak"] == 0 and not s["checked_today"] and s["next_reward"] == 1


def test_play_disabled_still_counts_streak_without_stardust(client, env):
    env.setattr(main, "PLAY_ENABLED", False)
    at(env, "2026-10-14")
    r = client.post("/api/checkin", headers=H()).json()
    assert r["streak"] == 1 and r["gain"] == 0


def test_invite_flow_and_guards(client, env):
    a, b, c = "dev_" + "a" * 20, "dev_" + "b" * 20, "dev_" + "c" * 20
    code = client.get("/api/invite", headers=H(a)).json()["code"]
    assert client.get("/api/invite", headers=H(a)).json()["code"] == code
    assert client.post("/api/invite/redeem", json={"code": code}, headers=H(a)).json()["detail"]["code"] == "self"
    assert client.post("/api/invite/redeem", json={"code": "ZZZZZZZ"}, headers=H(b)).json()["detail"]["code"] == "bad_code"
    ok = client.post("/api/invite/redeem", json={"code": code.lower()}, headers=H(b))
    assert ok.status_code == 200 and ok.json()["gain"] == retention.INVITE_BONUS_INVITEE
    again = client.post("/api/invite/redeem", json={"code": code}, headers=H(b))
    assert again.json()["detail"]["code"] == "used"
    assert client.get("/api/play/state", headers=H(b)).json()["stardust"] == retention.INVITE_BONUS_INVITEE
    assert client.get("/api/play/state", headers=H(a)).json()["stardust"] == retention.INVITE_BONUS_INVITER
    assert client.get("/api/invite", headers=H(a)).json()["invited_week"] == 1
    # 같은 네트워크에서 하루 상한(2)
    d = "dev_" + "d" * 20
    client.post("/api/invite/redeem", json={"code": code}, headers=H(c))
    assert client.post("/api/invite/redeem", json={"code": code}, headers=H(d)).json()["detail"]["code"] == "ip"


def test_inviter_weekly_cap(client, env):
    env.setattr(main, "INVITE_WEEKLY_MAX", 1)
    env.setattr(retention, "INVITE_PER_IP_DAILY", 99)
    a = "dev_" + "a" * 20
    code = client.get("/api/invite", headers=H(a)).json()["code"]
    assert client.post("/api/invite/redeem", json={"code": code}, headers=H("dev_" + "b" * 20)).status_code == 200
    r = client.post("/api/invite/redeem", json={"code": code}, headers=H("dev_" + "c" * 20))
    assert r.json()["detail"]["code"] == "inviter_full"


def test_push_subscribe_and_daily_send(client, env):
    env.setattr(main, "VAPID_PUBLIC_KEY", "pub")
    env.setattr(main, "VAPID_PRIVATE_KEY", "priv")
    env.setattr(main, "PUSH_CRON_SECRET", "s3cret")
    sub = {"endpoint": "https://push.example/abc123456", "p256dh": "k" * 20, "auth": "a" * 10}
    assert client.post("/api/push/subscribe", json=sub, headers=H()).status_code == 200
    assert client.get("/api/retention", headers=H()).json()["push_on"] is True
    assert client.post("/api/push/send-daily").status_code == 403
    sent = []
    env.setattr(main, "_send_one_push", lambda s, payload: (sent.append(payload), "ok")[1])
    r = client.post("/api/push/send-daily", headers={"X-Cron-Secret": "s3cret"}).json()
    assert r["sent"] == 1 and len(sent) == 1
    again = client.post("/api/push/send-daily", headers={"X-Cron-Secret": "s3cret"}).json()
    assert again["sent"] == 0  # 오늘은 이미 보냄
    env.setattr(main, "_send_one_push", lambda s, p: "dead")
    client.post("/api/push/subscribe", json={**sub, "endpoint": "https://push.example/zzz123456"}, headers=H("dev_" + "e" * 20))
    client.post("/api/push/send-daily", headers={"X-Cron-Secret": "s3cret"})
    client.post("/api/push/unsubscribe", headers=H())
    assert client.get("/api/retention", headers=H()).json()["push_on"] is False


def test_push_disabled_without_keys(client):
    sub = {"endpoint": "https://push.example/abc123456", "p256dh": "k" * 20, "auth": "a" * 10}
    assert client.post("/api/push/subscribe", json=sub, headers=H()).status_code == 404


def test_lunar_and_season_helpers():
    assert retention.lunar_event("2026-10-26")["key"] == "full"
    assert retention.lunar_event("2026-11-10")["key"] == "new"
    assert retention.lunar_event("2026-10-16") is None
    assert retention.season_for("2026-10-16")["name"]
    assert retention.next_milestone(7)["day"] == 14


def test_webpush_encryption_round_trip():
    import base64
    import os
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    import webpush

    ua = ec.generate_private_key(ec.SECP256R1())
    ua_raw = ua.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    auth = os.urandom(16)
    body = webpush.encrypt("안녕 별빛".encode(), webpush.b64e(ua_raw), webpush.b64e(auth))
    salt, idlen = body[:16], body[20]
    as_raw, ct = body[21:21 + idlen], body[21 + idlen:]
    shared = ua.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), as_raw))
    ikm = HKDF(hashes.SHA256(), 32, auth, b"WebPush: info\x00" + ua_raw + as_raw).derive(shared)
    cek = HKDF(hashes.SHA256(), 16, salt, b"Content-Encoding: aes128gcm\x00").derive(ikm)
    nonce = HKDF(hashes.SHA256(), 12, salt, b"Content-Encoding: nonce\x00").derive(ikm)
    plain = AESGCM(cek).decrypt(nonce, ct, None)
    assert plain == "안녕 별빛".encode() + b"\x02"


def test_vapid_header_signature_verifies():
    import webpush
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
    key = ec.generate_private_key(ec.SECP256R1())
    priv = webpush.b64e(key.private_numbers().private_value.to_bytes(32, "big"))
    pub = webpush.b64e(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    h = webpush.vapid_header("https://fcm.googleapis.com/fcm/send/abc", priv, pub, "mailto:a@b.c")
    t = h.split("t=")[1].split(",")[0]
    head, cl, sig = t.split(".")
    raw = webpush.b64d(sig)
    der = encode_dss_signature(int.from_bytes(raw[:32], "big"), int.from_bytes(raw[32:], "big"))
    key.public_key().verify(der, f"{head}.{cl}".encode(), ec.ECDSA(hashes.SHA256()))
    assert b"fcm.googleapis.com" in webpush.b64d(cl)
