import uvicorn
from datetime import datetime
import traceback
import json # Добавь в самый верх файла, если еще нет
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

from fastapi import APIRouter, FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
import gspread
from oauth2client.service_account import ServiceAccountCredentials
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
1. Пуховики та зимовий одяг: Експертиза преміум-рівня (як у ienki-ienki) — дбайливий догляд за пухом, відновлення об'єму.
2. Хімія: Преміальна гіпоалергенна хімія без різких запахів.
3. Обладнання: Професійні машини IPSO та Danube.

Орієнтовні ціни (базові, від):
- Футболка / майка: від 170 ₴, сорочка / блуза: від 240 ₴
- Джинси / брюки: від 250 ₴, сукня: від 450 ₴
- Верхній одяг (вітровка → пуховик довгий): 650–1450 ₴
- Білизна: комплект постелі 550 ₴, ковдра 850–1200 ₴, подушка від 350 ₴
- Взуття: від 650 ₴, аксесуари (рюкзак/сумка): 550–650 ₴
- Аквачистка (преміум): кашемір від 650 ₴, весільна сукня від 3000 ₴
- Прасування без прання: від 90 ₴ (футболка) до 320 ₴ (пальто/куртка)
- Додатково: виведення плями від 80 ₴, чистка катишків 100 ₴
- Ательє: індивідуальний прорахунок після огляду майстром.
Це орієнтир — точна ціна завжди в каталозі додатку, звіряй з ним, а не вигадуй.

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
        response = requests.post(url, json=payload)
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
async def ai_chat(data: AIMessageData):
    try:
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
async def get_cabinet(user_id: int):
    try:
        user_str_id = str(user_id)
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
                total_spent += parse_price_value(row.get("Сума", ""))
                client_orders.append({
                    "id": str(row.get("Номер замовлення", "")),
                    "status": row.get("Статус", "Прийнято"),
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
                    "status": row.get("Статус", "⏳ Очікує огляду"),
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
async def update_cabinet(profile: ClientProfile):
    try:
        user_str_id = str(profile.telegram_id)
        all_clients = sheet_clients.get_all_records()
        
        row_index = None
        for i, row in enumerate(all_clients, start=2):  
            if str(row.get("telegram_id", "")) == user_str_id:
                row_index = i
                break

        if row_index:
            sheet_clients.update_cell(row_index, 2, profile.first_name)
            sheet_clients.update_cell(row_index, 3, profile.phone)
            sheet_clients.update_cell(row_index, 4, profile.apartment)
        else:
            new_row = [profile.telegram_id, profile.first_name, profile.phone, profile.apartment, "", ""]
            sheet_clients.append_row(new_row)
        return {"status": "success"}
    except Exception as e:
        print(f"❌ Ошибка при сохранении профиля: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- 3. POST: Создание заказа (Прачечная / Ателье) ---
@app.post("/api/orders")  # Check your endpoint name (/api/order or /api/orders)
@app.post("/api/order")
@app.post("/api/order/")
async def create_order(order: OrderData):
    try:
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d %H:%M")

        # === РАЗВИЛКА: ЕСЛИ ЭТО АТЕЛЬЕ ===
        if order.service == "atelier":
            order_id = f"ATL-{int(now.timestamp())}"
            item_names = []
            
            # 1. Создаем переменную для подсчета общей суммы
            total_price = 0 
            
            raw_items = order.items
            
            if isinstance(raw_items, str):
                try:
                    raw_items = json.loads(raw_items)
                except:
                    pass

            if isinstance(raw_items, list):
                for item in raw_items:
                    if hasattr(item, "dict"):
                        item = item.dict()
                        
                    if isinstance(item, dict):
                        name = str(item.get("name", "")).strip()
                        quantity = int(item.get("quantity", 1) or 1)
                        
                        # 2. Достаем цену из каждого товара
                        item_price = float(item.get("price", 0))
                        
                        if name:
                            # 3. Считаем сумму: цена * количество
                            total_price += item_price * quantity
                            
                            if quantity > 1:
                                item_names.append(f"• {name} — {quantity} шт.")
                            else:
                                item_names.append(f"• {name}")
                                
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
                "⏳ Очікує огляду",        # 7-я: Статус
                "",                       # 8-я: Комментарий/Колонка
                "",                       # 9-я: Останній повідомлений статус
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
                f"<b>Клієнт:</b> {order.name}\n"
                f"<b>Телефон:</b> {order.phone}\n"
                f"<b>Адреса:</b> {order.address}\n"
                f"<b>Послуги:</b>\n{items_text}\n"
                f"<b>Орієнтовна сума:</b> {formatted_price}\n"
                f"<b>Коментар:</b> {order.comment or 'Немає'}"
            )
            # Отправляем в админский чат
            send_tg_message(ADMIN_CHAT_ID, admin_text)
            
            # ====================================================

            return {
                "status": "success",
                "order_id": order_id
            }
 # === ИНАЧЕ: ЭТО СТАНДАРТНЫЙ ЗАКАЗ (ПРАЧЕЧНАЯ) ===
        else:
            # 1. Красиво форматируем вещи с учетом количества
            items_str = ""
            total_price = float(order.price or 0)
            
            if isinstance(order.items, list):
                item_names = []
                calc_price = 0
                for item in order.items:
                    if isinstance(item, dict):
                        name = item.get("name", "Річ")
                        price = float(item.get("price", 0))
                        qty = int(item.get("quantity", 1))
                        
                        if qty > 1:
                            item_names.append(f"{name} ({qty} шт)")
                        else:
                            item_names.append(name)
                            
                        calc_price += price * qty
                
                items_str = ", ".join(item_names)
                if total_price == 0:
                    total_price = calc_price
            else:
                items_str = str(order.items or "Послуги пральні")

            # 1.5 Знижка Pralnya Club — за сумою, яку клієнт вже витратив раніше
            all_orders_for_loyalty = get_cached_records(sheet_orders, "orders_loyalty", ttl=LOYALTY_CACHE_TTL)
            prev_total_spent = sum(
                parse_price_value(row.get("Сума", ""))
                for row in all_orders_for_loyalty
                if str(row.get("telegram_id", "")) == str(order.telegram_id)
            )
            loyalty_discount = get_loyalty_discount(prev_total_spent)
            price_before_discount = total_price
            if loyalty_discount > 0:
                total_price = round(total_price * (1 - loyalty_discount / 100))

            # 2. Генерируем ID для прачечной
            order_id = f"ORD-{int(now.timestamp())}"
            
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
                "Прийнято",
                "",
                total_price,
                "",
                order_id,
                "",
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
                f"<b>Клієнт:</b> {order.name}\n"
                f"<b>Телефон:</b> {order.phone}\n"
                f"<b>Квартира:</b> {order.address}\n"
                f"<b>Речі:</b> {items_str}\n"
                f"{discount_line}"
                f"<b>Сума:</b> {int(total_price)} ₴\n"
                f"<b>Коментар:</b> {order.comment or 'Немає'}"
            )
            send_tg_message(ADMIN_CHAT_ID, admin_text)
            
            # ====================================================

            return {"status": "success", "order_id": order_id}

    except Exception as e:
        print("❌ Ошибка при создании заказа:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

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
        cache_storage[cache_key]["data"] = sheet.get_all_records()
        cache_storage[cache_key]["expires"] = now + effective_ttl
    return cache_storage[cache_key]["data"]

    
# --- 4. POST: Заявка B2B (Співпраця) ---
@app.post("/api/b2b")
async def create_b2b_request(data: B2BData):
    try:
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d %H:%M")
        
        # Генерируем простой номер заявки (например: B2B-26081540 — дата и время)
        order_number = f"B2B-{now.strftime('%d%m%H%M')}"

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
            getattr(data, 'username', "") or "",# 9. Username (если передается в B2BData)
            "Нова заявка",                      # 10. Статус
            "",                                 # 11. Коментар адміна (пусто)
            ""                                  # 12. Останній повідомлений статус (пусто)
        ]

        # Записываем на наш единый лист (убедитесь, что sheet_b2b указывает на B2B_General)
        sheet_B2B_General.append_row(new_row)
        print(f"✅ B2B заявка №{order_number} від {data.company} успішно збережена!")

        # 1. Повідомлення клієнту в Телеграм
        client_text = (
            f"🤝 <b>Дякуємо за запит на співпрацю!</b>\n"
            f"<b>Номер заявки:</b> #{order_number}\n\n"
            f"<b>Компанія:</b> {data.company}\n"
            f"Наш менеджер зв'яжеться з вами найближчим часом для обговорення індивідуальних умов."
        )
        if data.telegram_id:
            send_tg_message(data.telegram_id, client_text)

        # 2. Повідомлення адміністратору (в адмінський чат)
        admin_text = (
            f"💼 <b>НОВА B2B ЗАЯВКА (Mini App) №{order_number}</b> 💼\n\n"
            f"<b>Компанія:</b> {data.company}\n"
            f"<b>Телефон:</b> {data.phone}\n"
            f"<b>Деталі:</b> {data.details or 'Не вказано'}\n"
            f"<b>Telegram ID:</b> {data.telegram_id or 'Невідомо'}"
        )
        send_tg_message(ADMIN_CHAT_ID, admin_text)

        return {"status": "success", "order_number": order_number}

    except Exception as e:
        print(f"❌ Помилка створення B2B заявки: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def parse_price_value(val) -> float:
    """
    Повертає число з суми в будь-якому форматі, в якому вона записана в таблиці
    (200, '200 грн', '200,00', копійки тощо). Некоректне/порожнє значення -> 0.
    Використовується для підрахунку витрат клієнта (Pralnya Club).
    """
    if not val:
        return 0.0
    clean_str = str(val).replace('\xa0', '').replace(' ', '').strip()
    clean_str = clean_str.replace(',', '.')
    clean_str = clean_str.replace('грн', '').replace('₴', '').strip()
    try:
        num = float(clean_str)
        if num >= 10000 and num % 100 == 0:
            num = num / 100
        return num
    except ValueError:
        return 0.0


def format_price(val):
    if not val:
        return "0 грн"
    
    # 1. Очищаем строку от неразрывных пробелов и меняем запятые на точки
    clean_str = str(val).replace('\xa0', '').replace(' ', '').strip()
    clean_str = clean_str.replace(',', '.')
    clean_str = clean_str.replace('грн', '').replace('₴', '').strip()
    
    try:
        num = float(clean_str)
        
        # 2. Если сумма гигантская и круглая (например, 35000.0), 
        # значит она пришла в копейках. Переводим в гривны:
        if num >= 10000 and num % 100 == 0:
            num = num / 100
            
        # 3. САМОЕ ВАЖНОЕ: Оборачиваем в int(), чтобы отсечь нули после точки.
        # Теперь вместо "350.00" мы отдаем строго "350 грн".
        # JS на фронтенде больше не сможет "склеить" нули!
        return f"{int(num)} грн"
    
    except ValueError:
        # Если пришел совсем странный текст, который нельзя превратить в число
        return str(val) if "грн" in str(val) else f"{val} грн"



import os

if __name__ == "__main__":
    # Ловим порт, который выдает Render, либо ставим 10000 для локальных тестов
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)