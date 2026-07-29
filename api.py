import uvicorn
import datetime
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
import gspread
from oauth2client.service_account import ServiceAccountCredentials

app = FastAPI()

# --- Настройка CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Подключение к Google Таблицам ---
SCOPE = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]

CREDS = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", SCOPE) 
GS_CLIENT = gspread.authorize(CREDS)

SPREADSHEET_NAME = "Pralnya" 
spreadsheet = GS_CLIENT.open(SPREADSHEET_NAME)

# Подключаем листы
sheet_clients = spreadsheet.worksheet("Clients")
sheet_orders = spreadsheet.worksheet("Лист1")

# --- Модели данных ---
class ClientProfile(BaseModel):
    telegram_id: Any
    first_name: Optional[str] = ""
    phone: Optional[str] = ""
    apartment: Optional[str] = ""

class OrderData(BaseModel):
    user_id: Optional[Any] = None
    telegram_id: Optional[Any] = None
    phone: Optional[str] = ""
    name: Optional[str] = ""
    address: Optional[str] = ""
    items: Optional[Any] = ""
    service: Optional[str] = ""
    price: Optional[Any] = 0
    date: Optional[str] = ""
    comment: Optional[str] = ""

# --- 1. GET: Загрузка кабинета ---
@app.get("/api/cabinet")
async def get_cabinet(user_id: int):
    try:
        user_str_id = str(user_id)
        client_data = {"name": "", "phone": "", "apartment": "", "discount": 0}
        
        all_clients = sheet_clients.get_all_records()
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
        all_orders = sheet_orders.get_all_records()
        for row in all_orders:
        
            order_tg_id = str(row.get("telegram_id", "")) 
            order_phone = str(row.get("Телефон", ""))
            
            if order_tg_id == user_str_id or (client_data["phone"] and order_phone == client_data["phone"]):
                client_orders.append({
                    "id": str(row.get("Номер замовлення", "")),
                    "status": row.get("Статус", "Прийнято"),
                    "items": str(row.get("Речі", "")),
                    "date": str(row.get("Дата", "")),
                    "price": format_price(row.get("Сума", ""))
                })
        
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

# --- 3. POST: Создание нового заказа ---
@app.post("/api/order")
async def create_order(order: OrderData):
    try:
        # 1. Красиво форматируем вещи с учетом количества (quantity) и считаем сумму
        items_str = ""
        total_price = float(order.price or 0)
        
        if isinstance(order.items, list):
            item_names = []
            calc_price = 0
            for item in order.items:
                if isinstance(item, dict):
                    name = item.get("name", "Річ")
                    price = float(item.get("price", 0))
                    qty = int(item.get("quantity", 1)) # Достаем количество (по умолчанию 1)
                    
                    # Если количество больше 1, пишем "Футболка (3 шт)"
                    if qty > 1:
                        item_names.append(f"{name} ({qty} шт)")
                    else:
                        item_names.append(name)
                        
                    calc_price += price * qty # Умножаем цену товара на его количество
            
            items_str = ", ".join(item_names) # Склеиваем всё: "Футболка (3 шт), Майка"
            if total_price == 0:
                total_price = calc_price
        else:
            items_str = str(order.items or "Послуги пральні")

        # 2. Генерируем даты и ID
        now = datetime.datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M")
        order_id = f"ORD-{int(now.timestamp())}"
        
        # 3. Собираем массив строк СТРОГО в твоем порядке!
        new_row = [
            date_str,         # 1. Дата
            order.name,       # 2. Ім'я
            order.phone,      # 3. Телефон
            order.address,    # 4. Квартира
            items_str,        # 5. Речі ("Футболка, Майка")
            order.comment,         # 6. Час
            "",               # 7. Скасування (пусто)
            "",               # 8. Підписка (пусто)
            "Прийнято",       # 9. Статус
            "",               # 10. Повідомлено (пусто)
            total_price,      # 11. Сума
            "",               # 12. Фото (пусто)
            order_id,         # 13. Номер замовлення
            "",               # 14. Останній повідомлений статус (пусто)
            "",                # 15. Розпізнано (пусто)
            str(order.telegram_id)
        ]
        
        sheet_orders.append_row(new_row)
        print(f"✅ Заказ {order_id} ({items_str}) успішно записано!")
        
        return {"status": "success", "order_id": order_id}

    except Exception as e:
        print("❌ Ошибка при создании заказа:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    
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

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)