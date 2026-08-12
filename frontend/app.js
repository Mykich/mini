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
    
    // ИСПРАВЛЕНО: ищем правильный ID из HTML
    const profileNameEl = document.getElementById("profile-display-name");
    if (profileNameEl) profileNameEl.textContent = user.first_name;
}

// 4. Навигация по страницам (Routing)
// 4. Навигация по страницам (Routing)
const pages = {
    home: document.getElementById("home-page"),
    order: document.getElementById("order-page"),
    orders: document.getElementById("orders-page"),
    ai: document.getElementById("ai-page"),
    profile: document.getElementById("cabinet-page"), 
    cabinet: document.getElementById("cabinet-page"), // Добавили алиас для кабинета
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

    // Якщо повернулись на каталог — перемальовуємо, щоб +/- відповідали актуальному кошику
    if (pageId === "order") {
        if (state.search) {
            renderSearchResults(state.search);
        } else {
            renderProducts(state.currentCategory);
        }
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

// ======================================
// Новая навигация нижнего меню (SVG иконки)
// ======================================
window.switchTab = function(tabName) {
    // 1. Сбрасываем цвета у всех кнопок меню (делаем серыми)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-blue-600');
        btn.classList.add('text-gray-400');
    });

    // 2. Красим активную кнопку (делаем синей)
    const activeBtn = document.querySelector(`.nav-btn[onclick="switchTab('${tabName}')"]`);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('text-blue-600');
    }

    // 3. Мапим названия из меню на твои ID страниц и вызываем роутинг
    let pageId = 'home';
    if (tabName === 'main') pageId = 'home';
    if (tabName === 'assistant') pageId = 'ai';
    if (tabName === 'cabinet') pageId = 'cabinet';

    showPage(pageId);

    // 4. Добавляем вибрацию при переключении
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
};

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
// Создаёт карточку товара. onUpdate вызывается после +/- чтобы перерисовать список,
// в котором эта карточка показана (каталог категории, результаты пошуку, тощо).
function createServiceCard(product, onUpdate) {
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
            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            onUpdate();
        });
    }

    // Вешаем обработчик на минус (если он есть)
    const removeBtn = card.querySelector(".remove-btn");
    if (removeBtn) {
        removeBtn.addEventListener("click", () => {
            removeFromCart(product.id);
            onUpdate();
        });
    }

    return card;
}

function renderProducts(category) {
    const container = document.getElementById("products-list");
    if (!container) return;

    container.innerHTML = "";
    const products = typeof servicesData !== 'undefined' ? (servicesData[category] || []) : [];

    products.forEach(product => {
        container.appendChild(createServiceCard(product, () => renderProducts(category)));
    });
}

// ======================================
// Пошук по всіх категоріях
// ======================================
function getAllServices() {
    if (typeof servicesData === 'undefined') return [];
    return Object.keys(servicesData).reduce((acc, key) => acc.concat(servicesData[key]), []);
}

function renderSearchResults(query) {
    const container = document.getElementById("products-list");
    const emptyState = document.getElementById("search-empty-state");
    const catalogTitle = document.getElementById("catalog-title");
    const popularSection = document.getElementById("popular-section");
    const categoriesSection = document.getElementById("categories-section");
    if (!container) return;

    const q = query.trim().toLowerCase();

    // Пустий пошук — повертаємось до звичайного вигляду каталогу
    if (!q) {
        if (popularSection) popularSection.classList.remove("hidden");
        if (categoriesSection) categoriesSection.classList.remove("hidden");
        if (catalogTitle) catalogTitle.textContent = "Послуги";
        if (emptyState) emptyState.classList.add("hidden");
        renderProducts(state.currentCategory);
        return;
    }

    if (popularSection) popularSection.classList.add("hidden");
    if (categoriesSection) categoriesSection.classList.add("hidden");
    if (catalogTitle) catalogTitle.textContent = `Результати пошуку: "${query}"`;

    const results = getAllServices().filter(p => p.name.toLowerCase().includes(q));

    container.innerHTML = "";

    if (results.length === 0) {
        if (emptyState) emptyState.classList.remove("hidden");
        return;
    }
    if (emptyState) emptyState.classList.add("hidden");

    results.forEach(product => {
        container.appendChild(createServiceCard(product, () => renderSearchResults(query)));
    });
}

const searchInput = document.getElementById("search-input");

if (searchInput) {
    // 0. Головне: запускаємо пошук при кожному натисканні клавіші
    searchInput.addEventListener("input", (e) => {
        state.search = e.target.value;
        renderSearchResults(state.search);
    });

    // 1. Обработка нажатия Enter на клавиатуре
    searchInput.addEventListener("keydown", (e) => {
        // Проверяем, что нажат именно Enter
        if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault(); // Блокируем стандартную перезагрузку страницы
            searchInput.blur(); // Снимаем фокус с поля, чтобы скрыть клавиатуру телефона

            // Результаты поиска рендерятся именно в #products-list
            const resultsContainer = document.getElementById("products-list"); 
            
            if (resultsContainer) {
                setTimeout(() => {
                    // Скроллим страницу к блоку с результатами
                    resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 300); // Небольшая задержка, чтобы клавиатура успела скрыться
            }
        }
    });
}

// ======================================
// Популярні послуги (кураторський вибір)
// ======================================
const POPULAR_IDS = [104, 201, 301, 3, 502, 7];

function renderPopularServices() {
    const container = document.getElementById("popular-services");
    if (!container) return;

    container.innerHTML = "";
    const allServices = getAllServices();

    POPULAR_IDS.forEach(id => {
        const product = allServices.find(p => p.id === id);
        if (!product) return;

        const card = document.createElement("div");
        card.className = `
            shrink-0 w-40 bg-white rounded-[20px] p-4
            shadow-[0_4px_20px_rgba(0,0,0,0.05)]
            border border-gray-50/80
        `;
        card.innerHTML = `
            <div class="text-[15px] font-bold text-gray-900 leading-tight min-h-[40px]">${product.name}</div>
            <div class="text-blue-600 text-[15px] font-bold mt-2">${product.price} ₴</div>
            <button class="popular-add-btn mt-3 w-full py-2 rounded-[12px] bg-blue-50 text-blue-600 font-semibold text-sm hover:bg-blue-600 hover:text-white transition-colors">
                + Додати
            </button>
        `;

        const btn = card.querySelector(".popular-add-btn");
        btn.addEventListener("click", () => {
            addToCart(product);
            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            // Якщо зараз відкрита та ж категорія — перемальовуємо, щоб з'явився +/-
            if (state.currentCategory === product.category) {
                renderProducts(state.currentCategory);
            }
        });

        container.appendChild(card);
    });
}

// Початковий рендер каталогу та популярного при відкритті додатку
renderProducts(state.currentCategory);
renderPopularServices();

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
            <div class="flex items-center gap-3">
                <div class="text-[15px] font-bold text-gray-900">${itemTotal} ₴</div>
                <button class="checkout-remove-btn w-7 h-7 rounded-full bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center text-lg leading-none transition-colors" title="Прибрати одну позицію">
                    −
                </button>
            </div>
        `;

        const removeBtn = row.querySelector(".checkout-remove-btn");
        removeBtn.addEventListener("click", () => {
            removeFromCart(item.id);
            renderCheckout();
        });

        container.appendChild(row);
    });

    if (totalPriceEl) totalPriceEl.textContent = `${total} ₴`;

    if (displayAddress && addressInput && displayAddress.textContent !== "ЖК, номер квартири") {
        addressInput.value = displayAddress.textContent;
    }
}

// Повне очищення кошика — з підтвердженням, щоб не зняти все випадково
function clearCart() {
    if (state.cart.length === 0) return;

    const doClear = () => {
        state.cart = [];
        updateCartUI();
        renderCheckout();
        // Якщо каталог зараз відкритий десь позаду — оновимо, щоб +/- скинулись на "+"
        renderProducts(state.currentCategory);
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    };

    if (typeof tg !== 'undefined' && tg.showConfirm) {
        tg.showConfirm("Очистити весь кошик?", (confirmed) => {
            if (confirmed) doClear();
        });
    } else if (confirm("Очистити весь кошик?")) {
        doClear();
    }
}

const clearCartBtn = document.getElementById("clear-cart-btn");
if (clearCartBtn) {
    clearCartBtn.addEventListener("click", clearCart);
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
// Связь с сервером Python (ngrok)
// ======================================
const NGROK_URL = "https://mini-mrip.onrender.com"; 
const safeTg = window.Telegram ? window.Telegram.WebApp : null;

let userId = 123456789;
if (safeTg && safeTg.initDataUnsafe && safeTg.initDataUnsafe.user) {
    userId = safeTg.initDataUnsafe.user.id;
}

async function fetchCabinetData() {
    try {
        const response = await fetch(`${NGROK_URL}/api/cabinet?user_id=${userId}`, {
            method: 'GET'
        });
        
        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);

        const data = await response.json();
        console.log("Данные с сервера получены:", data);

        // 1. Заполняем имя пользователя в кабинете
        if (data.client) {
            const nameEl = document.getElementById("profile-name");
            if (nameEl) nameEl.textContent = data.client.name || "Клієнт";
        }

        // 1.5. Обновляем счётчики на главной ("Замовлень" / "Витрачено")
        updateHomeStats(data.client, data.orders);

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

// Рахує реальну суму витрат по замовленнях (ательє без ціни до огляду — пропускаємо,
// так само як на бекенді в /api/cabinet). Використовується і для "Витрачено",
// і для прогресу в картці Pralnya Club.
function computeTotalSpent(orders) {
    return (orders || []).reduce((sum, order) => {
        const match = String(order.price || "").match(/\d+/);
        return sum + (match ? parseInt(match[0], 10) : 0);
    }, 0);
}

// Pralnya Club — бейдж знижки + текст прогресу до наступного рівня.
// Пороги дублюють get_loyalty_discount() на сервері (api.py) — лише для відображення,
// реальна знижка завжди рахується і застосовується на бекенді від суми витрат
// (навмисно не від кількості замовлень — інакше знижку можна "накрутити" дрібними замовленнями).
function updateLoyaltyCard(totalSpent, discount) {
    const badge = document.getElementById("profile-discount-badge");
    const text = document.getElementById("pralnya-club-text");

    if (badge) badge.textContent = `Знижка ${discount}%`;

    if (text) {
        if (discount >= 10) {
            text.textContent = "Максимальна знижка 10% активна — дякуємо, що обираєте нас! 💙";
        } else {
            const nextThreshold = discount === 0 ? 2000 : 5000;
            const remaining = Math.max(1, nextThreshold - totalSpent);
            text.textContent = `Витратьте ще ${remaining} ₴ до наступного рівня знижки`;
        }
    }
}

// Оновлення статистики на головній сторінці ("Замовлень" / "Витрачено")
function updateHomeStats(client, orders) {
    const ordersCountEl = document.getElementById("orders-count");
    const bonusCountEl = document.getElementById("bonus-count");
    const list = orders || [];

    if (ordersCountEl) {
        ordersCountEl.textContent = list.length;
    }

    if (bonusCountEl) {
        bonusCountEl.textContent = `${computeTotalSpent(list)} ₴`;
    }
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
        ? "bg-blue-600 text-white p-3.5 rounded-[20px] rounded-tr-sm text-sm shadow-sm max-w-[85%] self-end leading-relaxed animate-fade-in"
        : "bg-white p-3.5 rounded-[20px] rounded-tl-sm text-sm text-gray-800 shadow-sm border border-gray-100 max-w-[85%] self-start leading-relaxed animate-fade-in";

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
    bubble.className = "bg-white p-3.5 rounded-[20px] rounded-tl-sm text-sm text-gray-400 shadow-sm border border-gray-100 max-w-[40%] self-start flex items-center gap-1.5";
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
        // Pralnya Club — знижка та прогрес до наступного рівня
        updateLoyaltyCard(computeTotalSpent(orders), client.discount || 0);

        // --- Отрисовка заказов ---
        renderOrdersList(orders);

        // --- Оновлюємо статистику на головній, якщо вона зміниться ---
        updateHomeStats(client, orders);

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
            <div class="bg-white rounded-[24px] p-8 text-center border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                <div class="text-4xl mb-3">🧺</div>
                <h4 class="font-bold text-slate-900 text-sm mb-1">У вас поки немає замовлень</h4>
                <p class="text-xs text-slate-500 mb-5">Оформіть ваше перше замовлення пральні або ательє!</p>
                <button onclick="showPage('home')" class="bg-blue-50 text-blue-600 font-bold px-5 py-2.5 rounded-full text-xs active:scale-95 transition-transform">
                    До каталогу
                </button>
            </div>
        `;
        return;
    }

    // Собираем карточки заказов
    container.innerHTML = orders.map(order => {
        const isAtelier = order.type === 'atelier';
        const icon = isAtelier ? '✂️' : '🫧';
        
        // Определяем цвет и иконку статуса с учетом нового дизайна
        let statusBg = "bg-slate-50 text-slate-600 border-slate-200/50";
        let dotColor = "bg-slate-400";
        let dotAnim = "";
        const statusText = order.status || "Прийнято";

        if (statusText.includes("Готово") || statusText.includes("Видано")) {
            statusBg = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
            dotColor = "bg-emerald-500"; // Зеленая точка (без пульсации, так как завершено)
        } else if (statusText.includes("пранн") || statusText.includes("робот")) {
            statusBg = "bg-blue-50 text-blue-700 border-blue-200/50";
            dotColor = "bg-blue-500";
            dotAnim = "animate-pulse"; // Пульсирующая синяя точка
        } else if (statusText.includes("огляд") || statusText.includes("Узгодження")) {
            statusBg = "bg-amber-50 text-amber-700 border-amber-200/50";
            dotColor = "bg-amber-500";
            dotAnim = "animate-pulse"; // Пульсирующая оранжевая точка
        }

        return `
            <div class="group relative rounded-[24px] bg-white p-5 border border-slate-100 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.04)] transition-all duration-200 active:scale-[0.98]">
              
              <!-- Шапка карточки -->
              <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-xl ring-4 ring-slate-50/50 shadow-inner">
                    ${icon}
                  </div>
                  <div>
                    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">№ ${order.id}</div>
                    <div class="text-sm font-bold text-slate-800">${order.date || ''}</div>
                  </div>
                </div>

                <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${statusBg}">
                  <span class="h-1.5 w-1.5 rounded-full ${dotColor} ${dotAnim}"></span>
                  ${statusText}
                </span>
              </div>

              <!-- Содержимое (вещи/услуги) -->
              <div class="my-3.5 rounded-2xl bg-slate-50/80 p-3 text-xs font-medium text-slate-600 leading-relaxed">
                ${order.items || 'Послуги'}
              </div>

              <!-- Сумма -->
              <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                <span class="text-xs font-medium text-slate-400">Сума:</span>
                <span class="text-base font-black text-slate-900">${order.price}</span>
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
                message: String(text || ""),
                telegram_id: userId ? String(userId) : null
            
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

//window.openAIPage = function() {
    // 1. Скрываем все возможные страницы (main и section), которые есть в твоем index_2.html
    //const allPages = [
        //'home-page', 
        //'order-page', 
        //'orders-page', 
        //'atelier-page', 
        //'b2b-page', 
        //'checkout-page', 
        //'cabinet-page'
    //];
    
    //allPages.forEach(pageId => {
        //const pageElement = document.getElementById(pageId);
        //if (pageElement) {
            //pageElement.classList.add('hidden');
        //}
    //});
    
    // 2. Принудительно показываем секцию AI
    //const aiPage = document.getElementById('ai-page');
    //f (aiPage) {
        //aiPage.classList.remove('hidden');
    //}
    
    // 3. Снимаем активный класс с кнопок нижнего меню (чтобы было видно, что мы не на главной)
    //document.querySelectorAll('.nav-btn').forEach(btn => {
       // btn.classList.remove('active');
    //});
//};

// ======================================
// Закриття клавіатури тапом по порожньому місцю екрану
// ======================================
document.addEventListener("click", (e) => {
    const active = document.activeElement;
    if (!active) return;

    const isTextField = active.tagName === "INPUT" || active.tagName === "TEXTAREA";
    if (!isTextField) return;

    // Клік по самому полю (або по чомусь всередині нього) — не чіпаємо фокус
    if (e.target === active || active.contains(e.target)) return;

    active.blur();
});

// ======================================
// Підняти поле вводу над клавіатурою при фокусі — для БУДЬ-ЯКОГО
// input/textarea в застосунку (адреса, коментар, B2B-форма, профіль тощо),
// а не тільки для пошуку.
// ======================================
document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;

    setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400); // Даємо Telegram час повністю розкрити клавіатуру
});
