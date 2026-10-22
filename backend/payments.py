"""상품 목록과 토스페이먼츠 결제 승인.

PAYMENTS_MODE
  off      결제 비활성(기본). 결제 화면이 '준비 중'으로 보입니다.
  sandbox  테스트용. 결제 없이 코인이 지급됩니다. 운영 서버에서는 절대 켜지 마세요.
  toss     토스페이먼츠 실결제. TOSS_SECRET_KEY(서버), TOSS_CLIENT_KEY(공개 키)가 필요합니다.
"""
import base64
import os
import ssl
from typing import Any, Dict, List, Optional

import httpx

PRODUCTS: List[Dict[str, Any]] = [
    {"sku": "first_990", "name": "첫 구매 한정 코인 2개", "price": 990, "coins": 2, "first_only": True},
    {"sku": "coin_1", "name": "코인 1개", "price": 1000, "coins": 1},
    {"sku": "coin_5", "name": "코인 5개", "price": 4900, "coins": 5},
    {"sku": "coin_12", "name": "코인 12개", "price": 9900, "coins": 12, "badge": "가장 알뜰"},
]
PRODUCT_BY_SKU = {p["sku"]: p for p in PRODUCTS}

TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm"


def payments_mode() -> str:
    mode = os.getenv("PAYMENTS_MODE", "off").strip().lower()
    return mode if mode in ("off", "sandbox", "toss") else "off"


class TossError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


async def toss_confirm(payment_key: str, order_id: str, amount: int, *, client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    """토스페이먼츠 결제 승인 API. 성공하면 결제 정보를 돌려주고, 실패하면 TossError."""
    secret = os.getenv("TOSS_SECRET_KEY", "")
    if not secret:
        raise TossError("NO_SECRET_KEY", "서버에 결제 키가 설정되지 않았어요.")
    auth = base64.b64encode(f"{secret}:".encode()).decode()
    headers = {"Authorization": f"Basic {auth}", "Content-Type": "application/json"}
    body = {"paymentKey": payment_key, "orderId": order_id, "amount": amount}
    own = client is None
    client = client or httpx.AsyncClient(timeout=20)
    try:
        resp = await client.post(TOSS_CONFIRM_URL, json=body, headers=headers)
    except httpx.HTTPError as e:
        raise TossError("NETWORK", "결제사와 통신하지 못했어요.") from e
    finally:
        if own:
            await client.aclose()
    try:
        data = resp.json()
    except ValueError:
        data = {}
    if resp.status_code != 200:
        raise TossError(str(data.get("code", "TOSS_ERROR")), str(data.get("message", "결제 승인에 실패했어요.")))
    if data.get("status") != "DONE" or int(data.get("totalAmount", -1)) != amount or data.get("orderId") != order_id:
        raise TossError("MISMATCH", "결제 정보가 주문과 일치하지 않아요.")
    return data

# ---------------------------------------------------------------------------
# 앱인토스(토스 앱 안) 인앱결제
#   TOSS_PAYWALL_ENABLED : true 면 토스 앱(X-Platform: toss)에서만 코인·결제를 켭니다. 웹에는 영향이 없어요.
#   TOSS_MTLS_CERT_PATH / TOSS_MTLS_KEY_PATH : 앱인토스 콘솔에서 받은 mTLS 인증서·개인키 파일 경로
#     (Render 의 Secret Files 는 /etc/secrets/<파일이름> 으로 올라와요)
#   TOSS_IAP_SKU_COIN3 : 콘솔에 등록한 상품 ID(기본값은 '별빛 코인 3개')
# ---------------------------------------------------------------------------
TOSS_IAP_SKU_COIN3 = os.getenv("TOSS_IAP_SKU_COIN3", "ait.0000087437.c4cd615f.952c3bd11d.2630490003").strip()
TOSS_IAP_PRODUCTS: List[Dict[str, Any]] = [
    {"sku": TOSS_IAP_SKU_COIN3, "name": "별빛 코인 3개", "price": 1980, "coins": 3},
]
# 더 큰 묶음: 콘솔에 상품을 등록하고 상품 ID 를 환경변수로 넣으면 자동으로 노출돼요.
for _env, _name, _price, _coins, _badge, _default in (
    ("TOSS_IAP_SKU_COIN8", "별빛 코인 8개", 4950, 8, None, "ait.0000087437.94682728.909a65d387.2632839657"),
    ("TOSS_IAP_SKU_COIN20", "별빛 코인 20개", 9900, 20, "가장 알뜰", "ait.0000087437.69be1435.55b3ee47d5.2632883384"),
):
    _sku = os.getenv(_env, _default).strip()
    if _sku:
        _p = {"sku": _sku, "name": _name, "price": _price, "coins": _coins}
        if _badge:
            _p["badge"] = _badge
        TOSS_IAP_PRODUCTS.append(_p)
TOSS_IAP_BY_SKU = {p["sku"]: p for p in TOSS_IAP_PRODUCTS}
TOSS_IAP_ORDER_STATUS_URL = "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/order/get-order-status"


def toss_iap_enabled() -> bool:
    cert = os.getenv("TOSS_MTLS_CERT_PATH", "").strip()
    key = os.getenv("TOSS_MTLS_KEY_PATH", "").strip()
    return bool(cert and key and os.path.isfile(cert) and os.path.isfile(key))


async def toss_iap_order_status(order_id: str, *, client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    """앱인토스 주문 상태 조회(mTLS). 성공하면 {orderId, status, sku, ...} 를 돌려주고, 실패하면 TossError."""
    if client is None:
        if not toss_iap_enabled():
            raise TossError("NO_CERT", "서버에 앱인토스 인증서가 설정되지 않았어요.")
        try:
            ctx = ssl.create_default_context()
            ctx.load_cert_chain(os.environ["TOSS_MTLS_CERT_PATH"].strip(), os.environ["TOSS_MTLS_KEY_PATH"].strip())
        except Exception as e:  # noqa: BLE001
            raise TossError("BAD_CERT", "앱인토스 인증서를 읽지 못했어요.") from e
        client = httpx.AsyncClient(verify=ctx, timeout=10.0)
        own = True
    else:
        own = False
    try:
        resp = await client.post(TOSS_IAP_ORDER_STATUS_URL, json={"orderId": order_id})
    except httpx.HTTPError as e:
        raise TossError("NETWORK", "결제사와 통신하지 못했어요.") from e
    finally:
        if own:
            await client.aclose()
    try:
        data = resp.json()
    except ValueError:
        data = {}
    if resp.status_code != 200 or data.get("resultType") != "SUCCESS":
        raise TossError(str(data.get("error", {}).get("errorCode", resp.status_code)) if isinstance(data.get("error"), dict) else str(resp.status_code), "주문을 확인하지 못했어요.")
    return data.get("success") or {}
