/**
 * login.js - ตรรกะการเข้าสู่ระบบแบบบัญชีผู้ใช้
 */

document.addEventListener('DOMContentLoaded', () => {
    // ตรวจสอบว่าล็อกอินอยู่แล้วหรือไม่
    const user = getCurrentUser();
    if (user) {
        window.location.href = user.scope[0];
    }

    // ดักจับปุ่ม Enter
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performLogin();
    });
});

function performLogin() {
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;

    if (!user || !pass) {
        showError('กรุณากรอก Username และ Password');
        return;
    }

    const result = handleLogin(user, pass);

    if (result.success) {
        // ไปยังหน้าแรกที่บัญชีนั้นเข้าถึงได้
        window.location.href = result.user.scope[0];
    } else {
        showError(result.message);
    }
}

function showError(msg) {
    const errorEl = document.getElementById('login-error');
    errorEl.innerText = msg;
    errorEl.style.display = 'block';
}
