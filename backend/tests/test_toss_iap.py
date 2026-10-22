import pytest
import main, payments
from conftest import H, DEV

SKU = payments.TOSS_IAP_SKU_COIN3


def th(dev=DEV):
    return {**H(dev), "X-Platform": "toss"}


@pytest.fixture
def toss(env):
    env.delenv("PAYWALL_ENABLED", raising=False)
    env.setenv("TOSS_PAYWALL_ENABLED", "true")

    def set_status(status, sku=SKU):
        async def fake(order_id, **kw):
            return {"orderId": order_id, "status": status, "sku": sku}
        env.setattr(payments, "toss_iap_order_status", fake)
    set_status("PAYMENT_COMPLETED")
    env.setattr(payments, "toss_iap_enabled", lambda: True)
    return set_status


def test_paywall_is_toss_only(client, toss):
    web = client.get("/api/config").json()
    assert web["paywall_enabled"] is False
    t = client.get("/api/config", headers={"X-Platform": "toss"}).json()
    assert t["paywall_enabled"] is True and t["payments_mode"] == "toss_iap"
    assert t["products"][0]["sku"] == SKU and t["products"][0]["coins"] == 3
    assert t["login_required_to_pay"] is False


def test_grant_once_and_idempotent(client, toss):
    r = client.post("/api/checkout/toss-iap", json={"orderId": "o1", "sku": SKU}, headers=th())
    assert r.status_code == 200 and r.json()["granted"] == 3
    coins = r.json()["coins"]
    r2 = client.post("/api/checkout/toss-iap", json={"orderId": "o1", "sku": SKU}, headers=th())
    assert r2.status_code == 200 and r2.json()["granted"] == 0 and r2.json()["coins"] == coins


def test_purchased_status_also_grants(client, toss):
    toss("PURCHASED")
    r = client.post("/api/checkout/toss-iap", json={"orderId": "o2", "sku": SKU}, headers=th())
    assert r.status_code == 200 and r.json()["granted"] == 3


@pytest.mark.parametrize("status", ["FAILED", "NOT_FOUND", "REFUNDED", "MINIAPP_MISMATCH", "ERROR"])
def test_unpaid_statuses_rejected(client, toss, status):
    toss(status)
    r = client.post("/api/checkout/toss-iap", json={"orderId": "o3", "sku": SKU}, headers=th())
    assert r.status_code == 402


def test_in_progress_is_retryable(client, toss):
    toss("ORDER_IN_PROGRESS")
    r = client.post("/api/checkout/toss-iap", json={"orderId": "o4", "sku": SKU}, headers=th())
    assert r.status_code == 409


def test_sku_mismatch_and_unknown(client, toss):
    toss("PAYMENT_COMPLETED", sku="other")
    assert client.post("/api/checkout/toss-iap", json={"orderId": "o5", "sku": SKU}, headers=th()).status_code == 402
    assert client.post("/api/checkout/toss-iap", json={"orderId": "o5", "sku": "nope"}, headers=th()).status_code == 404


def test_other_device_cannot_claim_order(client, toss):
    assert client.post("/api/checkout/toss-iap", json={"orderId": "o6", "sku": SKU}, headers=th()).status_code == 200
    r = client.post("/api/checkout/toss-iap", json={"orderId": "o6", "sku": SKU}, headers=th("dev_" + "b" * 20))
    assert r.status_code == 409


def test_web_request_cannot_use_toss_endpoint(client, toss):
    r = client.post("/api/checkout/toss-iap", json={"orderId": "o7", "sku": SKU}, headers=H())
    assert r.status_code == 403
