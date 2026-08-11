let SERVICES = [], PORTFOLIO = [], INQUIRIES = [], CHAT_SESSIONS = [];
let currentServiceImg = '', currentPortfolioImg = '';
let activeChatSessionId = null;
let sessionsPollTimer = null, messagesPollTimer = null;
let lastActiveMsgCount = 0;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2500);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...opts
  });
  if (res.status === 401) { showApp(false); throw new Error('unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'error');
  return data;
}

// ---------- AUTH ----------
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-err');
  errEl.textContent = '';
  try {
    await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }), credentials: 'include'
    }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); });
    showApp(true);
    initAdmin();
  } catch (err) {
    errEl.textContent = err.message || 'เข้าสู่ระบบไม่สำเร็จ';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  showApp(false);
});

function showApp(loggedIn) {
  document.getElementById('login-screen').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('app-shell').classList.toggle('show', loggedIn);
}

async function checkSession() {
  try {
    await api('/api/auth/me');
    showApp(true);
    initAdmin();
  } catch (e) {
    showApp(false);
  }
}

// ---------- NAV ----------
document.getElementById('menu').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-page]');
  if (!a) return;
  document.querySelectorAll('.menu a').forEach(el => el.classList.remove('active'));
  a.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + a.dataset.page).classList.add('active');
});

function switchFormLang(prefix, lang) {
  document.querySelectorAll(`#page-${prefix === 'service' ? 'services' : 'portfolio'} .lang-tabs button`).forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  document.getElementById(`${prefix}-pane-th`).classList.toggle('active', lang === 'th');
  document.getElementById(`${prefix}-pane-en`).classList.toggle('active', lang === 'en');
}
window.switchFormLang = switchFormLang;

// ---------- INIT ----------
async function initAdmin() {
  await Promise.all([loadDashboard(), loadServices(), loadPortfolio(), loadInquiries(), loadSettings(), loadContentTexts(), loadProductsAdmin(), loadOrdersAdmin()]);
  startSessionsPolling();
  initRealtimeAdmin();
}

// ---------- DASHBOARD ----------
async function loadDashboard() {
  const [services, portfolio, inquiries, sessions, products, orders] = await Promise.all([
    api('/api/services?all=1'), api('/api/portfolio?all=1'), api('/api/contact'), api('/api/chat/sessions'),
    api('/api/products?all=1'), api('/api/orders')
  ]);
  const newCount = inquiries.filter(i => i.status === 'new').length;
  const paidOrders = orders.filter(o => o.payment_status === 'paid');
  const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const lowStock = products.filter(p => p.stock_qty <= 5).length;
  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="n">${services.length}</div><div class="l">บริการทั้งหมด</div></div>
    <div class="stat-card"><div class="n">${portfolio.length}</div><div class="l">ผลงานทั้งหมด</div></div>
    <div class="stat-card"><div class="n">${products.length}</div><div class="l">สินค้าทั้งหมด${lowStock ? ` (⚠️ ${lowStock} ใกล้หมด)` : ''}</div></div>
    <div class="stat-card"><div class="n">${orders.length}</div><div class="l">คำสั่งซื้อทั้งหมด</div></div>
    <div class="stat-card"><div class="n">฿${revenue.toLocaleString('th-TH')}</div><div class="l">ยอดขายที่ชำระแล้ว</div></div>
    <div class="stat-card"><div class="n">${inquiries.length}</div><div class="l">ข้อความติดต่อทั้งหมด</div></div>
    <div class="stat-card"><div class="n">${newCount}</div><div class="l">ข้อความใหม่ที่ยังไม่อ่าน</div></div>
    <div class="stat-card"><div class="n">${sessions.length}</div><div class="l">ห้องแชททั้งหมด</div></div>
  `;
  document.getElementById('dash-inquiries').innerHTML = inquiries.slice(0, 6).map(rowInquiry).join('') || `<tr><td colspan="5" style="color:var(--muted)">ยังไม่มีข้อความ</td></tr>`;
  updateInquiryBadge(newCount);
}

function updateInquiryBadge(n) {
  const b = document.getElementById('inquiry-badge');
  if (n > 0) { b.style.display = 'inline-block'; b.textContent = n; } else b.style.display = 'none';
}

function rowInquiry(i) {
  const tagClass = i.status === 'new' ? 'new' : i.status === 'done' ? 'done' : 'progress';
  return `<tr>
    <td>${escapeHtml(i.name)}</td>
    <td>${escapeHtml(i.phone || i.email || '-')}</td>
    <td>${escapeHtml(i.service_interested || '-')}</td>
    <td><span class="tag ${tagClass}">${i.status}</span></td>
    <td>${i.created_at}</td>
  </tr>`;
}

// ---------- SERVICES ----------
async function loadServices() {
  SERVICES = await api('/api/services?all=1');
  document.getElementById('services-list').innerHTML = SERVICES.map(s => `
    <div class="item-card">
      <div class="icon-big">${s.icon || '💡'}</div>
      <div class="info">
        <h4>${escapeHtml(s.title_th)} <span style="color:var(--muted); font-weight:400;">/ ${escapeHtml(s.title_en || '')}</span></h4>
        <p>${escapeHtml(s.desc_th || '')}</p>
      </div>
      <div class="actions">
        <button class="btn small secondary" onclick="editService(${s.id})">แก้ไข</button>
        <button class="btn small danger" onclick="deleteService(${s.id})">ลบ</button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--muted)">ยังไม่มีบริการ</p>';
}

document.getElementById('service-img-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  currentServiceImg = await uploadImage(file);
  const prev = document.getElementById('service-img-preview');
  prev.src = currentServiceImg; prev.style.display = 'block';
});

function resetServiceForm() {
  document.getElementById('service-id').value = '';
  document.getElementById('service-icon').value = '';
  document.getElementById('service-order').value = 0;
  document.getElementById('service-title-th').value = '';
  document.getElementById('service-title-en').value = '';
  document.getElementById('service-desc-th').value = '';
  document.getElementById('service-desc-en').value = '';
  document.getElementById('service-form-title').textContent = 'เพิ่มบริการใหม่';
  document.getElementById('service-img-preview').style.display = 'none';
  currentServiceImg = '';
}
window.resetServiceForm = resetServiceForm;

function editService(id) {
  const s = SERVICES.find(x => x.id === id); if (!s) return;
  document.getElementById('service-id').value = s.id;
  document.getElementById('service-icon').value = s.icon || '';
  document.getElementById('service-order').value = s.sort_order || 0;
  document.getElementById('service-title-th').value = s.title_th || '';
  document.getElementById('service-title-en').value = s.title_en || '';
  document.getElementById('service-desc-th').value = s.desc_th || '';
  document.getElementById('service-desc-en').value = s.desc_en || '';
  document.getElementById('service-form-title').textContent = 'แก้ไขบริการ #' + s.id;
  currentServiceImg = s.image_url || '';
  const prev = document.getElementById('service-img-preview');
  if (currentServiceImg) { prev.src = currentServiceImg; prev.style.display = 'block'; } else prev.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.editService = editService;

async function saveService() {
  const id = document.getElementById('service-id').value;
  const payload = {
    icon: document.getElementById('service-icon').value,
    image_url: currentServiceImg,
    sort_order: Number(document.getElementById('service-order').value) || 0,
    title_th: document.getElementById('service-title-th').value,
    title_en: document.getElementById('service-title-en').value,
    desc_th: document.getElementById('service-desc-th').value,
    desc_en: document.getElementById('service-desc-en').value,
    active: true
  };
  try {
    if (id) await api('/api/services/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/services', { method: 'POST', body: JSON.stringify(payload) });
    showToast('บันทึกบริการเรียบร้อย');
    resetServiceForm();
    loadServices(); loadDashboard();
  } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message); }
}
window.saveService = saveService;

async function deleteService(id) {
  if (!confirm('ยืนยันลบบริการนี้?')) return;
  await api('/api/services/' + id, { method: 'DELETE' });
  loadServices(); loadDashboard();
}
window.deleteService = deleteService;

// ---------- PORTFOLIO ----------
async function loadPortfolio() {
  PORTFOLIO = await api('/api/portfolio?all=1');
  document.getElementById('portfolio-list').innerHTML = PORTFOLIO.map(p => `
    <div class="item-card">
      <img src="${p.image_url || '/assets/img/logo.jpg'}">
      <div class="info">
        <h4>${escapeHtml(p.title_th)} <span style="color:var(--muted); font-weight:400;">/ ${escapeHtml(p.title_en || '')}</span></h4>
        <p>${escapeHtml(p.desc_th || '')}</p>
      </div>
      <div class="actions">
        <button class="btn small secondary" onclick="editPortfolio(${p.id})">แก้ไข</button>
        <button class="btn small danger" onclick="deletePortfolio(${p.id})">ลบ</button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--muted)">ยังไม่มีผลงาน</p>';
}

document.getElementById('portfolio-img-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  currentPortfolioImg = await uploadImage(file);
  const prev = document.getElementById('portfolio-img-preview');
  prev.src = currentPortfolioImg; prev.style.display = 'block';
});

function resetPortfolioForm() {
  document.getElementById('portfolio-id').value = '';
  document.getElementById('portfolio-link').value = '';
  document.getElementById('portfolio-order').value = 0;
  document.getElementById('portfolio-title-th').value = '';
  document.getElementById('portfolio-title-en').value = '';
  document.getElementById('portfolio-desc-th').value = '';
  document.getElementById('portfolio-desc-en').value = '';
  document.getElementById('portfolio-img-preview').style.display = 'none';
  currentPortfolioImg = '';
}
window.resetPortfolioForm = resetPortfolioForm;

function editPortfolio(id) {
  const p = PORTFOLIO.find(x => x.id === id); if (!p) return;
  document.getElementById('portfolio-id').value = p.id;
  document.getElementById('portfolio-link').value = p.link_url || '';
  document.getElementById('portfolio-order').value = p.sort_order || 0;
  document.getElementById('portfolio-title-th').value = p.title_th || '';
  document.getElementById('portfolio-title-en').value = p.title_en || '';
  document.getElementById('portfolio-desc-th').value = p.desc_th || '';
  document.getElementById('portfolio-desc-en').value = p.desc_en || '';
  currentPortfolioImg = p.image_url || '';
  const prev = document.getElementById('portfolio-img-preview');
  if (currentPortfolioImg) { prev.src = currentPortfolioImg; prev.style.display = 'block'; } else prev.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.editPortfolio = editPortfolio;

async function savePortfolio() {
  const id = document.getElementById('portfolio-id').value;
  const payload = {
    image_url: currentPortfolioImg,
    link_url: document.getElementById('portfolio-link').value,
    sort_order: Number(document.getElementById('portfolio-order').value) || 0,
    title_th: document.getElementById('portfolio-title-th').value,
    title_en: document.getElementById('portfolio-title-en').value,
    desc_th: document.getElementById('portfolio-desc-th').value,
    desc_en: document.getElementById('portfolio-desc-en').value,
    active: true
  };
  try {
    if (id) await api('/api/portfolio/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/portfolio', { method: 'POST', body: JSON.stringify(payload) });
    showToast('บันทึกผลงานเรียบร้อย');
    resetPortfolioForm();
    loadPortfolio(); loadDashboard();
  } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message); }
}
window.savePortfolio = savePortfolio;

async function deletePortfolio(id) {
  if (!confirm('ยืนยันลบผลงานนี้?')) return;
  await api('/api/portfolio/' + id, { method: 'DELETE' });
  loadPortfolio(); loadDashboard();
}
window.deletePortfolio = deletePortfolio;

// ---------- INQUIRIES ----------
async function loadInquiries() {
  INQUIRIES = await api('/api/contact');
  document.getElementById('inquiries-list').innerHTML = INQUIRIES.map(i => `
    <tr>
      <td>${escapeHtml(i.name)}</td>
      <td>${escapeHtml(i.phone || '-')}<br>${escapeHtml(i.email || '')}</td>
      <td>${escapeHtml(i.service_interested || '-')}</td>
      <td style="max-width:220px">${escapeHtml(i.message || '-')}</td>
      <td>
        <select onchange="updateInquiryStatus(${i.id}, this.value)">
          <option value="new" ${i.status === 'new' ? 'selected' : ''}>ใหม่</option>
          <option value="progress" ${i.status === 'progress' ? 'selected' : ''}>กำลังดำเนินการ</option>
          <option value="done" ${i.status === 'done' ? 'selected' : ''}>เสร็จสิ้น</option>
        </select>
      </td>
      <td>${i.created_at}</td>
      <td><button class="btn small danger" onclick="deleteInquiry(${i.id})">ลบ</button></td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="color:var(--muted)">ยังไม่มีข้อความติดต่อ</td></tr>';
}

async function updateInquiryStatus(id, status) {
  await api(`/api/contact/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  loadDashboard();
}
window.updateInquiryStatus = updateInquiryStatus;

async function deleteInquiry(id) {
  if (!confirm('ยืนยันลบข้อความนี้?')) return;
  await api('/api/contact/' + id, { method: 'DELETE' });
  loadInquiries(); loadDashboard();
}
window.deleteInquiry = deleteInquiry;

// ---------- SETTINGS ----------
async function loadSettings() {
  const s = await api('/api/settings');
  document.getElementById('set-logo-preview').src = s.logo_url || '/assets/img/logo.jpg';
  document.getElementById('set-qr-preview').src = s.line_qr_url || '/assets/img/line-qr-flyer.jpg';
  document.getElementById('set-hero-img-preview').src = s.hero_image_url || '/assets/img/hero-showcase.jpg';
  document.getElementById('set-hero-badge-text').value = s.hero_badge_text || 'ENTERING THE GRID';
  document.getElementById('set-site-th').value = s.site_name_th || '';
  document.getElementById('set-site-en').value = s.site_name_en || '';
  document.getElementById('set-tagline-th').value = s.tagline_th || '';
  document.getElementById('set-tagline-en').value = s.tagline_en || '';
  document.getElementById('set-herosub-th').value = s.hero_sub_th || '';
  document.getElementById('set-herosub-en').value = s.hero_sub_en || '';
  document.getElementById('set-primary').value = s.primary_color || '#00d4ff';
  document.getElementById('set-accent').value = s.accent_color || '#ff6b35';
  document.getElementById('set-font').value = s.font_family || 'Sarabun';
  document.getElementById('set-default-lang').value = s.default_lang || 'th';
  document.getElementById('set-phone').value = s.phone || '';
  document.getElementById('set-lineid').value = s.line_id || '';
  document.getElementById('set-fb').value = s.facebook || '';
  document.getElementById('set-fburl').value = s.facebook_url || '';
  document.getElementById('set-email-display').value = s.email_display || '';
  window._logoUrl = s.logo_url; window._qrUrl = s.line_qr_url; window._heroImgUrl = s.hero_image_url;
}

document.getElementById('set-logo-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  window._logoUrl = await uploadImage(file);
  document.getElementById('set-logo-preview').src = window._logoUrl;
});
document.getElementById('set-qr-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  window._qrUrl = await uploadImage(file);
  document.getElementById('set-qr-preview').src = window._qrUrl;
});
document.getElementById('set-hero-img-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  window._heroImgUrl = await uploadImage(file);
  document.getElementById('set-hero-img-preview').src = window._heroImgUrl;
});

async function saveSettings() {
  const payload = {
    logo_url: window._logoUrl, favicon_url: window._logoUrl, line_qr_url: window._qrUrl,
    hero_image_url: window._heroImgUrl, hero_badge_text: document.getElementById('set-hero-badge-text').value,
    site_name_th: document.getElementById('set-site-th').value,
    site_name_en: document.getElementById('set-site-en').value,
    tagline_th: document.getElementById('set-tagline-th').value,
    tagline_en: document.getElementById('set-tagline-en').value,
    hero_sub_th: document.getElementById('set-herosub-th').value,
    hero_sub_en: document.getElementById('set-herosub-en').value,
    primary_color: document.getElementById('set-primary').value,
    accent_color: document.getElementById('set-accent').value,
    font_family: document.getElementById('set-font').value,
    default_lang: document.getElementById('set-default-lang').value,
    phone: document.getElementById('set-phone').value,
    line_id: document.getElementById('set-lineid').value,
    facebook: document.getElementById('set-fb').value,
    facebook_url: document.getElementById('set-fburl').value,
    email_display: document.getElementById('set-email-display').value
  };
  try {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
    showToast('บันทึกการตั้งค่าเรียบร้อย — หน้าเว็บจะอัปเดตทันที');
  } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message); }
}
window.saveSettings = saveSettings;

// ---------- PRODUCTS ----------
let PRODUCTS_ADMIN = [];
let currentProductImg = '';

async function loadProductsAdmin() {
  PRODUCTS_ADMIN = await api('/api/products?all=1');
  document.getElementById('products-list').innerHTML = PRODUCTS_ADMIN.map(p => `
    <div class="item-card">
      <img src="${p.image_url || '/assets/img/logo.jpg'}">
      <div class="info">
        <h4>${escapeHtml(p.name_th)} <span style="color:var(--muted); font-weight:400;">/ ${escapeHtml(p.name_en || '')}</span></h4>
        <p>฿${Number(p.price).toLocaleString('th-TH')} • สต๊อก: ${p.stock_qty} • ${escapeHtml(p.category)} ${p.sku ? '• SKU: ' + escapeHtml(p.sku) : ''}</p>
      </div>
      <div class="actions">
        <button class="btn small secondary" onclick="editProduct(${p.id})">แก้ไข</button>
        <button class="btn small danger" onclick="deleteProduct(${p.id})">ลบ</button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--muted)">ยังไม่มีสินค้า</p>';
  if (document.getElementById('pos-product-list')) renderPosProductList();
}

document.getElementById('product-img-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  currentProductImg = await uploadImage(file);
  const prev = document.getElementById('product-img-preview');
  prev.src = currentProductImg; prev.style.display = 'block';
});

function resetProductForm() {
  document.getElementById('product-id').value = '';
  document.getElementById('product-sku').value = '';
  document.getElementById('product-category').value = '';
  document.getElementById('product-name-th').value = '';
  document.getElementById('product-name-en').value = '';
  document.getElementById('product-desc-th').value = '';
  document.getElementById('product-desc-en').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-stock').value = '';
  document.getElementById('product-form-title').textContent = 'เพิ่มสินค้าใหม่';
  document.getElementById('product-img-preview').style.display = 'none';
  currentProductImg = '';
}
window.resetProductForm = resetProductForm;

function editProduct(id) {
  const p = PRODUCTS_ADMIN.find(x => x.id === id); if (!p) return;
  document.getElementById('product-id').value = p.id;
  document.getElementById('product-sku').value = p.sku || '';
  document.getElementById('product-category').value = p.category || '';
  document.getElementById('product-name-th').value = p.name_th || '';
  document.getElementById('product-name-en').value = p.name_en || '';
  document.getElementById('product-desc-th').value = p.desc_th || '';
  document.getElementById('product-desc-en').value = p.desc_en || '';
  document.getElementById('product-price').value = p.price;
  document.getElementById('product-stock').value = p.stock_qty;
  document.getElementById('product-form-title').textContent = 'แก้ไขสินค้า #' + p.id;
  currentProductImg = p.image_url || '';
  const prev = document.getElementById('product-img-preview');
  if (currentProductImg) { prev.src = currentProductImg; prev.style.display = 'block'; } else prev.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.editProduct = editProduct;

async function saveProduct() {
  const id = document.getElementById('product-id').value;
  const payload = {
    sku: document.getElementById('product-sku').value,
    category: document.getElementById('product-category').value || 'ทั่วไป',
    image_url: currentProductImg,
    name_th: document.getElementById('product-name-th').value,
    name_en: document.getElementById('product-name-en').value,
    desc_th: document.getElementById('product-desc-th').value,
    desc_en: document.getElementById('product-desc-en').value,
    price: document.getElementById('product-price').value,
    stock_qty: document.getElementById('product-stock').value,
    active: true
  };
  try {
    if (id) await api('/api/products/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
    showToast('บันทึกสินค้าเรียบร้อย');
    resetProductForm();
    loadProductsAdmin(); loadDashboard();
  } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message); }
}
window.saveProduct = saveProduct;

async function deleteProduct(id) {
  if (!confirm('ยืนยันลบสินค้านี้?')) return;
  await api('/api/products/' + id, { method: 'DELETE' });
  loadProductsAdmin(); loadDashboard();
}
window.deleteProduct = deleteProduct;

// ---------- ORDERS ----------
let ORDERS_ADMIN = [];
const ORDER_STATUS_LABEL = { pending: 'รอดำเนินการ', processing: 'กำลังจัดเตรียม', shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก' };
const PAY_STATUS_LABEL = { unpaid: 'ยังไม่ชำระเงิน', pending_verification: 'รอตรวจสอบสลิป', paid: 'ชำระเงินแล้ว', rejected: 'สลิปไม่ผ่าน' };

async function loadOrdersAdmin() {
  ORDERS_ADMIN = await api('/api/orders');
  const pendingCount = ORDERS_ADMIN.filter(o => o.payment_status === 'pending_verification').length;
  const badge = document.getElementById('order-badge');
  if (pendingCount > 0) { badge.style.display = 'inline-block'; badge.textContent = pendingCount; } else badge.style.display = 'none';

  document.getElementById('orders-list').innerHTML = ORDERS_ADMIN.map(o => `
    <tr>
      <td>${o.order_number}<br><small style="color:var(--muted)">${o.channel === 'pos' ? '🖥️ POS' : '🌐 ออนไลน์'}</small></td>
      <td>${escapeHtml(o.customer_name || o.shipping_name || '-')}</td>
      <td>฿${Number(o.total_amount).toLocaleString('th-TH')}</td>
      <td><span class="tag ${o.status === 'completed' ? 'done' : o.status === 'cancelled' ? '' : 'progress'}">${ORDER_STATUS_LABEL[o.status] || o.status}</span></td>
      <td><span class="tag ${o.payment_status === 'paid' ? 'done' : o.payment_status === 'rejected' ? '' : 'new'}">${PAY_STATUS_LABEL[o.payment_status] || o.payment_status}</span></td>
      <td>${new Date(o.created_at).toLocaleDateString('th-TH')}</td>
      <td><button class="btn small secondary" onclick="openOrderModal(${o.id})">ดู</button></td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="color:var(--muted)">ยังไม่มีคำสั่งซื้อ</td></tr>';
}

async function openOrderModal(orderId) {
  const data = await api('/api/orders/' + orderId);
  const { order, items } = data;
  document.getElementById('order-modal-body').innerHTML = `
    <p><b>เลขที่คำสั่งซื้อ:</b> ${order.order_number}</p>
    <p><b>ลูกค้า:</b> ${escapeHtml(order.shipping_name || '-')} (${escapeHtml(order.shipping_phone || '-')})</p>
    <p><b>ที่อยู่จัดส่ง:</b> ${escapeHtml(order.shipping_address || '-')}</p>
    <div style="margin:1rem 0; border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:1rem 0;">
      ${items.map(i => `<div style="display:flex; justify-content:space-between; font-size:.85rem; margin-bottom:.4rem;"><span>${escapeHtml(i.product_name)} × ${i.quantity}</span><span>฿${Number(i.subtotal).toLocaleString('th-TH')}</span></div>`).join('')}
      <div style="display:flex; justify-content:space-between; font-weight:700; margin-top:.6rem;"><span>รวม</span><span>฿${Number(order.total_amount).toLocaleString('th-TH')}</span></div>
    </div>
    ${order.payment_slip_url ? `<p><b>สลิปการโอนเงิน:</b></p><img src="${order.payment_slip_url}" style="max-width:100%; border-radius:8px; margin-bottom:1rem;">` : '<p style="color:var(--muted); font-size:.85rem;">ยังไม่มีสลิปการโอนเงิน</p>'}
    <div class="grid2">
      <div class="field">
        <label>สถานะคำสั่งซื้อ</label>
        <select id="modal-order-status" onchange="updateOrderStatus(${order.id}, this.value)">
          ${Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${order.status === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>สถานะการชำระเงิน</label>
        <select id="modal-pay-status" onchange="updatePaymentStatus(${order.id}, this.value)">
          ${Object.entries(PAY_STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${order.payment_status === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
    </div>
    <a href="/api/orders/${order.id}/invoice" target="_blank" class="btn secondary" style="display:block; text-align:center; text-decoration:none; margin-top:.5rem;">📄 ดูใบเสร็จ (PDF)</a>
  `;
  document.getElementById('order-modal-overlay').style.display = 'flex';
}
window.openOrderModal = openOrderModal;
function closeOrderModal() { document.getElementById('order-modal-overlay').style.display = 'none'; }
window.closeOrderModal = closeOrderModal;

async function updateOrderStatus(orderId, status) {
  try {
    await api(`/api/orders/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    showToast('อัปเดตสถานะคำสั่งซื้อแล้ว');
    loadOrdersAdmin();
  } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message); }
}
window.updateOrderStatus = updateOrderStatus;

async function updatePaymentStatus(orderId, payment_status) {
  try {
    await api(`/api/orders/${orderId}/payment-status`, { method: 'PUT', body: JSON.stringify({ payment_status }) });
    showToast(payment_status === 'rejected' ? 'ปฏิเสธสลิป — คืนสต๊อกสินค้าแล้ว' : 'อัปเดตสถานะการชำระเงินแล้ว');
    loadOrdersAdmin(); loadProductsAdmin();
  } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message); }
}
window.updatePaymentStatus = updatePaymentStatus;

// ---------- POS ----------
let posCart = [];

function renderPosProductList() {
  const q = (document.getElementById('pos-search').value || '').toLowerCase();
  const filtered = PRODUCTS_ADMIN.filter(p => !q || p.name_th.toLowerCase().includes(q));
  document.getElementById('pos-product-list').innerHTML = filtered.map(p => `
    <div class="item-card" style="cursor:pointer;" onclick="addToPosCart(${p.id})">
      <img src="${p.image_url || '/assets/img/logo.jpg'}" style="width:44px;height:44px;">
      <div class="info">
        <h4 style="font-size:.85rem;">${escapeHtml(p.name_th)}</h4>
        <p>฿${Number(p.price).toLocaleString('th-TH')} • สต๊อก: ${p.stock_qty}</p>
      </div>
    </div>
  `).join('') || '<p style="color:var(--muted)">ไม่พบสินค้า</p>';
}
window.renderPosProductList = renderPosProductList;

function addToPosCart(productId) {
  const p = PRODUCTS_ADMIN.find(x => x.id === productId); if (!p) return;
  const existing = posCart.find(c => c.product_id === productId);
  if (existing) existing.qty++;
  else posCart.push({ product_id: productId, qty: 1 });
  renderPosCart();
}
window.addToPosCart = addToPosCart;

function updatePosCartQty(productId, qty) {
  if (qty <= 0) posCart = posCart.filter(c => c.product_id !== productId);
  else { const item = posCart.find(c => c.product_id === productId); if (item) item.qty = qty; }
  renderPosCart();
}
window.updatePosCartQty = updatePosCartQty;

function renderPosCart() {
  let total = 0;
  document.getElementById('pos-cart').innerHTML = posCart.map(c => {
    const p = PRODUCTS_ADMIN.find(x => x.id === c.product_id); if (!p) return '';
    const subtotal = p.price * c.qty; total += subtotal;
    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:.5rem 0; border-bottom:1px solid var(--border); font-size:.85rem;">
      <span>${escapeHtml(p.name_th)}</span>
      <div style="display:flex; align-items:center; gap:.5rem;">
        <button class="btn small secondary" onclick="updatePosCartQty(${p.id}, ${c.qty - 1})">−</button>
        <span>${c.qty}</span>
        <button class="btn small secondary" onclick="updatePosCartQty(${p.id}, ${c.qty + 1})">+</button>
        <span style="min-width:70px; text-align:right;">฿${subtotal.toLocaleString('th-TH')}</span>
      </div>
    </div>`;
  }).join('') || '<p style="color:var(--muted); font-size:.85rem;">ยังไม่ได้เลือกสินค้า</p>';
  document.getElementById('pos-total').textContent = '฿' + total.toLocaleString('th-TH');
}

async function submitPosSale() {
  if (!posCart.length) { showToast('กรุณาเลือกสินค้าก่อน'); return; }
  try {
    await api('/api/orders/pos', {
      method: 'POST',
      body: JSON.stringify({
        items: posCart,
        customer_name: document.getElementById('pos-customer-name').value,
        customer_phone: document.getElementById('pos-customer-phone').value
      })
    });
    showToast('บันทึกการขายเรียบร้อย');
    posCart = [];
    renderPosCart();
    document.getElementById('pos-customer-name').value = '';
    document.getElementById('pos-customer-phone').value = '';
    loadProductsAdmin(); loadOrdersAdmin(); loadDashboard();
  } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message); }
}
window.submitPosSale = submitPosSale;

// ---------- SITE CONTENT (ข้อความ UI ทุกจุดที่แสดงหน้าบ้าน) ----------
const CONTENT_GROUP_LABELS = {
  nav: '🧭 เมนูนำทาง (Navbar)',
  hero: '🏠 หน้าแรก (Hero)',
  services: '🧩 หัวข้อส่วน "บริการของเรา"',
  portfolio: '🖼️ หัวข้อส่วน "ผลงานของเรา"',
  why: '⭐ ส่วน "ทำไมต้องเลือกเรา"',
  contact: '📞 ส่วนติดต่อเรา',
  form: '📝 ฟอร์มติดต่อ',
  chat: '💬 แชทสด'
};
const CONTENT_KEY_LABELS = {
  'nav.services': 'เมนู: บริการของเรา', 'nav.portfolio': 'เมนู: ผลงาน', 'nav.why': 'เมนู: ทำไมต้องเรา',
  'nav.contact': 'เมนู: ติดต่อเรา', 'nav.cta': 'ปุ่ม: ติดต่อเลย (บน navbar)',
  'hero.badge': 'ป้ายเล็กเหนือหัวข้อใหญ่', 'hero.cta1': 'ปุ่ม: ขอคำปรึกษาฟรี', 'hero.cta2': 'ปุ่ม: ดูผลงานของเรา',
  'hero.stat1': 'คำอธิบายสถิติที่ 1', 'hero.stat2': 'คำอธิบายสถิติที่ 2', 'hero.stat3': 'คำอธิบายสถิติที่ 3',
  'hero.stat4': 'คำอธิบายสถิติที่ 4 (บริการ)', 'hero.stat5': 'คำอธิบายสถิติที่ 5 (ผลงาน)',
  'services.tag': 'ป้ายเล็ก (SERVICES)', 'services.title': 'หัวข้อใหญ่', 'services.sub': 'คำอธิบายใต้หัวข้อ',
  'portfolio.tag': 'ป้ายเล็ก (PORTFOLIO)', 'portfolio.title': 'หัวข้อใหญ่', 'portfolio.sub': 'คำอธิบายใต้หัวข้อ',
  'why.tag': 'ป้ายเล็ก (WHY US)', 'why.title': 'หัวข้อใหญ่',
  'why.i1t': 'หัวข้อย่อยที่ 1', 'why.i1d': 'คำอธิบายข้อ 1', 'why.i2t': 'หัวข้อย่อยที่ 2', 'why.i2d': 'คำอธิบายข้อ 2',
  'why.i3t': 'หัวข้อย่อยที่ 3', 'why.i3d': 'คำอธิบายข้อ 3', 'why.i4t': 'หัวข้อย่อยที่ 4', 'why.i4d': 'คำอธิบายข้อ 4',
  'contact.tag': 'ป้ายเล็ก (CONTACT)', 'contact.title': 'หัวข้อใหญ่', 'contact.sub': 'คำอธิบายใต้หัวข้อ',
  'contact.phone': 'ป้ายกำกับ: เบอร์โทร', 'contact.email': 'ป้ายกำกับ: อีเมล', 'contact.qr': 'ข้อความใต้ QR LINE',
  'form.name': 'ป้ายกำกับ: ชื่อ-นามสกุล', 'form.phone': 'ป้ายกำกับ: เบอร์โทรศัพท์', 'form.email': 'ป้ายกำกับ: อีเมล',
  'form.service': 'ป้ายกำกับ: บริการที่สนใจ', 'form.message': 'ป้ายกำกับ: รายละเอียดงาน', 'form.submit': 'ปุ่ม: ส่งข้อความ',
  'form.ok': 'ข้อความเมื่อส่งฟอร์มสำเร็จ', 'form.err': 'ข้อความเมื่อส่งฟอร์มไม่สำเร็จ',
  'chat.title': 'หัวข้อหน้าต่างแชท', 'chat.sub': 'คำอธิบายใต้หัวข้อแชท'
};
const GROUP_ORDER = ['nav', 'hero', 'services', 'portfolio', 'why', 'contact', 'form', 'chat'];
let CONTENT_TEXTS = {};

async function loadContentTexts() {
  CONTENT_TEXTS = await api('/api/content-texts');
  const s = await api('/api/settings');
  document.getElementById('ct-stat1-number').value = s.stat1_number || '';
  document.getElementById('ct-stat2-number').value = s.stat2_number || '';
  document.getElementById('ct-stat3-number').value = s.stat3_number || '';

  const groups = {};
  for (const [key, val] of Object.entries(CONTENT_TEXTS)) {
    const g = val.group || 'other';
    if (!groups[g]) groups[g] = [];
    groups[g].push({ key, ...val });
  }
  const orderedGroups = [...GROUP_ORDER.filter(g => groups[g]), ...Object.keys(groups).filter(g => !GROUP_ORDER.includes(g))];

  document.getElementById('content-texts-groups').innerHTML = orderedGroups.map(g => `
    <div class="panel">
      <h3>${CONTENT_GROUP_LABELS[g] || g}</h3>
      ${groups[g].map(item => `
        <div class="field">
          <label>${escapeHtml(CONTENT_KEY_LABELS[item.key] || item.key)} <span style="color:var(--muted); font-size:.75rem;">(${item.key})</span></label>
          <div class="grid2">
            <div>
              <label style="font-size:.72rem;">ไทย</label>
              ${item.th && item.th.length > 60
                ? `<textarea data-ct-key="${item.key}" data-ct-lang="th">${escapeHtml(item.th || '')}</textarea>`
                : `<input data-ct-key="${item.key}" data-ct-lang="th" value="${escapeHtml(item.th || '')}">`}
            </div>
            <div>
              <label style="font-size:.72rem;">English</label>
              ${item.en && item.en.length > 60
                ? `<textarea data-ct-key="${item.key}" data-ct-lang="en">${escapeHtml(item.en || '')}</textarea>`
                : `<input data-ct-key="${item.key}" data-ct-lang="en" value="${escapeHtml(item.en || '')}">`}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

async function saveContentTexts() {
  const msg = document.getElementById('content-save-msg');
  msg.textContent = 'กำลังบันทึก...';
  try {
    const updates = {};
    document.querySelectorAll('[data-ct-key]').forEach(el => {
      const key = el.getAttribute('data-ct-key');
      const lang = el.getAttribute('data-ct-lang');
      if (!updates[key]) updates[key] = { th: '', en: '' };
      updates[key][lang] = el.value;
    });
    await api('/api/content-texts', { method: 'PUT', body: JSON.stringify(updates) });
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        stat1_number: document.getElementById('ct-stat1-number').value,
        stat2_number: document.getElementById('ct-stat2-number').value,
        stat3_number: document.getElementById('ct-stat3-number').value
      })
    });
    msg.textContent = 'บันทึกเรียบร้อย — หน้าเว็บอัปเดตทันที';
    showToast('บันทึกเนื้อหาหน้าเว็บเรียบร้อย');
    setTimeout(() => { msg.textContent = ''; }, 3000);
  } catch (e) {
    msg.textContent = '';
    showToast('เกิดข้อผิดพลาด: ' + e.message);
  }
}
window.saveContentTexts = saveContentTexts;

// ---------- ACCOUNT ----------
async function changePassword() {
  const currentPassword = document.getElementById('acc-current').value;
  const newPassword = document.getElementById('acc-new').value;
  const msg = document.getElementById('acc-msg');
  try {
    await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    msg.style.color = '#5eead4'; msg.textContent = 'เปลี่ยนรหัสผ่านสำเร็จ';
    document.getElementById('acc-current').value = ''; document.getElementById('acc-new').value = '';
  } catch (e) { msg.style.color = '#ff8b8b'; msg.textContent = e.message; }
}
window.changePassword = changePassword;

// ---------- UPLOAD HELPER (แปลงไฟล์เป็น base64 แล้วส่งเป็น JSON เพราะ Vercel ไม่มี disk ถาวรให้เก็บไฟล์) ----------
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file) {
  if (file.size > 4 * 1024 * 1024) { showToast('ไฟล์รูปใหญ่เกินไป กรุณาใช้ไฟล์ไม่เกิน 4MB'); throw new Error('file too large'); }
  const dataUrl = await fileToDataUrl(file);
  const res = await fetch('/api/upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }), credentials: 'include'
  });
  const data = await res.json();
  if (!res.ok) { showToast('อัปโหลดรูปไม่สำเร็จ: ' + data.error); throw new Error(data.error); }
  return data.url;
}

// ---------- CHAT (admin side) — polling ทุก 4 วิ สำหรับรายชื่อห้อง / ทุก 3 วิ สำหรับห้องที่เปิดอยู่ ----------
async function loadChatSessions() {
  const prevIds = CHAT_SESSIONS.map(s => s.id + s.last_message_at).join(',');
  CHAT_SESSIONS = await api('/api/chat/sessions');
  const newIds = CHAT_SESSIONS.map(s => s.id + s.last_message_at).join(',');
  renderChatSessions();
  const anyOpen = CHAT_SESSIONS.some(s => s.status === 'open');
  document.getElementById('chat-badge-menu').style.display = anyOpen ? 'inline-block' : 'none';
  if (prevIds && prevIds !== newIds) showToast('มีความเคลื่อนไหวในห้องแชท');
}

function startSessionsPolling() {
  if (sessionsPollTimer) return;
  loadChatSessions();
  // realtime (ถ้าตั้งค่าไว้) จะดันข้อมูลมาทันที ส่วนนี้เหลือไว้เป็นตัว sync สำรอง
  sessionsPollTimer = setInterval(loadChatSessions, 20000);
}

function renderChatSessions() {
  document.getElementById('chat-sessions').innerHTML = CHAT_SESSIONS.map(s => `
    <div class="chat-session-item ${s.id === activeChatSessionId ? 'active' : ''}" onclick="openChatSession('${s.id}')">
      ${escapeHtml(s.customer_name)} ${s.id.startsWith('line:') ? '💬 LINE' : '🌐 เว็บ'}
      <small>${s.last_message_at}</small>
    </div>
  `).join('') || '<p style="padding:1rem; color:var(--muted); font-size:.85rem;">ยังไม่มีห้องแชท</p>';
}

async function renderActiveMessages() {
  if (!activeChatSessionId) return;
  const msgs = await api('/api/chat/sessions/' + encodeURIComponent(activeChatSessionId) + '/messages');
  if (msgs.length === lastActiveMsgCount) return;
  lastActiveMsgCount = msgs.length;
  const body = document.getElementById('chat-window-body');
  body.innerHTML = msgs.map(m => `<div class="chat-window-msg ${m.sender}">${escapeHtml(m.message)}</div>`).join('') || '<p style="color:var(--muted); padding:.5rem;">ยังไม่มีข้อความ</p>';
  body.scrollTop = body.scrollHeight;
}

async function openChatSession(id) {
  activeChatSessionId = id;
  lastActiveMsgCount = -1;
  renderChatSessions();
  await renderActiveMessages();
  if (messagesPollTimer) clearInterval(messagesPollTimer);
  messagesPollTimer = setInterval(renderActiveMessages, 15000); // ตัว sync สำรอง เผื่อ realtime พลาดอีเวนต์
  subscribeToSessionRealtime(id);
}
window.openChatSession = openChatSession;

async function adminSendChat() {
  const input = document.getElementById('chat-window-input');
  const message = input.value.trim();
  if (!message || !activeChatSessionId) return;
  input.value = '';
  const body = document.getElementById('chat-window-body');
  body.insertAdjacentHTML('beforeend', `<div class="chat-window-msg admin">${escapeHtml(message)}</div>`);
  body.scrollTop = body.scrollHeight;
  lastActiveMsgCount++;
  try {
    await api('/api/chat/sessions/' + encodeURIComponent(activeChatSessionId) + '/reply', { method: 'POST', body: JSON.stringify({ message }) });
  } catch (e) { showToast('ส่งข้อความไม่สำเร็จ: ' + e.message); }
}
window.adminSendChat = adminSendChat;
document.getElementById('chat-window-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') adminSendChat(); });

// ---------- Supabase Realtime (แจ้งเตือนแอดมินแบบทันที) ----------
let sbClient = null;
let activeSessionRealtimeChannel = null;

async function initRealtimeAdmin() {
  try {
    const cfg = await fetch('/api/realtime-config').then(r => r.json());
    if (!cfg.enabled || typeof window.supabase === 'undefined') return; // ยังไม่ตั้งค่า Supabase -> ใช้ polling ตามปกติ
    sbClient = window.supabase.createClient(cfg.url, cfg.anonKey);
    // ฟังช่องกลาง: มีข้อความใหม่เข้ามาห้องไหนก็ได้ -> รีเฟรชรายชื่อห้อง/badge ทันที
    sbClient.channel('chat-admin-feed')
      .on('broadcast', { event: 'new_message' }, () => loadChatSessions())
      .subscribe();
  } catch (e) { /* เงียบไว้ — ระบบยังทำงานผ่าน polling ได้ตามปกติ */ }
}

function subscribeToSessionRealtime(sessionId) {
  if (!sbClient) return;
  if (activeSessionRealtimeChannel) { sbClient.removeChannel(activeSessionRealtimeChannel); activeSessionRealtimeChannel = null; }
  activeSessionRealtimeChannel = sbClient.channel('chat-session-' + sessionId)
    .on('broadcast', { event: 'message' }, () => renderActiveMessages())
    .subscribe();
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

checkSession();
