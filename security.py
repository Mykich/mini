"""
Безпека API для Mini App:
  1. Перевірка підпису Telegram initData — сервер сам дізнається, хто клієнт,
     а не вірить telegram_id, який надсилає браузер.
  2. Каталог цін на сервері — сума замовлення рахується з services.js за id позиції,
     а не береться з браузера.

Документація Telegram: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""

import hashlib
import hmac
import json
import os
import re
import time
from typing import Optional
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException

# Скільки живе initData. Telegram видає його при відкритті Mini App;
# 24 години з запасом покривають навіть довго відкритий застосунок.
INIT_DATA_MAX_AGE = 24 * 60 * 60

# DEV_MODE=1 дозволяє локально тестувати API без Telegram (наприклад, з браузера).
# На Render цю змінну НЕ задавати.
DEV_MODE = os.getenv("DEV_MODE", "").strip() == "1"
DEV_USER_ID = int(os.getenv("DEV_USER_ID", "0") or 0)


def verify_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    """Повертає дані користувача Telegram, якщо підпис правильний, інакше None."""
    if not init_data or not bot_token:
        return None
    try:
        pairs = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    except ValueError:
        return None

    received_hash = pairs.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        return None

    try:
        auth_date = int(pairs.get("auth_date", "0"))
    except ValueError:
        return None
    if time.time() - auth_date > INIT_DATA_MAX_AGE:
        return None

    try:
        user = json.loads(pairs.get("user", "{}"))
    except ValueError:
        return None
    if not isinstance(user, dict) or not user.get("id"):
        return None
    return user


def require_tg_user(
    x_telegram_init_data: Optional[str] = Header(default=None),
) -> dict:
    """
    FastAPI-залежність: повертає перевіреного користувача Telegram ({"id": ..., "first_name": ...}).
    Без правильного підпису — 401.
    """
    user = verify_init_data(x_telegram_init_data or "", os.getenv("TELEGRAM_TOKEN", ""))
    if user:
        return user
    if DEV_MODE and DEV_USER_ID:
        return {"id": DEV_USER_ID, "first_name": "Dev", "username": ""}
    raise HTTPException(status_code=401, detail="Відкрийте застосунок через Telegram")


# ==========================================
# Каталог цін (єдине джерело для Mini App і API — frontend/services.js)
# ==========================================
SERVICES_JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "services.js")

_ITEM_RE = re.compile(
    r"\{\s*id:\s*(\d+)\s*,\s*name:\s*\"([^\"]+)\"[^{}]*?price:\s*(\d+(?:\.\d+)?)",
    re.S,
)


_SECTION_RE = re.compile(r"^\s{4}(\w+):\s*\[", re.M)

# Назви розділів каталогу українською (для промпту ІІ і повідомлень)
SECTION_TITLES = {
    "clothing": "Прання одягу",
    "outerwear": "Верхній одяг",
    "textile": "Домашній текстиль",
    "shoes": "Взуття",
    "accessories": "Аксесуари",
    "aquaclean": "Аквачистка (преміум)",
    "ironing": "Прасування без прання",
    "extra": "Додаткові послуги",
    "atelier": "Ательє",
}


def load_catalog(path: str = SERVICES_JS) -> dict:
    """Читає services.js і повертає {id: {"name", "price", "section"}}."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    sections = [(m.start(), m.group(1)) for m in _SECTION_RE.finditer(text)]
    catalog = {}
    for m in _ITEM_RE.finditer(text):
        item_id, name, price = int(m.group(1)), m.group(2), float(m.group(3))
        if item_id in catalog:
            raise RuntimeError(f"У services.js два товари з id {item_id}")
        section = ""
        for pos, key in sections:
            if pos < m.start():
                section = key
        catalog[item_id] = {"name": name, "price": price, "section": section}
    if not catalog:
        raise RuntimeError("Не вдалося прочитати жодної ціни з services.js")
    return catalog


CATALOG = load_catalog()


def price_cart(items, max_qty: int = 99):
    """
    Перераховує кошик за серверним каталогом.
    Повертає (позиції [{"id","name","price","quantity"}], сума).
    Невідомий id -> 400, щоб замовлення з підробленою позицією не потрапило в таблицю.
    """
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=400, detail="Кошик порожній")
    lines = []
    total = 0.0
    for raw in items:
        if not isinstance(raw, dict):
            raise HTTPException(status_code=400, detail="Некоректна позиція в кошику")
        try:
            item_id = int(raw.get("id"))
            qty = int(raw.get("quantity", 1) or 1)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Некоректна позиція в кошику")
        product = CATALOG.get(item_id)
        if not product:
            raise HTTPException(status_code=400, detail=f"Невідома послуга (id {item_id})")
        qty = max(1, min(qty, max_qty))
        lines.append({
            "id": item_id,
            "name": product["name"],
            "price": product["price"],
            "quantity": qty,
            "section": product["section"],
        })
        total += product["price"] * qty
    return lines, total


def catalog_prompt_text() -> str:
    """Прайс для промпту ІІ, зібраний з того самого каталогу, що бачить клієнт."""
    by_section = {}
    for item in CATALOG.values():
        by_section.setdefault(item["section"], []).append(item)
    parts = []
    for key, items in by_section.items():
        title = SECTION_TITLES.get(key, key)
        line = "; ".join(f"{i['name']} — від {int(i['price'])} ₴" for i in items)
        parts.append(f"- {title}: {line}")
    return "\n".join(parts)
