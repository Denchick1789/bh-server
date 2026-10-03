const PRICES = [
    { days: "10 дней", price: 50 },
    { days: "30 дней", price: 143 },
    { days: "90 дней", price: 406 },
    { days: "180 дней", price: 772 },
    { days: "365 дней", price: 1487 }
];

const ADMIN_CODE = "PERFARATOR1487";

let activeDiscount = 0;
let currentUser = null;
let userProfile = null; // Здесь будем хранить кастомный профиль

document.addEventListener('DOMContentLoaded', async () => {
    renderPriceCards();
    await checkReferralLink();
    loadPromoCodes();
    
    // Следим за состоянием входа
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserProfile();
        } else {
            currentUser = null;
            userProfile = null;
            updateUserInterface(false);
        }
    });
});

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

function copyIP() {
    navigator.clipboard.writeText("bh.mclan.ru").then(() => showToast("IP-адрес скопирован!"));
}

// === ПРОМОКОДЫ ===
function loadPromoCodes() {
    db.ref('promoCodes').on('value', (snapshot) => {
        window.PUBLIC_PROMO_CODES = Object.values(snapshot.val() || {});
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
    } else {
        activeDiscount = 0;
        msgEl.textContent = "Неверный или истекший промокод";
        msgEl.className = "error";
    }
    updatePrices();
}

function updatePrices() {
    document.querySelectorAll('.price-card').forEach(card => {
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

// === АВТОРИЗАЦИЯ И ПРОФИЛЬ ===
function toggleAuth() {
    currentUser ? logout() : openAuthModal();
}

function openAuthModal() { document.getElementById('authModal').classList.add('active'); }
function closeAuthModal() { document.getElementById('authModal').classList.remove('active'); }

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then(() => closeAuthModal())
        .catch((error) => alert("Ошибка входа: " + error.message));
}

function logout() {
    firebase.auth().signOut().then(() => showToast("Вы вышли из аккаунта"));
}

async function loadUserProfile() {
    const userRef = db.ref(`users/${currentUser.uid}`);
    const snapshot = await userRef.once('value');
    
    if (snapshot.exists()) {
        // Профиль уже создан, загружаем его
        userProfile = snapshot.val();
        updateUserInterface(true);
        loadReferralStats(userProfile.refCode);
    } else {
        // Профиля нет, открываем окно настройки
        openSetupModal();
    }
}

function openSetupModal() {
    document.getElementById('setupProfileModal').classList.add('active');
}

function closeSetupModal() {
    document.getElementById('setupProfileModal').classList.remove('active');
    document.getElementById('setupError').style.display = 'none';
}

async function saveCustomProfile() {
    const nickname = document.getElementById('setupNickname').value.trim();
    let avatar = document.getElementById('setupAvatar').value.trim();
    const refCode = document.getElementById('setupRefCode').value.trim().toUpperCase();
    const errorEl = document.getElementById('setupError');

    // Валидация
    if (!nickname || !refCode) {
        errorEl.textContent = "Заполните никнейм и код реферала!";
        errorEl.style.display = 'block';
        return;
    }
    if (refCode.length < 3 || !/^[A-Z0-9_]+$/.test(refCode)) {
        errorEl.textContent = "Код должен содержать только английские буквы, цифры и '_' (мин. 3 символа).";
        errorEl.style.display = 'block';
        return;
    }

    // Проверяем, не занят ли код
    const refCheck = await db.ref(`referrals/${refCode}`).once('value');
    if (refCheck.exists()) {
        errorEl.textContent = "Этот код реферала уже занят кем-то другим. Придумайте другой!";
        errorEl.style.display = 'block';
        return;
    }

    // Если аватар не указан, генерируем голову из Minecraft по нику
    if (!avatar) {
        avatar = `https://mc-heads.net/avatar/${encodeURIComponent(nickname)}/100`;
    }

    const newProfile = {
        uid: currentUser.uid,
        nickname: nickname,
        avatar: avatar,
        refCode: refCode,
        createdAt: Date.now()
    };

    // Сохраняем профиль пользователя
    await db.ref(`users/${currentUser.uid}`).set(newProfile);
    
    // Инициализируем статистику реферала
    await db.ref(`referrals/${refCode}`).set({
        clicks: 0,
        earnings: 0,
        donations: 0,
        ownerUid: currentUser.uid,
        createdAt: Date.now()
    });

    userProfile = newProfile;
    closeSetupModal();
    updateUserInterface(true);
    loadReferralStats(refCode);
    showToast("Профиль успешно создан!");
}

function updateUserInterface(isLoggedIn) {
    const authBtn = document.getElementById('authBtn');
    const createBox = document.getElementById('referralCreateBox');
    const dashboard = document.getElementById('userDashboard');
    
    if (isLoggedIn && userProfile) {
        authBtn.textContent = 'Выйти';
        createBox.style.display = 'none';
        dashboard.style.display = 'block';
        
        document.getElementById('userName').textContent = userProfile.nickname;
        document.getElementById('userPhoto').src = userProfile.avatar;
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
        await db.ref(`referrals/${ref}/clicks`).set((refStats.val() || 0) + 1);
        showToast(`Вы перешли по ссылке игрока!`);
    }
}

function loadReferralStats(refCode) {
    db.ref(`referrals/${refCode}`).on('value', (snapshot) => {
        const data = snapshot.val() || {};
        document.getElementById('referralCount').textContent = data.clicks || 0;
        document.getElementById('referralEarnings').textContent = `${data.earnings || 0} ₽`;
        document.getElementById('referralDonations').textContent = data.donations || 0;
    });
    
    const link = `${window.location.origin}${window.location.pathname}?ref=${refCode}`;
    document.getElementById('referralLink').value = link;
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
        msgEl.textContent = "✅ Код принят! Перенаправление...";
        msgEl.style.color = "var(--accent)";
        setTimeout(() => { window.location.href = 'admin.html'; }, 1000);
    } else {
        msgEl.textContent = "❌ Неверный код!";
        msgEl.style.color = "var(--error)";
        setTimeout(() => { msgEl.textContent = ""; }, 3000);
    }
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
