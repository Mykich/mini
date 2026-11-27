// ======================================
// Pralnya Vdoma Mini App — тема в стилі сайту (2026-11-27)
// Палітра та шрифти взяті з сайту (pralnyavdoma/style/site.css):
// теплий білий фон, камінь, графіт, золотистий акцент.
//
// Як це працює: розмітка (index.html, app.js) використовує класи Tailwind
// blue/indigo/gray/slate. Тут ми перевизначаємо ці палітри, тож усі
// кнопки, картки й тексти отримують кольори сайту без зміни логіки.
// Повернути старий вигляд = прибрати підключення цього файлу з index.html.
// ======================================

(function () {
    // Нейтральна тепла шкала (фон, лінії, другорядний текст)
    var stone = {
        50:  "#f6f3ee", // --bg сайту
        100: "#ece6dc", // --bg-alt
        200: "#dcd4c7", // --line
        300: "#c9bfb0",
        400: "#9b948a",
        500: "#6f706b",
        600: "#5d625f", // --muted
        700: "#454a49",
        800: "#2f3436",
        900: "#1f2326"  // --text
    };

    // Акцент: світлі відтінки — пісочно-золоті, темні — графіт (як кнопки сайту)
    var accent = {
        50:  "#f4efe7",
        100: "#ebe2d4",
        200: "#dccdb6",
        300: "#c4ac8b",
        400: "#a68a66",
        500: "#8a6d4b", // --gold
        600: "#1f2a33", // --accent (основні кнопки)
        700: "#34414d", // --accent-hover
        800: "#18212a",
        900: "#10171d"
    };

    var shadow = "0 1px 2px rgba(31,35,38,.04), 0 8px 24px rgba(31,35,38,.06)";

    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
        theme: {
            extend: {
                colors: {
                    blue: accent,
                    indigo: accent,
                    sky: accent,
                    gray: stone,
                    slate: stone
                },
                fontFamily: {
                    sans: ["Manrope", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
                    serif: ["Cormorant Garamond", "Georgia", "Times New Roman", "serif"]
                },
                borderRadius: {
                    "2xl": "16px",
                    "3xl": "20px"
                },
                boxShadow: {
                    sm: "0 1px 2px rgba(31,35,38,.05)",
                    DEFAULT: shadow,
                    md: shadow,
                    lg: "0 2px 4px rgba(31,35,38,.04), 0 12px 32px rgba(31,35,38,.08)",
                    xl: "0 2px 4px rgba(31,35,38,.05), 0 16px 40px rgba(31,35,38,.10)",
                    "2xl": "0 4px 8px rgba(31,35,38,.06), 0 20px 48px rgba(31,35,38,.14)"
                }
            }
        }
    };

    // Кольори верхньої/нижньої панелі Telegram під фон застосунку
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.isVersionAtLeast) {
        try {
            if (tg.isVersionAtLeast("6.1")) {
                tg.setHeaderColor(stone[50]);
                tg.setBackgroundColor(stone[50]);
            }
            if (tg.isVersionAtLeast("7.10") && tg.setBottomBarColor) {
                tg.setBottomBarColor("#ffffff");
            }
        } catch (e) { /* старий клієнт Telegram — залишаємо стандартні кольори */ }
    }
})();
