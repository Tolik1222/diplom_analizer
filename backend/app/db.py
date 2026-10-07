import os
import sqlite3
import hashlib
import secrets
import json
import base64
import io
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from PIL import Image

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "optimetrics.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initializes SQLite database schema for users, auth tokens, and analysis history."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                email TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Auth tokens session table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)

        # Analysis history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                filename TEXT NOT NULL,
                thumbnail_url TEXT,
                original_size_bytes INTEGER,
                optimized_size_bytes INTEGER,
                saved_percent REAL,
                format TEXT,
                quality INTEGER,
                ssim REAL,
                psnr_db REAL,
                entropy_bits REAL,
                spatial_info REAL,
                noise_score REAL,
                content_type TEXT,
                metrics_json TEXT,
                strategy_json TEXT,
                optimization_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        conn.commit()


# ---------------------------------------------------------------------------
# Password and Authentication Helpers
# ---------------------------------------------------------------------------

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000
    ).hex()
    return hashed, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    hashed, _ = hash_password(password, salt)
    return secrets.compare_digest(hashed, password_hash)


def register_user(username: str, password: str, email: str = "") -> Dict[str, Any]:
    username = username.strip()
    if len(username) < 3:
        raise ValueError("Ім'я користувача повинно містити щонайменше 3 символи.")
    if len(password) < 4:
        raise ValueError("Пароль повинен містити щонайменше 4 символи.")

    pwd_hash, salt = hash_password(password)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,))
        if cursor.fetchone():
            raise ValueError("Користувач із таким іменем вже існує.")

        cursor.execute(
            "INSERT INTO users (username, password_hash, salt, email) VALUES (?, ?, ?, ?)",
            (username, pwd_hash, salt, email.strip())
        )
        user_id = cursor.lastrowid
        conn.commit()

        # Generate auth token automatically upon registration
        token = create_token(user_id)
        return {
            "user_id": user_id,
            "username": username,
            "email": email.strip(),
            "token": token
        }


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    username = username.strip()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,))
        user = cursor.fetchone()
        if not user:
            return None

        if not verify_password(password, user["password_hash"], user["salt"]):
            return None

        token = create_token(user["id"])
        return {
            "user_id": user["id"],
            "username": user["username"],
            "email": user["email"] or "",
            "token": token
        }


def create_token(user_id: int, days_valid: int = 30) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=days_valid)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at.isoformat())
        )
        conn.commit()
    return token


def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    with get_db_connection() as conn:
        cursor = conn.cursor()
        now_str = datetime.utcnow().isoformat()
        cursor.execute("""
            SELECT u.id, u.username, u.email, u.created_at
            FROM tokens t
            JOIN users u ON t.user_id = u.id
            WHERE t.token = ? AND t.expires_at > ?
        """, (token, now_str))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"] or "",
            "created_at": row["created_at"]
        }


def revoke_token(token: str) -> bool:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tokens WHERE token = ?", (token,))
        conn.commit()
        return cursor.rowcount > 0


# ---------------------------------------------------------------------------
# History and Image Assessment Records
# ---------------------------------------------------------------------------

def generate_thumbnail_base64(raw_bytes: bytes, max_dim: int = 140) -> str:
    """Generates a small fast Base64 JPEG thumbnail to store with history."""
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img = img.convert("RGB")
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=75)
        b64 = base64.b64encode(out.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"
    except Exception:
        return ""


def save_history_entry(
    user_id: Optional[int],
    filename: str,
    raw_bytes: bytes,
    metrics: Dict[str, Any],
    strategy: Dict[str, Any],
    optimization: Optional[Dict[str, Any]]
) -> int:
    thumbnail_url = generate_thumbnail_base64(raw_bytes)
    orig_size = len(raw_bytes)
    opt_size = optimization.get("optimized_size_bytes", orig_size) if optimization else orig_size
    saved_percent = optimization.get("saved_percent", 0.0) if optimization else 0.0
    fmt = optimization.get("format", strategy.get("recommended_format", "WEBP")) if optimization else strategy.get("recommended_format", "WEBP")
    q = optimization.get("quality_applied", strategy.get("recommended_quality", 84)) if optimization else strategy.get("recommended_quality", 84)
    ssim = optimization.get("ssim", 1.0) if optimization else 1.0
    psnr_db = optimization.get("psnr_db", 0.0) if optimization else 0.0

    entropy = metrics.get("complexity", {}).get("entropy_bits", 0.0)
    spatial_info = metrics.get("complexity", {}).get("spatial_information", 0.0)
    noise_score = metrics.get("noise", {}).get("noise_score", 0.0)
    content_type = metrics.get("metadata", {}).get("content_type", "Фото")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO history (
                user_id, filename, thumbnail_url,
                original_size_bytes, optimized_size_bytes, saved_percent,
                format, quality, ssim, psnr_db,
                entropy_bits, spatial_info, noise_score, content_type,
                metrics_json, strategy_json, optimization_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            filename,
            thumbnail_url,
            orig_size,
            opt_size,
            saved_percent,
            fmt,
            q,
            ssim,
            psnr_db,
            entropy,
            spatial_info,
            noise_score,
            content_type,
            json.dumps(metrics, ensure_ascii=False),
            json.dumps(strategy, ensure_ascii=False),
            json.dumps(optimization or {}, ensure_ascii=False)
        ))
        conn.commit()
        return cursor.lastrowid


def get_history_entries(user_id: Optional[int] = None, limit: int = 15) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id is not None:
            cursor.execute("""
                SELECT id, user_id, filename, thumbnail_url,
                       original_size_bytes, optimized_size_bytes, saved_percent,
                       format, quality, ssim, psnr_db,
                       entropy_bits, spatial_info, noise_score, content_type,
                       created_at
                FROM history
                WHERE user_id = ?
                ORDER BY id DESC
                LIMIT ?
            """, (user_id, limit))
        else:
            # Guest / general recent history
            cursor.execute("""
                SELECT id, user_id, filename, thumbnail_url,
                       original_size_bytes, optimized_size_bytes, saved_percent,
                       format, quality, ssim, psnr_db,
                       entropy_bits, spatial_info, noise_score, content_type,
                       created_at
                FROM history
                ORDER BY id DESC
                LIMIT ?
            """, (limit,))

        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def get_history_entry_detail(history_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id is not None:
            cursor.execute("SELECT * FROM history WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (history_id, user_id))
        else:
            cursor.execute("SELECT * FROM history WHERE id = ?", (history_id,))
        row = cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        try:
            res["metrics"] = json.loads(res["metrics_json"]) if res.get("metrics_json") else None
            res["strategy"] = json.loads(res["strategy_json"]) if res.get("strategy_json") else None
            res["optimization"] = json.loads(res["optimization_json"]) if res.get("optimization_json") else None
        except Exception:
            pass
        return res


def delete_history_entry(history_id: int, user_id: Optional[int] = None) -> bool:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id is not None:
            cursor.execute("DELETE FROM history WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (history_id, user_id))
        else:
            cursor.execute("DELETE FROM history WHERE id = ?", (history_id,))
        conn.commit()
        return cursor.rowcount > 0


def clear_history_entries(user_id: Optional[int] = None) -> bool:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id is not None:
            cursor.execute("DELETE FROM history WHERE user_id = ?", (user_id,))
        else:
            cursor.execute("DELETE FROM history WHERE user_id IS NULL")
        conn.commit()
        return True


# Auto-initialize DB schema on module import
init_db()
