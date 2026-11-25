import uvicorn
from datetime import datetime
import traceback
import json # Добавь в самый верх файла, если еще нет
import re
import requests
import os
import time

import asyncio
import logging
from functools import wraps

# Локальная разработка: подхватываем .env, если установлен python-dotenv.
# На Render/в проде переменные окружения задаются в панели проекта, .env не нужен.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
from openai import AsyncOpenAI
from fastapi.staticfiles import StaticFiles

from fastapi import APIRouter, FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import html
import uuid
from security import require_tg_user, price_cart, catalog_prompt_text
from typing import Optional, Any
import gspread
from oauth2client.service_account import ServiceAccountCredentials
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # Лише сторінки Mini App на GitHub Pages. Додаткові адреси — через змінну ALLOWED_ORIGINS (через кому).
    allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", "https://mykich.github.io").split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# === Уведомление клиенту ===
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")

if not TELEGRAM_TOKEN:
    print("⚠️ TELEGRAM_TOKEN не знайдено в змінних середовища! Повідомлення в Telegram не відправлятимуться.")
if not ADMIN_CHAT_ID:
    print("⚠️ ADMIN_CHAT_ID не знайдено в змінних середовища! Адмін не отримуватиме сповіщення.")

# === АИ Асистент ===
aclient = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """Ти — преміальний AI-консультант елітної пральні та ательє "PralnyaVdoma" (Київ, вул. Бульварно-Кудрявська, 17-А).

Стиль спілкування: Ввічливий консьєрж 5-зіркового готелю. 
❗️ ГОЛОВНЕ ПРАВИЛО: Пиши максимально КРАТКО, ЛАКОНІЧНО і ПО СУТІ. Жодної «води», довгих вступів та розлогих описів. Тільки конструктивні відповіді в 1-3 речення, якщо це можливо. Форматуй текст красиво (використовуй емодзі та списки).

Експертиза (використовуй точково, без зайвих деталей):
1. Пуховики та зимовий одяг: дбайливий догляд за пухом, відновлення об'єму.
2. Хімія: Преміальна гіпоалергенна хімія без різких запахів.
3. Обладнання: Професійні машини IPSO та Danube.

Прайс (орієнтовні ціни «від»; це той самий каталог, що бачить клієнт у застосунку):
""" + catalog_prompt_text() + """
Остаточна вартість погоджується після огляду речі. Складні речі (шкіра, замша, хутро, декор) — лише після огляду.

Правила:
- Не вигадуй невідомі ціни. Якщо послуги немає в прайсі — кажи, що треба спитати в менеджера.
- Завжди спрямовуй клієнта на оформлення замовлення прямо в додатку."""



def send_tg_message(chat_id, text):
    """Функция для отправки сообщений через Telegram API"""
    if not chat_id or not TELEGRAM_TOKEN:
        return
        
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML" # Позволяет использовать <b>жирный</b> текст и <i>курсив</i>
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        if not response.ok:
            print(f"⚠️ Ошибка отправки ТГ: {response.text}")
    except Exception as e:
        print(f"⚠️ Ошибка сети при отправке ТГ: {e}")

# ==========================================
def retry_google_api(max_retries=3):
    """
    Декоратор для повторного выполнения асинхронной функции
    при получении серверных ошибок от Google (500, 503) или лимитов (429).
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    error_msg = str(e)
                    if any(code in error_msg for code in ["500", "503", "429"]):
                        if attempt == max_retries - 1:
                            logging.error(f"❌ Все {max_retries} попытки исчерпаны. Ошибка: {error_msg}")
                            raise e 
                        
                        sleep_time = 2 ** attempt 
                        logging.warning(f"⚠️ Ошибка Google API ({error_msg}). Повторная попытка через {sleep_time} сек...")
                        await asyncio.sleep(sleep_time)
                    else:
                        raise e
        return wrapper
    return decorator
# ==========================================


# --- 1. GET: Загрузка кабинета ---


# --- Подключення до Google Таблиць ---
SCOPE = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]

SPREADSHEET_NAME = "Pralnya"

# Раніше підключення до Google Sheets відбувалося прямо тут, на рівні імпорту модуля —
# 5 послідовних блокуючих мережевих запитів (auth + 4x worksheet()) виконувались ДО того,
# як скрипт взагалі доходив до uvicorn.run(). Якщо Google API відповідав повільніше
# звичайного — порт фізично не встигав відкритися до тайм-ауту порт-скану Render,
# і деплой падав з "no open ports detected", хоча з кодом усе було гаразд.
#
# Тепер uvicorn стартує і відкриває порт одразу, а підключення до таблиці відбувається
# вже ПІСЛЯ цього, в startup-події FastAPI — Render встигає побачити відкритий порт
# незалежно від того, наскільки швидко відповість Google.
GS_CLIENT = None
spreadsheet = None
sheet_clients = None
sheet_orders = None
sheet_atelier = None
sheet_B2B_General = None


@app.on_event("startup")
async def connect_google_sheets():
    global GS_CLIENT, spreadsheet, sheet_clients, sheet_orders, sheet_atelier, sheet_B2B_General

    creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", SCOPE)
    GS_CLIENT = gspread.authorize(creds)
    spreadsheet = GS_CLIENT.open(SPREADSHEET_NAME)

    sheet_clients = spreadsheet.worksheet("Clients")
    sheet_orders = spreadsheet.worksheet("Лист1")
    sheet_atelier = spreadsheet.worksheet("Atelier")
    sheet_B2B_General = spreadsheet.worksheet("B2B_General")

    print("✅ Google Sheets підключено (після старту порту)")

# --- Модели данных ---
class ClientProfile(BaseModel):
    telegram_id: Any
    first_name: Optional[str] = ""
    phone: Optional[str] = ""
    apartment: Optional[str] = ""

class OrderData(BaseModel):
    user_id: Optional[Any] = None
    telegram_id: Optional[Any] = None
    username: Optional[str] = ""
    phone: Optional[str] = ""
    name: Optional[str] = ""
    address: Optional[str] = ""
    apartment: Optional[str] = ""
    items: Optional[Any] = ""
    service: Optional[str] = ""
    price: Optional[Any] = 0
    date: Optional[str] = ""
    comment: Optional[str] = ""

class B2BData(BaseModel):
    company: str
    phone: str
    details: Optional[str] = ""
    telegram_id: Optional[Any] = None
    name: Optional[str] = ""

class AIMessageData(BaseModel):
    message: str = ""
    telegram_id: Optional[Any] = None
    
router = APIRouter()

@app.post("/api/ai")
async def ai_chat(data: AIMessageData, tg_user: dict = Depends(require_tg_user)):
    try:
        # Обмеження довжини: кожен запит до OpenAI платний
        data.message = (data.message or "")[:1000]
        # Проверяем, есть ли вообще ключ
        if not os.getenv("OPENAI_API_KEY"):
            return {"status": "success", "reply": "Вибачте, мій AI-модуль наразі налаштовується. Будь ласка, зверніться до менеджера або скористайтеся меню!"}

        # Отправляем запрос в OpenAI
        response = await aclient.chat.completions.create(
            model="gpt-3.5-turbo", # Працює швидко і дешево, для консультанта ідеально
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": data.message}
            ],
            temperature=0.7, # Трохи креативності, але без фантазій
            max_tokens=250   # Обмежуємо довжину відповіді, щоб він був лаконічним
        )

        reply = response.choices[0].message.content

        return {"status": "success", "reply": reply}

    except Exception as e:
        print(f"❌ Помилка AI: {e}")
        # Якщо сталася помилка на стороні OpenAI, віддаємо клієнту красиву заглушку
        return {"status": "success", "reply": "Зараз я трохи перевантажений замовленнями 🧺. Будь ласка, зателефонуйте нашому менеджеру!"}
    
# --- 1. GET: Загрузка кабинета ---
def get_loyalty_discount(total_spent: float) -> int:
    """
    Знижка постійного клієнта Pralnya Club за сумою витрачених коштів
    (навмисно НЕ за кількістю замовлень — інакше знижку можна "накрутити",
    замовляючи по одній футболці багато разів).
    Максимум — 10%. Пороги (в ₴) легко змінити тут, в одному місці.
    """
    if total_spent >= 5000:
        return 10
    if total_spent >= 2000:
        return 5
    return 0


@app.get("/api/cabinet")
@retry_google_api(max_retries=3)
async def get_cabinet(user_id: Optional[int] = None, tg_user: dict = Depends(require_tg_user)):
    try:
        # user_id з адреси більше не використовується: клієнта визначає підпис Telegram
        user_str_id = str(tg_user["id"])
        client_data = {"name": "", "phone": "", "apartment": "", "discount": 0}
        
        # 1. Ищем данные клиента (через кэш)
        all_clients = get_cached_records(sheet_clients, "clients")
        for row in all_clients:
            if str(row.get("telegram_id", "")) == user_str_id:
                client_data = {
                    "name": row.get("name", ""),
                    "phone": str(row.get("phone", "")),
                    "apartment": str(row.get("apartment", "")),
                    "discount": 0
                }
                break
        
        client_orders = []
        total_spent = 0.0
        
        # 2. Собираем заказы ПРАЧЕЧНОЙ (через кэш)
        all_orders = get_cached_records(sheet_orders, "orders")
        for row in all_orders:
            order_tg_id = str(row.get("telegram_id", "")) 
            order_phone = str(row.get("Телефон", ""))
            
            if order_tg_id == user_str_id or (client_data["phone"] and order_phone == client_data["phone"]):
                if "Скасовано" not in str(row.get("Статус", "")) and not str(row.get("Скасування", "")).strip():
                    total_spent += parse_price_value(row.get("Сума", ""))
                client_orders.append({
                    "id": str(row.get("Номер замовлення", "")),
                    "status": row.get("Статус", ORDER_INITIAL_STATUS),
                    "items": str(row.get("Речі", "")),
                    "date": str(row.get("Дата", "")),
                    "price": format_price(row.get("Сума", "")),
                    "type": "laundry"
                })
                
        # 3. Собираем заявки АТЕЛЬЕ (через кэш)
        # Примітка: суму ательє свідомо НЕ додаємо до total_spent — вона орієнтовна
        # до огляду майстром, тому клієнту показуємо "Після огляду", а не число.
        all_atelier = get_cached_records(sheet_atelier, "atelier")
        for row in all_atelier:
            order_tg_id = str(row.get("Telegram ID", ""))
            
            if order_tg_id == user_str_id:
                client_orders.append({
                    "id": str(row.get("Номер заявки", "")),
                    "status": row.get("Статус", ATELIER_INITIAL_STATUS),
                    "items": str(row.get("Опис", "")),
                    "date": str(row.get("Дата", "")),
                    "price": "Після огляду",
                    "type": "atelier"
                })
        
        # 4. Знижка Pralnya Club — рахуємо від реальної суми витрат (пральня, без ательє)
        client_data["discount"] = get_loyalty_discount(total_spent)

        return {"client": client_data, "orders": client_orders}
        
    except Exception as e:
        print(f"❌ Ошибка при получении данных: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 2. POST: Сохранение профиля ---
@app.post("/api/cabinet")
async def update_cabinet(profile: ClientProfile, tg_user: dict = Depends(require_tg_user)):
    try:
        profile.telegram_id = tg_user["id"]
        user_str_id = str(profile.telegram_id)
        all_clients = sheet_clients.get_all_records(numericise_ignore=["all"])
        
        row_index = None
        for i, row in enumerate(all_clients, start=2):  
            if str(row.get("telegram_id", "")) == user_str_id:
                row_index = i
                break

        if row_index:
            # Порожні поля не затирають уже збережені дані
            if profile.first_name:
                sheet_clients.update_cell(row_index, 2, profile.first_name)
            if profile.phone:
                sheet_clients.update_cell(row_index, 3, profile.phone)
            if profile.apartment:
                sheet_clients.update_cell(row_index, 4, profile.apartment)
        else:
            new_row = [profile.telegram_id, profile.first_name, profile.phone, profile.apartment, "", ""]
            sheet_clients.append_row(new_row)
        return {"status": "success"}
    except Exception as e:
        print(f"❌ Ошибка при сохранении профиля: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Єдині статуси (ті самі, що в боті PralnyaVdoma.py) ---
ORDER_INITIAL_STATUS = "Очікує"        # Лист1: Очікує → 🧺 В роботі → 🚚 Доставляється → ✅ Виконано / ❌ Скасовано
ATELIER_INITIAL_STATUS = "Нова"        # Atelier: Нова → В роботі → Готово / Скасовано
B2B_INITIAL_STATUS = "Нова заявка"     # B2B_General: Нова заявка → В процесі переговорів → Погоджено / Відхилено


def make_number(prefix, now=None):
    """Номер заявки: префікс + час + 3 випадкові символи (два замовлення в одну секунду не збігаються)."""
    now = now or datetime.now()
    return f"{prefix}-{int(now.timestamp())}{uuid.uuid4().hex[:3].upper()}"


def esc(value):
    """Екранування для повідомлень Telegram з parse_mode=HTML: символ < в імені чи коментарі не зламає відправку."""
    return html.escape(str(value or ""), quote=False)


# Захист від подвійного натискання «Оформити»: однаковий кошик від того самого клієнта за 60 с
_recent_orders = {}
DUPLICATE_WINDOW = 60


def is_duplicate_request(telegram_id, priced_items):
    key = (str(telegram_id), tuple(sorted((i["id"], i["quantity"]) for i in priced_items)))
    now = time.time()
    for k, ts in list(_recent_orders.items()):
        if now - ts > DUPLICATE_WINDOW:
            _recent_orders.pop(k, None)
    if key in _recent_orders:
        return True
    _recent_orders[key] = now
    return False


def invalidate_cache(*keys):
    """Після запису в таблицю скидаємо кеш, щоб кабінет одразу показав нове замовлення."""
    for k in keys:
        if k in cache_storage:
            cache_storage[k]["data"] = None


# --- 3. POST: Создание заказа (Прачечная / Ателье) ---
@app.post("/api/orders")  # Check your endpoint name (/api/order or /api/orders)
@app.post("/api/order")
@app.post("/api/order/")
async def create_order(order: OrderData, tg_user: dict = Depends(require_tg_user)):
    try:
        # Клієнт — лише той, чий підпис Telegram перевірено; telegram_id з тіла запиту ігнорується
        order.telegram_id = tg_user["id"]
        order.username = f"@{tg_user['username']}" if tg_user.get("username") else ""
        # Ціни — лише з серверного каталогу (services.js), суми з браузера ігноруються
        priced_items, catalog_total = price_cart(order.items)
        if is_duplicate_request(order.telegram_id, priced_items):
            raise HTTPException(status_code=409, detail="Це замовлення вже прийнято")

        # Змішаний кошик ділимо: послуги ательє — у лист Atelier, решта — у Лист1 (пральня).
        # Раніше весь кошик з хоча б однією послугою ательє йшов в Atelier, і прання губилось.
        atelier_items = [i for i in priced_items if i["section"] == "atelier"]
        laundry_items = [i for i in priced_items if i["section"] != "atelier"]
        order_ids = []
        if atelier_items:
            order_ids.append(await _create_atelier_order(order, atelier_items))
        if laundry_items:
            order_ids.append(await _create_laundry_order(order, laundry_items))
        invalidate_cache("orders", "orders_loyalty", "atelier", "clients")
        return {"status": "success", "order_id": ", ".join(order_ids), "order_ids": order_ids}

    except HTTPException:
        raise
    except Exception as e:
        print("❌ Ошибка при создании заказа:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


async def _create_atelier_order(order, priced_items):
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d %H:%M")
        if True:
            order_id = make_number("ATL", now)
            item_names = []
            
            # 1. Создаем переменную для подсчета общей суммы
            total_price = 0 
            
            for item in priced_items:
                total_price += item["price"] * item["quantity"]
                if item["quantity"] > 1:
                    item_names.append(f"• {item['name']} — {item['quantity']} шт.")
                else:
                    item_names.append(f"• {item['name']}")
                                
            if not item_names:
                item_names.append("• Послуги ательє (деталі не розпізнано)")

            items_text = "\n".join(item_names)
            
            # 4. Форматируем сумму, чтобы было красиво (отсекаем нули)
            formatted_price = f"{int(total_price)} ₴"

            # 5. Собираем строку для таблицы
           # 5. Собираем строку для таблицы (с твоим новым порядком колонок)
            new_row = [
                date_str,                 # 1-я: Дата
                order.name,               # 2-я: Имя
                str(order.telegram_id),   # 3-я: Telegram ID
                order.username or "",     # 4-я: Username
                items_text,               # 5-я: Послуги (Названия)
                "",                       # 6-я: Фото
                ATELIER_INITIAL_STATUS,   # 7-я: Статус
                "",                       # 8-я: Комментарий/Колонка
                ATELIER_INITIAL_STATUS,   # 9-я: Останній повідомлений статус (клієнт уже отримав підтвердження)
                order_id,                 # 10-я: Номер заявки
                formatted_price           # 11-я: СУМА
            ]

            sheet_atelier.append_row(new_row)
            print(f"✅ Заявка в Ательє {order_id} успішно записана! Сума: {formatted_price}")

            # === НОВИЙ БЛОК: УВЕДОМЛЕНИЯ В TELEGRAM (АТЕЛЬЕ) ===
            
            # 1. Сообщение для клиента
            client_text = (
                f"✅ <b>Заявку успішно відправлено!</b>\n\n"
                f"<b>Номер:</b> {order_id}\n"
                f"<b>Послуги:</b>\n{items_text}\n"
                f"<b>Орієнтовна сума:</b> {formatted_price}\n\n"
                f"Майстер зв'яжеться з вами найближчим часом! ✂️"
            )
            # Отправляем клиенту по его telegram_id
            send_tg_message(order.telegram_id, client_text)
            
            # 2. Сообщение для администратора (Тебе и Светлане Николаевне)
            admin_text = (
                f"✂️ <b>НОВА ЗАЯВКА (Ательє)</b> ✂️\n\n"
                f"<b>Номер:</b> {order_id}\n"
                f"<b>Клієнт:</b> {esc(order.name)}\n"
                f"<b>Телефон:</b> {esc(order.phone)}\n"
                f"<b>Адреса:</b> {esc(order.address)}\n"
                f"<b>Послуги:</b>\n{items_text}\n"
                f"<b>Орієнтовна сума:</b> {formatted_price}\n"
                f"<b>Коментар:</b> {esc(order.comment) or 'Немає'}"
            )
            # Отправляем в админский чат
            send_tg_message(ADMIN_CHAT_ID, admin_text)
            
            # ====================================================

            return order_id


async def _create_laundry_order(order, priced_items):
        now = datetime.now()
        catalog_total = sum(i["price"] * i["quantity"] for i in priced_items)
        if True:
            # 1. Красиво форматируем вещи с учетом количества
            item_names = [
                f"{item['name']} ({item['quantity']} шт)" if item["quantity"] > 1 else item["name"]
                for item in priced_items
            ]
            items_str = ", ".join(item_names)
            total_price = catalog_total

            # 1.5 Знижка Pralnya Club — за сумою, яку клієнт вже витратив раніше
            all_orders_for_loyalty = get_cached_records(sheet_orders, "orders_loyalty", ttl=LOYALTY_CACHE_TTL)
            prev_total_spent = sum(
                parse_price_value(row.get("Сума", ""))
                for row in all_orders_for_loyalty
                if str(row.get("telegram_id", "")) == str(order.telegram_id)
                and "Скасовано" not in str(row.get("Статус", ""))
                and not str(row.get("Скасування", "")).strip()
            )
            loyalty_discount = get_loyalty_discount(prev_total_spent)
            price_before_discount = total_price
            if loyalty_discount > 0:
                total_price = round(total_price * (1 - loyalty_discount / 100))

            # 2. Генерируем ID для прачечной
            order_id = make_number("ORD", now)
            
            # 3. Собираем массив строк для Прачечной
            new_row = [
                now.strftime("%Y-%m-%d"),
                order.name,
                order.phone,
                order.address,
                items_str,
                order.comment,
                "",
                "",
                ORDER_INITIAL_STATUS,     # I Статус (як у боті)
                "",
                total_price,
                "",
                order_id,
                ORDER_INITIAL_STATUS,     # N Останній повідомлений статус — клієнт уже отримав підтвердження
                "",
                str(order.telegram_id)
            ]
            
            sheet_orders.append_row(new_row)
            print(f"✅ Заказ {order_id} ({items_str}) успішно записано! Знижка: {loyalty_discount}%")
            
            # === НОВИЙ БЛОК: УВЕДОМЛЕНИЯ В TELEGRAM (ПРАЧЕЧНАЯ) ===
            
            discount_line = f"<b>Знижка Pralnya Club:</b> -{loyalty_discount}% (було {int(price_before_discount)} ₴)\n" if loyalty_discount > 0 else ""

            # 1. Сообщение для клиента
            client_text = (
                f"🫧 <b>Ваше замовлення прийнято!</b>\n\n"
                f"<b>Номер:</b> {order_id}\n"
                f"<b>Речі:</b> {items_str}\n"
                f"{discount_line}"
                f"<b>Сума:</b> {int(total_price)} ₴\n\n"
                f"Дякуємо, що обрали PralnyaVdoma! 💙"
            )
            send_tg_message(order.telegram_id, client_text)
            
            # 2. Сообщение для адміністратора 
            admin_text = (
                f"🫧 <b>НОВЕ ЗАМОВЛЕННЯ (Пральня)</b> 🫧\n\n"
                f"<b>Номер:</b> {order_id}\n"
                f"<b>Клієнт:</b> {esc(order.name)}\n"
                f"<b>Телефон:</b> {esc(order.phone)}\n"
                f"<b>Квартира:</b> {esc(order.address)}\n"
                f"<b>Речі:</b> {items_str}\n"
                f"{discount_line}"
                f"<b>Сума:</b> {int(total_price)} ₴\n"
                f"<b>Коментар:</b> {esc(order.comment) or 'Немає'}"
            )
            send_tg_message(ADMIN_CHAT_ID, admin_text)
            
            # ====================================================

            return order_id

# Кэш в памяти для Google Таблиц (время жизни — 60 секунд по умолчанию)
cache_storage = {
    "clients": {"data": None, "expires": 0},
    "orders": {"data": None, "expires": 0},
    "orders_loyalty": {"data": None, "expires": 0},  # окремий, короткий TTL — від нього залежить сума до сплати
    "atelier": {"data": None, "expires": 0}
}
CACHE_TTL = 60
LOYALTY_CACHE_TTL = 5  # секунд — набагато коротший за звичайний, щоб два швидких замовлення поспіль рахували коректно

def get_cached_records(sheet, cache_key, ttl=None):
    global cache_storage
    now = time.time()
    effective_ttl = CACHE_TTL if ttl is None else ttl
    # Если кэш пустой или устарел — делаем реальный запрос к Google Таблице
    if cache_storage[cache_key]["data"] is None or now > cache_storage[cache_key]["expires"]:
        # numericise_ignore=["all"]: gspread інакше перетворює "720,00" на 72000
        # (через це раніше був костиль «ділити суми ≥10000 на 100»)
        cache_storage[cache_key]["data"] = sheet.get_all_records(numericise_ignore=["all"])
        cache_storage[cache_key]["expires"] = now + effective_ttl
    return cache_storage[cache_key]["data"]

    
# --- 4. POST: Заявка B2B (Співпраця) ---
@app.post("/api/b2b")
async def create_b2b_request(data: B2BData, tg_user: dict = Depends(require_tg_user)):
    try:
        data.telegram_id = tg_user["id"]
        username = f"@{tg_user['username']}" if tg_user.get("username") else ""
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d %H:%M")
        
        # Генерируем простой номер заявки (например: B2B-26081540 — дата и время)
        order_number = make_number("B2B", now)

        # Формируем строку из 12 элементов строго под новую единую структуру
        new_row = [
            date_str,                           # 1. Дата
            "Mini App",                         # 2. Джерело
            order_number,                       # 3. Номер заявки
            data.company,                       # 4. Клієнт (Ім'я / Компанія)
            data.phone,                         # 5. Телефон
            data.details or "",                 # 6. Опис / Деталі
            "",                                 # 7. Фото (в B2B форме Mini App его нет)
            str(data.telegram_id or ""),        # 8. Telegram ID
            username,                           # 9. Username (если передается в B2BData)
            B2B_INITIAL_STATUS,                 # 10. Статус
            "",                                 # 11. Коментар адміна (пусто)
            B2B_INITIAL_STATUS                  # 12. Останній повідомлений статус — клієнт уже отримав підтвердження
        ]

        # Записываем на наш единый лист (убедитесь, что sheet_b2b указывает на B2B_General)
        sheet_B2B_General.append_row(new_row)
        print(f"✅ B2B заявка №{order_number} від {data.company} успішно збережена!")
        invalidate_cache("clients")

        # 1. Повідомлення клієнту в Телеграм
        client_text = (
            f"🤝 <b>Дякуємо за запит на співпрацю!</b>\n"
            f"<b>Номер заявки:</b> #{order_number}\n\n"
            f"<b>Компанія:</b> {esc(data.company)}\n"
            f"Наш менеджер зв'яжеться з вами найближчим часом для обговорення індивідуальних умов."
        )
        if data.telegram_id:
            send_tg_message(data.telegram_id, client_text)

        # 2. Повідомлення адміністратору (в адмінський чат)
        admin_text = (
            f"💼 <b>НОВА B2B ЗАЯВКА (Mini App) №{order_number}</b> 💼\n\n"
            f"<b>Компанія:</b> {esc(data.company)}\n"
            f"<b>Телефон:</b> {esc(data.phone)}\n"
            f"<b>Деталі:</b> {esc(data.details) or 'Не вказано'}\n"
            f"<b>Telegram ID:</b> {data.telegram_id or 'Невідомо'}"
        )
        send_tg_message(ADMIN_CHAT_ID, admin_text)

        return {"status": "success", "order_number": order_number}

    except Exception as e:
        print(f"❌ Помилка створення B2B заявки: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def parse_price_value(val) -> float:
    """
    Сума з таблиці в будь-якому вигляді: 1200, "720,00", "1 910,00", "450 ₴", "1.910,50" -> float.
    Некоректне/порожнє значення -> 0. Використовується для витрат клієнта (Pralnya Club).
    """
    text = str(val or "").replace("\xa0", "").replace(" ", "")
    text = re.sub(r"[^0-9,.\-]", "", text).replace(",", ".")
    if text.count(".") > 1:
        head, _, tail = text.rpartition(".")
        text = head.replace(".", "") + "." + tail
    try:
        return float(text) if text else 0.0
    except ValueError:
        return 0.0


def format_price(val):
    """Сума для показу клієнту: «1910 грн»."""
    if val in (None, ""):
        return "0 грн"
    num = parse_price_value(val)
    if num == 0 and not re.search(r"\d", str(val)):
        return str(val)
    return f"{int(round(num))} грн"



import os

if __name__ == "__main__":
    # Ловим порт, который выдает Render, либо ставим 10000 для локальных тестов
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)