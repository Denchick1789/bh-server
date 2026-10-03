// === ПУБЛИЧНЫЕ ПРОМОКОДЫ (Работают для ВСЕХ игроков) ===
// Чтобы добавить код для всех, просто впиши его сюда в таком формате:
const PUBLIC_PROMO_CODES = [
    { code: "START5", discount: 5 },
    { code: "BH2026", discount: 10 }
];

// Локальные коды (сохраняются в браузере админа для тестов)
let localPromoCodes = JSON.parse(localStorage.getItem('bh_promo_codes')) || [];

let activeDiscount = 0;
let activePromoName = "";

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => {
    renderAdminList();
    updateExportJson();
});

// === КОПИРОВАНИЕ IP ===
function copyIP() {
    navigator.clipboard.writeText("bh.mclan.ru").then(() => {
        const toast = document.getElementById("toast");
        toast.className = "show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
    });
}

// === СИСТЕМА ПРОМОКОДОВ ===
function applyPromo() {
    const input = document.getElementById('promoInput').value.trim().toUpperCase();
    const msgEl = document.getElementById('promoMessage');
    
    // Ищем в публичных и локальных
    const allCodes = [...PUBLIC_PROMO_CODES, ...localPromoCodes];
    const found = allCodes.find(c => c.code === input);

    if (found) {
        activeDiscount = found.discount;
        activePromoName = found.code;
        msgEl.textContent = `Промокод "${found.code}" применен! Скидка ${found.discount}%`;
        msgEl.className = "success";
        updatePrices();
    } else {
        activeDiscount = 0;
        activePromoName = "";
        msgEl.textContent = "Неверный или истекший промокод";
        msgEl.className = "error";
        updatePrices();
    }
}

function updatePrices() {
    const cards = document.querySelectorAll('.price-card');
    cards.forEach(card => {
        const basePrice = parseInt(card.getAttribute('data-base-price'));
        const originalEl = card.querySelector('.original-price');
        const discountedEl = card.querySelector('.discounted-price');

        if (activeDiscount > 0) {
            const newPrice = Math.round(basePrice * (1 - activeDiscount / 100));
            originalEl.style.textDecoration = "line-through";
            originalEl.style.color = "var(--text-secondary)";
            discountedEl.textContent = `${newPrice} ₽`;
            discountedEl.style.display = "inline";
        } else {
            originalEl.style.textDecoration = "none";
            originalEl.style.color = "var(--accent)";
            discountedEl.style.display = "none";
        }
    });
}

// === АДМИН ПАНЕЛЬ (Ctrl + Alt + -) ===
document.addEventListener('keydown', (e) => {
    // Проверяем Ctrl + Alt + Minus (или Underscore на некоторых раскладках)
    if (e.ctrlKey && e.altKey && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        document.getElementById('adminModal').classList.add('active');
    }
});

function closeAdmin() {
    document.getElementById('adminModal').classList.remove('active');
}

function createPromoCode() {
    const codeInput = document.getElementById('newPromoCode');
    const discountInput = document.getElementById('newPromoDiscount');
    
    const code = codeInput.value.trim().toUpperCase();
    const discount = parseInt(discountInput.value);

    if (!code || isNaN(discount) || discount < 1 || discount > 99) {
        alert("Введите корректное название и процент скидки (1-99)");
        return;
    }

    // Проверка на дубликаты
    const allCodes = [...PUBLIC_PROMO_CODES, ...localPromoCodes];
    if (allCodes.find(c => c.code === code)) {
        alert("Такой промокод уже существует!");
        return;
    }

    localPromoCodes.push({ code, discount });
    localStorage.setItem('bh_promo_codes', JSON.stringify(localPromoCodes));
    
    codeInput.value = '';
    discountInput.value = '5';
    
    renderAdminList();
    updateExportJson();
    alert(`Промокод ${code} создан! (Пока работает только в вашем браузере).`);
}

function deleteLocalPromo(code) {
    localPromoCodes = localPromoCodes.filter(c => c.code !== code);
    localStorage.setItem('bh_promo_codes', JSON.stringify(localPromoCodes));
    renderAdminList();
    updateExportJson();
}

function renderAdminList() {
    const listEl = document.getElementById('promoList');
    listEl.innerHTML = '';
    
    if (localPromoCodes.length === 0) {
        listEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">Локальных кодов нет</p>';
        return;
    }

    localPromoCodes.forEach(item => {
        const div = document.createElement('div');
        div.className = 'promo-item';
        div.innerHTML = `
            <span><b>${item.code}</b> (-${item.discount}%)</span>
            <button onclick="deleteLocalPromo('${item.code}')">Удалить</button>
        `;
        listEl.appendChild(div);
    });
}

function updateExportJson() {
    const exportEl = document.getElementById('exportJson');
    // Объединяем публичные и локальные для экспорта
    const allForExport = [...PUBLIC_PROMO_CODES, ...localPromoCodes];
    // Форматируем красиво
    const jsonString = JSON.stringify(allForExport, null, 4);
    exportEl.value = jsonString;
}

function copyExportJson() {
    const exportEl = document.getElementById('exportJson');
    exportEl.select();
    document.execCommand('copy');
    alert("JSON скопирован! Вставь его в файл script.js вместо старого массива PUBLIC_PROMO_CODES и загрузи на GitHub.");
}

// Закрытие модалки по клику вне её
window.onclick = function(event) {
    const modal = document.getElementById('adminModal');
    if (event.target === modal) {
        closeAdmin();
    }
}