/**
 * storage.js - "ครัวรีเทิน" Single Source of Truth (Advanced Version)
 */

const DB_KEYS = {
    MENUS: 'krua_menus_v2',
    ORDERS: 'krua_orders_v2',
    NOTIFICATIONS: 'krua_notifications_v2',
    MESSAGES: 'krua_messages_v2',
    ISSUES: 'krua_issues_v2',
    CONFIG: 'krua_config_v2',
    SESSION: 'krua_session',
    USERS: 'krua_users_v2',       // Dynamic Users
    PROMOS: 'krua_promos_v2',     // Discounts
    REVIEWS: 'krua_reviews_v2',   // Feedback
    LANG: 'krua_lang'             // Preferred Language
};

// --- Core Data Layer ---

function getData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : (key === DB_KEYS.USERS ? [] : []);
    } catch (e) {
        console.error(`Error reading ${key}:`, e);
        return [];
    }
}

function setData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('krua_sync', { detail: { key, data } }));
}

function getAllData() {
    return {
        menus: getData(DB_KEYS.MENUS),
        orders: getData(DB_KEYS.ORDERS),
        notifications: getData(DB_KEYS.NOTIFICATIONS),
        messages: getData(DB_KEYS.MESSAGES),
        issues: getData(DB_KEYS.ISSUES),
        config: getData(DB_KEYS.CONFIG),
        users: getData(DB_KEYS.USERS),
        promos: getData(DB_KEYS.PROMOS),
        reviews: getData(DB_KEYS.REVIEWS)
    };
}

// --- Menu & Stock Management ---

function getMenus() {
    const menus = getData(DB_KEYS.MENUS);
    // Ensure stock exists
    return menus.map(m => ({ ...m, stock: m.stock !== undefined ? m.stock : 99 }));
}

function updateMenuStock(id, newStock) {
    const menus = getMenus();
    const idx = menus.findIndex(m => m.id === id);
    if (idx !== -1) {
        menus[idx].stock = Math.max(0, parseInt(newStock));
        setData(DB_KEYS.MENUS, menus);
    }
}

// --- Order Management (With Stock Deduction) ---

function createOrder(table, items) {
    const v = validateOrderItems(items);
    if (!v.valid) { alert(v.message); return null; }

    // Check Stock
    const menus = getMenus();
    for (let item of items) {
        const menu = menus.find(m => m.id === item.id);
        if (menu && menu.stock < item.qty) {
            alert(`ขออภัย : ${item.name} มีสต็อกไม่เพียงพอ (เหลือ ${menu.stock})`);
            return null;
        }
    }

    const orders = getData(DB_KEYS.ORDERS);
    const totalPrice = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const user = getCurrentUser();

    const newOrder = {
        id: `ORD-${Date.now().toString().slice(-6)}`,
        table: parseInt(table),
        items: items.map(i => ({ ...i, status: 'waiting' })),
        status: 'waiting',
        totalPrice: totalPrice,
        finalPrice: totalPrice, // Price after promo
        promoCode: null,
        customerUser: user ? user.username : 'guest',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        paymentTime: null,
        paid: false,
        history: [{ status: 'waiting', time: Date.now(), note: 'ลูกค้าสั่งอาหาร' }]
    };

    // Deduct Stock
    items.forEach(item => {
        const mIdx = menus.findIndex(m => m.id === item.id);
        if (mIdx !== -1) menus[mIdx].stock -= item.qty;
    });
    setData(DB_KEYS.MENUS, menus);

    orders.push(newOrder);
    setData(DB_KEYS.ORDERS, orders);

    addNotification('staff', 'order', `โต๊ะ ${table} สั่งอาหารใหม่! (${totalPrice}฿)`, newOrder.id);
    return newOrder;
}

function updateOrderStatus(orderId, newStatus, note = '') {
    const orders = getData(DB_KEYS.ORDERS);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
        const order = orders[idx];
        order.status = newStatus;
        order.updatedAt = Date.now();
        order.history.push({ status: newStatus, time: Date.now(), note });

        if (newStatus === 'paid') {
            order.paid = true;
            order.paymentTime = Date.now();
            addNotification('owner', 'payment', `โต๊ะ ${order.table} ชำระเงิน ${order.finalPrice}฿`, orderId);
        } else if (newStatus === 'ready') {
            addNotification('customer', 'ready', `อาหารโต๊ะ ${order.table} พร้อมเสิร์ฟแล้ว!`, orderId, order.table);
        }
        setData(DB_KEYS.ORDERS, orders);
    }
}

// --- Promotions ---

function getPromos() {
    return getData(DB_KEYS.PROMOS);
}

function validatePromo(code, currentTotal) {
    const promos = getPromos();
    const p = promos.find(item => item.code.toUpperCase() === code.toUpperCase() && item.active);
    if (!p) return { success: false, message: 'รหัสส่วนลดไม่ถูกต้องหรือหมดอายุ' };
    if (currentTotal < p.minSpend) return { success: false, message: `ขั้นต่ำในการใช้รหัสคือ ${p.minSpend}฿` };

    let discount = p.type === 'percent' ? (currentTotal * p.value / 100) : p.value;
    return { success: true, discount: Math.min(discount, currentTotal), code: p.code };
}

// --- User & Authentication (Dynamic DB) ---

const FIXED_ACCOUNTS = {
    'staff_kds': { pass: 'kds5678', role: 'staff', scope: ['staff.html'] },
    'admin_saran': { pass: 'saran9999', role: 'owner', scope: ['owner.html', 'customer.html', 'staff.html'] }
};

function handleLogin(username, password) {
    // 1. Check Fixed
    let account = FIXED_ACCOUNTS[username];

    // 2. Check Dynamic
    if (!account) {
        const users = getData(DB_KEYS.USERS);
        const dynamicUser = users.find(u => u.username === username && u.password === password);
        if (dynamicUser) {
            account = { role: 'customer', scope: ['customer.html'], nickname: dynamicUser.nickname };
        }
    } else {
        // For fixed, verify pass
        if (account.pass !== password) account = null;
    }

    if (account) {
        const sessionUser = {
            username: username,
            role: account.role,
            scope: account.scope,
            nickname: account.nickname || username,
            loginTime: Date.now()
        };
        localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(sessionUser));
        return { success: true, user: sessionUser };
    }
    return { success: false, message: 'Username หรือ Password ไม่ถูกต้อง' };
}

function handleRegister(username, password, nickname) {
    const users = getData(DB_KEYS.USERS);
    if (users.find(u => u.username === username) || FIXED_ACCOUNTS[username]) {
        return { success: false, message: 'Username นี้มีผู้ใช้งานแล้ว' };
    }
    const newUser = { username, password, nickname, createdAt: Date.now() };
    users.push(newUser);
    setData(DB_KEYS.USERS, users);
    return { success: true };
}

function handleLogout() {
    localStorage.removeItem(DB_KEYS.SESSION);
    window.location.href = 'login.html';
}

function getCurrentUser() {
    const session = localStorage.getItem(DB_KEYS.SESSION);
    return session ? JSON.parse(session) : null;
}

function checkAuth(requiredPage) {
    const user = getCurrentUser();
    if (!user) {
        // Use hash/search to keep table info if any
        window.location.href = 'login.html' + window.location.search;
        return false;
    }
    if (!user.scope.includes(requiredPage)) {
        alert('คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้');
        window.location.href = user.scope[0];
        return false;
    }
    return true;
}

// --- Reviews ---

function submitReview(orderId, rating, comment) {
    const reviews = getData(DB_KEYS.REVIEWS);
    const user = getCurrentUser();
    reviews.push({
        id: Date.now(),
        orderId,
        username: user ? user.username : 'guest',
        rating: parseInt(rating),
        comment,
        createdAt: Date.now()
    });
    setData(DB_KEYS.REVIEWS, reviews);
}

// --- Notifications ---

function addNotification(role, type, message, refId = null, targetTable = null) {
    const notifications = getData(DB_KEYS.NOTIFICATIONS);
    notifications.unshift({
        id: Date.now(),
        role, type, message, refId, targetTable,
        read: false,
        createdAt: Date.now()
    });
    setData(DB_KEYS.NOTIFICATIONS, notifications.slice(0, 100));
}

function getNotificationsByRole(role, table = null) {
    const all = getData(DB_KEYS.NOTIFICATIONS);
    return all.filter(n => {
        if (n.role === 'all') return true;
        if (n.role === role) {
            if (role === 'customer' && table) return n.targetTable == table;
            return true;
        }
        return false;
    });
}

function markNotiAsRead(id) {
    const all = getData(DB_KEYS.NOTIFICATIONS);
    const idx = all.findIndex(n => n.id === id);
    if (idx !== -1) {
        all[idx].read = true;
        setData(DB_KEYS.NOTIFICATIONS, all);
    }
}

// --- Chat & Issues ---

function sendMessage(table, sender, text) {
    const messages = getData(DB_KEYS.MESSAGES);
    const msg = { id: Date.now(), table, sender, text, time: Date.now() };
    messages.push(msg);
    setData(DB_KEYS.MESSAGES, messages);
    const targetRole = sender === 'customer' ? 'staff' : 'customer';
    addNotification(targetRole, 'message', `${sender === 'customer' ? 'โต๊ะ ' + table : 'ครัว'}: ${text}`, table, table);
}

function addIssue(table, message) {
    const issues = getData(DB_KEYS.ISSUES);
    const newIssue = { id: Date.now(), table, message, status: 'pending', response: '', createdAt: Date.now() };
    issues.push(newIssue);
    setData(DB_KEYS.ISSUES, issues);
    addNotification('owner', 'issue', `โต๊ะ ${table} แจ้งปัญหา: ${message}`, newIssue.id);
}

function resolveIssue(issueId, response) {
    const issues = getData(DB_KEYS.ISSUES);
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
        issues[idx].status = 'resolved';
        issues[idx].response = response;
        setData(DB_KEYS.ISSUES, issues);
        addNotification('customer', 'issue', `เจ้าของตอบกลับปัญหาโต๊ะ ${issues[idx].table}: ${response}`, issueId, issues[idx].table);
    }
}

// --- System Utils ---

function initKruaSystem(renderCallback) {
    window.addEventListener('storage', (e) => {
        if (Object.values(DB_KEYS).includes(e.key)) renderCallback();
    });
    window.addEventListener('krua_sync', renderCallback);
    setInterval(renderCallback, 3000); // Polling sync
}

function validateOrderItems(items) {
    if (!items || items.length === 0) return { valid: false, message: 'กรุณาเลือกอาหาร' };
    for (let item of items) {
        if (!item.name || item.qty <= 0) return { valid: false, message: 'รายการอาหารไม่ถูกต้อง' };
    }
    return { valid: true };
}

// Helper for UI
function getStatusTextThai(status) {
    const map = { waiting: 'รอคิว', cooking: 'กำลังปรุง', ready: 'พร้อมเสิร์ฟ', served: 'เสิร์ฟแล้ว', paid: 'จ่ายแล้ว' };
    return map[status] || status;
}
