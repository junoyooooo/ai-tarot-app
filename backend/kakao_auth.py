"""카카오 로그인(인가 코드 방식) — 서버에서 코드를 토큰으로 바꾸고, 회원번호와 닉네임만 읽어 옵니다."""
import os
from typing import Tuple

import httpx

TOKEN_URL = "https://kauth.kakao.com/oauth/token"
ME_URL = "https://kapi.kakao.com/v2/user/me"


class KakaoError(Exception):
    pass


def rest_api_key() -> str:
    return os.getenv("KAKAO_REST_API_KEY", "").strip()


def enabled() -> bool:
    return bool(rest_api_key())


async def fetch_profile(code: str, redirect_uri: str) -> Tuple[str, str]:
    """(카카오 회원번호, 닉네임)을 돌려줍니다. 실패하면 KakaoError."""
    data = {
        "grant_type": "authorization_code",
        "client_id": rest_api_key(),
        "redirect_uri": redirect_uri,
        "code": code,
    }
    secret = os.getenv("KAKAO_CLIENT_SECRET", "").strip()
    if secret:
        data["client_secret"] = secret
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            tok = await http.post(TOKEN_URL, data=data)
            if tok.status_code != 200:
                raise KakaoError("token")
            access = tok.json().get("access_token")
            if not access:
                raise KakaoError("token")
            me = await http.get(ME_URL, headers={"Authorization": f"Bearer {access}"})
            if me.status_code != 200:
                raise KakaoError("profile")
            body = me.json()
    except httpx.HTTPError as e:
        raise KakaoError("network") from e
    kakao_id = str(body.get("id") or "")
    if not kakao_id:
        raise KakaoError("profile")
    props = body.get("properties") or {}
    acct = (body.get("kakao_account") or {}).get("profile") or {}
    nickname = str(props.get("nickname") or acct.get("nickname") or "").strip()[:20]
    return kakao_id, nickname
