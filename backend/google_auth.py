"""구글 로그인(Google Identity Services) — 브라우저가 받은 ID 토큰을 구글에 확인해서 회원번호(sub)와 이름만 읽어요."""
import os
from typing import Tuple

import httpx

TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


class GoogleError(Exception):
    pass


def client_id() -> str:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def enabled() -> bool:
    return bool(client_id())


async def verify(credential: str) -> Tuple[str, str]:
    """(구글 회원번호, 이름). 서명·만료는 구글이 확인하고, 우리 앱용 토큰인지(aud)와 발급자(iss)를 다시 확인해요."""
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(TOKENINFO_URL, params={"id_token": credential})
    except httpx.HTTPError as e:
        raise GoogleError("network") from e
    if r.status_code != 200:
        raise GoogleError("invalid")
    body = r.json()
    if body.get("aud") != client_id():
        raise GoogleError("aud")
    if body.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise GoogleError("iss")
    sub = str(body.get("sub") or "")
    if not sub:
        raise GoogleError("sub")
    name = str(body.get("given_name") or body.get("name") or "").strip()[:20]
    return sub, name
