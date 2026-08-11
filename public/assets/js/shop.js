let PRODUCTS = [];
let CUSTOMER = null;
let currentCategory = 'all';

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2500);
}
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) { return '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 }); }

// ---------- CART (เก็บใน localStorage ฝั่งลูกค้า ไม่ต้อง login ก็หยิบใส่ตะกร้าได้) ----------
function getCart() {
  try { return JSON.parse(localStorage.getItem('tj_cart') || '[]'); } catch (e) { return []; }
}
function saveCart(cart) {
  localStorage.setItem('tj_cart', JSON.stringify(cart));
  renderCartCount();
}
function addToCart(productId, qty = 1) {
  const cart = getCart();
  const existing = cart.find(c => c.product_id === productId);
  if (existing) existing.qty += qty;
  else cart.push({ product_id: productId, qty });
  saveCart(cart);
  showToast('เพิ่มลงตะกร้าแล้ว');
}
function updateCartQty(productId, qty) {
  let cart = getCart();
  if (qty <= 0) cart = cart.filter(c => c.product_id !== productId);
  else { const item = cart.find(c => c.product_id === productId); if (item) item.qty = qty; }
  saveCart(cart);
  renderCartItems();
}
function renderCartCount() {
  const count = getCart().reduce((sum, c) => sum + c.qty, 0);
  document.getElementById('cart-count').textContent = count;
}

// ---------- PRODUCTS ----------
async function loadProducts() {
  PRODUCTS = await fetch('/api/products').then(r => r.json());
  renderCategoryTabs();
  renderProducts();
}

function renderCategoryTabs() {
  const cats = ['all', ...new Set(PRODUCTS.map(p => p.category))];
  document.getElementById('category-tabs').innerHTML = cats.map(c => `
    <button class="${c === currentCategory ? 'active' : ''}" onclick="setCategory('${escapeHtml(c)}')">${c === 'all' ? 'ทั้งหมด' : escapeHtml(c)}</button>
  `).join('');
}
function setCategory(c) { currentCategory = c; renderCategoryTabs(); renderProducts(); }
window.setCategory = setCategory;

function renderProducts() {
  const q = (document.getElementById('search-box').value || '').toLowerCase();
  const filtered = PRODUCTS.filter(p =>
    (currentCategory === 'all' || p.category === currentCategory) &&
    (!q || p.name_th.toLowerCase().includes(q) || (p.name_en || '').toLowerCase().includes(q))
  );
  const grid = document.getElementById('product-grid');
  if (!filtered.length) { grid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding:2rem;">ไม่พบสินค้า</p>'; return; }
  grid.innerHTML = filtered.map(p => {
    const outOfStock = p.stock_qty <= 0;
    const lowStock = p.stock_qty > 0 && p.stock_qty <= 5;
    return `
    <div class="product-card">
      <img class="pimg" src="${p.image_url || '/assets/img/logo.jpg'}" alt="${escapeHtml(p.name_th)}">
      <div class="pbody">
        <div class="pcat">${escapeHtml(p.category)}</div>
        <h3>${escapeHtml(p.name_th)}</h3>
        <div class="pprice">${money(p.price)}</div>
        <div class="pstock ${outOfStock ? 'out' : lowStock ? 'low' : ''}">${outOfStock ? 'สินค้าหมด' : lowStock ? `เหลือเพียง ${p.stock_qty} ชิ้น` : `คงเหลือ ${p.stock_qty} ชิ้น`}</div>
        <button ${outOfStock ? 'disabled' : ''} onclick="addToCart(${p.id})">${outOfStock ? 'สินค้าหมด' : '+ ใส่ตะกร้า'}</button>
      </div>
    </div>`;
  }).join('');
}

// ---------- CART DRAWER ----------
function openCart() {
  renderCartItems();
  document.getElementById('cart-overlay').classList.add('open');
  document.getElementById('cart-drawer').classList.add('open');
}
window.openCart = openCart;
function closeCart() {
  document.getElementById('cart-overlay').classList.remove('open');
  document.getElementById('cart-drawer').classList.remove('open');
}
window.closeCart = closeCart;

function renderCartItems() {
  const cart = getCart();
  const body = document.getElementById('cart-items');
  if (!cart.length) { body.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:2rem;">ตะกร้าว่างเปล่า</p>'; document.getElementById('cart-total').textContent = money(0); return; }
  let total = 0;
  body.innerHTML = cart.map(c => {
    const p = PRODUCTS.find(x => x.id === c.product_id);
    if (!p) return '';
    const subtotal = p.price * c.qty;
    total += subtotal;
    return `
    <div class="cart-item">
      <img src="${p.image_url || '/assets/img/logo.jpg'}">
      <div class="ci-info">
        <h4>${escapeHtml(p.name_th)}</h4>
        <div class="ci-price">${money(p.price)} × ${c.qty} = ${money(subtotal)}</div>
        <div class="qty-ctrl">
          <button onclick="updateCartQty(${p.id}, ${c.qty - 1})">−</button>
          <span>${c.qty}</span>
          <button onclick="updateCartQty(${p.id}, ${c.qty + 1})">+</button>
          <button class="remove-btn" onclick="updateCartQty(${p.id}, 0)">ลบ</button>
        </div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('cart-total').textContent = money(total);
}

// ---------- CUSTOMER AUTH ----------
async function checkCustomerSession() {
  try {
    const data = await fetch('/api/customer-auth/me', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(); return r.json(); });
    CUSTOMER = data.customer;
    document.getElementById('acc-nav-label').textContent = CUSTOMER.name.split(' ')[0];
  } catch (e) { CUSTOMER = null; document.getElementById('acc-nav-label').textContent = 'เข้าสู่ระบบ'; }
}

function openAccountPanel() {
  document.getElementById('account-overlay').classList.add('open');
  document.getElementById('account-drawer').classList.add('open');
  renderAccountPanel();
}
window.openAccountPanel = openAccountPanel;
function closeAccountPanel() {
  document.getElementById('account-overlay').classList.remove('open');
  document.getElementById('account-drawer').classList.remove('open');
}
window.closeAccountPanel = closeAccountPanel;

function renderAccountPanel() {
  if (CUSTOMER) { renderMyOrders(); return; }
  document.getElementById('account-panel-title').textContent = 'เข้าสู่ระบบ / สมัครสมาชิก';
  document.getElementById('account-body').innerHTML = `
    <div class="auth-tabs">
      <button id="tab-login" class="active" onclick="switchAuthTab('login')">เข้าสู่ระบบ</button>
      <button id="tab-register" onclick="switchAuthTab('register')">สมัครสมาชิก</button>
    </div>
    <div id="auth-pane-login">
      <div class="field"><label>อีเมล</label><input id="login-email" type="email"></div>
      <div class="field"><label>รหัสผ่าน</label><input id="login-password" type="password"></div>
      <button class="btn-primary" style="width:100%" onclick="doCustomerLogin()">เข้าสู่ระบบ</button>
      <div id="login-err" style="color:#ff8b8b; font-size:.85rem; margin-top:.6rem;"></div>
    </div>
    <div id="auth-pane-register" style="display:none">
      <div class="field"><label>ชื่อ-นามสกุล</label><input id="reg-name"></div>
      <div class="field"><label>อีเมล</label><input id="reg-email" type="email"></div>
      <div class="field"><label>เบอร์โทรศัพท์</label><input id="reg-phone"></div>
      <div class="field"><label>ที่อยู่จัดส่ง</label><textarea id="reg-address" rows="2"></textarea></div>
      <div class="field"><label>รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label><input id="reg-password" type="password"></div>
      <button class="btn-primary" style="width:100%" onclick="doCustomerRegister()">สมัครสมาชิก</button>
      <div id="reg-err" style="color:#ff8b8b; font-size:.85rem; margin-top:.6rem;"></div>
    </div>
  `;
}

function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-pane-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-pane-register').style.display = tab === 'register' ? 'block' : 'none';
}
window.switchAuthTab = switchAuthTab;

async function doCustomerLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-err');
  try {
    const res = await fetch('/api/customer-auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    CUSTOMER = data.customer;
    document.getElementById('acc-nav-label').textContent = CUSTOMER.name.split(' ')[0];
    renderAccountPanel();
    showToast('เข้าสู่ระบบสำเร็จ');
  } catch (e) { errEl.textContent = e.message; }
}
window.doCustomerLogin = doCustomerLogin;

async function doCustomerRegister() {
  const payload = {
    name: document.getElementById('reg-name').value,
    email: document.getElementById('reg-email').value,
    phone: document.getElementById('reg-phone').value,
    address: document.getElementById('reg-address').value,
    password: document.getElementById('reg-password').value
  };
  const errEl = document.getElementById('reg-err');
  try {
    const res = await fetch('/api/customer-auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    CUSTOMER = data.customer;
    document.getElementById('acc-nav-label').textContent = CUSTOMER.name.split(' ')[0];
    renderAccountPanel();
    showToast('สมัครสมาชิกสำเร็จ');
  } catch (e) { errEl.textContent = e.message; }
}
window.doCustomerRegister = doCustomerRegister;

async function doCustomerLogout() {
  await fetch('/api/customer-auth/logout', { method: 'POST', credentials: 'include' });
  CUSTOMER = null;
  document.getElementById('acc-nav-label').textContent = 'เข้าสู่ระบบ';
  renderAccountPanel();
}
window.doCustomerLogout = doCustomerLogout;

// ---------- MY ORDERS ----------
async function renderMyOrders() {
  document.getElementById('account-panel-title').textContent = 'บัญชีของฉัน';
  const orders = await fetch('/api/orders/my', { credentials: 'include' }).then(r => r.json()).catch(() => []);
  const statusLabel = { pending: 'รอดำเนินการ', processing: 'กำลังจัดเตรียม', shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก' };
  const payLabel = { unpaid: 'ยังไม่ชำระเงิน', pending_verification: 'รอตรวจสอบสลิป', paid: 'ชำระเงินแล้ว', rejected: 'สลิปไม่ผ่าน' };
  document.getElementById('account-body').innerHTML = `
    <div style="margin-bottom:1.2rem; padding-bottom:1rem; border-bottom:1px solid var(--border);">
      <b>${escapeHtml(CUSTOMER.name)}</b><br>
      <span style="color:var(--text-muted); font-size:.85rem;">${escapeHtml(CUSTOMER.email)}</span><br>
      <button class="btn-outline" style="margin-top:.7rem; padding:.4rem .9rem; font-size:.8rem;" onclick="doCustomerLogout()">ออกจากระบบ</button>
    </div>
    <h4 style="margin-bottom:.8rem; font-size:.95rem;">คำสั่งซื้อของฉัน</h4>
    ${orders.length ? orders.map(o => `
      <div class="order-row" onclick="openOrderDetail(${o.id})">
        <div class="or-top">
          <span class="or-num">${o.order_number}</span>
          <span>${money(o.total_amount)}</span>
        </div>
        <span class="status-pill ${o.status}">${statusLabel[o.status] || o.status}</span>
        <span class="status-pill ${o.payment_status}">${payLabel[o.payment_status] || o.payment_status}</span>
      </div>
    `).join('') : '<p style="color:var(--text-muted); font-size:.85rem;">ยังไม่มีคำสั่งซื้อ</p>'}
  `;
}

async function openOrderDetail(orderId) {
  const data = await fetch(`/api/orders/my/${orderId}`, { credentials: 'include' }).then(r => r.json());
  const { order, items } = data;
  const statusLabel = { pending: 'รอดำเนินการ', processing: 'กำลังจัดเตรียม', shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก' };
  const payLabel = { unpaid: 'ยังไม่ชำระเงิน', pending_verification: 'รอตรวจสอบสลิป', paid: 'ชำระเงินแล้ว', rejected: 'สลิปไม่ผ่าน กรุณาอัปโหลดใหม่' };
  document.getElementById('order-detail-body').innerHTML = `
    <p><b>เลขที่คำสั่งซื้อ:</b> ${order.order_number}</p>
    <p><b>สถานะ:</b> <span class="status-pill ${order.status}">${statusLabel[order.status]}</span></p>
    <p><b>การชำระเงิน:</b> <span class="status-pill ${order.payment_status}">${payLabel[order.payment_status]}</span></p>
    <div style="margin:1rem 0; border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:1rem 0;">
      ${items.map(i => `<div style="display:flex; justify-content:space-between; font-size:.85rem; margin-bottom:.4rem;"><span>${escapeHtml(i.product_name)} × ${i.quantity}</span><span>${money(i.subtotal)}</span></div>`).join('')}
      <div style="display:flex; justify-content:space-between; font-weight:700; margin-top:.6rem;"><span>รวม</span><span>${money(order.total_amount)}</span></div>
    </div>
    <a href="/api/orders/my/${order.id}/invoice" target="_blank" class="btn-outline" style="display:block; text-align:center; text-decoration:none; padding:.7rem; margin-bottom:.8rem;">📄 ดาวน์โหลดใบเสร็จ (PDF)</a>
    ${(order.payment_status === 'unpaid' || order.payment_status === 'rejected') ? `
      <div class="slip-upload-box">
        <p style="font-size:.85rem; color:var(--text-muted); margin-bottom:.6rem;">แนบสลิปการโอนเงินเพื่อยืนยันคำสั่งซื้อ</p>
        <input type="file" accept="image/*" id="slip-file-input" onchange="uploadSlip(${order.id}, this)">
      </div>
    ` : order.payment_slip_url ? `<div class="slip-upload-box"><img src="${order.payment_slip_url}"><p style="font-size:.8rem; color:var(--text-muted);">แนบสลิปแล้ว</p></div>` : ''}
  `;
  document.getElementById('order-detail-overlay').classList.add('open');
}
window.openOrderDetail = openOrderDetail;
function closeOrderDetail() { document.getElementById('order-detail-overlay').classList.remove('open'); }
window.closeOrderDetail = closeOrderDetail;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadSlip(orderId, input) {
  const file = input.files[0]; if (!file) return;
  try {
    const dataUrl = await fileToDataUrl(file);
    const res = await fetch(`/api/orders/my/${orderId}/payment-slip`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ dataUrl })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('อัปโหลดสลิปสำเร็จ รอทีมงานตรวจสอบ');
    openOrderDetail(orderId);
    renderMyOrders();
  } catch (e) { showToast('อัปโหลดไม่สำเร็จ: ' + e.message); }
}
window.uploadSlip = uploadSlip;

// ---------- CHECKOUT ----------
function goToCheckout() {
  const cart = getCart();
  if (!cart.length) { showToast('ตะกร้าสินค้าว่างเปล่า'); return; }
  if (!CUSTOMER) {
    closeCart();
    showToast('กรุณาเข้าสู่ระบบก่อนสั่งซื้อ');
    openAccountPanel();
    return;
  }
  closeCart();
  let total = 0;
  const lines = cart.map(c => {
    const p = PRODUCTS.find(x => x.id === c.product_id);
    if (!p) return '';
    total += p.price * c.qty;
    return `<div style="display:flex; justify-content:space-between; font-size:.85rem; margin-bottom:.4rem;"><span>${escapeHtml(p.name_th)} × ${c.qty}</span><span>${money(p.price * c.qty)}</span></div>`;
  }).join('');
  document.getElementById('checkout-body').innerHTML = `
    <div style="margin-bottom:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border);">
      ${lines}
      <div style="display:flex; justify-content:space-between; font-weight:700; margin-top:.6rem;"><span>ยอดรวม</span><span>${money(total)}</span></div>
    </div>
    <div class="field"><label>ชื่อผู้รับ</label><input id="co-name" value="${escapeHtml(CUSTOMER.name)}"></div>
    <div class="field"><label>เบอร์โทรศัพท์</label><input id="co-phone" value="${escapeHtml(CUSTOMER.phone || '')}"></div>
    <div class="field"><label>ที่อยู่จัดส่ง</label><textarea id="co-address" rows="3">${escapeHtml(CUSTOMER.address || '')}</textarea></div>
    <button class="btn-primary" style="width:100%" onclick="submitOrder()">ยืนยันสั่งซื้อ</button>
    <div id="checkout-err" style="color:#ff8b8b; font-size:.85rem; margin-top:.6rem;"></div>
  `;
  document.getElementById('checkout-overlay').classList.add('open');
}
window.goToCheckout = goToCheckout;
function closeCheckout() { document.getElementById('checkout-overlay').classList.remove('open'); }
window.closeCheckout = closeCheckout;

async function submitOrder() {
  const cart = getCart();
  const payload = {
    items: cart.map(c => ({ product_id: c.product_id, quantity: c.qty })),
    shipping_name: document.getElementById('co-name').value,
    shipping_phone: document.getElementById('co-phone').value,
    shipping_address: document.getElementById('co-address').value
  };
  const errEl = document.getElementById('checkout-err');
  try {
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    saveCart([]);
    closeCheckout();
    showToast('สั่งซื้อสำเร็จ! กรุณาแนบสลิปการโอนเงินในหน้าบัญชีของฉัน');
    await loadProducts(); // รีเฟรชสต๊อกที่แสดง
    openAccountPanel();
    setTimeout(() => openOrderDetail(data.order.id), 300);
  } catch (e) { errEl.textContent = e.message; }
}
window.submitOrder = submitOrder;

// ---------- init ----------
document.getElementById('f-year').textContent = new Date().getFullYear();
fetch('/api/settings').then(r => r.json()).then(s => {
  document.getElementById('site-logo').src = s.logo_url || '/assets/img/logo.jpg';
  document.getElementById('site-name').textContent = s.site_name_th || 'TECH-TJ';
  document.getElementById('favicon').href = s.favicon_url || s.logo_url;
  document.getElementById('f-name-text').textContent = s.site_name_th || 'TECH-TJ Solution Technology';
  if (s.primary_color) document.documentElement.style.setProperty('--primary', s.primary_color);
}).catch(() => {});
renderCartCount();
checkCustomerSession();
loadProducts();
