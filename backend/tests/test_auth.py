import kakao_auth
import main
from conftest import H


def fake_profile(kid="12345", nick="준호"):
    async def f(code, redirect_uri):
        if code == "bad":
            raise kakao_auth.KakaoError("token")
        return kid, nick
    return f


def login(client, dev, code="ok", uri="https://ai-tarot-app-tau.vercel.app/"):
    return client.post("/api/auth/kakao", json={"code": code, "redirect_uri": uri}, headers=H(dev))


def test_disabled_without_key(client, env):
    env.delenv("KAKAO_REST_API_KEY", raising=False)
    assert login(client, "a" * 20).status_code == 404


def test_login_links_and_moves_across_devices(client, env):
    env.setenv("KAKAO_REST_API_KEY", "k")
    env.setattr(kakao_auth, "fetch_profile", fake_profile())
    a, b = "a" * 20, "b" * 20
    r1 = login(client, a).json()
    assert r1["device_id"] == a and r1["created"] and not r1["switched"]
    # 같은 회원이 다른 기기에서 로그인하면 처음 기기의 ID를 받는다
    r2 = login(client, b).json()
    assert r2["device_id"] == a and r2["switched"] and not r2["created"]


def test_second_account_on_linked_device_gets_new_id(client, env):
    env.setenv("KAKAO_REST_API_KEY", "k")
    a = "a" * 20
    env.setattr(kakao_auth, "fetch_profile", fake_profile("1"))
    login(client, a)
    env.setattr(kakao_auth, "fetch_profile", fake_profile("2", "다른사람"))
    r = login(client, a).json()
    assert r["created"] and r["device_id"] != a and r["switched"]


def test_bad_code_and_bad_redirect(client, env):
    env.setenv("KAKAO_REST_API_KEY", "k")
    env.setattr(kakao_auth, "fetch_profile", fake_profile())
    assert login(client, "a" * 20, code="bad").json()["detail"]["code"] == "kakao_failed"
    assert login(client, "a" * 20, uri="https://evil.example/").json()["detail"]["code"] == "bad_redirect"


def test_config_exposes_client_id(client, env):
    env.setenv("KAKAO_REST_API_KEY", "abc")
    k = client.get("/api/config").json()["auth"]["kakao"]
    assert k == {"enabled": True, "client_id": "abc"}


# ---- 구글 로그인
import google_auth


def g_login(client, dev, cred="c" * 30):
    return client.post("/api/auth/google", json={"credential": cred}, headers=H(dev))


def fake_google(sub="777", name="준호"):
    async def f(credential):
        if credential.startswith("bad"):
            raise google_auth.GoogleError("invalid")
        return sub, name
    return f


def test_google_disabled_without_client_id(client, env):
    env.delenv("GOOGLE_CLIENT_ID", raising=False)
    assert g_login(client, "a" * 20).status_code == 404


def test_google_login_links_and_bad_token(client, env):
    env.setenv("GOOGLE_CLIENT_ID", "id.apps.googleusercontent.com")
    env.setattr(google_auth, "verify", fake_google())
    a, b = "a" * 20, "b" * 20
    assert g_login(client, a).json()["device_id"] == a
    r = g_login(client, b).json()
    assert r["device_id"] == a and r["switched"]
    assert g_login(client, a, "bad" + "x" * 30).status_code == 400
    cfg = client.get("/api/config").json()["auth"]["google"]
    assert cfg["enabled"] and cfg["client_id"].startswith("id.")


def test_google_and_kakao_ids_do_not_collide(client, env):
    env.setenv("GOOGLE_CLIENT_ID", "x")
    env.setenv("KAKAO_REST_API_KEY", "k")
    env.setattr(google_auth, "verify", fake_google("555"))
    env.setattr(kakao_auth, "fetch_profile", fake_profile("555"))
    a = "a" * 20
    g_login(client, a)
    r = login(client, "b" * 20).json()
    assert r["created"] and r["device_id"] == "b" * 20
