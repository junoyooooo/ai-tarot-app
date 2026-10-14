import asyncio

import main


class _Err(Exception):
    code = 429


class _Models:
    def __init__(self, fail_first):
        self.calls = []
        self.fail_first = fail_first

    async def generate_content(self, model, contents, config):
        self.calls.append(model)
        if model == main.GEMINI_MODEL and self.fail_first:
            raise _Err("429 RESOURCE_EXHAUSTED")

        class R:
            text = "ok"

        return R()


class _Client:
    def __init__(self, fail_first=True):
        self.aio = type("A", (), {"models": _Models(fail_first)})()


def test_is_rate_limited():
    assert main.is_rate_limited(_Err("x"))
    assert main.is_rate_limited(Exception("429 RESOURCE_EXHAUSTED quota"))
    assert not main.is_rate_limited(Exception("boom"))


def test_generate_text_falls_back_on_429(monkeypatch):
    c = _Client(True)
    monkeypatch.setattr(main, "gemini_client", c)
    monkeypatch.setattr(main, "GEMINI_MODEL_FALLBACK", "lite-model")
    out = asyncio.run(main.generate_text("s", "p", model=main.GEMINI_MODEL))
    assert out == "ok"
    assert c.aio.models.calls == [main.GEMINI_MODEL, "lite-model"]


def test_generate_text_no_fallback_when_disabled(monkeypatch):
    c = _Client(True)
    monkeypatch.setattr(main, "gemini_client", c)
    monkeypatch.setattr(main, "GEMINI_MODEL_FALLBACK", "")
    try:
        asyncio.run(main.generate_text("s", "p", model=main.GEMINI_MODEL))
        assert False
    except _Err:
        pass
