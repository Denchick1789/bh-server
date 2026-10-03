const ADMIN_PASSWORD = "den1pvp"; // придумай оочень сложный пароль

function checkAdminAccess() {
    const pass = prompt("Введите пароль администратора:");
    if (pass !== ADMIN_PASSWORD) {
        alert("Неверный пароль!");
        window.location.href = "index.html";
        return false;
    }
    return true;
}

// Вызови при загрузке
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAdminAccess()) return;
    // ... остальной код
});
