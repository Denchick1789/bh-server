// === ЗАЩИТА И ПРОВЕРКА ДОСТУПА ===
function checkAuth() {
    if (sessionStorage.getItem('bh_admin_access') === 'granted') {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        loadAllData();
    } else {
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('adminContent').style.display = 'none';
    }
}

function login() {
    const password = document.getElementById('adminPassword').value;
    if (password === "bh2026") { 
        sessionStorage.setItem('bh_admin_access', 'granted');
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        document.getElementById('loginError').style.display = 'none';
        loadAllData();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

function loadAllData() {
    db.ref('promoCodes').on('value', (snapshot) => { renderPromoList(snapshot.val() || {}); });
    db.ref('referrals').on('value', (snapshot) => { renderAdminStats(snapshot.val() || {}); });
    db.ref('transactions').orderByChild('timestamp').limitToLast(20).on('value', (snapshot) => { renderTransactions(snapshot.val() || {}); });
    db.ref('news').on('value', (snapshot) => { renderAdminNews(snapshot.val() || {}); });
    db.ref('gallery').on('value', (snapshot) => { renderAdminGallery(snapshot.val() || {}); });
}

// === ПРОМОКОДЫ ===
function createPromoCode() {
    const code = document.getElementById('adminPromoCode').value.trim().toUpperCase();
    const discount = parseInt(document.getElementById('adminPromoDiscount').value);
    if (!code || isNaN(discount) || discount < 1 || discount > 99) { alert('Введите корректные данные!'); return; }
    
    const password = prompt('Введите пароль для подтверждения:');
    if (password !== "bh2026") { alert('Неверный пароль!'); return; }
    
    db.ref(`promoCodes/${code}`).set({ code, discount, createdAt: Date.now() })
        .then(() => { document.getElementById('adminPromoCode').value = ''; document.getElementById('adminPromoDiscount').value = '5'; alert(`✅ Промокод ${code} создан!`); })
        .catch((e) => alert('Ошибка: ' + e.message));
}

function deletePromoCode(code) {
    const password = prompt('Введите пароль для удаления:');
    if (password !== "bh2026") { alert('Неверный пароль!'); return; }
    if (confirm(`Удалить промокод ${code}?`)) db.ref(`promoCodes/${code}`).remove();
}

function renderPromoList(codes) {
    const list = document.getElementById('promoList');
    list.innerHTML = '';
    if (Object.keys(codes).length === 0) { list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Нет промокодов</p>'; return; }
    Object.values(codes).forEach(item => {
        const div = document.createElement('div');
        div.className = 'promo-item';
        div.innerHTML = `<span><b style="color: var(--accent);">${item.code}</b> (-${item.discount}%)</span><button class="delete-btn" onclick="deletePromoCode('${item.code}')">Удалить</button>`;
        list.appendChild(div);
    });
}

// === ДОНАТЫ ===
async function confirmDonation() {
    const referralName = document.getElementById('adminReferralName').value.trim().toUpperCase();
    const amount = parseInt(document.getElementById('adminDonationAmount').value);
    if (!referralName || isNaN(amount) || amount <= 0) { alert('Введите корректные данные!'); return; }
    
    const refSnapshot = await db.ref(`referrals/${referralName}`).once('value');
    if (!refSnapshot.exists()) {
        if (!confirm(`Реферал "${referralName}" не найден. Создать и начислить комиссию?`)) return;
        await db.ref(`referrals/${referralName}`).set({ clicks: 0, earnings: 0, donations: 0, createdAt: Date.now() });
    }
    
    const commission = Math.round(amount * 10 / 100);
    const refData = await db.ref(`referrals/${referralName}`).once('value');
    const data = refData.val() || { earnings: 0, donations: 0 };
    
    await db.ref(`referrals/${referralName}/earnings`).set(data.earnings + commission);
    await db.ref(`referrals/${referralName}/donations`).set(data.donations + 1);
    await db.ref(`transactions`).push({ referral: referralName, amount, commission, timestamp: Date.now() });
    
    document.getElementById('adminReferralName').value = '';
    document.getElementById('adminDonationAmount').value = '';
    alert(`✅ Комиссия ${commission} ₽ начислена игроку ${referralName}!`);
}

function renderTransactions(transactions) {
    const list = document.getElementById('transactionsList');
    list.innerHTML = '';
    const sorted = Object.values(transactions).sort((a, b) => b.timestamp - a.timestamp);
    if (sorted.length === 0) { list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Нет транзакций</p>'; return; }
    sorted.forEach(item => {
        const date = new Date(item.timestamp).toLocaleString('ru-RU');
        const div = document.createElement('div');
        div.className = 'promo-item';
        div.innerHTML = `<div><b style="color: var(--accent);">${item.referral}</b> <span style="color: var(--text-secondary);">| Донат: ${item.amount}₽ | Комиссия: ${item.commission}₽</span><br><small style="color: var(--text-secondary);">${date}</small></div>`;
        list.appendChild(div);
    });
}

// === СТАТИСТИКА ===
function renderAdminStats(referrals) {
    let totalClicks = 0, totalEarnings = 0;
    Object.values(referrals).forEach(ref => { totalClicks += ref.clicks || 0; totalEarnings += ref.earnings || 0; });
    document.getElementById('statReferrals').textContent = Object.keys(referrals).length;
    document.getElementById('statClicks').textContent = totalClicks;
    document.getElementById('statEarnings').textContent = `${totalEarnings} ₽`;
    db.ref('transactions').once('value', (s) => { document.getElementById('statTransactions').textContent = s.numChildren(); });
}

// === УПРАВЛЕНИЕ НОВОСТЯМИ ===
async function adminPublishNews() {
    const title = document.getElementById('adminNewsTitle').value.trim();
    const content = document.getElementById('adminNewsContent').value.trim();
    const image = document.getElementById('adminNewsImage').value.trim();
    if (!title || !content) { alert('Заполните заголовок и текст!'); return; }
    
    try {
        await db.ref('news').push({ title, content, image: image || null, timestamp: Date.now() });
        document.getElementById('adminNewsTitle').value = '';
        document.getElementById('adminNewsContent').value = '';
        document.getElementById('adminNewsImage').value = '';
        alert('✅ Новость опубликована!');
    } catch (error) { alert('Ошибка: ' + error.message); }
}

async function adminDeleteNews(id) {
    if (confirm('Удалить эту новость?')) await db.ref(`news/${id}`).remove();
}

function renderAdminNews(news) {
    const list = document.getElementById('adminNewsList');
    if (!list) return;
    list.innerHTML = '';
    const sorted = Object.entries(news).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
    if (sorted.length === 0) { list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Новостей нет</p>'; return; }
    sorted.forEach(([id, item]) => {
        const date = new Date(item.timestamp || Date.now()).toLocaleDateString('ru-RU');
        const div = document.createElement('div');
        div.className = 'promo-item';
        div.innerHTML = `<div><b style="color: var(--accent);">${item.title}</b><br><small style="color: var(--text-secondary);">${date} | ${item.content.substring(0, 50)}...</small></div><button class="delete-btn" onclick="adminDeleteNews('${id}')">Удалить</button>`;
        list.appendChild(div);
    });
}

// === УПРАВЛЕНИЕ ГАЛЕРЕЕЙ ===
async function adminAddGallery() {
    const url = document.getElementById('adminGalleryUrl').value.trim();
    const caption = document.getElementById('adminGalleryCaption').value.trim();
    if (!url) { alert('Введите ссылку на изображение!'); return; }
    
    try {
        await db.ref('gallery').push({ url, caption: caption || null, timestamp: Date.now() });
        document.getElementById('adminGalleryUrl').value = '';
        document.getElementById('adminGalleryCaption').value = '';
        alert('✅ Фото добавлено!');
    } catch (error) { alert('Ошибка: ' + error.message); }
}

async function adminDeleteGallery(id) {
    if (confirm('Удалить это фото?')) await db.ref(`gallery/${id}`).remove();
}

function renderAdminGallery(images) {
    const list = document.getElementById('adminGalleryList');
    if (!list) return;
    list.innerHTML = '';
    const sorted = Object.entries(images).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
    if (sorted.length === 0) { list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Галерея пуста</p>'; return; }
    sorted.forEach(([id, item]) => {
        const div = document.createElement('div');
        div.className = 'promo-item';
        div.innerHTML = `<div style="display: flex; align-items: center; gap: 1rem;"><img src="${item.url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;" onerror="this.src='https://via.placeholder.com/60'"><span>${item.caption || 'Без подписи'}</span></div><button class="delete-btn" onclick="adminDeleteGallery('${id}')">Удалить</button>`;
        list.appendChild(div);
    });
}

// === ЗАПУСК ===
checkAuth();
