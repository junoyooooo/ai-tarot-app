"""서버 오류를 텔레그램으로 알려 주는 작은 도구.

TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 를 Render 환경변수에 넣으면 켜지고, 없으면 아무 일도 안 해요.
- 로그에 ERROR 가 찍힐 때만 보내요(처리 안 된 오류, AI 생성 실패, 결제 오류 등).
- 같은 오류는 10분에 한 번만, 전체로는 한 시간에 20개까지만 보내서 폭주를 막아요.
- 알림이 실패해도 서비스에는 영향이 없어요(별도 스레드에서 조용히 시도).
"""
import logging
import os
import threading
import time

import httpx

DEDUPE_SECONDS = 600
MAX_PER_HOUR = 20

_lock = threading.Lock()
_last: dict = {}
_sent: list = []


def enabled() -> bool:
    return bool(os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID"))


def _allow(key: str) -> bool:
    now = time.time()
    with _lock:
        _sent[:] = [t for t in _sent if now - t < 3600]
        if len(_sent) >= MAX_PER_HOUR:
            return False
        if now - _last.get(key, 0) < DEDUPE_SECONDS:
            return False
        _last[key] = now
        _sent.append(now)
        return True


def _post(text: str) -> None:
    try:
        httpx.post(
            f"https://api.telegram.org/bot{os.getenv('TELEGRAM_BOT_TOKEN')}/sendMessage",
            json={"chat_id": os.getenv("TELEGRAM_CHAT_ID"), "text": text[:3500]},
            timeout=10,
        )
    except Exception:  # 알림 실패가 서비스를 흔들면 안 돼요
        pass


def notify(text: str, key: str = "") -> bool:
    """알림을 보낸다(꺼져 있거나 한도에 걸리면 False). 네트워크는 백그라운드 스레드에서."""
    if not enabled() or not _allow(key or text[:80]):
        return False
    threading.Thread(target=_post, args=(text,), daemon=True).start()
    return True


class TelegramHandler(logging.Handler):
    """ERROR 이상 로그를 텔레그램으로 보내는 핸들러."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            if record.name.startswith(("httpx", "httpcore")):  # 알림 전송 자체의 로그는 건너뜀
                return
            msg = record.getMessage()
            exc = ""
            if record.exc_info and record.exc_info[1] is not None:
                e = record.exc_info[1]
                exc = f"\n{type(e).__name__}: {str(e)[:300]}"
            key = f"{record.name}|{record.pathname}:{record.lineno}"
            track("error", f"{record.name}: {msg[:60]}")
            notify(f"🚨 별빛타로 서버 오류\n{record.name}: {msg[:400]}{exc}", key)
        except Exception:
            pass


# ---- 활동 요약(다이제스트) --------------------------------------------------
# 접속·타로·결제·코인·로그인·오류를 모아 두었다가 DIGEST_MINUTES(기본 30분)마다 목록 한 통으로 보내요.
# 오류의 즉시 알림과는 별개의 한도라서 서로 영향이 없고, 개인정보(IP·이메일 등)는 담지 않아요.
DIGEST_MINUTES = int(os.getenv("DIGEST_MINUTES", "10") or 10)
DIGEST_MAX_LINES = 25
_events: list = []
_timer = None
_LABELS = {
    "visit": "👀 접속", "reading": "🔮 타로 뽑기", "payment": "💳 결제",
    "coin": "🪙 코인 사용", "login": "🔑 로그인", "error": "🚨 오류",
}


def track(kind: str, detail: str = "") -> None:
    """활동을 요약 목록에 쌓는다(꺼져 있으면 아무것도 안 함). 절대 예외를 내지 않는다."""
    try:
        if not enabled():
            return
        with _lock:
            if len(_events) < 2000:
                _events.append((time.time(), kind, detail[:80]))
            global _timer
            if _timer is None and DIGEST_MINUTES > 0:
                _timer = threading.Timer(DIGEST_MINUTES * 60, _flush)
                _timer.daemon = True
                _timer.start()
    except Exception:
        pass


def build_digest(events: list, minutes: int) -> str:
    counts: dict = {}
    for _, kind, _d in events:
        counts[kind] = counts.get(kind, 0) + 1
    lines = [f"📊 별빛타로 최근 {minutes}분 요약"]
    for kind in ("visit", "reading", "login", "coin", "payment", "error"):
        lines.append(f"{_LABELS[kind]} {counts.get(kind, 0)}건")
    detail = [(t, k, d) for t, k, d in events if k != "visit"]
    if detail:
        lines.append("")
        lines.append("· 자세히")
        kst = time.gmtime
        for t, k, d in detail[:DIGEST_MAX_LINES]:
            hm = time.strftime("%H:%M", time.gmtime(t + 9 * 3600))
            lines.append(f"{hm} {_LABELS[k].split()[0]} {d}".rstrip())
        if len(detail) > DIGEST_MAX_LINES:
            lines.append(f"…외 {len(detail) - DIGEST_MAX_LINES}건")
    return "\n".join(lines)


def _flush() -> None:
    global _timer
    try:
        with _lock:
            batch = _events[:]
            _events.clear()
            _timer = None
        if batch:
            _post(build_digest(batch, DIGEST_MINUTES))
    except Exception:
        pass


def _start_digest() -> None:
    """무료 호스팅은 요청이 없으면 15분 뒤 잠들어서 '30분마다 도는 반복 스레드'가 죽어요.
    그래서 첫 활동이 쌓이는 순간 DIGEST_MINUTES(기본 10분) 뒤에 한 번 보내는 타이머를 걸어요."""


def install() -> None:
    """루트 로거에 핸들러를 한 번만 붙인다."""
    root = logging.getLogger()
    if any(isinstance(h, TelegramHandler) for h in root.handlers):
        return
    h = TelegramHandler(level=logging.ERROR)
    root.addHandler(h)
    _start_digest()
