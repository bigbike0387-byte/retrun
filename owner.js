/**
 * owner.js - Unified Owner Portal Logic
 */

let activeTab = 'reports';
let activeResolveId = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth('owner.html')) return;
    setupCommonSync('owner', null, renderAllOwner);
});

function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

function renderAllOwner() {
    // Both tabs share stats and badge
    renderStatsAtOwner();
    updateOwnerNotiBadge();

    if (activeTab === 'reports') {
        renderHistoryAtOwner();
        renderBestSellersAtOwner();
        renderAnalyticsAtOwner();
        renderReviewsAtOwner();
    } else {
        renderMenuManagement();
        renderPromosAtOwner();
        renderIssuesAtOwner();
    }
}

// --- Reports Tab ---

function renderStatsAtOwner() {
    const daily = calculateSales('daily');
    const monthly = calculateSales('monthly');
    const { orders } = getAllData();
    const paidCount = orders.filter(o => o.paid).length;

    document.getElementById('sales-daily').innerText = `${daily.toLocaleString()}฿`;
    document.getElementById('sales-monthly').innerText = `${monthly.toLocaleString()}฿`;
    document.getElementById('total-paid-orders').innerText = paidCount;
}

function renderAnalyticsAtOwner() {
    const { orders } = getAllData();
    const now = new Date();
    const todayOrders = orders.filter(o => o.paid && new Date(o.paymentTime).toDateString() === now.toDateString());
    const hourlySales = new Array(24).fill(0);
    todayOrders.forEach(o => { hourlySales[new Date(o.paymentTime).getHours()] += o.finalPrice || o.totalPrice; });

    const maxSales = Math.max(...hourlySales, 1);
    const container = document.getElementById('hourly-chart');
    if (!container) return;
    container.innerHTML = hourlySales.map((sales, h) => {
        const hPct = (sales / maxSales) * 100;
        return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%;" title="${h}:00 - ${sales}฿">
            <div style="width:70%; height:${hPct}%; background:hsl(${200 + (hPct * 0.5)}, 70%, 50%); border-radius:3px 3px 0 0; min-height:${sales > 0 ? '2px' : '0'}"></div>
            <span style="font-size:0.55rem; color:#888; margin-top:3px;">${h}</span>
        </div>`;
    }).join('');
}

function renderHistoryAtOwner() {
    const { orders } = getAllData();
    const sorted = [...orders].filter(o => o.paid).sort((a, b) => b.paymentTime - a.paymentTime).slice(0, 10);
    const container = document.getElementById('owner-history-body');
    container.innerHTML = sorted.map(o => `<tr>
        <td>${o.id}</td><td>${o.table}</td><td class="text-primary"><strong>${o.totalPrice}฿</strong></td>
        <td><small>${new Date(o.paymentTime).toLocaleTimeString()}</small></td>
    </tr>`).join('');
}

function renderBestSellersAtOwner() {
    const bestSell = getBestSellingMenus();
    const container = document.getElementById('owner-best-sellers');
    if (bestSell.length === 0) { container.innerHTML = '<p class="text-muted text-center pt-2">ไม่มีข้อมูล</p>'; return; }
    const max = bestSell[0][1];
    container.innerHTML = bestSell.slice(0, 5).map(([name, qty]) => `<div class="mb-2">
        <div class="flex-between"><span>${name}</span><strong>${qty}</strong></div>
        <div style="height:4px; background:#eee; border-radius:2px; margin-top:4px;"><div style="width:${(qty / max) * 100}%; height:100%; background:var(--primary); border-radius:2px;"></div></div>
    </div>`).join('');
}

function renderReviewsAtOwner() {
    const { reviews } = getAllData();
    const container = document.getElementById('owner-review-list');
    if (reviews.length === 0) { container.innerHTML = '<p class="text-muted text-center">ยังไม่มีรีวิว</p>'; return; }
    container.innerHTML = reviews.reverse().map(r => `<div class="mb-2" style="background:rgba(0,0,0,0.02); padding:8px; border-radius:8px;">
        <div class="flex-between"><small><strong>${r.username}</strong></small><small style="color:#ffcc00">${'★'.repeat(r.rating)}</small></div>
        <div style="font-size:0.85rem; color:#444;">"${r.comment || 'เยี่ยมเลย!'}"</div>
    </div>`).join('');
}

// --- Management Tab ---

function renderMenuManagement() {
    const menus = getMenus();
    const container = document.getElementById('owner-menu-manage-body');
    if (!container) return;
    container.innerHTML = menus.map(m => `<tr>
        <td><img src="${m.image}"></td>
        <td><strong>${m.name}</strong></td>
        <td>${m.price}฿</td>
        <td class="${m.stock < 5 ? 'stock-warning' : ''}">${m.stock}</td>
        <td>
            <button class="btn btn-sm btn-outline" onclick="openMenuModal(${m.id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteMenu(${m.id})"><i class="fas fa-trash"></i></button>
        </td>
    </tr>`).join('');
}

function renderPromosAtOwner() {
    const promos = getPromos();
    const container = document.getElementById('owner-promo-list');
    if (promos.length === 0) { container.innerHTML = '<p class="text-muted">ไม่มีโปรโมชั่น</p>'; return; }
    container.innerHTML = promos.map(p => `<div class="card flex-between mb-1" style="padding:10px; border:none; background:rgba(0,0,0,0.03);">
        <span><strong>${p.code}</strong> (${p.value}${p.type === 'percent' ? '%' : '฿'})</span>
        <button class="btn btn-sm btn-outline text-danger" onclick="deletePromo(${p.id})"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

function renderIssuesAtOwner() {
    const { issues } = getAllData();
    const container = document.getElementById('owner-issue-list');
    const pending = issues.filter(i => i.status === 'pending');
    if (pending.length === 0) { container.innerHTML = '<p class="text-success text-center">ไม่มีปัญหาแจ้งเข้ามา</p>'; return; }
    container.innerHTML = pending.map(i => `<div class="card mb-1" style="padding:10px; border-left:4px solid red;">
        <div class="flex-between"><small><strong>โต๊ะ ${i.table}</strong></small><button class="btn btn-sm btn-danger" onclick="openResolveModal(${i.id}, '${i.message}', ${i.table})">แก้</button></div>
        <div style="font-size:0.85rem;">${i.message}</div>
    </div>`).join('');
}

// --- CRUD Actions ---

function openMenuModal(id = null) {
    document.getElementById('menu-form').reset();
    document.getElementById('edit-menu-id').value = id || '';
    document.getElementById('menu-modal-title').innerText = id ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่';
    if (id) {
        const m = getMenus().find(item => item.id == id);
        document.getElementById('m-name').value = m.name;
        document.getElementById('m-price').value = m.price;
        document.getElementById('m-stock').value = m.stock;
        document.getElementById('m-cat').value = m.category;
        document.getElementById('m-img').value = m.image;
    }
    document.getElementById('menu-modal').style.display = 'flex';
}

function closeMenuModal() { document.getElementById('menu-modal').style.display = 'none'; }

function handleSaveMenu(e) {
    e.preventDefault();
    const id = document.getElementById('edit-menu-id').value;
    const name = document.getElementById('m-name').value;
    const price = parseInt(document.getElementById('m-price').value);
    const stock = parseInt(document.getElementById('m-stock').value);
    const category = document.getElementById('m-cat').value;
    const image = document.getElementById('m-img').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';

    const menus = getMenus();
    const menuData = { id: id ? parseInt(id) : Date.now(), name, price, stock, category, image };
    if (id) { const idx = menus.findIndex(m => m.id == id); menus[idx] = menuData; }
    else { menus.push(menuData); }
    setData(DB_KEYS.MENUS, menus);
    closeMenuModal();
}

function deleteMenu(id) { if (confirm('ลบเมนูนี้?')) { setData(DB_KEYS.MENUS, getMenus().filter(m => m.id != id)); } }

function openPromoModal() { document.getElementById('promo-modal').style.display = 'flex'; }
function closePromoModal() { document.getElementById('promo-modal').style.display = 'none'; }

function handleSavePromo(e) {
    e.preventDefault();
    const promos = getPromos();
    const code = document.getElementById('p-code').value.toUpperCase();
    const type = document.getElementById('p-type').value;
    const value = parseInt(document.getElementById('p-value').value);
    const minSpend = parseInt(document.getElementById('p-min').value);
    promos.push({ id: Date.now(), code, type, value, minSpend, active: true });
    setData(DB_KEYS.PROMOS, promos);
    closePromoModal();
}

function deletePromo(id) { if (confirm('ลบโค้ดนี้?')) { setData(DB_KEYS.PROMOS, getPromos().filter(p => p.id != id)); } }

function openResolveModal(id, msg, table) {
    activeResolveId = id;
    document.getElementById('resolve-info').innerText = `โต๊ะ ${table}: ${msg}`;
    document.getElementById('resolve-modal').style.display = 'flex';
}

function handleConfirmResolve() {
    const text = document.getElementById('resolve-text').value;
    if (text.trim()) {
        resolveIssue(activeResolveId, text.trim());
        document.getElementById('resolve-modal').style.display = 'none';
        document.getElementById('resolve-text').value = '';
    }
}

// --- Common Utils ---

function updateOwnerNotiBadge() {
    const pendingCount = getData(DB_KEYS.ISSUES).filter(i => i.status === 'pending').length;
    const badge = document.getElementById('owner-noti-badge');
    if (pendingCount > 0) { badge.style.display = 'inline-block'; badge.innerText = pendingCount; }
    else { badge.style.display = 'none'; }
}

function handleExportData() {
    const { orders } = getAllData();
    const csv = "data:text/csv;charset=utf-8,ID,Table,Total,Time\n" + orders.filter(o => o.paid).map(o => `${o.id},${o.table},${o.totalPrice},${new Date(o.paymentTime).toLocaleString()}`).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "sales_report.csv";
    link.click();
}
