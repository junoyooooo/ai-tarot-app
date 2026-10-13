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
