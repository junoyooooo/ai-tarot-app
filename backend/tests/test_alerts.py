import logging

import alerts


def test_disabled_without_env(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    assert alerts.enabled() is False
    assert alerts.notify("x") is False


def test_dedupe_and_hourly_cap(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "t")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "1")
    sent = []
    monkeypatch.setattr(alerts, "_post", lambda text: sent.append(text))
    monkeypatch.setattr(alerts, "_last", {})
    monkeypatch.setattr(alerts, "_sent", [])
    assert alerts.notify("a", "k1") is True
    assert alerts.notify("a", "k1") is False  # 같은 오류는 10분에 한 번
    for i in range(30):
        alerts.notify("b", f"other{i}")
    assert len(alerts._sent) <= alerts.MAX_PER_HOUR


def test_error_log_triggers_alert(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "t")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "1")
    got = []
    monkeypatch.setattr(alerts, "notify", lambda text, key="": got.append(text) or True)
    alerts.install()
    log = logging.getLogger("ai-tarot-test")
    log.error("boom")
    log.warning("not an alert")
    assert len(got) == 1 and "boom" in got[0]


def test_health_reports_alerts_flag(client):
    r = client.get("/health")
    assert r.status_code == 200 and "alerts" in r.json()
