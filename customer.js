/**
 * customer.js - ตรรกะฝั่งลูกค้า (Advanced Feature Pack)
 */

let tableId = new URLSearchParams(window.location.search).get('table') || '1';
let cart = [];
let isChatOpen = false;
let isIssueOpen = false;
let currentLanguage = 'th';
let activePromo = null;
let currentRating = 5;
let activeOrderForPayment = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth('customer.html')) return;

    document.getElementById('table-info').innerText = `โต๊ะ : ${tableId}`;
    setupCommonSync('customer', tableId, renderAll);

    // Initial Lang
    document.getElementById('lang-switcher').value = currentLanguage;
    applyLanguageUI();
});

function renderAll() {
    renderMenusAtCustomer();
    renderMyOrders();
    if (isChatOpen) renderChatAtCustomer();
    if (isIssueOpen) renderMyIssues();
    updateCartBadge();
    updateCartUIAtCustomer();
}

// --- Multi-language ---

function toggleLanguage(val) {
    currentLanguage = val;
    applyLanguageUI();
    renderAll();
}

function applyLanguageUI() {
    document.querySelectorAll('[data-en]').forEach(el => {
        el.innerText = currentLanguage === 'en' ? el.getAttribute('data-en') : el.innerText;
    });
}

// --- Menu Rendering (Stock Aware) ---

function renderMenusAtCustomer() {
    const menus = getMenus();
    const container = document.getElementById('menu-container');
    if (!container) return;

    container.innerHTML = menus.map(menu => {
        const isSoldOut = menu.stock <= 0;
        return `
            <div class="card fade-in" style="padding: 10px; position: relative;">
                <img src="${menu.image}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 12px; filter: ${isSoldOut ? 'grayscale(1)' : 'none'}">
                ${isSoldOut ? '<div class="badge badge-danger" style="position: absolute; top: 20px; left: 20px;">หมด (SOLD OUT)</div>' : ''}
                <div class="mt-2">
                    <strong>${menu.name}</strong>
                    <div class="flex-between">
                        <span class="text-primary">${menu.price}฿</span>
                        <button class="btn btn-primary btn-sm" onclick="addToCartAtCustomer(${menu.id})" ${isSoldOut ? 'disabled' : ''}>
                            <i class="fas fa-plus"></i> ${currentLanguage === 'en' ? 'Add' : 'เพิ่ม'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- Cart & Promo ---

function addToCartAtCustomer(id) {
    const menus = getMenus();
    const menu = menus.find(m => m.id === id);
    if (!menu) return;

    const existing = cart.find(i => i.id === id);
    if (existing) {
        if (existing.qty >= menu.stock) return alert('ขออภัย สต็อกไม่พอครับ');
        existing.qty++;
    } else {
        cart.push({ ...menu, qty: 1 });
    }
    updateCartUIAtCustomer();
    updateCartBadge();
}

function updateCartUIAtCustomer() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    container.innerHTML = cart.map((item, idx) => `
        <div class="flex-between mb-2">
            <div><strong>${item.name}</strong><br><small>${item.price}฿ x ${item.qty}</small></div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <button class="btn btn-sm" onclick="changeQtyAtCustomer(${idx}, -1)">-</button>
                <span>${item.qty}</span>
                <button class="btn btn-sm" onclick="changeQtyAtCustomer(${idx}, 1)">+</button>
            </div>
        </div>
    `).join('');

    const rawTotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    let finalTotal = rawTotal;

    if (activePromo) {
        document.getElementById('cart-total-raw').innerText = `${rawTotal}฿`;
        document.getElementById('cart-total-raw').style.display = 'inline';
        const disc = activePromo.type === 'percent' ? (rawTotal * activePromo.value / 100) : activePromo.value;
        finalTotal = rawTotal - disc;
    } else {
        document.getElementById('cart-total-raw').style.display = 'none';
    }

    document.getElementById('cart-total').innerText = `${finalTotal}฿`;
}

function applyPromoCode() {
    const input = document.getElementById('promo-input');
    const msg = document.getElementById('promo-msg');
    const val = input.value.trim();

    if (!val) return;

    // Hardcode some promos for demo
    const promos = [
        { code: 'KRUA10', type: 'percent', value: 10, minSpend: 200 },
        { code: 'SARAN50', type: 'flat', value: 50, minSpend: 300 }
    ];

    const p = promos.find(item => item.code.toUpperCase() === val.toUpperCase());
    const rawTotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);

    if (p) {
        if (rawTotal < p.minSpend) {
            msg.innerText = `ขั้นต่ำ ${p.minSpend}฿ ครับ`;
            msg.style.color = 'red';
        } else {
            activePromo = p;
            msg.innerText = `ใช้โค้ดลดเลิก! ลดไป ${p.type === 'percent' ? p.value + '%' : p.value + '฿'}`;
            msg.style.color = 'green';
            updateCartUIAtCustomer();
        }
    } else {
        msg.innerText = 'รหัสถไม่ถูกต้อง';
        msg.style.color = 'red';
    }
    msg.style.display = 'block';
}

function updateCartBadge() {
    const count = cart.reduce((sum, i) => sum + i.qty, 0);
    document.getElementById('cart-count').innerText = count;
}

function toggleCart() {
    const el = document.getElementById('cart-modal');
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    if (el.style.display === 'flex') updateCartUIAtCustomer();
}

function handleConfirmOrder() {
    if (cart.length === 0) return alert('เลือกอาหารก่อนครับ');
    const order = createOrder(tableId, cart);
    if (order) {
        cart = [];
        activePromo = null;
        toggleCart();
        alert('ส่งออเดอร์เข้าครัวแล้วครับ!');
    }
}

// --- Payment Simulation ---

function handlePayOrder(id) {
    const { orders } = getAllData();
    activeOrderForPayment = orders.find(o => o.id === id);
    if (!activeOrderForPayment) return;

    document.getElementById('pay-amount-text').innerText = `ยอดชำระ: ${activeOrderForPayment.finalPrice}฿`;
    document.getElementById('qr-image').src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PROMPTPAY_${activeOrderForPayment.finalPrice}_${Date.now()}`;
    document.getElementById('payment-modal').style.display = 'flex';
}

function confirmPaymentSimulation() {
    updateOrderStatus(activeOrderForPayment.id, 'paid', 'ชำระเงินผ่าน QR จำลอง');
    document.getElementById('payment-modal').style.display = 'none';

    // Open review
    document.getElementById('review-modal').style.display = 'flex';
}

// --- Reviews ---

function setRating(r) {
    currentRating = r;
    const stars = document.getElementById('star-rating').children;
    for (let i = 0; i < 5; i++) {
        stars[i].className = i < r ? 'fas fa-star' : 'far fa-star';
    }
}

function handleSaveReview() {
    const comment = document.getElementById('review-comment').value;
    submitReview(activeOrderForPayment.id, currentRating, comment);
    document.getElementById('review-modal').style.display = 'none';
    alert('ขอบคุณสำหรับคำแนะนำครับ!');
}

function renderMyOrders() {
    const { orders } = getAllData();
    const myOrders = orders.filter(o => o.table == tableId && (!o.paid || (Date.now() - o.paymentTime < 300000)));
    const section = document.getElementById('active-orders-section');
    const container = document.getElementById('my-orders-list');

    if (myOrders.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    container.innerHTML = myOrders.map(o => `
        <div class="card mb-2" style="background: rgba(255,255,255,0.4);">
            <div class="flex-between">
                <strong>ID: ${o.id}</strong>
                <span class="badge badge-${o.status}">${getStatusTextThai(o.status)}</span>
            </div>
            <div class="flex-between mt-1">
                <small>${o.items.map(i => `${i.name} x${i.qty}`).join(', ')}</small>
                <strong>${o.finalPrice}฿</strong>
            </div>
            ${o.status === 'ready' && !o.paid ? `<button class="btn btn-success mt-1" style="width: 100%" onclick="handlePayOrder('${o.id}')">ชำระเงิน</button>` : ''}
        </div>
    `).join('');
}

// --- Existing Chat/Issue Logic (Simplified for brevity) ---
function toggleChat() {
    isChatOpen = !isChatOpen;
    document.getElementById('chat-modal').style.display = isChatOpen ? 'flex' : 'none';
    if (isChatOpen) renderChatAtCustomer();
}
function handleSendMessageAtCustomer() {
    const input = document.getElementById('chat-input');
    if (input.value.trim()) { sendMessage(tableId, 'customer', input.value.trim()); input.value = ''; renderChatAtCustomer(); }
}
function renderChatAtCustomer() {
    const { messages } = getAllData();
    document.getElementById('chat-box').innerHTML = messages.filter(m => m.table == tableId).map(m => `<div class="chat-msg"><div class="msg-content ${m.sender === 'customer' ? 'msg-customer' : 'msg-staff'}">${m.text}</div></div>`).join('');
}
function openIssueModal() {
    isIssueOpen = !isIssueOpen;
    document.getElementById('issue-modal').style.display = isIssueOpen ? 'flex' : 'none';
}
function handleSubmitIssue() {
    const t = document.getElementById('issue-text');
    if (t.value.trim()) { addIssue(tableId, t.value.trim()); t.value = ''; alert('ส่งแล้ว'); }
}
function handleCallStaff() {
    addNotification('staff', 'call', `โต๊ะ ${tableId} เรียกพนักงาน`, null, tableId);
    alert('เรียกแล้วครับ');
}
function changeQtyAtCustomer(idx, delta) {
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    updateCartUIAtCustomer();
    updateCartBadge();
}
function scrollToBottom(id) { const el = document.getElementById(id); el.scrollTop = el.scrollHeight; }
