"""웹 푸시용 VAPID 키 한 쌍을 만듭니다. 내 컴퓨터에서 실행하고, 출력된 값을 Render 환경변수에 직접 넣으세요.
(채팅이나 깃허브에 붙여 넣지 마세요.)   python backend/gen_vapid.py
"""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


key = ec.generate_private_key(ec.SECP256R1())
priv = key.private_numbers().private_value.to_bytes(32, "big")
pub = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
print("VAPID_PRIVATE_KEY =", b64(priv))
print("VAPID_PUBLIC_KEY  =", b64(pub))
print("VAPID_SUBJECT     = mailto:내이메일@example.com")
print("PUSH_CRON_SECRET  = (아무 긴 랜덤 문자열)")
