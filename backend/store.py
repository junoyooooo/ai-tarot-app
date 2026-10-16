"""SQLite 저장소: 코인 지갑, 상담(잠금 포함), 주문.

- 기기 ID(device_id)로 사용자를 구분하고, 로그인(카카오·구글)하면 같은 기기 ID를 여러 기기에서 씁니다.
- 기본은 파일 SQLite(DB_PATH)입니다. Render 무료 플랜은 디스크가 초기화되므로, 실제 서비스에서는
  TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 을 설정해 Turso(libSQL)에 저장하세요. (같은 SQL을 그대로 씁니다.)
"""
import hashlib
import json
import os
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from typing import Any, Dict, Optional, Tuple

from play import STARTER as PLAY_STARTER


class _Row:
    """libsql 의 결과 행을 sqlite3.Row 처럼 쓰게 해 주는 얇은 껍데기(이름·번호로 읽기, dict() 변환)."""

    __slots__ = ("_cols", "_vals")

    def __init__(self, cols, vals):
        self._cols = cols
        self._vals = tuple(vals)

    def __getitem__(self, k):
        if isinstance(k, str):
            return self._vals[self._cols.index(k)]
        return self._vals[k]

    def keys(self):
        return list(self._cols)

    def __iter__(self):
        return iter(self._vals)

    def __len__(self):
        return len(self._vals)


class _Cursor:
    def __init__(self, cur):
        self._cur = cur
        self._cols = [d[0] for d in (cur.description or [])]

    @property
    def rowcount(self):
        return self._cur.rowcount

    @property
    def lastrowid(self):
        return getattr(self._cur, "lastrowid", None)

    def fetchone(self):
        r = self._cur.fetchone()
        return None if r is None else _Row(self._cols, r)

    def fetchall(self):
        return [_Row(self._cols, r) for r in self._cur.fetchall()]

    def __iter__(self):
        return iter(self.fetchall())


class _LibsqlConn:
    """libsql 연결을 sqlite3 연결처럼 쓰는 껍데기. execute 가 _Cursor 를 돌려줘요."""

    def __init__(self, raw):
        self._raw = raw

    def execute(self, sql, params=()):
        return _Cursor(self._raw.execute(sql, tuple(params)))

    def executescript(self, script):
        self._raw.executescript(script)

    def commit(self):
        self._raw.commit()

    def close(self):
        try:
            self._raw.close()
        except Exception:  # pragma: no cover
            pass


class InsufficientCoins(Exception):
    def __init__(self, coins: int):
        super().__init__("insufficient coins")
        self.coins = coins


class OrderError(Exception):
    pass


SCHEMA = """
CREATE TABLE IF NOT EXISTS wallets (
    device_id TEXT PRIMARY KEY,
    coins INTEGER NOT NULL DEFAULT 0,
    first_purchase_used INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref TEXT,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS welcome_grants (
    ip_hash TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    category TEXT NOT NULL,
    concern TEXT NOT NULL,
    cards_json TEXT NOT NULL,
    free_text TEXT NOT NULL,
    locked_text TEXT NOT NULL DEFAULT '',
    meta_json TEXT NOT NULL DEFAULT '{}',
    unlocked INTEGER NOT NULL DEFAULT 1,
    advice_json TEXT,
    followups_json TEXT NOT NULL DEFAULT '[]',
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS usage (
    device_id TEXT NOT NULL,
    day TEXT NOT NULL,
    kind TEXT NOT NULL,
    n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (device_id, day, kind)
);
CREATE TABLE IF NOT EXISTS play_state (
    device_id TEXT PRIMARY KEY,
    stardust INTEGER NOT NULL DEFAULT 0,
    items_json TEXT NOT NULL DEFAULT '[]',
    equipped_json TEXT NOT NULL DEFAULT '{}',
    main_mascot INTEGER NOT NULL DEFAULT 0,
    last_exchange_week TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS play_runs (
    run_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    day TEXT NOT NULL,
    started_at REAL NOT NULL,
    claimed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rpg_runs (
    run_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    day TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at REAL NOT NULL,
    claimed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS exchange_grants (
    ip_hash TEXT NOT NULL,
    week TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
    kakao_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS cardbox_claims (
    device_id TEXT NOT NULL,
    key TEXT NOT NULL,
    created_at REAL NOT NULL,
    PRIMARY KEY (device_id, key)
);
CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    amount INTEGER NOT NULL,
    coins INTEGER NOT NULL,
    status TEXT NOT NULL,
    payment_key TEXT,
    created_at REAL NOT NULL,
    paid_at REAL
);
CREATE TABLE IF NOT EXISTS checkins (
    device_id TEXT PRIMARY KEY,
    last_day TEXT NOT NULL DEFAULT '',
    streak INTEGER NOT NULL DEFAULT 0,
    best INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invite_codes (
    code TEXT PRIMARY KEY,
    device_id TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS referrals (
    invitee_id TEXT PRIMARY KEY,
    inviter_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    day TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    last_sent_day TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL
);
"""


class Store:
    def __init__(self, path: str, turso: Optional[Tuple[str, str]] = None):
        """turso=(주소, 토큰)을 주면 Turso(libSQL)에 저장하고, 없으면 path 의 SQLite 파일을 씁니다."""
        self.path = path
        self._turso = turso
        self._lock = threading.Lock()
        if not turso:
            folder = os.path.dirname(os.path.abspath(path))
            os.makedirs(folder, exist_ok=True)
        conn = self._open()
        try:
            conn.executescript(SCHEMA)
            conn.commit()
        finally:
            conn.close()

    def _open(self):
        if self._turso:
            import libsql  # 지연 import: 파일 SQLite 로만 쓸 때는 필요 없어요

            url, token = self._turso
            if url.startswith(("libsql://", "https://", "http://", "wss://", "ws://")):
                raw = libsql.connect(url, auth_token=token, isolation_level=None)
            else:  # 테스트용: 로컬 파일을 libsql 로 열어 같은 코드 경로를 시험해요
                raw = libsql.connect(url, isolation_level=None)
            return _LibsqlConn(raw)
        conn = sqlite3.connect(self.path, timeout=15, isolation_level=None)
        conn.row_factory = sqlite3.Row
        return conn

    @contextmanager
    def _tx(self):
        """쓰기 트랜잭션. 프로세스 안에서는 락으로, 여러 프로세스 사이에서는 BEGIN IMMEDIATE 로 보호한다."""
        with self._lock:
            conn = self._open()
            try:
                conn.execute("BEGIN IMMEDIATE")
                yield conn
                conn.execute("COMMIT")
            except BaseException:
                try:
                    conn.execute("ROLLBACK")
                except Exception:
                    pass
                raise
            finally:
                conn.close()

    @contextmanager
    def _read(self):
        """읽기 전용·문장 하나짜리 쿼리용. BEGIN/COMMIT 왕복을 아끼려고 트랜잭션 없이 실행해요(Turso는 왕복마다 느려요)."""
        conn = self._open()
        try:
            yield conn
        finally:
            conn.close()

    # ------------------------------------------------------------------ 계정(카카오 로그인)
    def link_account(self, kakao_id: str, nickname: str, device_id: str) -> Tuple[str, str]:
        """카카오 회원을 기기 ID(코인·별가루가 묶인 키)에 연결한다. (기기 ID, 'created'|'existing')을 돌려준다.
        이미 있는 회원이면 그 회원의 기기 ID를 돌려줘서 어느 기기에서든 같은 기록을 쓰게 한다."""
        with self._tx() as c:
            row = c.execute("SELECT device_id FROM accounts WHERE kakao_id=?", (kakao_id,)).fetchone()
            if row:
                c.execute("UPDATE accounts SET nickname=? WHERE kakao_id=?", (nickname, kakao_id))
                return row["device_id"], "existing"
            taken = c.execute("SELECT 1 FROM accounts WHERE device_id=?", (device_id,)).fetchone()
            device = ("k" + secrets.token_hex(16)) if taken else device_id
            c.execute(
                "INSERT INTO accounts(kakao_id, device_id, nickname, created_at) VALUES (?,?,?,?)",
                (kakao_id, device, nickname, time.time()),
            )
            return device, "created"

    def has_account(self, device_id: str) -> bool:
        with self._read() as c:
            return c.execute("SELECT 1 FROM accounts WHERE device_id=?", (device_id,)).fetchone() is not None

    # ------------------------------------------------------------------ 카드 보관함
    def cardbox_info(self, device_id: str, tz_offset_hours: int = 9) -> Dict[str, Any]:
        """이 기기의 상담 수(전체, 월별)와 이미 받은 보상 키."""
        with self._read() as c:
            rows = c.execute("SELECT created_at FROM readings WHERE device_id=?", (device_id,)).fetchall()
            claims = [r["key"] for r in c.execute("SELECT key FROM cardbox_claims WHERE device_id=?", (device_id,)).fetchall()]
        by_month: Dict[str, int] = {}
        for r in rows:
            t = time.gmtime(r["created_at"] + tz_offset_hours * 3600)
            k = f"{t.tm_year:04d}-{t.tm_mon:02d}"
            by_month[k] = by_month.get(k, 0) + 1
        return {"total": len(rows), "by_month": by_month, "claims": claims}

    def cardbox_grant(self, device_id: str, rewards: list, give_stardust: bool) -> list:
        """아직 받지 않은 보상만 한 번씩 기록하고 별가루를 더한다. 받은 것 [(키, 별가루, 이름)]을 돌려준다."""
        granted = []
        with self._tx() as c:
            for key, bonus, name in rewards:
                cur = c.execute(
                    "INSERT OR IGNORE INTO cardbox_claims(device_id, key, created_at) VALUES (?,?,?)",
                    (device_id, key, time.time()),
                )
                if cur.rowcount == 1:
                    gain = bonus if give_stardust else 0
                    if gain:
                        self._play_row(c, device_id)
                        c.execute("UPDATE play_state SET stardust = stardust + ? WHERE device_id=?", (gain, device_id))
                    granted.append((key, gain, name))
        return granted

    # ------------------------------------------------------------------ 하루 이용 한도
    GLOBAL_ID = "*"

    def has_paid(self, device_id: str) -> bool:
        with self._read() as c:
            return c.execute("SELECT 1 FROM orders WHERE device_id=? AND status='paid' LIMIT 1", (device_id,)).fetchone() is not None

    @staticmethod
    def _count(c: sqlite3.Connection, device_id: str, day: str, kind: str) -> int:
        row = c.execute("SELECT n FROM usage WHERE device_id=? AND day=? AND kind=?", (device_id, day, kind)).fetchone()
        return row["n"] if row else 0

    @staticmethod
    def _bump(c: sqlite3.Connection, device_id: str, day: str, kind: str, delta: int) -> None:
        c.execute(
            "INSERT INTO usage(device_id, day, kind, n) VALUES (?,?,?,?) "
            "ON CONFLICT(device_id, day, kind) DO UPDATE SET n = MAX(0, n + ?)",
            (device_id, day, kind, max(0, delta), delta),
        )

    def try_use(self, device_id: str, day: str, kind: str, device_limit: int = 0, global_limit: int = 0) -> Optional[str]:
        """하루 한도를 확인하고 한 번 쓴 것으로 센다. 통과하면 None, 막히면 'global' 또는 'device'.
        limit 이 0 이하이면 그 단계는 제한하지 않는다. 확인과 증가가 한 트랜잭션이라 동시에 몰려도 한도를 넘지 않는다."""
        with self._tx() as c:
            if global_limit > 0 and self._count(c, self.GLOBAL_ID, day, kind) >= global_limit:
                return "global"
            if device_limit > 0 and self._count(c, device_id, day, kind) >= device_limit:
                return "device"
            if device_limit > 0:
                self._bump(c, device_id, day, kind, 1)
            if global_limit > 0:
                self._bump(c, self.GLOBAL_ID, day, kind, 1)
            return None

    def release_use(self, device_id: str, day: str, kind: str, device: bool = True, glob: bool = False) -> None:
        """생성에 실패했을 때 센 횟수를 돌려준다."""
        with self._tx() as c:
            if device:
                self._bump(c, device_id, day, kind, -1)
            if glob:
                self._bump(c, self.GLOBAL_ID, day, kind, -1)

    # ------------------------------------------------------------------ 지갑
    @staticmethod
    def _ip_hash(ip: str) -> str:
        salt = os.getenv("IP_HASH_SALT", "tarot-salt")
        return hashlib.sha256(f"{salt}|{ip}".encode()).hexdigest()[:24]

    def ensure_wallet(self, device_id: str, ip: str = "", welcome_coins: int = 0, welcome_per_ip_daily: int = 3) -> Dict[str, Any]:
        with self._tx() as c:
            row = c.execute("SELECT * FROM wallets WHERE device_id=?", (device_id,)).fetchone()
            if row is None:
                now = time.time()
                grant = 0
                if welcome_coins > 0:
                    h = self._ip_hash(ip or "unknown")
                    used = c.execute(
                        "SELECT COUNT(*) FROM welcome_grants WHERE ip_hash=? AND created_at>?", (h, now - 86400)
                    ).fetchone()[0]
                    if used < welcome_per_ip_daily:
                        grant = welcome_coins
                        c.execute("INSERT INTO welcome_grants(ip_hash, created_at) VALUES (?,?)", (h, now))
                c.execute("INSERT INTO wallets(device_id, coins, created_at) VALUES (?,?,?)", (device_id, grant, now))
                if grant:
                    c.execute(
                        "INSERT INTO ledger(device_id, delta, reason, ref, created_at) VALUES (?,?,?,?,?)",
                        (device_id, grant, "welcome", None, now),
                    )
                row = c.execute("SELECT * FROM wallets WHERE device_id=?", (device_id,)).fetchone()
            return dict(row)

    def get_wallet(self, device_id: str) -> Optional[Dict[str, Any]]:
        with self._read() as c:
            row = c.execute("SELECT * FROM wallets WHERE device_id=?", (device_id,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def _spend(c: sqlite3.Connection, device_id: str, amount: int, reason: str, ref: Optional[str]) -> int:
        cur = c.execute(
            "UPDATE wallets SET coins = coins - ? WHERE device_id=? AND coins >= ?", (amount, device_id, amount)
        )
        if cur.rowcount == 0:
            row = c.execute("SELECT coins FROM wallets WHERE device_id=?", (device_id,)).fetchone()
            raise InsufficientCoins(row["coins"] if row else 0)
        c.execute(
            "INSERT INTO ledger(device_id, delta, reason, ref, created_at) VALUES (?,?,?,?,?)",
            (device_id, -amount, reason, ref, time.time()),
        )
        return c.execute("SELECT coins FROM wallets WHERE device_id=?", (device_id,)).fetchone()["coins"]

    @staticmethod
    def _grant(c: sqlite3.Connection, device_id: str, amount: int, reason: str, ref: Optional[str]) -> int:
        c.execute("UPDATE wallets SET coins = coins + ? WHERE device_id=?", (amount, device_id))
        c.execute(
            "INSERT INTO ledger(device_id, delta, reason, ref, created_at) VALUES (?,?,?,?,?)",
            (device_id, amount, reason, ref, time.time()),
        )
        return c.execute("SELECT coins FROM wallets WHERE device_id=?", (device_id,)).fetchone()["coins"]

    def spend(self, device_id: str, amount: int, reason: str, ref: Optional[str] = None) -> int:
        with self._tx() as c:
            return self._spend(c, device_id, amount, reason, ref)

    def grant(self, device_id: str, amount: int, reason: str, ref: Optional[str] = None) -> int:
        with self._tx() as c:
            return self._grant(c, device_id, amount, reason, ref)

    # ------------------------------------------------------------------ 상담
    def save_reading(self, r: Dict[str, Any]) -> None:
        with self._read() as c:  # 문장 하나라 그 자체로 원자적이에요
            c.execute(
                """INSERT OR REPLACE INTO readings
                   (id, device_id, category, concern, cards_json, free_text, locked_text, meta_json, unlocked, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    r["id"], r["device_id"], r["category"], r["concern"],
                    json.dumps(r["cards"], ensure_ascii=False), r["free_text"], r.get("locked_text", ""),
                    json.dumps(r.get("meta", {}), ensure_ascii=False), 1 if r.get("unlocked", True) else 0, time.time(),
                ),
            )

    @staticmethod
    def _reading_row(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
        if row is None:
            return None
        d = dict(row)
        d["cards"] = json.loads(d.pop("cards_json"))
        d["meta"] = json.loads(d.pop("meta_json") or "{}")
        d["advice"] = json.loads(d.pop("advice_json")) if d.get("advice_json") else None
        d.pop("advice_json", None)
        d["followups"] = json.loads(d.pop("followups_json") or "[]")
        d["unlocked"] = bool(d["unlocked"])
        return d

    def get_reading(self, reading_id: str) -> Optional[Dict[str, Any]]:
        with self._read() as c:
            return self._reading_row(c.execute("SELECT * FROM readings WHERE id=?", (reading_id,)).fetchone())

    def unlock_with_coins(self, reading_id: str, device_id: str, cost: int) -> Tuple[bool, int]:
        """코인을 쓰고 잠금을 푼다. (이번에 실제로 차감했는지, 남은 코인)을 돌려준다. 이미 풀려 있으면 차감하지 않는다."""
        with self._tx() as c:
            row = c.execute("SELECT unlocked FROM readings WHERE id=? AND device_id=?", (reading_id, device_id)).fetchone()
            if row is None:
                raise KeyError(reading_id)
            if row["unlocked"]:
                w = c.execute("SELECT coins FROM wallets WHERE device_id=?", (device_id,)).fetchone()
                return False, (w["coins"] if w else 0)
            balance = self._spend(c, device_id, cost, "unlock", reading_id)
            c.execute("UPDATE readings SET unlocked=1 WHERE id=?", (reading_id,))
            return True, balance

    def set_advice(self, reading_id: str, advice: Dict[str, Any]) -> None:
        with self._read() as c:
            c.execute("UPDATE readings SET advice_json=? WHERE id=?", (json.dumps(advice, ensure_ascii=False), reading_id))

    def append_followup(self, reading_id: str, item: Dict[str, str]) -> int:
        with self._tx() as c:
            row = c.execute("SELECT followups_json FROM readings WHERE id=?", (reading_id,)).fetchone()
            items = json.loads(row["followups_json"] or "[]")
            items.append(item)
            c.execute("UPDATE readings SET followups_json=? WHERE id=?", (json.dumps(items, ensure_ascii=False), reading_id))
            return len(items)

    # ------------------------------------------------------------------ 주문
    def create_order(self, order_id: str, device_id: str, sku: str, amount: int, coins: int) -> None:
        with self._tx() as c:
            c.execute(
                "INSERT INTO orders(order_id, device_id, sku, amount, coins, status, created_at) VALUES (?,?,?,?,?,?,?)",
                (order_id, device_id, sku, amount, coins, "pending", time.time()),
            )

    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        with self._tx() as c:
            row = c.execute("SELECT * FROM orders WHERE order_id=?", (order_id,)).fetchone()
            return dict(row) if row else None

    def complete_order(self, order_id: str, payment_key: Optional[str]) -> Tuple[bool, int]:
        """주문을 '결제 완료'로 바꾸고 코인을 지급한다. 같은 주문은 한 번만 지급된다. (이번에 지급했는지, 잔액)"""
        with self._tx() as c:
            o = c.execute("SELECT * FROM orders WHERE order_id=?", (order_id,)).fetchone()
            if o is None:
                raise OrderError("order_not_found")
            if o["status"] == "paid":
                w = c.execute("SELECT coins FROM wallets WHERE device_id=?", (o["device_id"],)).fetchone()
                return False, (w["coins"] if w else 0)
            c.execute(
                "UPDATE orders SET status='paid', payment_key=?, paid_at=? WHERE order_id=?",
                (payment_key, time.time(), order_id),
            )
            balance = self._grant(c, o["device_id"], o["coins"], f"purchase:{o['sku']}", order_id)
            if o["sku"] == "first_990":
                c.execute("UPDATE wallets SET first_purchase_used=1 WHERE device_id=?", (o["device_id"],))
            return True, balance

    def fail_order(self, order_id: str) -> None:
        with self._tx() as c:
            c.execute("UPDATE orders SET status='failed' WHERE order_id=? AND status='pending'", (order_id,))


    # ------------------------------------------------------------------ 별가루·꾸미기 (미니게임)
    @staticmethod
    def _play_row(c: sqlite3.Connection, device_id: str, starter: Tuple[str, ...] = PLAY_STARTER) -> Dict[str, Any]:
        row = c.execute("SELECT * FROM play_state WHERE device_id=?", (device_id,)).fetchone()
        if row is None:
            c.execute(
                "INSERT INTO play_state(device_id, items_json, created_at) VALUES (?,?,?)",
                (device_id, json.dumps(list(starter)), time.time()),
            )
            row = c.execute("SELECT * FROM play_state WHERE device_id=?", (device_id,)).fetchone()
        d = dict(row)
        d["items"] = json.loads(d.pop("items_json") or "[]")
        d["equipped"] = json.loads(d.pop("equipped_json") or "{}")
        return d

    def play_state(self, device_id: str, day: str, starter: Tuple[str, ...] = PLAY_STARTER) -> Dict[str, Any]:
        with self._tx() as c:
            d = self._play_row(c, device_id, starter)
            d["plays_today"] = self._count(c, device_id, day, "play")
            d["earned_today"] = self._count(c, device_id, day, "stardust")
            return d

    def play_start(self, device_id: str, day: str, run_id: str, max_plays: int) -> bool:
        """판을 시작한다. 오늘 끝낸 판이 한도에 닿았으면 False."""
        with self._tx() as c:
            if self._count(c, device_id, day, "play") >= max_plays:
                return False
            c.execute(
                "INSERT INTO play_runs(run_id, device_id, day, started_at) VALUES (?,?,?,?)",
                (run_id, device_id, day, time.time()),
            )
            return True

    def play_claim(
        self, device_id: str, day: str, run_id: str, score: int, min_seconds: float,
        max_plays: int, daily_cap: int, reward_fn,
    ) -> Dict[str, Any]:
        """판을 끝내고 별가루를 받는다. 한 판은 한 번만 정산되고, 하루 별가루는 점수와 상관없이 daily_cap 을 넘지 않는다."""
        with self._tx() as c:
            run = c.execute("SELECT * FROM play_runs WHERE run_id=? AND device_id=?", (run_id, device_id)).fetchone()
            if run is None:
                return {"error": "unknown_run"}
            if run["claimed"]:
                return {"error": "already_claimed"}
            if time.time() - run["started_at"] < min_seconds:
                return {"error": "too_fast"}
            if self._count(c, device_id, day, "play") >= max_plays:
                return {"error": "play_limit"}
            c.execute("UPDATE play_runs SET claimed=1 WHERE run_id=?", (run_id,))
            self._bump(c, device_id, day, "play", 1)
            earned_before = self._count(c, device_id, day, "stardust")
            want = int(reward_fn(score))
            gain = max(0, min(want, daily_cap - earned_before))
            if gain:
                self._bump(c, device_id, day, "stardust", gain)
                self._play_row(c, device_id)
                c.execute("UPDATE play_state SET stardust = stardust + ? WHERE device_id=?", (gain, device_id))
            return {"gain": gain, "capped": gain < want}

    def rpg_plays_today(self, device_id: str, day: str) -> int:
        with self._tx() as c:
            return self._count(c, device_id, day, "rpg_play")

    def rpg_start(self, device_id: str, day: str, run_id: str, max_plays: int, state: Dict[str, Any]) -> bool:
        """RPG 한 판을 시작한다. 시작하면 오늘 판 수가 하나 줄어든다(중간에 나가도 그대로)."""
        with self._tx() as c:
            if self._count(c, device_id, day, "rpg_play") >= max_plays:
                return False
            self._bump(c, device_id, day, "rpg_play", 1)
            c.execute(
                "INSERT INTO rpg_runs(run_id, device_id, day, state_json, updated_at) VALUES (?,?,?,?,?)",
                (run_id, device_id, day, json.dumps(state), time.time()),
            )
            return True

    def rpg_turn(self, device_id: str, day: str, run_id: str, daily_cap: int, rewards: Dict[str, int], step_fn) -> Dict[str, Any]:
        """저장된 상태로 한 턴을 서버에서 진행한다. 끝나면 보상을 한 번만, 하루 상한 안에서 준다."""
        with self._tx() as c:
            row = c.execute("SELECT * FROM rpg_runs WHERE run_id=? AND device_id=?", (run_id, device_id)).fetchone()
            if row is None or row["day"] != day:
                return {"error": "unknown_run"}
            state = json.loads(row["state_json"])
            if state.get("over"):
                return {"error": "over"}
            state, log = step_fn(state)
            gain = 0
            want = 0
            if state.get("over") and not row["claimed"]:
                want = int(rewards.get(state["over"], 0))
                earned = self._count(c, device_id, day, "stardust")
                gain = max(0, min(want, daily_cap - earned))
                if gain:
                    self._bump(c, device_id, day, "stardust", gain)
                    self._play_row(c, device_id)
                    c.execute("UPDATE play_state SET stardust = stardust + ? WHERE device_id=?", (gain, device_id))
            c.execute(
                "UPDATE rpg_runs SET state_json=?, updated_at=?, claimed=? WHERE run_id=?",
                (json.dumps(state), time.time(), 1 if state.get("over") else row["claimed"], run_id),
            )
            return {"state": state, "log": log, "gain": gain, "capped": bool(want and gain < want)}

    def play_buy(self, device_id: str, item_id: str, price: int) -> str:
        """'ok' | 'owned' | 'poor'"""
        with self._tx() as c:
            d = self._play_row(c, device_id)
            if item_id in d["items"]:
                return "owned"
            cur = c.execute(
                "UPDATE play_state SET stardust = stardust - ? WHERE device_id=? AND stardust >= ?", (price, device_id, price)
            )
            if cur.rowcount == 0:
                return "poor"
            c.execute("UPDATE play_state SET items_json=? WHERE device_id=?", (json.dumps(d["items"] + [item_id]), device_id))
            return "ok"

    def play_equip(self, device_id: str, equipped: Dict[str, str], main: Optional[int]) -> None:
        with self._tx() as c:
            self._play_row(c, device_id)
            c.execute("UPDATE play_state SET equipped_json=? WHERE device_id=?", (json.dumps(equipped), device_id))
            if main is not None:
                c.execute("UPDATE play_state SET main_mascot=? WHERE device_id=?", (main, device_id))

    def play_exchange(self, device_id: str, ip: str, week: str, cost: int, per_ip_weekly: int) -> str:
        """별가루 → 코인 1개. 기기당 일주일에 한 번, 같은 네트워크는 일주일에 per_ip_weekly 번까지. 'ok'|'poor'|'weekly'|'ip'"""
        with self._tx() as c:
            d = self._play_row(c, device_id)
            if d["last_exchange_week"] == week:
                return "weekly"
            h = self._ip_hash(ip or "unknown")
            if c.execute("SELECT COUNT(*) FROM exchange_grants WHERE ip_hash=? AND week=?", (h, week)).fetchone()[0] >= per_ip_weekly:
                return "ip"
            cur = c.execute(
                "UPDATE play_state SET stardust = stardust - ?, last_exchange_week=? WHERE device_id=? AND stardust >= ?",
                (cost, week, device_id, cost),
            )
            if cur.rowcount == 0:
                return "poor"
            c.execute("INSERT INTO exchange_grants(ip_hash, week) VALUES (?,?)", (h, week))
            self._grant(c, device_id, 1, "stardust_exchange", week)
            return "ok"

    # ------------------------------------------------------------------ 연속 출석(스트릭)
    def checkin_get(self, device_id: str) -> Dict[str, Any]:
        with self._read() as c:
            row = c.execute("SELECT * FROM checkins WHERE device_id=?", (device_id,)).fetchone()
        return dict(row) if row else {"device_id": device_id, "last_day": "", "streak": 0, "best": 0, "total": 0}

    def checkin(self, device_id: str, day: str, yesterday: str, reward_fn, give_stardust: bool, lunar_bonus: int = 0) -> Dict[str, Any]:
        """오늘 출석을 한 번만 기록한다. 어제도 했으면 스트릭을 잇고, 아니면 1부터 다시 시작한다."""
        with self._tx() as c:
            row = c.execute("SELECT * FROM checkins WHERE device_id=?", (device_id,)).fetchone()
            if row and row["last_day"] == day:
                return {"already": True, "streak": row["streak"], "best": row["best"], "total": row["total"], "gain": 0, "bonus": 0}
            prev = row["streak"] if row and row["last_day"] == yesterday else 0
            streak = prev + 1
            best = max(streak, row["best"] if row else 0)
            total = (row["total"] if row else 0) + 1
            if row:
                c.execute("UPDATE checkins SET last_day=?, streak=?, best=?, total=? WHERE device_id=?", (day, streak, best, total, device_id))
            else:
                c.execute("INSERT INTO checkins(device_id, last_day, streak, best, total) VALUES (?,?,?,?,?)", (device_id, day, streak, best, total))
            gain = reward_fn(streak) + lunar_bonus if give_stardust else 0
            if gain:
                self._play_row(c, device_id)
                c.execute("UPDATE play_state SET stardust = stardust + ? WHERE device_id=?", (gain, device_id))
            return {"already": False, "streak": streak, "best": best, "total": total, "gain": gain, "bonus": lunar_bonus if give_stardust else 0}

    # ------------------------------------------------------------------ 친구 초대
    def invite_code(self, device_id: str, make_code) -> str:
        with self._tx() as c:
            row = c.execute("SELECT code FROM invite_codes WHERE device_id=?", (device_id,)).fetchone()
            if row:
                return row["code"]
            for _ in range(10):
                code = make_code()
                if c.execute("SELECT 1 FROM invite_codes WHERE code=?", (code,)).fetchone() is None:
                    c.execute("INSERT INTO invite_codes(code, device_id) VALUES (?,?)", (code, device_id))
                    return code
        raise RuntimeError("invite code")

    def invite_stats(self, device_id: str, since: float) -> Dict[str, int]:
        with self._read() as c:
            total = c.execute("SELECT COUNT(*) FROM referrals WHERE inviter_id=?", (device_id,)).fetchone()[0]
            week = c.execute("SELECT COUNT(*) FROM referrals WHERE inviter_id=? AND created_at>?", (device_id, since)).fetchone()[0]
            joined = c.execute("SELECT 1 FROM referrals WHERE invitee_id=?", (device_id,)).fetchone() is not None
        return {"total": total, "week": week, "redeemed": joined}

    def invite_redeem(self, invitee: str, code: str, ip: str, day: str, bonus_inviter: int, bonus_invitee: int,
                      weekly_max: int, per_ip_daily: int, max_age_days: int, give_stardust: bool) -> str:
        """초대 코드를 한 번 쓴다. 'ok'|'bad_code'|'self'|'used'|'too_old'|'inviter_full'|'ip'"""
        now = time.time()
        with self._tx() as c:
            row = c.execute("SELECT device_id FROM invite_codes WHERE code=?", (code,)).fetchone()
            if row is None:
                return "bad_code"
            inviter = row["device_id"]
            if inviter == invitee:
                return "self"
            if c.execute("SELECT 1 FROM referrals WHERE invitee_id=?", (invitee,)).fetchone():
                return "used"
            w = c.execute("SELECT created_at FROM wallets WHERE device_id=?", (invitee,)).fetchone()
            if w is not None and now - w["created_at"] > max_age_days * 86400:
                return "too_old"
            if c.execute("SELECT COUNT(*) FROM referrals WHERE inviter_id=? AND created_at>?", (inviter, now - 7 * 86400)).fetchone()[0] >= weekly_max:
                return "inviter_full"
            h = self._ip_hash(ip or "unknown")
            if c.execute("SELECT COUNT(*) FROM referrals WHERE ip_hash=? AND day=?", (h, day)).fetchone()[0] >= per_ip_daily:
                return "ip"
            c.execute("INSERT INTO referrals(invitee_id, inviter_id, ip_hash, day, created_at) VALUES (?,?,?,?,?)", (invitee, inviter, h, day, now))
            if give_stardust:
                for did, amt in ((inviter, bonus_inviter), (invitee, bonus_invitee)):
                    self._play_row(c, did)
                    c.execute("UPDATE play_state SET stardust = stardust + ? WHERE device_id=?", (amt, did))
            return "ok"

    # ------------------------------------------------------------------ 웹 푸시 구독
    def push_add(self, device_id: str, endpoint: str, p256dh: str, auth: str) -> None:
        with self._tx() as c:
            c.execute("DELETE FROM push_subs WHERE endpoint=?", (endpoint,))
            c.execute("INSERT INTO push_subs(endpoint, device_id, p256dh, auth, created_at) VALUES (?,?,?,?,?)", (endpoint, device_id, p256dh, auth, time.time()))

    def push_remove(self, device_id: str, endpoint: Optional[str] = None) -> int:
        with self._tx() as c:
            if endpoint:
                cur = c.execute("DELETE FROM push_subs WHERE device_id=? AND endpoint=?", (device_id, endpoint))
            else:
                cur = c.execute("DELETE FROM push_subs WHERE device_id=?", (device_id,))
            return cur.rowcount

    def push_has(self, device_id: str) -> bool:
        with self._read() as c:
            return c.execute("SELECT 1 FROM push_subs WHERE device_id=? LIMIT 1", (device_id,)).fetchone() is not None

    def push_due(self, day: str, limit: int = 500) -> list:
        with self._read() as c:
            rows = c.execute(
                "SELECT p.endpoint, p.device_id, p.p256dh, p.auth, COALESCE(k.last_day,'') AS last_day, COALESCE(k.streak,0) AS streak "
                "FROM push_subs p LEFT JOIN checkins k ON k.device_id=p.device_id WHERE p.last_sent_day != ? LIMIT ?",
                (day, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def push_mark(self, endpoint: str, day: str, dead: bool = False) -> None:
        with self._tx() as c:
            if dead:
                c.execute("DELETE FROM push_subs WHERE endpoint=?", (endpoint,))
            else:
                c.execute("UPDATE push_subs SET last_sent_day=? WHERE endpoint=?", (day, endpoint))
