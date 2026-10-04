const PRICES = [
    { days: "10 дней", price: 50 },
    { days: "30 дней", price: 143 },
    { days: "90 дней", price: 406 },
    { days: "180 дней", price: 772 },
    { days: "365 дней", price: 1487 }
];

const ADMIN_CODE = "BIGBOB1488CHERTOLET";

let activeDiscount = 0;
let currentUser = null;
let userProfile = null;
let currentNewsId = null;

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof firebase === 'undefined' || typeof db === 'undefined') {
        console.error(' Firebase не подключен!');
        return;
    }
    
    renderPriceCards();
    await checkReferralLink();
    loadPromoCodes();
    loadNews();
    loadGallery();
    
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            try { await loadUserProfile(); } 
            catch (error) { console.error('Ошибка загрузки профиля:', error); }
        } else {
            currentUser = null;
            userProfile = null;
            updateUserInterface(false);
        }
    });
});

function renderPriceCards() {
    const grid = document.getElementById('pricingGrid');
    if (!grid) return;
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

// === АВТОРИЗАЦИЯ ===
function toggleAuth() { currentUser ? logout() : openAuthModal(); }
function openAuthModal() { document.getElementById('authModal').classList.add('active'); }
function closeAuthModal() { document.getElementById('authModal').classList.remove('active'); }

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then(() => { closeAuthModal(); showToast("Успешный вход!"); })
        .catch((error) => alert("Ошибка входа: " + error.message));
}

function logout() { firebase.auth().signOut().then(() => showToast("Вы вышли из аккаунта")); }

// === ПРОФИЛЬ ===
async function loadUserProfile() {
    const snapshot = await db.ref(`users/${currentUser.uid}`).once('value');
    if (snapshot.exists()) {
        userProfile = snapshot.val();
        updateUserInterface(true);
        loadReferralStats(userProfile.refCode);
    } else {
        updateUserInterface(false);
        openSetupModal();
    }
}

function openSetupModal() { document.getElementById('setupProfileModal').classList.add('active'); }
function closeSetupModal() { 
    document.getElementById('setupProfileModal').classList.remove('active'); 
    document.getElementById('setupError').style.display = 'none'; 
}

async function saveCustomProfile() {
    const nickname = document.getElementById('setupNickname').value.trim();
    let avatar = document.getElementById('setupAvatar').value.trim();
    const refCode = document.getElementById('setupRefCode').value.trim().toUpperCase();
    const errorEl = document.getElementById('setupError');

    if (!nickname || !refCode) { errorEl.textContent = "Заполните все поля!"; errorEl.style.display = 'block'; return; }
    if (refCode.length < 3 || !/^[A-Z0-9_]+$/.test(refCode)) { errorEl.textContent = "Код: латиница, цифры, '_' (мин. 3 символа)."; errorEl.style.display = 'block'; return; }

    const refCheck = await db.ref(`referrals/${refCode}`).once('value');
    if (refCheck.exists()) { errorEl.textContent = "Этот код уже занят!"; errorEl.style.display = 'block'; return; }

    if (!avatar) avatar = `https://mc-heads.net/avatar/${encodeURIComponent(nickname)}/100`;

    const newProfile = { uid: currentUser.uid, nickname, avatar, refCode, createdAt: Date.now() };
    await db.ref(`users/${currentUser.uid}`).set(newProfile);
    await db.ref(`referrals/${refCode}`).set({ clicks: 0, earnings: 0, donations: 0, ownerUid: currentUser.uid, createdAt: Date.now() });

    userProfile = newProfile;
    closeSetupModal();
    updateUserInterface(true);
    loadReferralStats(refCode);
    showToast("Профиль создан!");
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

// === РЕФЕРАЛКА ===
async function checkReferralLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
        localStorage.setItem('bh_referral', ref);
        const stats = await db.ref(`referrals/${ref}/clicks`).once('value');
        await db.ref(`referrals/${ref}/clicks`).set((stats.val() || 0) + 1);
        showToast(`Вы перешли по ссылке реферала!`);
    }
}

function loadReferralStats(refCode) {
    db.ref(`referrals/${refCode}`).on('value', (snapshot) => {
        const data = snapshot.val() || {};
        document.getElementById('referralCount').textContent = data.clicks || 0;
        document.getElementById('referralEarnings').textContent = `${data.earnings || 0} ₽`;
        document.getElementById('referralDonations').textContent = data.donations || 0;
    });
    document.getElementById('referralLink').value = `${window.location.origin}${window.location.pathname}?ref=${refCode}`;
}

function copyReferralLink() {
    const input = document.getElementById('referralLink');
    input.select(); document.execCommand('copy');
    showToast('Ссылка скопирована!');
}

// === АДМИН КОД ===
function checkAdminCode() {
    const input = document.getElementById('adminCodeInput').value.trim();
    const msgEl = document.getElementById('adminMessage');
    if (input === ADMIN_CODE) {
        sessionStorage.setItem('bh_admin_access', 'granted');
        msgEl.textContent = "✅ Код принят! Перенаправление...";
        msgEl.style.color = "var(--accent)";
        setTimeout(() => { window.location.href = 'admin.html'; }, 1000);
    } else {
        msgEl.textContent = " Неверный код!";
        msgEl.style.color = "var(--error)";
        setTimeout(() => { msgEl.textContent = ""; }, 3000);
    }
}

// === СБРОС ПРОФИЛЯ ===
async function resetProfile() {
    if (!confirm('⚠️ Удалить профиль и реферальный код? Статистика будет потеряна!')) return;
    if (!confirm('Точно удалить? Это нельзя отменить!')) return;
    
    try {
        await db.ref(`users/${currentUser.uid}`).remove();
        if (userProfile?.refCode) await db.ref(`referrals/${userProfile.refCode}`).remove();
        await firebase.auth().signOut();
        showToast('Профиль удален!');
        setTimeout(() => location.reload(), 2000);
    } catch (error) { alert('Ошибка: ' + error.message); }
}

// === НОВОСТИ И ГАЛЕРЕЯ (ТОЛЬКО ПРОСМОТР) ===
function loadNews() {
    const grid = document.getElementById('newsGrid');
    if (!grid) return;
    grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">Загрузка...</p>';
    
    db.ref('news').once('value').then((snapshot) => {
        const news = snapshot.val() || {};
        const sorted = Object.entries(news).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
        
        if (sorted.length === 0) {
            grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">Новостей пока нет</p>';
            return;
        }
        
        grid.innerHTML = '';
        sorted.forEach(([id, item]) => {
            const date = new Date(item.timestamp || Date.now()).toLocaleDateString('ru-RU');
            const card = document.createElement('div');
            card.className = 'news-card';
            let imageHtml = item.image ? `<img src="${item.image}" class="news-image" onerror="this.style.display='none'">` : '';
            
            card.innerHTML = `
                ${imageHtml}
                <div class="news-content">
                    <h3 class="news-title">${escapeHtml(item.title)}</h3>
                    <p class="news-text">${escapeHtml(item.content)}</p>
                    <div class="news-footer">
                        <span class="news-date">${date}</span>
                        <button class="news-comments-btn" onclick="openComments('${id}')">💬 ${item.comments ? Object.keys(item.comments).length : 0}</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }).catch(() => { grid.innerHTML = '<p style="color: var(--error); text-align: center; grid-column: 1/-1;">Ошибка загрузки</p>'; });
}

function loadGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">Загрузка...</p>';
    
    db.ref('gallery').once('value').then((snapshot) => {
        const images = snapshot.val() || {};
        const sorted = Object.entries(images).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
        
        if (sorted.length === 0) {
            grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">Галерея пуста</p>';
            return;
        }
        
        grid.innerHTML = '';
        sorted.forEach(([id, item]) => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            const caption = item.caption ? `<div class="gallery-caption">${escapeHtml(item.caption)}</div>` : '';
            div.innerHTML = `<img src="${item.url}" onclick="openLightbox('${item.url}')" onerror="this.parentElement.style.display='none'">${caption}`;
            grid.appendChild(div);
        });
    }).catch(() => { grid.innerHTML = '<p style="color: var(--error); text-align: center; grid-column: 1/-1;">Ошибка загрузки</p>'; });
}

function openLightbox(url) {
    let lightbox = document.getElementById('lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'lightbox';
        lightbox.className = 'lightbox';
        lightbox.onclick = () => lightbox.classList.remove('active');
        document.body.appendChild(lightbox);
    }
    lightbox.innerHTML = `<img src="${url}">`;
    lightbox.classList.add('active');
}

// === КОММЕНТАРИИ ===
function openComments(newsId) {
    currentNewsId = newsId;
    document.getElementById('commentsModal').classList.add('active');
    loadComments(newsId);
}

function closeCommentsModal() {
    document.getElementById('commentsModal').classList.remove('active');
    currentNewsId = null;
}

function loadComments(newsId) {
    const list = document.getElementById('commentsList');
    list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Загрузка...</p>';
    
    db.ref(`news/${newsId}/comments`).once('value').then((snapshot) => {
        const comments = snapshot.val() || {};
        const sorted = Object.entries(comments).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
        
        if (sorted.length === 0) {
            list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Комментариев пока нет</p>';
            return;
        }
        
        list.innerHTML = '';
        sorted.forEach(([id, item]) => {
            const date = new Date(item.timestamp || Date.now()).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(item.author || 'Гость')}</span>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-text">${escapeHtml(item.text)}</div>
            `;
            list.appendChild(div);
        });
    }).catch(() => { list.innerHTML = '<p style="color: var(--error); text-align: center;">Ошибка загрузки</p>'; });
}

async function postComment() {
    const text = document.getElementById('commentText').value.trim();
    const errorEl = document.getElementById('commentError');
    if (!text) { errorEl.textContent = 'Напишите комментарий!'; errorEl.style.display = 'block'; return; }
    if (!currentNewsId) return;
    
    const author = userProfile ? userProfile.nickname : 'Гость';
    try {
        await db.ref(`news/${currentNewsId}/comments`).push({ text, author, timestamp: Date.now() });
        document.getElementById('commentText').value = '';
        errorEl.style.display = 'none';
        showToast('Комментарий добавлен!');
        loadComments(currentNewsId);
    } catch (error) { errorEl.textContent = 'Ошибка: ' + error.message; errorEl.style.display = 'block'; }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) event.target.classList.remove('active');
}
