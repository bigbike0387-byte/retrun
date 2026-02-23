/**
 * staff.js - ตรรกะฝ่ายครัว/พนักงาน (ฉบับสมบูรณ์)
 */

let activeStaffChatTable = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth('staff.html')) return;

    // Initialize for 'staff' role
    setupCommonSync('staff', null, renderAllStaff);

    // Handle Chat Input Enter
    document.getElementById('kds-chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessageAtStaff();
    });
});

function renderAllStaff() {
    renderOrdersAtStaff();
    renderNotificationsAtStaff();
    if (activeStaffChatTable) renderChatAtStaff();
}

// --- Order Management ---

function renderOrdersAtStaff() {
    const { orders } = getAllData();
    const activeOrders = orders.filter(o => !o.paid); // Show everything not paid

    document.getElementById('kds-stats').innerText = `${activeOrders.filter(o => o.status === 'waiting').length} ออเดอร์กำลังรอ`;

    const container = document.getElementById('kds-orders-grid');
    container.innerHTML = activeOrders.map(o => `
        <div class="card fade-in" style="border-top: 5px solid var(--${o.status});">
            <div class="flex-between">
                <h3>โต๊ะ ${o.table}</h3>
                <span class="badge badge-${o.status}">${getStatusTextThai(o.status)}</span>
            </div>
            <div class="mt-2" style="background: rgba(0,0,0,0.03); padding: 10px; border-radius: 10px;">
                ${o.items.map(i => `<div class="flex-between"><span>${i.name}</span> <span>x${i.qty}</span></div>`).join('')}
            </div>
            <div class="mt-2 flex-between" style="gap: 5px;">
                ${getNextActionButtonsAtStaff(o)}
                <button class="btn btn-outline btn-sm" onclick="toggleStaffChat(${o.table})" title="แชท">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="btn btn-outline btn-sm" onclick="showOrderHistory('${o.id}')" title="ประวัติ">
                    <i class="fas fa-history"></i>
                </button>
            </div>
            <div class="mt-2" style="font-size: 0.75rem; color: #999;">
                สั่งเมื่อ: ${new Date(o.createdAt).toLocaleTimeString()}
            </div>
        </div>
    `).join('');
}

function getNextActionButtonsAtStaff(order) {
    if (order.status === 'waiting') {
        return `<button class="btn btn-warning btn-sm" style="flex: 1" onclick="handleUpdateStatus('${order.id}', 'cooking', 'ครัวรับรายการและเริ่มปรุง')">เริ่มปรุง</button>`;
    } else if (order.status === 'cooking') {
        return `<button class="btn btn-info btn-sm" style="flex: 1" onclick="handleUpdateStatus('${order.id}', 'ready', 'ปรุงเสร็จแล้ว พร้อมเสิร์ฟ')">ปรุงเสร็จ</button>`;
    } else if (order.status === 'ready') {
        return `<button class="btn btn-success btn-sm" style="flex: 1" onclick="handleUpdateStatus('${order.id}', 'served', 'พนักงานเสิร์ฟอาหารแล้ว')">เสิร์ฟแล้ว</button>`;
    }
    return '';
}

function handleUpdateStatus(id, status, note) {
    updateOrderStatus(id, status, note);
    renderAllStaff();
}

function getStatusTextThai(status) {
    const map = { waiting: 'รอคิว', cooking: 'กำลังปรุง', ready: 'พร้อมเสิร์ฟ', served: 'เสิร์ฟแล้ว', paid: 'จ่ายแล้ว' };
    return map[status] || status;
}

// --- Notifications ---

function renderNotificationsAtStaff() {
    const notis = getNotificationsByRole('staff');
    const container = document.getElementById('kds-noti-list');

    container.innerHTML = notis.map(n => `
        <div class="noti-card noti-${n.type} ${n.read ? '' : 'noti-unread'} fade-in" onclick="handleNotiClick('${n.id}', '${n.type}', '${n.refId}', '${n.targetTable}')">
            <div class="flex-between">
                <strong>${getNotiTitleThai(n.type)}</strong>
                <small>${new Date(n.createdAt).toLocaleTimeString()}</small>
            </div>
            <div style="font-size: 0.9rem; margin-top: 5px;">${n.message}</div>
        </div>
    `).join('');
}

function getNotiTitleThai(type) {
    const map = { order: '🍴 ออเดอร์ใหม่', call: '🔔 เรียกพนักงาน', message: '💬 ข้อความใหม่', ready: '✅ อาหารเสร็จ', payment: '💰 ชำระเงิน' };
    return map[type] || 'แจ้งเตือน';
}

function handleNotiClick(id, type, refId, table) {
    markNotiAsRead(id);
    if (type === 'message' || type === 'call') {
        toggleStaffChat(table);
    }
}

function handleMarkAllNotiRead() {
    const notis = getNotificationsByRole('staff');
    notis.forEach(n => markNotiAsRead(n.id));
    renderAllStaff();
}

// --- Chat ---

function toggleStaffChat(table = null) {
    activeStaffChatTable = table;
    const modal = document.getElementById('kds-chat-modal');
    if (table) {
        document.getElementById('kds-chat-title').innerText = `แชทพูดคุยกับโต๊ะ ${table}`;
        modal.style.display = 'flex';
        renderChatAtStaff();
        scrollToBottom('kds-chat-box');
    } else {
        modal.style.display = 'none';
    }
}

function handleSendMessageAtStaff() {
    const input = document.getElementById('kds-chat-input');
    if (input.value.trim() && activeStaffChatTable) {
        sendMessage(activeStaffChatTable, 'staff', input.value.trim());
        input.value = '';
        renderChatAtStaff();
        scrollToBottom('kds-chat-box');
    }
}

function renderChatAtStaff() {
    const { messages } = getAllData();
    const tableMsgs = messages.filter(m => m.table == activeStaffChatTable);
    const container = document.getElementById('kds-chat-box');

    container.innerHTML = tableMsgs.map(m => `
        <div class="chat-msg">
            <div class="msg-content ${m.sender === 'staff' ? 'msg-customer' : 'msg-staff'}">
                ${m.text}
            </div>
            <small style="align-self: ${m.sender === 'staff' ? 'flex-end' : 'flex-start'}; font-size: 0.7rem; color: #999;">
                ${new Date(m.time).toLocaleTimeString()}
            </small>
        </div>
    `).join('');
}

// --- Order History ---

function showOrderHistory(id) {
    const { orders } = getAllData();
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const modal = document.getElementById('order-history-modal');
    const content = document.getElementById('history-content');

    content.innerHTML = `
        <div class="mb-2">
            <strong>เลขที่ออเดอร์:</strong> ${order.id}<br>
            <strong>โต๊ะ:</strong> ${order.table}<br>
            <strong>รายการ:</strong> ${order.items.map(i => `${i.name} x${i.qty}`).join(', ')}<br>
            <strong>ยอดรวม:</strong> ${order.totalPrice}฿
        </div>
        <hr>
        <h4 class="mt-2">ไทม์ไลน์สถานะ:</h4>
        <div class="mt-2">
            ${order.history.map(h => `
                <div style="padding: 8px; border-left: 2px solid var(--${h.status}); margin-bottom: 5px;">
                    <span class="badge badge-${h.status}" style="font-size: 0.7rem;">${getStatusTextThai(h.status)}</span>
                    <small style="color: #666; margin-left: 10px;">${new Date(h.time).toLocaleTimeString()}</small><br>
                    <small>${h.note}</small>
                </div>
            `).reverse().join('')}
        </div>
    `;
    modal.style.display = 'flex';
}

function closeHistoryModal() {
    document.getElementById('order-history-modal').style.display = 'none';
}
