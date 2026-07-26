// ======================================
// Pralnya Vdoma Mini App
// Version 1.2 - Pages & Logic
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

// 3. Данные пользователя
const user = tg?.initDataUnsafe?.user;
if (user) {
    // Подставляем имя на главной странице
    const nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.textContent = user.first_name;
    
    // Подставляем имя в профиле (в Кабинете)
    const profileNameEl = document.getElementById("profile-name");
    if (profileNameEl) profileNameEl.textContent = user.first_name;
}

// 4. Навигация по страницам (Routing)
// Здесь мы объявляем pages только один раз!
const pages = {
    home: document.getElementById("home-page"),
    order: document.getElementById("order-page"),
    orders: document.getElementById("orders-page"),
    ai: document.getElementById("ai-page"),
    profile: document.getElementById("profile-page"),
    atelier: document.getElementById("atelier-page"),
    b2b: document.getElementById("b2b-page"),
    checkout: document.getElementById("checkout-page") // Додали цю строчку
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

    // Если перешли в Заказы — рендерим историю заказов
    if (pageId === "orders") {
        renderOrders();
    }

    // Обновляем активную кнопку в нижнем меню
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.page === pageId);
    });

    state.currentPage = pageId;
}

// Обработчики для кнопок навигации и быстрых действий
document.querySelectorAll(".nav-btn, .quick-action").forEach(button => {
    button.addEventListener("click", () => {
        const targetPage = button.dataset.page;
        if (targetPage) showPage(targetPage);
    });
});

// ======================================
// Рендер Каталога Прачечной
// ======================================

function renderProducts(category) {
    const container = document.getElementById("products-list");
    if (!container) return;

    container.innerHTML = "";
    const products = servicesData[category] || [];

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = `
            bg-white rounded-[24px] p-5 
            shadow-[0_4px_20px_rgba(0,0,0,0.03)] 
            hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] 
            transition-all duration-300 
            border border-gray-50/80 
            flex justify-between items-center
        `;

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
            
            <button 
                class="add-to-cart-btn shrink-0 w-12 h-12 rounded-[16px] bg-gray-50 text-blue-600 flex items-center justify-center text-2xl font-light hover:bg-blue-600 hover:text-white transition-colors"
                data-id="${product.id}">
                +
            </button>
        `;

        const addBtn = card.querySelector(".add-to-cart-btn");
        addBtn.addEventListener("click", () => addToCart(product));

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
    const atelierItems = servicesData.atelier || [];

    atelierItems.forEach(product => {
        const card = document.createElement("div");
        card.className = `
            bg-white rounded-[24px] p-5 
            shadow-[0_4px_20px_rgba(0,0,0,0.03)] 
            border border-gray-50/80 
            flex justify-between items-center
        `;

        card.innerHTML = `
            <div class="flex-1 pr-4">
                <h3 class="text-[17px] font-bold text-gray-900">${product.name}</h3>
                <p class="text-[13px] text-gray-500 mt-1.5">${product.description}</p>
                <div class="text-blue-600 text-[16px] font-bold mt-3">${product.price} ₴</div>
            </div>
            <button class="add-to-cart-btn shrink-0 w-12 h-12 rounded-[16px] bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-light hover:bg-indigo-600 hover:text-white transition">
                +
            </button>
        `;

        card.querySelector("button").addEventListener("click", () => addToCart(product));
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
// Корзина
// ======================================

function addToCart(product) {
    state.cart.push(product);
    updateCartUI();
    
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred("light");
    }
}

function updateCartUI() {
    const total = state.cart.reduce((sum, item) => sum + item.price, 0);
    const count = state.cart.length;

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
// Форма B2B
// ======================================
const b2bForm = document.getElementById("b2b-form");
if (b2bForm) {
    b2bForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const company = document.getElementById("b2b-company").value;
        const phone = document.getElementById("b2b-phone").value;
        
        alert(`Дякуємо! Заявку від "${company}" прийнято. Ми зателефонуємо на номер ${phone}.`);
        
        b2bForm.reset();
        showPage("home");
    });
}
// ======================================
// Рендер Сторінки Замовлень
// ======================================

// Тестова база замовлень (Mock Data)
const mockOrders = [
    {
        id: "ORD-8432",
        date: "26 Липня 2026",
        status: "active", // active (активний) або completed (виконаний)
        statusText: "🚚 В дорозі до пральні",
        items: ["Пуховик довгий (1 шт.)", "Светр (1 шт.)"],
        total: 1770
    },
    {
        id: "ORD-8105",
        date: "20 Липня 2026",
        status: "completed",
        statusText: "✅ Виконано",
        items: ["Сорочка (3 шт.)", "Джинси (1 шт.)"],
        total: 1030
    }
];

function renderOrders() {
    const container = document.getElementById("orders-list");
    if (!container) return;

    container.innerHTML = ""; // Очищаємо перед рендером

    // Якщо замовлень немає
    if (mockOrders.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-center">
                <div class="text-6xl mb-4 opacity-50">📭</div>
                <h3 class="text-lg font-bold text-gray-800">У вас поки немає замовлень</h3>
                <p class="text-sm text-gray-500 mt-2">Зробіть своє перше замовлення вже сьогодні</p>
            </div>
        `;
        return;
    }

    // Відмальовуємо кожне замовлення
    mockOrders.forEach(order => {
        // Кольори для статусів: синій для активних, зелений для готових
        const statusColor = order.status === "active" 
            ? "text-blue-600 bg-blue-50" 
            : "text-green-600 bg-green-50";
        
        const card = document.createElement("div");
        card.className = `
            bg-white rounded-[24px] p-5 
            shadow-[0_4px_20px_rgba(0,0,0,0.03)] 
            border border-gray-50/80
        `;

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <div class="font-bold text-gray-900 text-lg">№ ${order.id}</div>
                    <div class="text-xs text-gray-500 mt-1">${order.date}</div>
                </div>
                <div class="px-3 py-1.5 rounded-[12px] text-xs font-bold ${statusColor}">
                    ${order.statusText}
                </div>
            </div>
            
            <div class="border-t border-gray-100 pt-4 mt-2">
                <div class="text-[14px] text-gray-600 mb-4 leading-relaxed">
                    ${order.items.join("<br>")}
                </div>
                
                <div class="flex justify-between items-center bg-gray-50 p-3 rounded-[16px]">
                    <span class="text-sm font-semibold text-gray-500">Сума:</span>
                    <span class="text-[18px] font-bold text-gray-900">${order.total} ₴</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}
// ======================================
// Модальні вікна (Bottom Sheets) в Кабінеті
// ======================================

const overlay = document.getElementById("modal-overlay");
const modalAddress = document.getElementById("modal-address");
const modalPayment = document.getElementById("modal-payment");

// Універсальна функція відкриття шторки
function openModal(modal) {
    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
    
    // Невелика затримка для плавного CSS-анімування
    setTimeout(() => {
        overlay.classList.remove("opacity-0");
        modal.classList.remove("translate-y-full");
    }, 10);

    // Легка вібрація для преміум-відчуття
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

// Функція закриття всіх шторок
function closeModal() {
    modalAddress.classList.add("translate-y-full");
    modalPayment.classList.add("translate-y-full");
    overlay.classList.add("opacity-0");
    
    // Чекаємо завершення анімації (300мс), потім ховаємо елементи
    setTimeout(() => {
        overlay.classList.add("hidden");
        modalAddress.classList.add("hidden");
        modalPayment.classList.add("hidden");
    }, 300);
}

// Закриття по кліку на темний фон
if (overlay) overlay.addEventListener("click", closeModal);

// Прив'язка кнопок
const btnAddress = document.getElementById("btn-address");
const btnPayment = document.getElementById("btn-payment");
const btnSupport = document.getElementById("btn-support");

if (btnAddress) btnAddress.addEventListener("click", () => openModal(modalAddress));
if (btnPayment) btnPayment.addEventListener("click", () => openModal(modalPayment));

// Збереження адреси
const btnSaveAddress = document.getElementById("save-address-btn");
const inputAddress = document.getElementById("address-input");
const displayAddress = document.getElementById("display-address");

if (btnSaveAddress) {
    btnSaveAddress.addEventListener("click", () => {
        const newAddress = inputAddress.value.trim();
        if (newAddress !== "") {
            // Оновлюємо текст у кабінеті
            displayAddress.textContent = newAddress;
            // Показуємо сповіщення "Успіх" через вібрацію Telegram
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            closeModal();
        }
    });
}

// Кнопка Підтримки (Одразу відкриває чат у Telegram)
if (btnSupport) {
    btnSupport.addEventListener("click", () => {
        if (tg && tg.openTelegramLink) {
            // Заміни pralnya_support на реальний юзернейм твого акаунта/менеджера
            tg.openTelegramLink("https://t.me/pralnya_support"); 
        } else {
            alert("Відкриваємо чат зі службою підтримки...");
        }
    });
}
// ======================================
// Оформлення замовлення (Checkout)
// ======================================

// Відкриття кошика (перехід на сторінку чекауту)
const floatingCartBtn = document.querySelector("#floating-cart button");
if (floatingCartBtn) {
    floatingCartBtn.addEventListener("click", () => {
        showPage("checkout");
        renderCheckout();
    });
}

// Кнопка Назад у чекауті (повертає в каталог послуг)
const checkoutBackBtn = document.getElementById("checkout-back-btn");
if (checkoutBackBtn) {
    checkoutBackBtn.addEventListener("click", () => {
        showPage("order");
    });
}

// Функція відмальовки чека
function renderCheckout() {
    const container = document.getElementById("checkout-items");
    const totalPriceEl = document.getElementById("checkout-total-price");
    const addressInput = document.getElementById("checkout-address");
    const displayAddress = document.getElementById("display-address");

    if (!container) return;
    container.innerHTML = "";

    if (state.cart.length === 0) {
        container.innerHTML = "<div class='text-gray-500 py-3 text-center'>Кошик порожній</div>";
        totalPriceEl.textContent = "0 ₴";
        return;
    }

    // Групуємо однакові товари (щоб не було 5 окремих рядків "Футболка")
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

    totalPriceEl.textContent = `${total} ₴`;

    // Якщо користувач вже вказав адресу в Кабінеті – підставляємо її автоматично
    if (displayAddress && displayAddress.textContent !== "ЖК, номер квартири") {
        addressInput.value = displayAddress.textContent;
    }
}

// Кнопка підтвердження замовлення
const confirmOrderBtn = document.getElementById("confirm-order-btn");
if (confirmOrderBtn) {
    confirmOrderBtn.addEventListener("click", () => {
        if (state.cart.length === 0) {
            alert("Ваш кошик порожній!");
            return;
        }

        const address = document.getElementById("checkout-address").value.trim();
        if (!address) {
            alert("Будь ласка, введіть адресу доставки");
            return;
        }

        // Тут у майбутньому ми збиратимемо дані в об'єкт і відправлятимемо 
        // через tg.sendData() у твій Python-бот для обробки і Google Sheets
        console.log("Замовлення відправлено:", {
            cart: state.cart,
            address: address,
            comment: document.getElementById("checkout-comment").value
        });

        // Вібрація успіху
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

        alert("🎉 Замовлення успішно оформлено! Кур'єр зв'яжеться з вами.");
        
        // Очищаємо кошик і повертаємо на головну
        state.cart = [];
        updateCartUI();
        showPage("home");
    });
}
// ======================================
// B2B Форма співпраці
// ======================================
const b2bSubmitBtn = document.getElementById("b2b-submit-btn");
if (b2bSubmitBtn) {
    b2bSubmitBtn.addEventListener("click", () => {
        const company = document.getElementById("b2b-company").value.trim();
        const phone = document.getElementById("b2b-phone").value.trim();
        const details = document.getElementById("b2b-details").value.trim();
        
        // Перевірка, чи заповнені обов'язкові поля
        if (!company || !phone) {
            alert("Будь ласка, вкажіть назву компанії та контактний телефон.");
            return;
        }
        
        // Тут ми в майбутньому передамо дані в Telegram-бота на Python
        console.log("Нова B2B заявка:", { company, phone, details });
        
        // Вібрація успіху
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        
        // Повідомлення користувачу
        alert(`Дякуємо! Заявка для "${company}" прийнята. Наш менеджер зв'яжеться з вами найближчим часом для обговорення умов.`);
        
        // Очищаємо форму після успішної відправки
        document.getElementById("b2b-company").value = "";
        document.getElementById("b2b-phone").value = "";
        document.getElementById("b2b-details").value = "";
        
        // Повертаємо на головну сторінку
        showPage("home");
    });
}
// ======================================
// Запуск
// ======================================
showPage("home");
renderProducts(state.currentCategory);