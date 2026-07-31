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

// 3. Данные пользователя из Telegram
const user = tg?.initDataUnsafe?.user;
if (user) {
    const nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.textContent = user.first_name;
    
    const profileNameEl = document.getElementById("profile-name");
    if (profileNameEl) profileNameEl.textContent = user.first_name;
}

// 4. Навигация по страницам (Routing)
const pages = {
    home: document.getElementById("home-page"),
    order: document.getElementById("order-page"),
    orders: document.getElementById("orders-page"),
    ai: document.getElementById("ai-page"),
    profile: document.getElementById("profile-page"),
    atelier: document.getElementById("atelier-page"),
    b2b: document.getElementById("b2b-page"),
    checkout: document.getElementById("checkout-page")
};

function showPage(pageId) {
    // Прячем все страницы
    Object.values(pages).forEach(section => {
        if (section) section.classList.add("hidden");
    });
    
    // Показываем нужную
    if (pages[pageId]) {
        pages[pageId].classList.remove("hidden");
    }

    // Если перешли в Ателье — рендерим его услуги
    if (pageId === "atelier") {
        renderAtelierServices();
    }

    // Если перешли в Заказы или Кабинет — подтягиваем данные с Python сервера
    if (pageId === "orders" || pageId === "profile") {
        fetchCabinetData();
    }

    // ==========================================
    // ДОБАВЛЯЕМ НАШУ ФУНКЦИЮ СЮДА:
    // Если перешли в Заказы — генерируем карточки
   // if (pageId === "orders") {
     //   loadMyOrders(); 
    //}
    // ==========================================

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
        card.className = `
            bg-white rounded-[24px] p-5 
            shadow-[0_4px_20px_rgba(0,0,0,0.03)] 
            hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] 
            transition-all duration-300 
            border border-gray-50/80 
            flex justify-between items-center
        `;

        // Логика кнопок: если товара нет, показываем "+". Если есть, показываем блок с количеством "+ / -"
        let controlsHTML = '';
        if (quantity === 0) {
            controlsHTML = `
                <button class="add-btn shrink-0 w-12 h-12 rounded-[16px] bg-gray-50 text-blue-600 flex items-center justify-center text-2xl font-light hover:bg-blue-600 hover:text-white transition-colors">
                    +
                </button>
            `;
        } else {
            controlsHTML = `
                <div class="flex items-center gap-3 bg-gray-50 rounded-[16px] p-1 border border-gray-100">
                    <button class="remove-btn w-9 h-9 rounded-[12px] bg-white text-gray-600 shadow-sm flex items-center justify-center text-xl font-medium hover:text-red-500 transition-colors">
                        -
                    </button>
                    <span class="w-4 text-center font-bold text-gray-800">${quantity}</span>
                    <button class="add-btn w-9 h-9 rounded-[12px] bg-blue-600 text-white shadow-sm flex items-center justify-center text-xl font-medium hover:bg-blue-700 transition-colors">
                        +
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="flex-1 pr-4">
                <h3 class="text-[17px] font-bold text-gray-900 leading-tight">
                    ${product.name}
                </h3>
                <p class="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
                    ${product.description}
                </p>
                <div class="text-blue-600 text-[16px] font-bold mt-3">
                    ${product.price} ₴
                </div>
            </div>
            <div class="shrink-0 flex items-center justify-center min-w-[48px]">
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
        card.className = `
            bg-white rounded-[24px] p-5 
            shadow-[0_4px_20px_rgba(0,0,0,0.03)] 
            border border-gray-50/80 
            flex justify-between items-center
        `;

        // Логика кнопок: если товара нет -> "+". Если есть -> "- / кол-во / +"
        let controlsHTML = '';
        if (quantity === 0) {
            controlsHTML = `
                <button class="add-btn shrink-0 w-12 h-12 rounded-[16px] bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-light hover:bg-indigo-600 hover:text-white transition">
                    +
                </button>
            `;
        } else {
            controlsHTML = `
                <div class="flex items-center gap-3 bg-indigo-50 rounded-[16px] p-1 border border-indigo-100">
                    <button class="remove-btn w-9 h-9 rounded-[12px] bg-white text-gray-600 shadow-sm flex items-center justify-center text-xl font-medium hover:text-red-500 transition-colors">
                        -
                    </button>
                    <span class="w-4 text-center font-bold text-gray-800">${quantity}</span>
                    <button class="add-btn w-9 h-9 rounded-[12px] bg-indigo-600 text-white shadow-sm flex items-center justify-center text-xl font-medium hover:bg-indigo-700 transition-colors">
                        +
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="flex-1 pr-4">
                <h3 class="text-[17px] font-bold text-gray-900">${product.name}</h3>
                <p class="text-[13px] text-gray-500 mt-1.5">${product.description}</p>
                <div class="text-indigo-600 text-[16px] font-bold mt-3">${product.price} ₴</div>
            </div>
            <div class="shrink-0 flex items-center justify-center min-w-[48px]">
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
                <div class="text-[15px] font-medium text-gray-900">
                    ${item.name} 
                    <span class="text-blue-600 font-bold ml-1">x${item.count}</span>
                </div>
            </div>
            <div class="text-[15px] font-bold text-gray-900">${itemTotal} ₴</div>
        `;
        container.appendChild(row);
    });

    if (totalPriceEl) totalPriceEl.textContent = `${total} ₴`;

    if (displayAddress && addressInput && displayAddress.textContent !== "ЖК, номер квартири") {
        addressInput.value = displayAddress.textContent;
    }
}

const confirmOrderBtn = document.getElementById("confirm-order-btn");

if (confirmOrderBtn) {
    confirmOrderBtn.addEventListener("click", async () => {
        if (state.cart.length === 0) {
            alert("Ваш кошик порожній!");
            return;
        }

        const address =
            document.getElementById("checkout-address").value.trim();

        if (!address) {
            alert("Будь ласка, введіть квартиру");
            return;
        }

        const comment =
            document.getElementById("checkout-comment")?.value || "";

        // === ОПРЕДЕЛЯЕМ ТИП УСЛУГИ (Ателье или Прачечная) ===
        const isAtelier = state.cart.some(item => item.service === 'atelier');
        const orderService = isAtelier ? 'atelier' : 'laundry';

        try {
            const response = await fetch(`${NGROK_URL}/api/order`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "69420"
                },
                body: JSON.stringify({
                    telegram_id: userId,
                    name: document.getElementById("profile-name")?.textContent || "",
                    phone: state.user?.phone || "",
                    apartment: address,
                    items: state.cart,
                    comment: comment,
                    service: orderService // <--- ВОТ НАША НОВАЯ СТРОЧКА!
                })
            });

            const result = await response.json();
            console.log(result);

            if (tg?.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred("success");
            }

            alert("🎉 Замовлення успішно оформлено!");

            state.cart = [];
            updateCartUI();
            showPage("home");

        } catch (err) {
            console.error(err);
            alert("Помилка відправки замовлення");
        }
    });
}

// ======================================
// B2B Форма сотрудничества
// ======================================
const b2bSubmitBtn = document.getElementById("b2b-submit-btn");
if (b2bSubmitBtn) {
    b2bSubmitBtn.addEventListener("click", () => {
        const company = document.getElementById("b2b-company").value.trim();
        const phone = document.getElementById("b2b-phone").value.trim();
        const details = document.getElementById("b2b-details").value.trim();
        
        if (!company || !phone) {
            alert("Будь ласка, вкажіть назву компанії та контактний телефон.");
            return;
        }
        
        console.log("Нова B2B заявка:", { company, phone, details });
        
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        
        alert(`Дякуємо! Заявка для "${company}" прийнята. Наш менеджер зв'яжеться з вами найближчим часом для обговорення умов.`);
        
        document.getElementById("b2b-company").value = "";
        document.getElementById("b2b-phone").value = "";
        document.getElementById("b2b-details").value = "";
        
        showPage("home");
    });
}

// ======================================
// Связь с сервером Python (ngrok)
// ======================================
const NGROK_URL = "https://shrouded-curfew-quintet.ngrok-free.dev";
const safeTg = window.Telegram ? window.Telegram.WebApp : null;

let userId = 123456789;
if (safeTg && safeTg.initDataUnsafe && safeTg.initDataUnsafe.user) {
    userId = safeTg.initDataUnsafe.user.id;
}

async function fetchCabinetData() {
    try {
        const response = await fetch(`${NGROK_URL}/api/cabinet?user_id=${userId}`, {
            method: 'GET',
            headers: { "ngrok-skip-browser-warning": "69420" }
        });
        
        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);

        const data = await response.json();
        console.log("Данные с сервера получены:", data);

        // 1. Заполняем имя пользователя в кабинете
        if (data.client) {
            const nameEl = document.getElementById("profile-name");
            if (nameEl) nameEl.textContent = data.client.name || "Клієнт";
        }

        // 2. Заполняем список заказов
        const ordersContainer = document.getElementById("orders-list");

        if (ordersContainer) {
            ordersContainer.innerHTML = ""; // Очищаем старые данные

            if (!data.orders || data.orders.length === 0) {
                ordersContainer.innerHTML = `
                    <div class="text-center text-gray-400 py-10">
                        <div class="text-4xl mb-3">📦</div>
                        У вас поки немає активних замовлень
                    </div>`;
                return;
            }

            data.orders.forEach(order => {
                const orderCard = document.createElement("div");
                orderCard.className = "bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-50/80 mb-4";
                
                orderCard.innerHTML = `
                    <div class="flex justify-between items-center mb-4">
                        <span class="font-bold text-lg text-gray-900">Замовлення №${order.id}</span>
                        <span class="text-xs font-bold px-3 py-1.5 rounded-full ${getStatusColor(order.status)}">${order.status}</span>
                    </div>
                    <div class="text-sm text-gray-500 mb-5">
                        <p class="mb-1.5"><b class="text-gray-700">Речі:</b> ${order.items}</p>
                        <p><b class="text-gray-700">Дата:</b> ${order.date}</p>
                    </div>
                    <div class="flex justify-between items-center pt-4 border-t border-gray-100">
                        <span class="text-gray-500 text-sm">До сплати:</span>
                        <strong class="text-blue-600 text-xl">${order.price} ₴</strong>
                    </div>
                `;
                
                ordersContainer.appendChild(orderCard);
            });
        }

    } catch (error) {
        console.error("Ошибка обновления кабинета:", error);
    }
}

// Вспомогательная функция для динамического цвета статусов
function getStatusColor(status) {
    const s = status.toLowerCase();
    if (s.includes("стирк") || s.includes("пранн") || s.includes("робот") || s.includes("в стирке")) {
        return "bg-blue-100 text-blue-600";
    }
    if (s.includes("виконан") || s.includes("готов") || s.includes("видач")) {
        return "bg-green-100 text-green-600";
    }
    return "bg-gray-100 text-gray-600";
}

// Автоматический запуск при старте
fetchCabinetData();
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
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "69420"
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
