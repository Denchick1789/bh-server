// === ДАННЫЕ СЕРВЕРА ===
const PRICES = [
    { days: "10 дней", price: 50 },
    { days: "30 дней", price: 143 },
    { days: "90 дней", price: 406 },
    { days: "180 дней", price: 772 },
    { days: "365 дней", price: 1487 }
];

const REFERRAL_COMMISSION = 10; // 10% комиссии

let activeDiscount = 0;
let currentReferral = null;

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    renderPriceCards();
    await checkReferralLink();
    await loadReferralStats();
    loadPromoCodes();
});

// === ГЕНЕРАЦИЯ КАРТОЧЕК ЦЕН ===
function renderPriceCards() {
    const grid = document.getElementById('pricingGrid');
    grid.innerHTML = '';
    
    PRICES.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `price-card ${index === 1 || index === 4 ? 'featured' : ''}`;
        card.setAttribute('data-base-price', item.price);
        
        card.innerHTML = `
            <div>
                <div class="duration">${item.days}</div>
                <div class="price-wrapper">
                    <span class="original-price">${item.price} ₽</span>
                    <span class="discounted-price" style="display: none;">0 ₽</span>
                </div>
            </div>
            <a href="https://www.donationalerts.com/r/svyatik_over_world" target="_blank" class="btn">Купить</a>
        `;
        
        grid.appendChild(card);
    });
}

// === КОПИРОВАНИЕ IP ===
function copyIP() {
    navigator.clipboard.writeText("bh.mclan.ru").then(() => {
        const toast = document.getElementById("toast");
        toast.className = "show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
    });
}

// === ПРОМОКОДЫ (АВТОМАТИЧЕСКИ ИЗ FIREBASE) ===
function loadPromoCodes() {
    db.ref('promoCodes').on('value', (snapshot) => {
        const codes = snapshot.val() || {};
        window.PUBLIC_PROMO_CODES = Object.values(codes);
    });
}

function applyPromo() {
    const input = document.getElementById('promoInput').value.trim().toUpperCase();
    const msgEl = document.getElementById('promoMessage');
    
    const found = window.PUBLIC_PROMO_CODES?.find(c => c.code === input);

    if (found) {
        activeDiscount = found.discount;
        msgEl.textContent = `Промокод "${found.code}" применен! Скидка ${found.discount}%`;
        msgEl.className = "success";
        updatePrices();
    } else {
        activeDiscount = 0;
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

// === РЕФЕРАЛЬНАЯ СИСТЕМА ===
async function checkReferralLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    
    if (ref) {
        // Сохраняем реферера в localStorage
        localStorage.setItem('bh_referral', ref);
        currentReferral = ref;
        
        // Увеличиваем счетчик переходов
        const refStats = await db.ref(`referrals/${ref}/clicks`).once('value');
        const clicks = refStats.val() || 0;
        await db.ref(`referrals/${ref}/clicks`).set(clicks + 1);
        
        // Показываем уведомление
        const toast = document.getElementById("toast");
        toast.textContent = `Вы перешли по ссылке игрока ${ref}!`;
        toast.className = "show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
    }
}

async function loadReferralStats() {
    const savedRef = localStorage.getItem('bh_referral');
    if (!savedRef) {
        document.getElementById('referralLink').value = 'Создай свою ссылку ниже ↓';
        return;
    }
    
    currentReferral = savedRef;
    const link = `${window.location.origin}${window.location.pathname}?ref=${savedRef}`;
    document.getElementById('referralLink').value = link;
    
    // Загружаем статистику
    db.ref(`referrals/${savedRef}`).on('value', (snapshot) => {
        const data = snapshot.val() || {};
        document.getElementById('referralCount').textContent = data.clicks || 0;
        document.getElementById('referralEarnings').textContent = `${data.earnings || 0} ₽`;
    });
}

function createReferralLink() {
    const nameInput = document.getElementById('referralName');
    const name = nameInput.value.trim().toUpperCase();
    
    if (!name) {
        alert('Введите свой ник!');
        return;
    }
    
    if (name.length < 3) {
        alert('Ник должен быть минимум 3 символа!');
        return;
    }
    
    // Сохраняем в localStorage
    localStorage.setItem('bh_referral', name);
    
    // Создаем запись в Firebase
    db.ref(`referrals/${name}`).set({
        clicks: 0,
        earnings: 0,
        createdAt: Date.now()
    });
    
    // Обновляем интерфейс
    loadReferralStats();
    nameInput.value = '';
    
    alert(`Реферальная ссылка создана! Твой ник: ${name}`);
}

function copyReferralLink() {
    const input = document.getElementById('referralLink');
    input.select();
    document.execCommand('copy');
    
    const toast = document.getElementById("toast");
    toast.textContent = 'Реферальная ссылка скопирована!';
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
}

// === АВТОМАТИЧЕСКОЕ НАЧИСЛЕНИЕ КОМИССИИ ===
// Эта функция вызывается из админки при подтверждении доната
async function processDonation(referralName, amount) {
    if (!referralName) return;
    
    const commission = Math.round(amount * REFERRAL_COMMISSION / 100);
    
    const refData = await db.ref(`referrals/${referralName}`).once('value');
    const data = refData.val() || { earnings: 0 };
    
    await db.ref(`referrals/${referralName}/earnings`).set(data.earnings + commission);
    
    // Логируем транзакцию
    await db.ref(`transactions`).push({
        referral: referralName,
        amount: amount,
        commission: commission,
        timestamp: Date.now()
    });
}
