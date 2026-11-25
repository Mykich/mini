# catalog — єдине джерело цін

`prices.json` — усі ціни Пральні Вдома: роздріб (поштучно), B2B (за кг), доставка, Pralnya Club, перелік речей «після огляду».

Хто читає:
- **API** (`security.py`) — рахує суму замовлення за `id`, віддає `GET /api/prices`.
- **Mini App** — `frontend/services.js`, згенерований з цього файлу.
- **Бот** і **сайт** — `GET https://mini-mrip.onrender.com/api/prices` (із запасною копією у себе).

Як змінити ціну:
1. Змінити `price` у `prices.json` (id не змінювати і не використовувати повторно).
2. `python tools/build_services.py` — оновить `frontend/services.js`.
3. `python tools/build_services.py --check` — має бути ✅.
4. Скопіювати `prices.json` у репозиторій бота як `Pralnya/prices_fallback.json` (запасна копія на випадок, якщо API спить).
5. PR → merge. Опис зміни — у `Pralnya/docs/PRICING.md`, розділ «Історія змін».
