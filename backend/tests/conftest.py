import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("DB_PATH", "/tmp/tarot_test_import.db")
import pytest
from fastapi.testclient import TestClient
import main
from store import Store

DEV = "dev_" + "a" * 20


@pytest.fixture
def env(tmp_path, monkeypatch):
    if os.environ.get("TEST_STORE") == "libsql":  # 같은 시험을 libsql 연결 껍데기로도 돌려 봐요
        store = Store("", turso=(str(tmp_path / "t.db"), ""))
    else:
        store = Store(str(tmp_path / "t.db"))
    monkeypatch.setattr(main, "STORE", store)
    monkeypatch.setattr(main, "gemini_client", object())
    monkeypatch.setattr(main, "RATE_PER_MINUTE", 1000)
    monkeypatch.setattr(main, "RATE_PER_DAY", 100000)
    monkeypatch.setenv("PAYWALL_ENABLED", "true")
    monkeypatch.setenv("PAYMENTS_MODE", "sandbox")
    return monkeypatch


@pytest.fixture
def client(env):
    return TestClient(main.app)


def H(dev=DEV):
    return {"X-Device-Id": dev}
