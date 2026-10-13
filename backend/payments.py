"""상품 목록과 토스페이먼츠 결제 승인.

PAYMENTS_MODE
  off      결제 비활성(기본). 결제 화면이 '준비 중'으로 보입니다.
  sandbox  테스트용. 결제 없이 코인이 지급됩니다. 운영 서버에서는 절대 켜지 마세요.
  toss     토스페이먼츠 실결제. TOSS_SECRET_KEY(서버), TOSS_CLIENT_KEY(공개 키)가 필요합니다.
"""
import base64
import os
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
