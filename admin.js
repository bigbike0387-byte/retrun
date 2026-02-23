/**
 * admin.js - ตรรกะฝั่งผู้ดูแลระบบ (ฉบับสมบูรณ์)
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth('admin.html')) return;

    // Admin uses 'owner' sync profile to see all business updates while managing
    setupCommonSync('owner', null, renderAllAdmin);
});

function renderAllAdmin() {
    renderMenuTableAtAdmin();
    renderPromosAtAdmin();
}

// --- Menu CRUD Logic ---

function renderMenuTableAtAdmin() {
    const menus = getMenus();
    document.getElementById('total-menu-count').innerText = menus.length;

    const container = document.getElementById('admin-table-body');
    container.innerHTML = menus.map(m => `
        <tr>
            <td><img src="${m.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;"></td>
            <td><strong>${m.name}</strong></td>
            <td class="text-primary">${m.price}฿</td>
            <td><span style="color: ${m.stock < 10 ? 'red' : 'inherit'}">${m.stock}</span></td>
            <td><span class="badge" style="background: #eee; color: #666;">${m.category}</span></td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-outline btn-sm" onclick="editMenu(${m.id})" title="แก้ไข">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteMenu(${m.id})" title="ลบ">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function handleSaveMenu(e) {
    e.preventDefault();

    const menus = getMenus();
    const id = document.getElementById('edit-id').value;
    const name = document.getElementById('m-name').value;
    const price = parseInt(document.getElementById('m-price').value);
    const category = document.getElementById('m-cat').value;
    const image = document.getElementById('m-img').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
    const stock = parseInt(document.getElementById('m-stock').value || 99);

    const menuData = { name, price, category, image, stock };
    const v = validateMenu(menuData);
    if (!v.valid) {
        alert(v.message);
        return;
    }

    if (id) {
        // Update
        const idx = menus.findIndex(m => m.id == id);
        if (idx !== -1) {
            menus[idx] = { ...menus[idx], name, price, category, image, stock };
        }
    } else {
        // Create
        const newMenu = {
            id: Date.now(),
            name,
            price,
            category,
            image,
            stock
        };
        menus.push(newMenu);
    }

    setData(DB_KEYS.MENUS, menus);
    resetMenuForm();
    renderAllAdmin();
    alert('บันทึกข้อมูลเมนูเรียบร้อยแล้ว');
}

function deleteMenu(id) {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบเมนูนี้?')) {
        const menus = getMenus();
        const filtered = menus.filter(m => m.id != id);
        setData(DB_KEYS.MENUS, filtered);
        renderAllAdmin();
    }
}

function editMenu(id) {
    const menus = getMenus();
    const menu = menus.find(m => m.id == id);
    if (!menu) return;

    document.getElementById('form-title').innerText = 'แก้ไขเมนูอาหาร';
    document.getElementById('edit-id').value = menu.id;
    document.getElementById('m-name').value = menu.name;
    document.getElementById('m-price').value = menu.price;
    document.getElementById('m-cat').value = menu.category;
    document.getElementById('m-img').value = menu.image;
    document.getElementById('m-stock').value = menu.stock || 0;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetMenuForm() {
    document.getElementById('form-title').innerText = 'เพิ่มเมนูอาหารใหม่';
    document.getElementById('edit-id').value = '';
    document.getElementById('admin-menu-form').reset();
}

// --- Promo Management ---

function renderPromosAtAdmin() {
    const promos = getPromos();
    const container = document.getElementById('admin-promo-list');
    if (!container) return;

    if (promos.length === 0) {
        container.innerHTML = '<p style="color:#999;">ยังไม่มีรหัสส่วนลด</p>';
        return;
    }

    container.innerHTML = promos.map(p => `
        <div class="flex-between mb-1" style="background: white; padding: 5px 10px; border-radius: 8px;">
            <span><strong>${p.code}</strong> (${p.value}${p.type === 'percent' ? '%' : '฿'})</span>
            <button class="btn btn-sm text-danger" onclick="deletePromo(${p.id})"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function openPromoModal() {
    document.getElementById('promo-form').reset();
    document.getElementById('p-id').value = '';
    document.getElementById('promo-modal').style.display = 'flex';
}

function closePromoModal() {
    document.getElementById('promo-modal').style.display = 'none';
}

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
    renderAllAdmin();
}

function deletePromo(id) {
    if (confirm('ลบรหัสส่วนลดนี้?')) {
        const promos = getPromos().filter(p => p.id !== id);
        setData(DB_KEYS.PROMOS, promos);
        renderAllAdmin();
    }
}
