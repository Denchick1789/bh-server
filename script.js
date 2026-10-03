// === ДАННЫЕ СЕРВЕРА ===
const PRICES = [
    { days: "10 дней", price: 50 },
    { days: "30 дней", price: 143 },
    { days: "90 дней", price: 406 },
    { days: "180 дней", price: 772 },
    { days: "365 дней", price: 1487 }
];

const REFERRAL_COMMISSION = 10; // 10% комиссии
const ADMIN_CODE = "PERFARATOR1487";

let activeDiscount = 0;
let currentUser = null;
let userReferralName = null;

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    renderPriceCards();
    await checkReferralLink();
    
    // Проверяем авторизацию
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            updateUserInterface(true);
            await loadUserReferralData();
        } else {
            currentUser = null;
            userReferralName = null;
            updateUserInterface(false);
        }
    });
    
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
        toast.textContent = "IP-адрес скопирован!";
        toast.className = "show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
    });
}

// === ПРОМОКОДЫ ===
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

// === GOOGLE AUTH ===
function toggleAuth() {
    if (currentUser) {
        logout();
    } else {
        openAuthModal();
    }
}

function openAuthModal() {
    document.getElementById('authModal').classList.add('active');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
}

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            closeAuthModal();
            showToast(`Добро пожаловать, ${result.user.displayName}!`);
        })
        .catch((error) => {
            console.error("Ошибка входа:", error);
            alert("Ошибка входа: " + error.message);
        });
}

function logout() {
    firebase.auth().signOut().then(() => {
        showToast("Вы вышли из аккаунта");
    });
}

function updateUserInterface(isLoggedIn) {
    const authBtn = document.getElementById('authBtn');
    const createBox = document.getElementById('referralCreateBox');
    const dashboard = document.getElementById('userDashboard');
    
    if (isLoggedIn) {
        authBtn.textContent = 'Выйти';
        createBox.style.display = 'none';
        dashboard.style.display = 'block';
        
        // Заполняем данные пользователя
        document.getElementById('userName').textContent = currentUser.displayName;
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userPhoto').src = currentUser.photoURL || 'https://via.placeholder.com/50';
    } else {
        authBtn.textContent = 'Войти';
        createBox.style.display = 'block';
        dashboard.style.display = 'none';
    }
}

// === РЕФЕРАЛЬНАЯ СИСТЕМА ===
async function checkReferralLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    
    if (ref) {
        localStorage.setItem('bh_referral', ref);
        
        const refStats = await db.ref(`referrals/${ref}/clicks`).once('value');
        const clicks = refStats.val() || 0;
        await db.ref(`referrals/${ref}/clicks`).set(clicks + 1);
        
        showToast(`Вы перешли по ссылке игрока ${ref}!`);
    }
}

async function loadUserReferralData() {
    if (!currentUser) return;
    
    // Используем email как уникальный идентификатор для реферальной ссылки
    const emailPrefix = currentUser.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
    userReferralName = `USER_${emailPrefix}_${currentUser.uid.substring(0, 4)}`;
    
    const link = `${window.location.origin}${window.location.pathname}?ref=${userReferralName}`;
    document.getElementById('referralLink').value = link;
    
    // Создаем запись если нет
    const refSnapshot = await db.ref(`referrals/${userReferralName}`).once('value');
    if (!refSnapshot.exists()) {
        await db.ref(`referrals/${userReferralName}`).set({
            clicks: 0,
            earnings: 0,
            donations: 0,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            createdAt: Date.now()
        });
    }
    
    // Подписываемся на обновления
    db.ref(`referrals/${userReferralName}`).on('value', (snapshot) => {
        const data = snapshot.val() || {};
        document.getElementById('referralCount').textContent = data.clicks || 0;
        document.getElementById('referralEarnings').textContent = `${data.earnings || 0} ₽`;
        document.getElementById('referralDonations').textContent = data.donations || 0;
    });
}

function copyReferralLink() {
    const input = document.getElementById('referralLink');
    input.select();
    document.execCommand('copy');
    
    showToast('Реферальная ссылка скопирована!');
}

// === АДМИН КОД ===
function checkAdminCode() {
    const input = document.getElementById('adminCodeInput').value.trim();
    const msgEl = document.getElementById('adminMessage');
    
    if (input === ADMIN_CODE) {
        msgEl.textContent = "✅ Код принят! Вы перенаправляетесь в админ-панель...";
        msgEl.style.color = "var(--accent)";
        
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1500);
    } else {
        msgEl.textContent = "❌ Неверный код администратора!";
        msgEl.style.color = "var(--error)";
        
        setTimeout(() => {
            msgEl.textContent = "";
        }, 3000);
    }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
}

// Закрытие модалки по клику вне
window.onclick = function(event) {
    const modal = document.getElementById('authModal');
    if (event.target === modal) {
        closeAuthModal();
    }
}
