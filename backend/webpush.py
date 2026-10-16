"""의존성이 가벼운 웹 푸시 발송기 (RFC 8291 aes128gcm + RFC 8292 VAPID). cryptography 와 httpx 만 써요."""
import base64
import json
import os
import time
from urllib.parse import urlparse

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _hkdf(length: int, salt: bytes, info: bytes, ikm: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=length, salt=salt, info=info).derive(ikm)


def encrypt(payload: bytes, p256dh: str, auth: str) -> bytes:
    ua_pub_raw = b64d(p256dh)
    ua_pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_pub_raw)
    as_priv = ec.generate_private_key(ec.SECP256R1())
    as_pub_raw = as_priv.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    shared = as_priv.exchange(ec.ECDH(), ua_pub)
    ikm = _hkdf(32, b64d(auth), b"WebPush: info\x00" + ua_pub_raw + as_pub_raw, shared)
    salt = os.urandom(16)
    cek = _hkdf(16, salt, b"Content-Encoding: aes128gcm\x00", ikm)
    nonce = _hkdf(12, salt, b"Content-Encoding: nonce\x00", ikm)
    body = AESGCM(cek).encrypt(nonce, payload + b"\x02", None)
    return salt + (4096).to_bytes(4, "big") + bytes([len(as_pub_raw)]) + as_pub_raw + body


def vapid_header(endpoint: str, private_key: str, public_key: str, subject: str, now: float = None) -> str:
    u = urlparse(endpoint)
    claims = {"aud": f"{u.scheme}://{u.netloc}", "exp": int((now or time.time()) + 12 * 3600), "sub": subject}
    head = b64e(json.dumps({"typ": "JWT", "alg": "ES256"}, separators=(",", ":")).encode())
    cl = b64e(json.dumps(claims, separators=(",", ":")).encode())
    signing = f"{head}.{cl}".encode()
    key = ec.derive_private_key(int.from_bytes(b64d(private_key), "big"), ec.SECP256R1())
    r, s = decode_dss_signature(key.sign(signing, ec.ECDSA(hashes.SHA256())))
    sig = b64e(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
    return f"vapid t={head}.{cl}.{sig}, k={public_key}"


def send(sub: dict, payload: str, private_key: str, public_key: str, subject: str, ttl: int = 6 * 3600, timeout: float = 10.0) -> str:
    """'ok' | 'dead'(구독 만료, 404/410) | 'fail'"""
    try:
        body = encrypt(payload.encode(), sub["p256dh"], sub["auth"])
        headers = {
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            "TTL": str(ttl),
            "Urgency": "normal",
            "Authorization": vapid_header(sub["endpoint"], private_key, public_key, subject),
        }
        r = httpx.post(sub["endpoint"], content=body, headers=headers, timeout=timeout)
        if r.status_code in (404, 410):
            return "dead"
        return "ok" if 200 <= r.status_code < 300 else "fail"
    except Exception:
        return "fail"
