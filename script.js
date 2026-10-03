// === КОНСТАНТЫ И ПЕРЕМЕННЫЕ ===
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
let userProfile = null;

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log(' Сайт загружается...');
    
    // Проверяем, что Firebase подключен
    if (typeof firebase === 'undefined' || typeof db === 'undefined') {
        console.error('❌ Firebase не подключен! Проверь firebase-config.js');
        alert('Ошибка: Firebase не подключен. Проверь консоль браузера (F12).');
        return;
    }
    
    renderPriceCards();
    await checkReferralLink();
    loadPromoCodes();
    
    // Следим за состоянием авторизации Firebase
    firebase.auth().onAuthStateChanged(async (user) => {
        console.log('👤 Состояние авторизации:', user ? 'Вошел' : 'Не вошел');
        
        if (user) {
            currentUser = user;
            console.log('✅ Пользователь вошел:', user.email);
            
            try {
                await loadUserProfile();
            } catch (error) {
                console.error('❌ Ошибка загрузки профиля:', error);
                alert('Ошибка загрузки профиля: ' + error.message);
            }
        } else {
            currentUser = null;
            userProfile = null;
            console.log('👋 Пользователь вышел');
            updateUserInterface(false);
        }
    });
});

// === ГЕНЕРАЦИЯ КАРТОЧЕК ДОНАТА ===
function renderPriceCards() {
    const grid = document.getElementById('pricingGrid');
    if (!grid) {
        console.error('❌ Не найден элемент pricingGrid');
        return;
    }
    
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
    console.log('✅ Карточки доната созданы');
}

// === КОПИРОВАНИЕ IP ===
function copyIP() {
    navigator.clipboard.writeText("bh.mclan.ru").then(() => {
        showToast("IP-адрес скопирован!");
    }).catch(err => {
        console.error('Ошибка копирования:', err);
    });
}

// === ПРОМОКОДЫ ===
function loadPromoCodes() {
    db.ref('promoCodes').on('value', (snapshot) => {
        window.PUBLIC_PROMO_CODES = Object.values(snapshot.val() || {});
        console.log('✅ Промокоды загружены:', window.PUBLIC_PROMO_CODES.length);
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

// === АВТОРИЗАЦИЯ ===
function toggleAuth() {
    console.log(' Клик по кнопке авторизации');
    if (currentUser) {
        logout();
    } else {
        openAuthModal();
    }
}

function openAuthModal() { 
    console.log('📱 Открытие модалки авторизации');
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.add('active');
    } else {
        console.error('❌ Не найден элемент authModal');
    }
}

function closeAuthModal() { 
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function signInWithGoogle() {
    console.log('🔐 Попытка входа через Google...');
    const provider = new firebase.auth.GoogleAuthProvider();
    
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            console.log('✅ Успешный вход:', result.user.email);
            closeAuthModal();
            showToast("Успешный вход!");
        })
        .catch((error) => {
            console.error('❌ Ошибка входа:', error);
            alert("Ошибка входа: " + error.message + "\n\nПроверь консоль браузера (F12) для деталей.");
        });
}

function logout() {
    console.log('👋 Выход из аккаунта');
    firebase.auth().signOut().then(() => {
        showToast("Вы вышли из аккаунта");
    }).catch(err => {
        console.error('Ошибка выхода:', err);
    });
}

// === ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ===
async function loadUserProfile() {
    console.log('📂 Загрузка профиля для UID:', currentUser.uid);
    
    try {
        const userRef = db.ref(`users/${currentUser.uid}`);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            console.log('✅ Профиль найден в базе');
            userProfile = snapshot.val();
            console.log('📋 Данные профиля:', userProfile);
            updateUserInterface(true);
            loadReferralStats(userProfile.refCode);
        } else {
            console.log('⚠️ Профиль не найден, открываем модалку настройки');
            updateUserInterface(false);
            openSetupModal();
        }
    } catch (error) {
        console.error('❌ Ошибка при загрузке профиля:', error);
        throw error;
    }
}

function openSetupModal() { 
    console.log('📝 Открытие модалки настройки профиля');
    const modal = document.getElementById('setupProfileModal');
    if (modal) {
        modal.classList.add('active');
    } else {
        console.error('❌ Не найден элемент setupProfileModal');
    }
}

function closeSetupModal() { 
    const modal = document.getElementById('setupProfileModal');
    if (modal) {
        modal.classList.remove('active');
    }
    const errorEl = document.getElementById('setupError');
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

async function saveCustomProfile() {
    console.log(' Сохранение кастомного профиля...');
    
    const nickname = document.getElementById('setupNickname').value.trim();
    let avatar = document.getElementById('setupAvatar').value.trim();
    const refCode = document.getElementById('setupRefCode').value.trim().toUpperCase();
    const errorEl = document.getElementById('setupError');

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

    try {
        const refCheck = await db.ref(`referrals/${refCode}`).once('value');
        if (refCheck.exists()) {
            errorEl.textContent = "Этот код реферала уже занят. Придумайте другой!";
            errorEl.style.display = 'block';
            return;
        }

        // Если аватар не указан, берем голову из Minecraft по нику
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

        console.log('📤 Сохранение профиля в базу...');
        await db.ref(`users/${currentUser.uid}`).set(newProfile);
        
        await db.ref(`referrals/${refCode}`).set({
            clicks: 0,
            earnings: 0,
            donations: 0,
            ownerUid: currentUser.uid,
            createdAt: Date.now()
        });

        userProfile = newProfile;
        console.log('✅ Профиль сохранен:', userProfile);
        
        closeSetupModal();
        updateUserInterface(true);
        loadReferralStats(refCode);
        showToast("Профиль успешно создан!");
        
    } catch (error) {
        console.error('❌ Ошибка сохранения профиля:', error);
        errorEl.textContent = "Ошибка сохранения: " + error.message;
        errorEl.style.display = 'block';
    }
}

function updateUserInterface(isLoggedIn) {
    console.log(' Обновление интерфейса:', isLoggedIn ? 'вошел' : 'вышел');
    
    const authBtn = document.getElementById('authBtn');
    const createBox = document.getElementById('referralCreateBox');
    const dashboard = document.getElementById('userDashboard');
    
    if (!authBtn || !createBox || !dashboard) {
        console.error('❌ Не найдены элементы интерфейса');
        return;
    }
    
    if (isLoggedIn && userProfile) {
        authBtn.textContent = 'Выйти';
        createBox.style.display = 'none';
        dashboard.style.display = 'block';
        
        const userNameEl = document.getElementById('userName');
        const userPhotoEl = document.getElementById('userPhoto');
        
        if (userNameEl) userNameEl.textContent = userProfile.nickname;
        if (userPhotoEl) userPhotoEl.src = userProfile.avatar;
        
        console.log('✅ Интерфейс обновлен для пользователя:', userProfile.nickname);
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
        console.log('🔗 Переход по реферальной ссылке:', ref);
        localStorage.setItem('bh_referral', ref);
        
        try {
            const refStats = await db.ref(`referrals/${ref}/clicks`).once('value');
            await db.ref(`referrals/${ref}/clicks`).set((refStats.val() || 0) + 1);
            showToast(`Вы перешли по ссылке реферала!`);
        } catch (error) {
            console.error('Ошибка обновления счетчика:', error);
        }
    }
}

function loadReferralStats(refCode) {
    console.log('📊 Загрузка статистики для реферала:', refCode);
    
    db.ref(`referrals/${refCode}`).on('value', (snapshot) => {
        const data = snapshot.val() || {};
        
        const countEl = document.getElementById('referralCount');
        const earningsEl = document.getElementById('referralEarnings');
        const donationsEl = document.getElementById('referralDonations');
        
        if (countEl) countEl.textContent = data.clicks || 0;
        if (earningsEl) earningsEl.textContent = `${data.earnings || 0} ₽`;
        if (donationsEl) donationsEl.textContent = data.donations || 0;
    });
    
    const link = `${window.location.origin}${window.location.pathname}?ref=${refCode}`;
    const linkInput = document.getElementById('referralLink');
    if (linkInput) {
        linkInput.value = link;
    }
}

function copyReferralLink() {
    const input = document.getElementById('referralLink');
    if (input) {
        input.select();
        document.execCommand('copy');
        showToast('Реферальная ссылка скопирована!');
    }
}

// === АДМИН КОД ===
function checkAdminCode() {
    const input = document.getElementById('adminCodeInput').value.trim();
    const msgEl = document.getElementById('adminMessage');
    
    if (input === ADMIN_CODE) {
        sessionStorage.setItem('bh_admin_access', 'granted');
        msgEl.textContent = "✅ Код принят! Перенаправление...";
        msgEl.style.color = "var(--accent)";
        
        setTimeout(() => { 
            window.location.href = 'admin.html'; 
        }, 1000);
    } else {
        msgEl.textContent = " Неверный код!";
        msgEl.style.color = "var(--error)";
        setTimeout(() => { msgEl.textContent = ""; }, 3000);
    }
}

// === СБРОС ПРОФИЛЯ ===
async function resetProfile() {
    if (!confirm('⚠️ Вы уверены? Это удалит ваш профиль и реферальный код. Вся статистика будет потеряна безвозвратно!')) {
        return;
    }
    
    if (!confirm('Точно удалить? Это действие нельзя отменить!')) {
        return;
    }
    
    try {
        console.log('🗑️ Удаление профиля...');
        
        await db.ref(`users/${currentUser.uid}`).remove();
        
        if (userProfile && userProfile.refCode) {
            await db.ref(`referrals/${userProfile.refCode}`).remove();
        }
        
        await firebase.auth().signOut();
        
        showToast('Профиль удален! Войдите снова, чтобы создать новый.');
        
        setTimeout(() => {
            location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Ошибка при сбросе:', error);
        alert('Произошла ошибка при сбросе профиля: ' + error.message);
    }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function showToast(message) {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.textContent = message;
        toast.className = "show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
