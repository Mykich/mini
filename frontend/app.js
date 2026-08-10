// ======================================
// Pralnya Vdoma Mini App
// Version 1.3 - Pages, Logic, Profile & Nav
// ======================================

// 1. Инициализация Telegram
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// 2. Глобальный State (Состояние приложения)
const state = {
    currentPage: "home",
    currentCategory: "clothing", 
    cart: [],
    search: ""
};

// ======================================
// Связь с сервером Python + идентификатор пользователя
// Вынесено в самый верх файла: эти переменные используются почти
// везде ниже, и если объявить их поздно, а где-то раньше по коду
// возникнет любая ошибка на верхнем уровне — все обращения к ним
// начнут падать с 'Cannot access before initialization' (TDZ).
// ======================================
const NGROK_URL = "https://mini-mrip.onrender.com";
const safeTg = window.Telegram ? window.Telegram.WebApp : null;

let userId = 123456789;
if (safeTg && safeTg.initDataUnsafe && safeTg.initDataUnsafe.user) {
    userId = safeTg.initDataUnsafe.user.id;
}

// 3. Данные пользователя из Telegram
const user = tg?.initDataUnsafe?.user;
if (user) {
    const nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.textContent = user.first_name;
    
    // ИСПРАВЛЕНО: ищем правильный ID из HTML
    const profileNameEl = document.getElementById("profile-display-name");
    if (profileNameEl) profileNameEl.textContent = user.first_name;
}

// 4. Навигация по страницам (Routing)
const pages = {
    home: document.getElementById("home-page"),
    order: document.getElementById("order-page"),
    orders: document.getElementById("orders-page"),
    ai: document.getElementById("ai-page"),
    // ИСПРАВЛЕНО: привязываем к cabinet-page вместо profile-page
    profile: document.getElementById("cabinet-page"), 
    atelier: document.getElementById("atelier-page"),
    b2b: document.getElementById("b2b-page"),
    checkout: document.getElementById("checkout-page")
};

function showPage(pageId) {
    // ИСПРАВЛЕНО: Прячем только главные контейнеры страниц, а не все <section> подряд!
    Object.values(pages).forEach(pageEl => {
        if (pageEl) pageEl.classList.add("hidden");
    });

    // Ищем нужную страницу
    const targetPage = pages[pageId] || document.getElementById(pageId);
    
    if (targetPage) {
        targetPage.classList.remove("hidden");
    } else {
        console.warn(`Страница с id "${pageId}" не найдена в HTML!`);
    }

    // Если перешли в Ателье — рендерим его услуги
    if (pageId === "atelier") {
        renderAtelierServices();
    }

    // Запускаем загрузку данных кабинета
    if (pageId === "orders" || pageId === "profile" || pageId === "cabinet") {
        loadCabinetData();
    }

    // Обновляем активную кнопку в нижнем меню
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.page === pageId);
    });

    // Показ кнопки "Назад" в шапке
    const headerBackBtn = document.getElementById('header-back-btn');
    if (headerBackBtn) {
        if (pageId === 'home') {
            headerBackBtn.classList.add('hidden');
        } else {
            headerBackBtn.classList.remove('hidden');
        }
    }

    state.currentPage = pageId;
}

// Обработчики для кнопок навигации и быстрых действий
document.querySelectorAll(".nav-btn, .quick-action").forEach(button => {
    button.addEventListener("click", () => {
        const targetPage = button.dataset.page;
        if (targetPage) {
            showPage(targetPage);
            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
        }
    });
});

// Возврат на главную при клике на "Назад" в хедере
const headerBackBtnMain = document.getElementById('header-back-btn');
if (headerBackBtnMain) {
    headerBackBtnMain.addEventListener('click', () => {
        showPage('home');
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    });
}
// ======================================
// Закрытие/Отмена меню Ателье
// ======================================
const closeAtelierBtn = document.getElementById('closeAtelierBtn');
if (closeAtelierBtn) {
    closeAtelierBtn.addEventListener('click', () => {
        showPage('home'); // Возвращаем на главную, как это настроено в твоем роутинге
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); // Добавил приятную вибрацию, как у тебя в других кнопках
    });
}

// ======================================
// Иконки по категориям (соответствуют спрайту в index.html)
// ======================================
const CATEGORY_ICONS = {
    clothing: "i-shirt",
    outerwear: "i-coat",
    textile: "i-bed",
    shoes: "i-shoe",
    accessories: "i-bag",
    aquaclean: "i-droplet",
    atelier: "i-scissors"
};

// ======================================
// Рендер Каталога Прачечной
// ======================================
function renderProducts(category) {
    const container = document.getElementById("products-list");
    if (!container) return;

    container.innerHTML = "";
    const products = typeof servicesData !== 'undefined' ? (servicesData[category] || []) : [];

    products.forEach(product => {
        // Проверяем, есть ли уже этот товар в корзине и берем его количество
        const cartItem = state.cart.find(item => item.id === product.id);
        const quantity = cartItem ? cartItem.quantity : 0;

        const card = document.createElement("div");
        card.className = "service-card";

        const iconId = CATEGORY_ICONS[category] || "i-basket";

        // Логика кнопок: если товара нет, показываем "+". Если есть, показываем блок с количеством "+ / -"
        let controlsHTML = '';
        if (quantity === 0) {
            controlsHTML = `
                <button class="add-btn qty-add">
                    <svg><use href="#i-plus"/></svg>
                </button>
            `;
        } else {
            controlsHTML = `
                <div class="qty-stepper">
                    <button class="remove-btn">
                        <svg><use href="#i-minus"/></svg>
                    </button>
                    <span class="qty-stepper__count">${quantity}</span>
                    <button class="add-btn qty-add-btn">
                        <svg><use href="#i-plus"/></svg>
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="service-card__info">
                <div class="service-card__icon">
                    <svg><use href="#${iconId}"/></svg>
                </div>
                <div class="service-card__text">
                    <h3 class="service-card__name">${product.name}</h3>
                    <p class="service-card__desc">${product.description}</p>
                    <div class="service-card__price">${product.price} ₴</div>
                </div>
            </div>
            <div class="shrink-0">
                ${controlsHTML}
            </div>
        `;

        // Вешаем обработчик на плюс
        const addBtn = card.querySelector(".add-btn");
        if (addBtn) {
            addBtn.addEventListener("click", () => {
                addToCart(product);
                renderProducts(category); // Обновляем карточку товара, чтобы перерисовалась цифра
            });
        }

        // Вешаем обработчик на минус (если он есть)
        const removeBtn = card.querySelector(".remove-btn");
        if (removeBtn) {
            removeBtn.addEventListener("click", () => {
                removeFromCart(product.id);
                renderProducts(category); // Обновляем карточку товара, чтобы перерисовалась цифра
            });
        }

        container.appendChild(card);
    });
}

// ======================================
// Рендер Услуг Ателье
// ======================================
function renderAtelierServices() {
    const container = document.getElementById("atelier-list");
    if (!container) return;

    container.innerHTML = "";
    const atelierItems = typeof servicesData !== 'undefined' ? (servicesData.atelier || []) : [];

    atelierItems.forEach(product => {
        // Проверяем, есть ли эта услуга в корзине и берем ее количество
        const cartItem = state.cart.find(item => item.id === product.id);
        const quantity = cartItem ? cartItem.quantity : 0;

        const card = document.createElement("div");
        card.className = "service-card is-atelier";

        // Логика кнопок: если товара нет -> "+". Если есть -> "- / кол-во / +"
        let controlsHTML = '';
        if (quantity === 0) {
            controlsHTML = `
                <button class="add-btn qty-add">
                    <svg><use href="#i-plus"/></svg>
                </button>
            `;
        } else {
            controlsHTML = `
                <div class="qty-stepper">
                    <button class="remove-btn">
                        <svg><use href="#i-minus"/></svg>
                    </button>
                    <span class="qty-stepper__count">${quantity}</span>
                    <button class="add-btn qty-add-btn">
                        <svg><use href="#i-plus"/></svg>
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="service-card__info">
                <div class="service-card__icon">
                    <svg><use href="#i-scissors"/></svg>
                </div>
                <div class="service-card__text">
                    <h3 class="service-card__name">${product.name}</h3>
                    <p class="service-card__desc">${product.description}</p>
                    <div class="service-card__price">${product.price} ₴</div>
                </div>
            </div>
            <div class="shrink-0">
                ${controlsHTML}
            </div>
        `;

        // Обработчик на кнопку "+"
        const addBtn = card.querySelector(".add-btn");
        if (addBtn) {
            addBtn.addEventListener("click", () => {
                addToCart(product, 'atelier');
                renderAtelierServices(); // Перерисовываем, чтобы появился минус и цифра
            });
        }

        // Обработчик на кнопку "-"
        const removeBtn = card.querySelector(".remove-btn");
        if (removeBtn) {
            removeBtn.addEventListener("click", () => {
                removeFromCart(product.id);
                renderAtelierServices(); // Перерисовываем, чтобы цифра уменьшилась
            });
        }

        container.appendChild(card);
    });
}

// ======================================
// Логика Категорий (в Прачечной)
// ======================================
const categoryBtns = document.querySelectorAll(".category-btn");
categoryBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        categoryBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        const category = btn.dataset.category;
        state.currentCategory = category;
        renderProducts(category);
    });
});

// ======================================
// ======================================
// Корзина (Добавление, Убавление и Отрисовка)
// ======================================
function addToCart(product, serviceType = 'laundry') {
    const existingItem = state.cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += 1; 
    } else {
        // Добавлена метка service для правильной маршрутизации на бэкенде
        state.cart.push({ ...product, quantity: 1, service: serviceType }); 
    }
    
    updateCartUI();
    
    if (typeof tg !== 'undefined' && tg.HapticFeedback) {
        try { tg.HapticFeedback.impactOccurred("light"); } catch(e) {}
    }
}

function removeFromCart(productId) {
    const itemIndex = state.cart.findIndex(item => item.id === productId);
    
    if (itemIndex !== -1) {
        if (state.cart[itemIndex].quantity > 1) {
            state.cart[itemIndex].quantity -= 1; 
        } else {
            state.cart.splice(itemIndex, 1); 
        }
    }
    
    updateCartUI();

    if (typeof tg !== 'undefined' && tg.HapticFeedback) {
        try { tg.HapticFeedback.impactOccurred("light"); } catch(e) {}
    }
}

function updateCartUI() {
    // Считаем сумму с учетом количества (цена * количество)
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Считаем общее количество вещей
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);

    document.querySelectorAll("#cart-count").forEach(el => {
        el.textContent = `${count} товарів`;
    });
    
    document.querySelectorAll("#cart-price, #cart-total").forEach(el => {
        el.textContent = `${total} ₴`;
    });

    const floatingCart = document.getElementById("floating-cart");
    if (floatingCart) {
        if (count > 0) {
            floatingCart.classList.remove("hidden");
        } else {
            floatingCart.classList.add("hidden");
        }
    }
}
// ======================================
// Модальные окна (Bottom Sheets) в Кабинете
// ======================================
const overlay = document.getElementById("modal-overlay");
const modalAddress = document.getElementById("modal-address");
const modalPayment = document.getElementById("modal-payment");

function openModal(modal) {
    if (!overlay || !modal) return;
    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
    
    setTimeout(() => {
        overlay.classList.remove("opacity-0");
        modal.classList.remove("translate-y-full");
    }, 10);

    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function closeModal() {
    if (modalAddress) modalAddress.classList.add("translate-y-full");
    if (modalPayment) modalPayment.classList.add("translate-y-full");
    if (overlay) overlay.classList.add("opacity-0");
    
    setTimeout(() => {
        if (overlay) overlay.classList.add("hidden");
        if (modalAddress) modalAddress.classList.add("hidden");
        if (modalPayment) modalPayment.classList.add("hidden");
    }, 300);
}

if (overlay) overlay.addEventListener("click", closeModal);

const btnAddress = document.getElementById("btn-address");
const btnPayment = document.getElementById("btn-payment");
const btnSupport = document.getElementById("btn-support");

if (btnAddress) btnAddress.addEventListener("click", () => openModal(modalAddress));
if (btnPayment) btnPayment.addEventListener("click", () => openModal(modalPayment));

// ======================================
// Сохранение адреса (LocalStorage)
// ======================================
const btnSaveAddress = document.getElementById("save-address-btn");
const inputAddress = document.getElementById("address-input");
const displayAddress = document.getElementById("display-address");

const savedAddress = localStorage.getItem('userAddress');
if (savedAddress && displayAddress) {
    displayAddress.textContent = savedAddress;
    if (inputAddress) inputAddress.value = savedAddress;
}

if (btnSaveAddress) {
    btnSaveAddress.addEventListener("click", () => {
        const newAddress = inputAddress.value.trim();
        if (newAddress !== "") {
            // 1. Сохраняем локально для отображения
            localStorage.setItem('userAddress', newAddress);
            displayAddress.textContent = newAddress;
            
            // 2. Отправляем на наш Python-сервер!
            saveProfileData();
            
            // 3. Вибрация и закрытие шторки
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            closeModal();
        }
    });
}

// Кнопка Поддержки
if (btnSupport) {
    btnSupport.addEventListener("click", () => {
        if (tg && tg.openTelegramLink) {
            tg.openTelegramLink("https://t.me/pralnya_support"); 
        } else {
            alert("Відкриваємо чат зі службою підтримки...");
        }
    });
}

// ======================================
// Оформление заказа (Checkout)
// ======================================
const floatingCartBtn = document.querySelector("#floating-cart button");
if (floatingCartBtn) {
    floatingCartBtn.addEventListener("click", () => {
        showPage("checkout");
        renderCheckout();
    });
}

const checkoutBackBtn = document.getElementById("checkout-back-btn");
if (checkoutBackBtn) {
    checkoutBackBtn.addEventListener("click", () => {
        showPage("order");
    });
}

function renderCheckout() {
    const container = document.getElementById("checkout-items");
    const totalPriceEl = document.getElementById("checkout-total-price");
    const addressInput = document.getElementById("checkout-address");

    if (!container) return;
    container.innerHTML = "";

    if (state.cart.length === 0) {
        container.innerHTML = "<div class='text-gray-500 py-3 text-center'>Кошик порожній</div>";
        if (totalPriceEl) totalPriceEl.textContent = "0 ₴";
        return;
    }

    const cartCounts = {};
    state.cart.forEach(item => {
        if (!cartCounts[item.id]) {
            cartCounts[item.id] = { ...item, count: 1 };
        } else {
            cartCounts[item.id].count++;
        }
    });

    let total = 0;
    Object.values(cartCounts).forEach(item => {
        const itemTotal = item.price * item.count;
        total += itemTotal;

        const row = document.createElement("div");
        row.className = "flex justify-between items-center py-3";
        row.innerHTML = `
            <div class="flex-1">
                <div class="text-[15px] font-medium" style="color:var(--ink)">
                    ${item.name} 
                    <span class="font-bold ml-1" style="color:var(--indigo)">x${item.count}</span>
                </div>
            </div>
            <div class="text-[15px] font-bold" style="color:var(--ink)">${itemTotal} ₴</div>
        `;
        container.appendChild(row);
    });

    if (totalPriceEl) totalPriceEl.textContent = `${total} ₴`;

    if (displayAddress && addressInput && displayAddress.textContent !== "ЖК, номер квартири") {
        addressInput.value = displayAddress.textContent;
    }
}

// ======================================
// Оформление заказа (Checkout) и отправка на сервер
// ======================================
const confirmOrderBtn = document.getElementById("confirm-order-btn");

if (confirmOrderBtn) {
    confirmOrderBtn.addEventListener("click", async () => {
        if (state.cart.length === 0) {
            Telegram.WebApp.showAlert("Ваш кошик порожній!");
            return;
        }

        const address = document.getElementById("checkout-address")?.value.trim() || "";
        if (!address) {
            Telegram.WebApp.showAlert("Будь ласка, введіть квартиру");
            return;
        }

        const comment = document.getElementById("checkout-comment")?.value || "";

        // === 1. Собираем имя (если в HTML висит заглушка "Клієнт", берем из Telegram) ===
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        let rawName = document.getElementById("profile-display-name")?.textContent?.trim();
        
        let clientName = rawName;
        if (!rawName || rawName === "Клієнт") {
            const firstName = tgUser?.first_name || "";
            const lastName = tgUser?.last_name || "";
            clientName = `${firstName} ${lastName}`.trim() || "Клієнт";
        }

        // === 2. Собираем телефон (с учетом пустой маски) ===
        let clientPhone = document.getElementById("profile-display-phone")?.textContent?.trim() || "";
        
        // Если это заглушка или пустая маска, пробуем взять из поля редактирования
        if (!clientPhone || clientPhone === "Телефон не вказано" || clientPhone.includes("--")) {
            clientPhone = document.getElementById("edit-phone")?.value?.trim() || "";
        }
        
        // Если и там пустая маска, то превращаем в абсолютную пустоту
        if (clientPhone.includes("--")) {
            clientPhone = ""; 
        }

        // === 3. Определяем тип услуги (Ателье или Прачечная) ===
        const isAtelier = state.cart.some(item => item.service === 'atelier');
        const orderService = isAtelier ? 'atelier' : 'laundry';

        // Блокируем кнопку на время отправки
        const originalText = confirmOrderBtn.innerText;
        confirmOrderBtn.innerText = "Відправка...";
        confirmOrderBtn.disabled = true;

        try {
            const response = await fetch(`${NGROK_URL}/api/order`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "69420"
                },
                body: JSON.stringify({
                    telegram_id: userId,
                    name: clientName,
                    phone: clientPhone,
                    apartment: address,
                    address: address, // Передаем дубль на случай разницы в api.py
                    items: state.cart,
                    comment: comment,
                    price: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                    service: orderService 
                })
            });

            const result = await response.json();

            if (response.ok) {
                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
                
                Telegram.WebApp.showAlert(`Успіх! Замовлення оформлено.`, function() {
                    state.cart = []; // Очищаем корзину
                    updateCartUI();  // Обновляем счетчики
                    showPage("home"); // Возвращаем на главный экран
                });
            } else {
                Telegram.WebApp.showAlert("Помилка при створенні замовлення.");
            }

        } catch (err) {
            console.error("Помилка:", err);
            Telegram.WebApp.showAlert("Немає зв'язку з сервером. Перевірте інтернет.");
        } finally {
            confirmOrderBtn.innerText = originalText;
            confirmOrderBtn.disabled = false;
        }
    });
}

// ======================================
// B2B Форма сотрудничества (Отправка на сервер)
// ======================================
const b2bSubmitBtn = document.getElementById("b2b-submit-btn");
if (b2bSubmitBtn) {
    b2bSubmitBtn.addEventListener("click", async () => {
        const companyEl = document.getElementById("b2b-company");
        const phoneEl = document.getElementById("b2b-phone");
        const detailsEl = document.getElementById("b2b-details");

        const company = companyEl?.value.trim();
        const phone = phoneEl?.value.trim();
        const details = detailsEl?.value.trim() || "";

        if (!company || !phone) {
            Telegram.WebApp.showAlert("Будь ласка, вкажіть назву компанії та контактний телефон.");
            return;
        }

        // Блокируем кнопку на время отправки
        const originalText = b2bSubmitBtn.innerText;
        b2bSubmitBtn.innerText = "Відправка...";
        b2bSubmitBtn.disabled = true;

        try {
            const response = await fetch(`${NGROK_URL}/api/b2b`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "69420"
                },
                body: JSON.stringify({
                    company: company,
                    phone: phone,
                    details: details,
                    telegram_id: userId,
                    name: document.getElementById("profile-name")?.textContent || ""
                })
            });

            if (response.ok) {
                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

                Telegram.WebApp.showAlert(`Дякуємо! Заявку для "${company}" прийнято. Наш менеджер зв'яжеться з вами найближчим часом.`, function() {
                    // Очищаем поля формы и переводим на главный экран
                    if (companyEl) companyEl.value = "";
                    if (phoneEl) phoneEl.value = "";
                    if (detailsEl) detailsEl.value = "";
                    showPage("home");
                });
            } else {
                Telegram.WebApp.showAlert("Помилка при відправці заявки. Спробуйте ще раз.");
            }
        } catch (error) {
            console.error("Помилка B2B:", error);
            Telegram.WebApp.showAlert("Немає зв'язку з сервером. Перевірте інтернет.");
        } finally {
            b2bSubmitBtn.innerText = originalText;
            b2bSubmitBtn.disabled = false;
        }
    });
}

// ======================================
// (Старое место объявления NGROK_URL/safeTg/userId перенесено наверх файла.
//  fetchCabinetData()/getStatusColor() удалены как мёртвый код: они писали
//  в #orders-list, на который нет ни одной кнопки в разметке — реальные
//  данные кабинета грузит loadCabinetData() ниже.)
// ======================================
// Сохранение данных профиля (POST на сервер)
// ======================================
async function saveProfileData() {
    // Если у тебя пока нет поля для телефона в шторке, оставим его пустым
    const phoneInput = document.getElementById("profile-phone"); 
    
    // БЕРЕМ ДАННЫЕ ИЗ ТВОЕЙ ШТОРКИ
    const apartmentInput = document.getElementById("address-input"); 
    
    const currentUserId = safeTg && safeTg.initDataUnsafe && safeTg.initDataUnsafe.user ? safeTg.initDataUnsafe.user.id : 123456789;
    const currentFirstName = safeTg && safeTg.initDataUnsafe && safeTg.initDataUnsafe.user ? safeTg.initDataUnsafe.user.first_name : "Ігор";

    const payload = {
        telegram_id: currentUserId,
        first_name: currentFirstName,
        phone: phoneInput ? phoneInput.value : "",
        apartment: apartmentInput ? apartmentInput.value : ""
    };

    try {
        const response = await fetch(`${NGROK_URL}/api/cabinet`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
});
    
        const result = await response.json();
        console.log("Ответ от сервера при сохранении:", result);
        
        // Уведомление убрано отсюда, так как оно уже есть в логике закрытия шторки

    } catch (error) {
        console.error("Ошибка при сохранении:", error);
    }
}
// ======================================
// AI Чат Консультант
// ======================================
const aiInput = document.getElementById("ai-input");
const aiSendBtn = document.getElementById("ai-send-btn");
const aiMessages = document.getElementById("ai-messages");

async function sendAiMessage(textToSend = null) {
    const text = textToSend || aiInput?.value.trim();
    if (!text) return;

    if (aiInput) aiInput.value = "";

    // 1. Рендерим сообщение пользователя
    appendMessage(text, 'user');

    // 2. Рендерим индикатор загрузки ("ИИ печатает...")
    const loadingId = appendLoadingBubble();

    try {
        const response = await fetch(`${NGROK_URL}/api/ai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            },
            body: JSON.stringify({
                message: text,
                telegram_id: userId
            })
        });

        const data = await response.json();
        
        // Удаляем индикатор загрузки
        removeMessage(loadingId);

        if (response.ok && data.reply) {
            appendMessage(data.reply, 'ai');
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } else {
            appendMessage("Вибачте, сталася помилка. Спробуйте ще раз пізніше.", 'ai');
        }

    } catch (error) {
        console.error("Ошибка AI:", error);
        removeMessage(loadingId);
        appendMessage("Немає зв'язку з сервером AI.", 'ai');
    }
}

// Вспомогательная функция отрисовки пупырок
function appendMessage(text, sender) {
    if (!aiMessages) return;

    const bubble = document.createElement("div");
    const isUser = sender === 'user';
    
    bubble.className = isUser 
        ? "chat-bubble-user p-3.5 text-sm max-w-[85%] self-end leading-relaxed animate-fade-in"
        : "chat-bubble-bot p-3.5 text-sm max-w-[85%] self-start leading-relaxed animate-fade-in";

    // Превращаем переносы строк \n в html теги <br>
    bubble.innerHTML = text.replace(/\n/g, '<br>');
    aiMessages.appendChild(bubble);
    
    // Скроллим вниз
    aiMessages.scrollTop = aiMessages.scrollHeight;
}

// Индикатор "Печатает..."
function appendLoadingBubble() {
    const id = "loading-" + Date.now();
    const bubble = document.createElement("div");
    bubble.id = id;
    bubble.className = "chat-bubble-bot p-3.5 text-sm max-w-[40%] self-start flex items-center gap-1.5";
    bubble.style.color = "var(--ink-faint)";
    bubble.innerHTML = `<span>Консультант думає</span><span class="animate-bounce">...</span>`;
    aiMessages.appendChild(bubble);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// События клика и нажатия Enter
if (aiSendBtn) aiSendBtn.addEventListener("click", () => sendAiMessage());
if (aiInput) {
    aiInput.addEventListener("keypress", (e) => {
        if (e.key === 'Enter') sendAiMessage();
    });
}

// Обработка клика по быстрым чипсам-вопросам
document.querySelectorAll(".ai-chip").forEach(btn => {
    btn.addEventListener("click", () => {
        const text = btn.innerText.replace(/^[^\s]+\s/, ''); // удаляем эмодзи с начала
        sendAiMessage(text);
    });
});
// ======================================
// ЛИЧНЫЙ КАБИНЕТ (Логика и рендеринг)
// ======================================

// 1. Загрузка и отрисовка данных кабинета
async function loadCabinetData() {
    const container = document.getElementById("orders-list-container");
    if (!container) return;

    try {
        const response = await fetch(`${NGROK_URL}/api/cabinet?user_id=${userId}`, {
            method: 'GET'
        });

        if (!response.ok) throw new Error("Помилка завантаження кабинета");

        const data = await response.json();
        const client = data.client || {};
        const orders = data.orders || [];

        // --- Отрисовка данных профиля ---
        const name = client.name || tg?.initDataUnsafe?.user?.first_name || "Клієнт";
        const phone = client.phone || "Телефон не вказано";
        const apt = client.apartment ? `кв. ${client.apartment}` : "Квартира не вказана";

        document.getElementById("profile-display-name").textContent = name;
        document.getElementById("profile-display-phone").textContent = phone;
        document.getElementById("profile-display-apt").textContent = apt;
        document.getElementById("user-avatar-initials").textContent = name.charAt(0).toUpperCase();

        // Поля ввода в форме редактирования
        document.getElementById("edit-name").value = client.name || "";
        document.getElementById("edit-phone").value = client.phone || "";
        document.getElementById("edit-apt").value = client.apartment || "";
        const checkoutAddressInput = document.getElementById("checkout-address");
        if (checkoutAddressInput && client.apartment) {
            checkoutAddressInput.value = client.apartment;
        }
        // Скидка
        if (client.discount > 0) {
            document.getElementById("profile-discount-badge").textContent = `Знижка ${client.discount}%`;
        }

        // --- Отрисовка заказов ---
        renderOrdersList(orders);

    } catch (error) {
        console.error("Ошибка кабинета:", error);
        container.innerHTML = `
            <div class="bg-white rounded-[20px] p-6 text-center text-red-500 text-sm border border-gray-100">
                Не вдалося завантажити дані. Перевірте інтернет.
            </div>
        `;
    }
}

// 2. Генерация списка карточек заказов
function renderOrdersList(orders) {
    const container = document.getElementById("orders-list-container");
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="card p-8 text-center">
                <div class="icon-badge mx-auto mb-3" style="width:48px;height:48px;">
                    <svg style="width:22px;height:22px;"><use href="#i-basket"/></svg>
                </div>
                <h4 style="font-weight:800; font-size:13.5px; color:var(--ink); margin-bottom:4px;">У вас поки немає замовлень</h4>
                <p style="font-size:12px; color:var(--ink-faint); margin-bottom:16px;">Оформіть ваше перше замовлення пральні або ательє!</p>
                <button onclick="showPage('home')" class="badge badge-indigo" style="padding:9px 16px;">
                    До каталогу
                </button>
            </div>
        `;
        return;
    }

    // Собираем карточки заказов
    container.innerHTML = orders.map(order => {
        const isAtelier = order.type === 'atelier';
        const iconId = isAtelier ? 'i-scissors' : 'i-droplet';
        
        // Определяем класс бейджа статуса
        let statusClass = "badge-neutral";
        const statusText = order.status || "Прийнято";

        if (statusText.includes("Готово") || statusText.includes("Видано")) {
            statusClass = "badge-good";
        } else if (statusText.includes("пранн") || statusText.includes("робот")) {
            statusClass = "badge-indigo";
        } else if (statusText.includes("огляд") || statusText.includes("Узгодження")) {
            statusClass = "badge-gold";
        }

        return `
            <div class="order-card space-y-3">
                <!-- Шапка карточки -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <span class="icon-badge" style="width:32px;height:32px;">
                            <svg style="width:15px;height:15px;"><use href="#${iconId}"/></svg>
                        </span>
                        <div>
                            <span style="font-size:12px; font-weight:800; color:var(--ink);">№ ${order.id}</span>
                            <span style="font-size:10px; color:var(--ink-faint); display:block;">${order.date || ''}</span>
                        </div>
                    </div>
                    <span class="badge ${statusClass}">
                        ${statusText}
                    </span>
                </div>

                <!-- Содержимое (вещи/услуги) -->
                <div style="background:var(--paper); border-radius:12px; padding:10px; font-size:12px; color:var(--ink-soft); line-height:1.5;">
                    ${order.items || 'Послуги'}
                </div>

                <!-- Сумма -->
                <div class="flex justify-between items-center pt-1" style="font-size:12px;">
                    <span style="color:var(--ink-faint);">Сума:</span>
                    <span style="font-weight:800; color:var(--ink); font-size:13.5px;">${order.price}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 3. Открытие/закрытие формы редактирования
const toggleEditBtn = document.getElementById("toggle-edit-profile-btn");
const editForm = document.getElementById("edit-profile-form");

if (toggleEditBtn && editForm) {
    toggleEditBtn.addEventListener("click", () => {
        editForm.classList.toggle("hidden");
    });
}

// 4. Сохранение профиля
const saveProfileBtn = document.getElementById("save-profile-btn");
if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
        const name = document.getElementById("edit-name").value.trim();
        const phone = document.getElementById("edit-phone").value.trim();
        const apt = document.getElementById("edit-apt").value.trim();

        if (!name || !phone) {
            Telegram.WebApp.showAlert("Будь ласка, вкажіть ім'я та телефон.");
            return;
        }

        saveProfileBtn.innerText = "Збереження...";
        saveProfileBtn.disabled = true;

        try {
            const response = await fetch(`${NGROK_URL}/api/cabinet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420'
                },
                body: JSON.stringify({
                    telegram_id: userId,
                    first_name: name,
                    phone: phone,
                    apartment: apt
                })
            });

            if (response.ok) {
                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                Telegram.WebApp.showAlert("Профіль успішно оновлено!");
                editForm.classList.add("hidden");
                loadCabinetData(); // Перерисовываем
            } else {
                Telegram.WebApp.showAlert("Помилка збереження.");
            }
        } catch (e) {
            console.error("Помилка сохранения профиля:", e);
        } finally {
            saveProfileBtn.innerText = "Зберегти зміни";
            saveProfileBtn.disabled = false;
        }
    });
}

// 5. Кнопка ручного обновления списка
const refreshBtn = document.getElementById("refresh-orders-btn");
if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        loadCabinetData();
    });
}

window.openAIPage = function() {
    // 1. Скрываем все возможные страницы (main и section), которые есть в твоем index_2.html
    const allPages = [
        'home-page', 
        'order-page', 
        'orders-page', 
        'atelier-page', 
        'b2b-page', 
        'checkout-page', 
        'cabinet-page'
    ];
    
    allPages.forEach(pageId => {
        const pageElement = document.getElementById(pageId);
        if (pageElement) {
            pageElement.classList.add('hidden');
        }
    });
    
    // 2. Принудительно показываем секцию AI
    const aiPage = document.getElementById('ai-page');
    if (aiPage) {
        aiPage.classList.remove('hidden');
    }
    
    // 3. Снимаем активный класс с кнопок нижнего меню (чтобы было видно, что мы не на главной)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
};