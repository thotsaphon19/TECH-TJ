// ---------- ค่าเริ่มต้น (fallback) เผื่อโหลดจากฐานข้อมูลไม่ทัน/ไม่มีข้อมูล — ค่าจริงจะถูกดึงจาก /api/content-texts มาทับ ----------
const DEFAULT_I18N = {
  th: {
    'nav.services':'บริการของเรา','nav.portfolio':'ผลงาน','nav.why':'ทำไมต้องเรา','nav.contact':'ติดต่อเรา','nav.cta':'ติดต่อเลย',
    'hero.badge':'SOLUTION TECHNOLOGY','hero.cta1':'ขอคำปรึกษาฟรี','hero.cta2':'ดูผลงานของเรา',
    'hero.stat1':'ชม. ส่งงานไว','hero.stat2':'รับผิดชอบงาน','hero.stat3':'ทีมซัพพอร์ต','hero.stat4':'บริการครบวงจร','hero.stat5':'ผลงานที่ส่งมอบ',
    'services.tag':'SERVICES','services.title':'บริการของเรา','services.sub':'ครบทุกความต้องการด้านเทคโนโลยี ตั้งแต่เว็บไซต์ แอปพลิเคชัน ไปจนถึงระบบ IoT',
    'portfolio.tag':'PORTFOLIO','portfolio.title':'ผลงานของเรา','portfolio.sub':'ตัวอย่างระบบที่พัฒนาให้ลูกค้าจริง',
    'why.tag':'WHY US','why.title':'ทำไมต้องเลือกเรา',
    'why.i1t':'ส่งงานไว','why.i1d':'',
    'why.i2t':'รับผิดชอบงาน 100%','why.i2d':'ตรงเวลา ไม่ทิ้งงาน',
    'why.i3t':'สื่อสารง่าย','why.i3d':'คุยตรง เข้าใจงานจริง',
    'why.i4t':'ดูแลหลังส่งงาน','why.i4d':'มีทีมซัพพอร์ตต่อเนื่อง',
    'contact.tag':'CONTACT','contact.title':'ติดต่อสอบถาม / แจ้งความต้องการ','contact.sub':'ทีมงานพร้อมให้บริการ รวดเร็ว ทันใจ ตอบกลับภายใน 24 ชม.',
    'contact.phone':'เบอร์โทร','contact.email':'อีเมล','contact.qr':'สแกนเพิ่มเพื่อน LINE OA เพื่อพูดคุยกับเราได้ทันที',
    'form.name':'ชื่อ-นามสกุล','form.phone':'เบอร์โทรศัพท์','form.email':'อีเมล','form.service':'บริการที่สนใจ','form.message':'รายละเอียดงาน','form.submit':'ส่งข้อความ',
    'form.ok':'ส่งข้อความสำเร็จ! ทีมงานจะติดต่อกลับโดยเร็วที่สุด','form.err':'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
    'chat.title':'แชทกับ TECH-TJ','chat.sub':'ทีมงานตอบกลับโดยเร็วที่สุด'
  },
  en: {
    'nav.services':'Services','nav.portfolio':'Portfolio','nav.why':'Why Us','nav.contact':'Contact','nav.cta':'Contact Us',
    'hero.badge':'SOLUTION TECHNOLOGY','hero.cta1':'Free Consultation','hero.cta2':'View Our Work',
    'hero.stat1':'hrs delivery','hero.stat2':'accountability','hero.stat3':'support team','hero.stat4':'full-service','hero.stat5':'projects delivered',
    'services.tag':'SERVICES','services.title':'Our Services','services.sub':'Everything you need in technology — from websites and apps to IoT systems',
    'portfolio.tag':'PORTFOLIO','portfolio.title':'Our Work','portfolio.sub':'Real systems built for real clients',
    'why.tag':'WHY US','why.title':'Why Choose Us',
    'why.i1t':'Fast Delivery','why.i1d':'',
    'why.i2t':'100% Accountability','why.i2d':'On time, never abandoned',
    'why.i3t':'Easy Communication','why.i3d':'Direct talk, real understanding',
    'why.i4t':'Post-launch Support','why.i4d':'Ongoing support team',
    'contact.tag':'CONTACT','contact.title':'Get in Touch','contact.sub':'Our team is ready to help — fast response within 24 hours',
    'contact.phone':'Phone','contact.email':'Email','contact.qr':'Scan to add our LINE OA and chat with us instantly',
    'form.name':'Full Name','form.phone':'Phone Number','form.email':'Email','form.service':'Service Interested','form.message':'Project Details','form.submit':'Send Message',
    'form.ok':'Message sent! Our team will contact you shortly.','form.err':'Something went wrong. Please try again.',
    'chat.title':'Chat with TECH-TJ','chat.sub':'Our team responds quickly'
  }
};
// I18N คือค่าที่ใช้งานจริง เริ่มจาก default แล้วจะถูกทับด้วยข้อมูลจากฐานข้อมูล (fetchContentTexts)
const I18N = { th: { ...DEFAULT_I18N.th }, en: { ...DEFAULT_I18N.en } };

async function fetchContentTexts() {
  try {
    const data = await fetch('/api/content-texts').then(r => r.json());
    for (const [key, val] of Object.entries(data)) {
      // ใช้ !== undefined/null แทนการเช็ค truthy เพื่อให้แอดมิน "ลบข้อความให้ว่างเปล่า" ได้จริง
      // (ค่าว่าง '' เป็นค่าที่ตั้งใจไว้ ไม่ใช่ค่าที่ไม่มี ถ้าเช็คแบบ truthy จะข้ามค่าว่างไปใช้ default แทนซึ่งผิด)
      if (val.th !== undefined && val.th !== null) I18N.th[key] = val.th;
      if (val.en !== undefined && val.en !== null) I18N.en[key] = val.en;
    }
  } catch (e) { /* ใช้ค่า default ต่อไปถ้าโหลดไม่สำเร็จ */ }
}

let currentLang = localStorage.getItem('tj_lang') || 'th';
let SERVICES = [], SETTINGS = {};

function applyStaticI18n() {
  document.querySelectorAll('[data-i]').forEach(el => {
    const key = el.getAttribute('data-i');
    const val = I18N[currentLang][key];
    if (val !== undefined && val !== null) {
      el.textContent = val;
      el.style.display = val === '' ? 'none' : ''; // ข้อความว่าง = ซ่อน element นี้ไปเลย ไม่ให้เหลือช่องว่างเปล่าๆ
    }
  });
  document.getElementById('lang-th').classList.toggle('active', currentLang === 'th');
  document.getElementById('lang-en').classList.toggle('active', currentLang === 'en');
  const langThMobile = document.getElementById('lang-th-mobile'); if (langThMobile) langThMobile.classList.toggle('active', currentLang === 'th');
  const langEnMobile = document.getElementById('lang-en-mobile'); if (langEnMobile) langEnMobile.classList.toggle('active', currentLang === 'en');
  document.documentElement.lang = currentLang;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('tj_lang', lang);
  applyStaticI18n();
  renderSettings();
  renderServices();
  renderPortfolio();
  populateServiceSelect();
}
window.setLang = setLang;

function t(obj, field) {
  const suffix = currentLang === 'en' ? '_en' : '_th';
  return obj[field + suffix] || obj[field + '_th'] || '';
}

async function loadAll() {
  const [settings, services, portfolio] = await Promise.all([
    fetch('/api/settings').then(r => r.json()),
    fetch('/api/services').then(r => r.json()),
    fetch('/api/portfolio').then(r => r.json()),
    fetchContentTexts()
  ]);
  SETTINGS = settings; SERVICES = services; PORTFOLIO = portfolio;
  applyStaticI18n(); // เรียกอีกครั้งหลังโหลดข้อความจากฐานข้อมูลเสร็จ เพื่อทับค่า default ที่แสดงไปก่อนหน้า
  renderSettings();
  renderServices();
  renderPortfolio();
  populateServiceSelect();
}
let PORTFOLIO = [];

function renderSettings() {
  const s = SETTINGS;
  if (!s.site_name_th) return;
  document.getElementById('site-name').textContent = currentLang === 'en' ? (s.site_name_en || s.site_name_th) : s.site_name_th;
  document.getElementById('site-logo').src = s.logo_url || '/assets/img/logo.jpg';
  document.getElementById('favicon').href = s.favicon_url || s.logo_url || '/assets/img/logo.jpg';
  document.getElementById('hero-title-1').textContent = currentLang === 'en' ? (s.tagline_en || s.tagline_th) : (s.tagline_th);
  document.getElementById('hero-title-2').textContent = '';
  document.getElementById('hero-sub').textContent = currentLang === 'en' ? (s.hero_sub_en || s.hero_sub_th) : (s.hero_sub_th);
  document.getElementById('c-phone').textContent = s.phone || '';
  document.getElementById('c-line').textContent = s.line_id || '';
  document.getElementById('c-fb').textContent = s.facebook || '';
  document.getElementById('c-email').textContent = s.email_display || '';
  document.getElementById('c-qr').src = s.line_qr_url || '/assets/img/line-qr-flyer.jpg';
  document.getElementById('f-phone').textContent = '📞 ' + (s.phone || '');
  document.getElementById('f-line').textContent = '💬 LINE: ' + (s.line_id || '');
  document.getElementById('f-fb').textContent = '📘 Facebook: ' + (s.facebook || '');
  document.getElementById('f-name-text').textContent = currentLang === 'en' ? (s.site_name_en || s.site_name_th) : s.site_name_th;
  document.getElementById('f-year').textContent = new Date().getFullYear();
  if (s.primary_color) document.documentElement.style.setProperty('--primary', s.primary_color);
  if (s.accent_color) document.documentElement.style.setProperty('--accent', s.accent_color);
  if (s.font_family) document.documentElement.style.setProperty('--font-main', `'${s.font_family}', sans-serif`);
  const st1 = document.getElementById('stat-num-1'); if (st1) st1.textContent = s.stat1_number || '24-48';
  const st2 = document.getElementById('stat-num-2'); if (st2) st2.textContent = s.stat2_number || '100%';
  const st3 = document.getElementById('stat-num-3'); if (st3) st3.textContent = s.stat3_number || '24/7';
  const heroImg = document.getElementById('hero-showcase-img'); if (heroImg && s.hero_image_url) heroImg.src = s.hero_image_url;
  const heroBadge = document.getElementById('hero-badge-text'); if (heroBadge) heroBadge.textContent = s.hero_badge_text || 'ENTERING THE GRID';
}

const CARD_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#14b8a6', '#22c55e', '#ef4444'];
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderServices() {
  const grid = document.getElementById('services-grid');
  if (!SERVICES.length) { grid.innerHTML = '<div class="skeleton" style="height:180px"></div>'.repeat(3); return; }
  grid.innerHTML = SERVICES.map((s, i) => {
    const color = CARD_COLORS[i % CARD_COLORS.length];
    return `
    <div class="service-card reveal in" style="--card-color:${color}; --card-bg:${hexToRgba(color, 0.16)}">
      <div class="service-icon">${s.icon || '💡'}</div>
      <h3>${escapeHtml(t(s,'title'))}</h3>
      <p>${escapeHtml(t(s,'desc'))}</p>
    </div>
  `;
  }).join('');
  const statServices = document.getElementById('stat-services');
  if (statServices) statServices.textContent = SERVICES.length;
}

function renderPortfolio() {
  const grid = document.getElementById('portfolio-grid');
  if (!PORTFOLIO.length) { grid.innerHTML = '<div class="skeleton" style="height:280px"></div>'.repeat(2); return; }
  grid.innerHTML = PORTFOLIO.map(p => `
    <div class="portfolio-card reveal in">
      ${p.image_url ? `<img src="${p.image_url}" alt="">` : ''}
      <div class="pf-body">
        <h3>${escapeHtml(t(p,'title'))}</h3>
        <p>${escapeHtml(t(p,'desc'))}</p>
      </div>
    </div>
  `).join('');
  const statPortfolio = document.getElementById('stat-portfolio');
  if (statPortfolio) statPortfolio.textContent = PORTFOLIO.length + '+';
}

function populateServiceSelect() {
  const sel = document.getElementById('f-service');
  sel.innerHTML = SERVICES.map(s => `<option value="${escapeHtml(t(s,'title'))}">${escapeHtml(t(s,'title'))}</option>`).join('');
}

function escapeHtml(str='') {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function scrollToContact() { document.getElementById('contact').scrollIntoView({behavior:'smooth'}); }
window.scrollToContact = scrollToContact;

// ---------- Contact form ----------
document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('form-msg');
  msgEl.textContent = ''; msgEl.className = 'form-msg';
  const payload = {
    name: document.getElementById('f-name').value,
    phone: document.getElementById('f-phone').value,
    email: document.getElementById('f-email').value,
    service_interested: document.getElementById('f-service').value,
    message: document.getElementById('f-message').value
  };
  try {
    const res = await fetch('/api/contact', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'error');
    msgEl.textContent = I18N[currentLang]['form.ok'];
    msgEl.className = 'form-msg ok';
    e.target.reset();
  } catch (err) {
    msgEl.textContent = I18N[currentLang]['form.err'];
    msgEl.className = 'form-msg err';
  }
});

// ---------- Scroll reveal ----------
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('in'); });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ---------- Live chat (polling — เข้ากันได้กับ Vercel serverless ที่ไม่รองรับ WebSocket ค้างสาย) ----------
function getSessionId() {
  let id = localStorage.getItem('tj_chat_session');
  if (!id) { id = 'web:' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('tj_chat_session', id); }
  return id;
}
const sessionId = getSessionId();
let chatOpened = false;
let lastMsgCount = 0;
let chatPollTimer = null;

function appendChatMsg(sender, message) {
  const body = document.getElementById('chat-body');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + sender;
  div.textContent = message;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

async function pollChatHistory(silent) {
  const rows = await fetch('/api/chat/history/' + encodeURIComponent(sessionId)).then(r => r.json()).catch(() => []);
  if (rows.length === lastMsgCount) return;
  const isNewFromAdmin = rows.length > lastMsgCount && rows.slice(lastMsgCount).some(r => r.sender === 'admin');
  document.getElementById('chat-body').innerHTML = '';
  rows.forEach(r => appendChatMsg(r.sender, r.message));
  lastMsgCount = rows.length;
  if (isNewFromAdmin && !chatOpened) document.getElementById('chat-badge').style.display = 'block';
}

function startChatPolling() {
  if (chatPollTimer) return;
  pollChatHistory();
  // realtime (ถ้าตั้งค่าไว้) จะดันข้อความมาทันที ส่วน poll ที่เหลือไว้เป็นตัว sync สำรองเผื่อพลาดอีเวนต์
  chatPollTimer = setInterval(pollChatHistory, 15000);
}
startChatPolling(); // เริ่ม poll เบา ๆ ตั้งแต่โหลดหน้า เพื่อให้เห็น badge ข้อความใหม่แม้ไม่ได้เปิดแชท

// ---------- Supabase Realtime (แจ้งเตือนแชทแบบทันทีที) ----------
(async function initRealtimeChat() {
  try {
    const cfg = await fetch('/api/realtime-config').then(r => r.json());
    if (!cfg.enabled || typeof window.supabase === 'undefined') return; // ยังไม่ตั้งค่า Supabase -> ใช้ polling ตามปกติ
    const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    sb.channel('chat-session-' + sessionId)
      .on('broadcast', { event: 'message' }, () => pollChatHistory())
      .subscribe();
  } catch (e) { /* เงียบไว้ — แชทยังทำงานผ่าน polling ได้ตามปกติ */ }
})();

function toggleChat() {
  const panel = document.getElementById('tj-chat-panel');
  panel.classList.toggle('open');
  chatOpened = panel.classList.contains('open');
  if (chatOpened) {
    document.getElementById('chat-badge').style.display = 'none';
    pollChatHistory();
  }
}
window.toggleChat = toggleChat;

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  appendChatMsg('customer', message);
  lastMsgCount++;
  try {
    await fetch('/api/chat/message', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, name: 'ผู้เยี่ยมชมเว็บไซต์', message })
    });
  } catch (e) { /* เดี๋ยว poll รอบถัดไปจะ sync ให้เอง */ }
}
window.sendChat = sendChat;
document.getElementById('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

// ---------- HUD glitch flicker (สุ่มกะพริบเบาๆ เป็นระยะ ให้ภาพหน้าแรกดูไฮเทค) ----------
(function initHeroGlitch() {
  const hud = document.getElementById('hero-hud');
  if (!hud) return;
  function triggerGlitch() {
    hud.classList.add('glitch');
    setTimeout(() => hud.classList.remove('glitch'), 320);
    setTimeout(triggerGlitch, 4000 + Math.random() * 5000);
  }
  setTimeout(triggerGlitch, 2200 + Math.random() * 2000);
})();

// ---------- init ----------
applyStaticI18n();
loadAll();
