// === ЗАЩИТА И ПРОВЕРКА ДОСТУПА ===

// Проверяем авторизацию при загрузке страницы
function checkAuth() {
    // Если мы пришли с главного сайта после ввода кода, флаг уже есть
    if (sessionStorage.getItem('bh_admin_access') === 'granted') {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        loadAllData();
    } else {
        // Если кто-то открыл admin.html напрямую, показываем экран ввода пароля
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('adminContent').style.display = 'none';
    }
}

function login() {
    const password = document.getElementById('adminPassword').value;
    // Запасной пароль на случай прямого входа (можешь изменить его)
    if (password === "den1789") { 
        sessionStorage.setItem('bh_admin_access', 'granted');
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        document.getElementById('loginError').style.display = 'none';
        loadAllData();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

// Остальной код admin.js (createPromoCode, deletePromoCode и т.д.) оставляем без изменений!
// ...
