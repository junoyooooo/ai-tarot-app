"""SQLite 저장소: 코인 지갑, 상담(잠금 포함), 주문.

- 지금은 기기 ID(device_id)로 사용자를 구분합니다. 로그인(카카오 등)을 붙이면 device_id 자리에 계정 ID를 쓰면 됩니다.
- Render 무료 플랜은 디스크가 초기화되므로, 실제 결제를 받기 전에 DB_PATH 를 영구 디스크나 외부 DB(Postgres 등)로 옮기세요.
"""
import hashlib
import json
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from typing import Any, Dict, Optional, Tuple

from play import STARTER as PLAY_STARTER


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
CREATE TABLE IF NOT EXISTS exchange_grants (
    ip_hash TEXT NOT NULL,
    week TEXT NOT NULL
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
"""


class Store:
    def __init__(self, path: str):
        self.path = path
        folder = os.path.dirname(os.path.abspath(path))
        os.makedirs(folder, exist_ok=True)
        self._lock = threading.Lock()
        conn = sqlite3.connect(self.path, timeout=15)
        try:
            conn.executescript(SCHEMA)
            conn.commit()
        finally:
            conn.close()

    @contextmanager
    def _tx(self):
        """쓰기 트랜잭션. 프로세스 안에서는 락으로, 여러 프로세스 사이에서는 BEGIN IMMEDIATE 로 보호한다."""
        with self._lock:
            conn = sqlite3.connect(self.path, timeout=15, isolation_level=None)
            conn.row_factory = sqlite3.Row
            try:
                conn.execute("BEGIN IMMEDIATE")
                yield conn
                conn.execute("COMMIT")
            except BaseException:
                try:
                    conn.execute("ROLLBACK")
                except sqlite3.Error:
                    pass
                raise
            finally:
                conn.close()

    # ------------------------------------------------------------------ 하루 이용 한도
    GLOBAL_ID = "*"

    def has_paid(self, device_id: str) -> bool:
        with self._tx() as c:
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
        with self._tx() as c:
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
        with self._tx() as c:
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
        with self._tx() as c:
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
        with self._tx() as c:
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
