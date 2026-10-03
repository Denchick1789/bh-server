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
    db.ref('promoCodes').on('value', (snapshot) => {
        const codes = snapshot.val() || {};
        renderPromoList(codes);
    });

    db.ref('referrals').on('value', (snapshot) => {
        const referrals = snapshot.val() || {};
        renderAdminStats(referrals);
    });

    db.ref('transactions').orderByChild('timestamp').limitToLast(20).on('value', (snapshot) => {
        const transactions = snapshot.val() || {};
        renderTransactions(transactions);
    });
}

// === ПРОМОКОДЫ (С ПРОВЕРКОЙ ПАРОЛЯ) ===
function createPromoCode() {
    const code = document.getElementById('adminPromoCode').value.trim().toUpperCase();
    const discount = parseInt(document.getElementById('adminPromoDiscount').value);
    
    if (!code || isNaN(discount) || discount < 1 || discount > 99) {
        alert('Введите корректные данные!');
        return;
    }
    
    // Дополнительная проверка пароля перед созданием
    const password = prompt('Введите пароль администратора для подтверждения:');
    if (password !== "bh2026") {
        alert('Неверный пароль! Промокод не создан.');
        return;
    }
    
    db.ref(`promoCodes/${code}`).set({
        code: code,
        discount: discount,
        createdAt: Date.now()
    }).then(() => {
        document.getElementById('adminPromoCode').value = '';
        document.getElementById('adminPromoDiscount').value = '5';
        alert(`✅ Промокод ${code} создан!`);
    }).catch((error) => {
        console.error('Ошибка создания промокода:', error);
        alert('Ошибка: ' + error.message);
    });
}

function deletePromoCode(code) {
    const password = prompt('Введите пароль для удаления промокода:');
    if (password !== "bh2026") {
        alert('Неверный пароль!');
        return;
    }
    
    if (confirm(`Удалить промокод ${code}?`)) {
        db.ref(`promoCodes/${code}`).remove();
    }
}

function renderPromoList(codes) {
    const list = document.getElementById('promoList');
    list.innerHTML = '';
    
    if (Object.keys(codes).length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Промокодов пока нет</p>';
        return;
    }
    
    Object.values(codes).forEach(item => {
        const div = document.createElement('div');
        div.className = 'promo-item';
        div.innerHTML = `
            <span><b style="color: var(--accent);">${item.code}</b> (-${item.discount}%)</span>
            <button class="delete-btn" onclick="deletePromoCode('${item.code}')">Удалить</button>
        `;
        list.appendChild(div);
    });
}

// === ДОНАТЫ И КОМИССИИ ===
async function confirmDonation() {
    const referralName = document.getElementById('adminReferralName').value.trim().toUpperCase();
    const amount = parseInt(document.getElementById('adminDonationAmount').value);
    
    if (!referralName || isNaN(amount) || amount <= 0) {
        alert('Введите корректные данные!');
        return;
    }
    
    const refSnapshot = await db.ref(`referrals/${referralName}`).once('value');
    if (!refSnapshot.exists()) {
        if (!confirm(`Реферал "${referralName}" не найден. Создать и начислить комиссию?`)) {
            return;
        }
        await db.ref(`referrals/${referralName}`).set({
            clicks: 0,
            earnings: 0,
            donations: 0,
            createdAt: Date.now()
        });
    }
    
    const commission = Math.round(amount * 10 / 100);
    
    const refData = await db.ref(`referrals/${referralName}`).once('value');
    const data = refData.val() || { earnings: 0, donations: 0 };
    
    await db.ref(`referrals/${referralName}/earnings`).set(data.earnings + commission);
    await db.ref(`referrals/${referralName}/donations`).set(data.donations + 1);
    
    await db.ref(`transactions`).push({
        referral: referralName,
        amount: amount,
        commission: commission,
        timestamp: Date.now()
    });
    
    document.getElementById('adminReferralName').value = '';
    document.getElementById('adminDonationAmount').value = '';
    
    alert(`✅ Комиссия ${commission} ₽ начислена игроку ${referralName}!`);
}

function renderTransactions(transactions) {
    const list = document.getElementById('transactionsList');
    list.innerHTML = '';
    
    const sorted = Object.values(transactions).sort((a, b) => b.timestamp - a.timestamp);
    
    if (sorted.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Транзакций пока нет</p>';
        return;
    }
    
    sorted.forEach(item => {
        const date = new Date(item.timestamp).toLocaleString('ru-RU');
        const div = document.createElement('div');
        div.className = 'promo-item';
        div.innerHTML = `
            <div>
                <b style="color: var(--accent);">${item.referral}</b> 
                <span style="color: var(--text-secondary);">| Донат: ${item.amount}₽ | Комиссия: ${item.commission}₽</span>
                <br><small style="color: var(--text-secondary);">${date}</small>
            </div>
        `;
        list.appendChild(div);
    });
}

// === СТАТИСТИКА ===
function renderAdminStats(referrals) {
    let totalClicks = 0;
    let totalEarnings = 0;
    
    Object.values(referrals).forEach(ref => {
        totalClicks += ref.clicks || 0;
        totalEarnings += ref.earnings || 0;
    });
    
    document.getElementById('statReferrals').textContent = Object.keys(referrals).length;
    document.getElementById('statClicks').textContent = totalClicks;
    document.getElementById('statEarnings').textContent = `${totalEarnings} ₽`;
    
    db.ref('transactions').once('value', (snapshot) => {
        document.getElementById('statTransactions').textContent = snapshot.numChildren();
    });
}

// === ЗАПУСК ===
checkAuth();
