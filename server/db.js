const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.warn('[db] ยังไม่ได้ตั้งค่า DATABASE_URL ใน .env (connection string จาก Neon)');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function query(text, params) {
  return pool.query(text, params);
}

// ---------- schema + seed (รันครั้งเดียวต่อ cold start ของ serverless function) ----------
let initPromise = null;
function ensureInit() {
  if (!initPromise) initPromise = doInit().catch((e) => { initPromise = null; throw e; });
  return initPromise;
}

async function doInit() {
  await query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      icon TEXT DEFAULT '💻',
      image_url TEXT,
      title_th TEXT, title_en TEXT,
      desc_th TEXT, desc_en TEXT,
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS portfolio (
      id SERIAL PRIMARY KEY,
      image_url TEXT,
      title_th TEXT, title_en TEXT,
      desc_th TEXT, desc_en TEXT,
      link_url TEXT,
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id SERIAL PRIMARY KEY,
      name TEXT, phone TEXT, email TEXT,
      service_interested TEXT,
      message TEXT,
      status TEXT DEFAULT 'new',
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      customer_name TEXT DEFAULT 'ผู้เยี่ยมชม',
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT now(),
      last_message_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS content_texts (
      key TEXT PRIMARY KEY,
      group_name TEXT,
      th TEXT,
      en TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      sku TEXT,
      name_th TEXT, name_en TEXT,
      desc_th TEXT, desc_en TEXT,
      category TEXT DEFAULT 'ทั่วไป',
      price NUMERIC(12,2) DEFAULT 0,
      stock_qty INTEGER DEFAULT 0,
      image_url TEXT,
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      address TEXT,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      channel TEXT DEFAULT 'online', -- 'online' (ลูกค้าสั่งเอง) | 'pos' (แอดมินขายหน้าร้าน)
      shipping_name TEXT,
      shipping_phone TEXT,
      shipping_address TEXT,
      subtotal NUMERIC(12,2) DEFAULT 0,
      total_amount NUMERIC(12,2) DEFAULT 0,
      status TEXT DEFAULT 'pending', -- pending | processing | shipped | completed | cancelled
      payment_status TEXT DEFAULT 'unpaid', -- unpaid | pending_verification | paid | rejected
      payment_method TEXT DEFAULT 'bank_transfer',
      payment_slip_url TEXT,
      note TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT,
      unit_price NUMERIC(12,2),
      quantity INTEGER,
      subtotal NUMERIC(12,2)
    );
  `);

  // ---------- seed admin user ----------
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const { rows: existingAdminRows } = await query('SELECT * FROM admin_users WHERE username = $1', [adminUsername]);
  if (!existingAdminRows.length) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'changeme123', 10);
    await query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', [adminUsername, hash]);
  }

  // ---------- seed default settings ----------
  const defaultSettings = {
    site_name_th: 'TECH-TJ Solution Technology',
    site_name_en: 'TECH-TJ Solution Technology',
    tagline_th: 'รับพัฒนาเว็บไซต์ ระบบ และ IoT ครบจบในที่เดียว',
    tagline_en: 'Websites, Software & IoT Solutions — All in One Place',
    hero_sub_th: 'ออกแบบและพัฒนาด้วยเทคโนโลยีที่ทันสมัย ใช้งานง่าย รองรับทุกความต้องการของธุรกิจคุณ',
    hero_sub_en: 'Designed and built with modern technology. Easy to use, tailored to your business needs.',
    logo_url: '/assets/img/logo.jpg',
    favicon_url: '/assets/img/logo.jpg',
    hero_image_url: '/assets/img/hero-showcase.jpg',
    hero_badge_text: 'ENTERING THE GRID',
    primary_color: '#00d4ff',
    accent_color: '#ff6b35',
    font_family: 'Sarabun',
    phone: '066-058-8956',
    line_id: 'tjkeng01',
    facebook: 'TECH TJ',
    facebook_url: 'https://facebook.com/',
    line_qr_url: '/assets/img/line-qr-flyer.jpg',
    email_display: 'contact@techtj.co',
    address_th: '',
    address_en: '',
    default_lang: 'th',
    stat1_number: '24-48',
    stat2_number: '100%',
    stat3_number: '24/7'
  };
  for (const [k, v] of Object.entries(defaultSettings)) {
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [k, v]);
  }

  // ---------- seed content_texts (ข้อความ UI ทุกจุดที่แสดงหน้าบ้าน แก้ไขได้จากหลังบ้านทั้งหมด) ----------
  const defaultContentTexts = [
    // [key, group, th, en]
    ['nav.services', 'nav', 'บริการของเรา', 'Services'],
    ['nav.portfolio', 'nav', 'ผลงาน', 'Portfolio'],
    ['nav.why', 'nav', 'ทำไมต้องเรา', 'Why Us'],
    ['nav.contact', 'nav', 'ติดต่อเรา', 'Contact'],
    ['nav.cta', 'nav', 'ติดต่อเลย', 'Contact Us'],

    ['hero.badge', 'hero', 'SOLUTION TECHNOLOGY', 'SOLUTION TECHNOLOGY'],
    ['hero.cta1', 'hero', 'ขอคำปรึกษาฟรี', 'Free Consultation'],
    ['hero.cta2', 'hero', 'ดูผลงานของเรา', 'View Our Work'],
    ['hero.stat1', 'hero', 'ชม. ส่งงานไว', 'hrs delivery'],
    ['hero.stat2', 'hero', 'รับผิดชอบงาน', 'accountability'],
    ['hero.stat3', 'hero', 'ทีมซัพพอร์ต', 'support team'],
    ['hero.stat4', 'hero', 'บริการครบวงจร', 'full-service'],
    ['hero.stat5', 'hero', 'ผลงานที่ส่งมอบ', 'projects delivered'],

    ['services.tag', 'services', 'SERVICES', 'SERVICES'],
    ['services.title', 'services', 'บริการของเรา', 'Our Services'],
    ['services.sub', 'services', 'ครบทุกความต้องการด้านเทคโนโลยี ตั้งแต่เว็บไซต์ แอปพลิเคชัน ไปจนถึงระบบ IoT', 'Everything you need in technology — from websites and apps to IoT systems'],

    ['portfolio.tag', 'portfolio', 'PORTFOLIO', 'PORTFOLIO'],
    ['portfolio.title', 'portfolio', 'ผลงานของเรา', 'Our Work'],
    ['portfolio.sub', 'portfolio', 'ตัวอย่างระบบที่พัฒนาให้ลูกค้าจริง', 'Real systems built for real clients'],

    ['why.tag', 'why', 'WHY US', 'WHY US'],
    ['why.title', 'why', 'ทำไมต้องเลือกเรา', 'Why Choose Us'],
    ['why.i1t', 'why', 'ส่งงานไว', 'Fast Delivery'],
    ['why.i1d', 'why', '', ''],
    ['why.i2t', 'why', 'รับผิดชอบงาน 100%', '100% Accountability'],
    ['why.i2d', 'why', 'ตรงเวลา ไม่ทิ้งงาน', 'On time, never abandoned'],
    ['why.i3t', 'why', 'สื่อสารง่าย', 'Easy Communication'],
    ['why.i3d', 'why', 'คุยตรง เข้าใจงานจริง', 'Direct talk, real understanding'],
    ['why.i4t', 'why', 'ดูแลหลังส่งงาน', 'Post-launch Support'],
    ['why.i4d', 'why', 'มีทีมซัพพอร์ตต่อเนื่อง', 'Ongoing support team'],

    ['contact.tag', 'contact', 'CONTACT', 'CONTACT'],
    ['contact.title', 'contact', 'ติดต่อสอบถาม / แจ้งความต้องการ', 'Get in Touch'],
    ['contact.sub', 'contact', 'ทีมงานพร้อมให้บริการ รวดเร็ว ทันใจ ตอบกลับภายใน 24 ชม.', 'Our team is ready to help — fast response within 24 hours'],
    ['contact.phone', 'contact', 'เบอร์โทร', 'Phone'],
    ['contact.email', 'contact', 'อีเมล', 'Email'],
    ['contact.qr', 'contact', 'สแกนเพิ่มเพื่อน LINE OA เพื่อพูดคุยกับเราได้ทันที', 'Scan to add our LINE OA and chat with us instantly'],

    ['form.name', 'form', 'ชื่อ-นามสกุล', 'Full Name'],
    ['form.phone', 'form', 'เบอร์โทรศัพท์', 'Phone Number'],
    ['form.email', 'form', 'อีเมล', 'Email'],
    ['form.service', 'form', 'บริการที่สนใจ', 'Service Interested'],
    ['form.message', 'form', 'รายละเอียดงาน', 'Project Details'],
    ['form.submit', 'form', 'ส่งข้อความ', 'Send Message'],
    ['form.ok', 'form', 'ส่งข้อความสำเร็จ! ทีมงานจะติดต่อกลับโดยเร็วที่สุด', 'Message sent! Our team will contact you shortly.'],
    ['form.err', 'form', 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'Something went wrong. Please try again.'],

    ['chat.title', 'chat', 'แชทกับ TECH-TJ', 'Chat with TECH-TJ'],
    ['chat.sub', 'chat', 'ทีมงานตอบกลับโดยเร็วที่สุด', 'Our team responds quickly']
  ];
  for (const [key, group, th, en] of defaultContentTexts) {
    await query(
      'INSERT INTO content_texts (key, group_name, th, en) VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING',
      [key, group, th, en]
    );
  }

  // ---------- seed services ----------
  const { rows: svcCountRows } = await query('SELECT COUNT(*)::int c FROM services');
  if (svcCountRows[0].c === 0) {
    const seedServices = [
      ['🌐', 'พัฒนาเว็บไซต์ (Website)', 'Website Development', 'ออกแบบสวยงาม รองรับทุกอุปกรณ์ ใช้งานง่าย ตรงตามความต้องการ', 'Beautiful, responsive design tailored to your business needs.', 1],
      ['🖥️', 'Web Application', 'Web Application', 'ระบบเว็บแอปพลิเคชันครบทุกฟังก์ชัน ปลอดภัย เสถียร และยืดหยุ่น', 'Full-featured, secure and stable web application systems.', 2],
      ['📱', 'Mobile Application', 'Mobile Application', 'แอปพลิเคชันบนมือถือ iOS / Android ใช้งานง่าย ประสบการณ์ที่ยอดเยี่ยม', 'iOS / Android mobile apps with an excellent user experience.', 3],
      ['💻', 'ระบบตามความต้องการ (Custom Software)', 'Custom Software', 'ออกแบบและพัฒนาระบบเฉพาะธุรกิจ ตามความต้องการของคุณ', 'Custom-built business systems tailored exactly to your needs.', 4],
      ['📡', 'IoT, AIoT และ IIoT', 'IoT, AIoT & IIoT', 'เชื่อมต่ออุปกรณ์ เก็บข้อมูล วิเคราะห์ และแสดงผลแบบ Real-time', 'Connect devices, collect data, analyze and display in real-time.', 5],
      ['🎓', 'งานโปรเจกต์นักศึกษา / เอกสารวิจัย', 'Student Projects & Research', 'พร้อมให้คำปรึกษาโปรเจกต์นักศึกษาและเอกสารวิจัย 5 บท จนจบงาน', 'Consultation and support for student thesis/research projects.', 6]
    ];
    for (const s of seedServices) {
      await query(
        `INSERT INTO services (icon, title_th, title_en, desc_th, desc_en, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
        s
      );
    }
  }

  // ---------- seed portfolio ----------
  const { rows: pfCountRows } = await query('SELECT COUNT(*)::int c FROM portfolio');
  if (pfCountRows[0].c === 0) {
    const seedPortfolio = [
      ['/assets/img/portfolio-dashboard-1.jpg', 'ระบบแจ้งซ่อม IT Service Desk', 'IT Service Desk System', 'ระบบแจ้งซ่อม ติดตามงาน และจัดการทีมช่างเทคนิคแบบเรียลไทม์', 'Real-time IT ticketing, task tracking and technician management.', 1],
      ['/assets/img/portfolio-dashboard-2.jpg', 'Dashboard วิเคราะห์งานซ่อม', 'Repair Analytics Dashboard', 'แดชบอร์ดสรุปแนวโน้มงานแจ้งซ่อม สัดส่วนตามหมวดหมู่ และ SLA', 'Analytics dashboard for repair trends, categories and SLA tracking.', 2]
    ];
    for (const p of seedPortfolio) {
      await query(
        `INSERT INTO portfolio (image_url, title_th, title_en, desc_th, desc_en, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
        p
      );
    }
  }

  // ---------- seed บริการใหม่: จำหน่ายอุปกรณ์อิเล็กทรอนิกส์/เซ็นเซอร์/IoT (ถ้ายังไม่มี) ----------
  const { rows: shopServiceRows } = await query(`SELECT id FROM services WHERE title_th LIKE '%จำหน่ายอุปกรณ์%'`);
  if (!shopServiceRows.length) {
    await query(
      `INSERT INTO services (icon, title_th, title_en, desc_th, desc_en, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['🛒', 'จำหน่ายอุปกรณ์อิเล็กทรอนิกส์ / เซ็นเซอร์ / IoT', 'Electronics, Sensors & IoT Devices',
       'ร้านค้าออนไลน์ครบวงจร จำหน่ายอุปกรณ์อิเล็กทรอนิกส์ เซ็นเซอร์ และอุปกรณ์ IoT พร้อมระบบสั่งซื้อและจัดส่ง',
       'Full online store for electronics, sensors and IoT devices with ordering and delivery.', 7]
    );
  }

  // ---------- seed บริการใหม่: ปรึกษาและบริหารจัดการโครงการ (ถ้ายังไม่มี) ----------
  const { rows: pmServiceRows } = await query(`SELECT id FROM services WHERE title_th LIKE '%บริหารจัดการโครงการ%'`);
  if (!pmServiceRows.length) {
    await query(
      `INSERT INTO services (icon, title_th, title_en, desc_th, desc_en, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['🗂️', 'ปรึกษาและรับบริหารจัดการโครงการ', 'Project Consulting & Management',
       'ให้คำปรึกษาและบริหารโครงการ IT ครบวงจร ตั้งแต่วางแผน (Planning) ดำเนินงาน (Execution) ควบคุมงาน (Control) จนถึงส่งมอบ (Delivery)',
       'End-to-end IT project consulting and management — from Planning and Execution to Control and Delivery.', 8]
    );
  }

  // ---------- seed สินค้าตัวอย่าง ----------
  const { rows: productCountRows } = await query('SELECT COUNT(*)::int c FROM products');
  if (productCountRows[0].c === 0) {
    const seedProducts = [
      ['TJ-ESP32-01', 'บอร์ด ESP32 DevKit V1', 'ESP32 DevKit V1 Board', 'บอร์ดไมโครคอนโทรลเลอร์ Wi-Fi + Bluetooth เหมาะสำหรับงาน IoT', 'Wi-Fi + Bluetooth microcontroller board, ideal for IoT projects.', 'บอร์ดพัฒนา', 189, 50, 1],
      ['TJ-DHT22-01', 'เซ็นเซอร์วัดอุณหภูมิ-ความชื้น DHT22', 'DHT22 Temp & Humidity Sensor', 'เซ็นเซอร์วัดอุณหภูมิและความชื้นความแม่นยำสูง', 'High-accuracy temperature and humidity sensor.', 'เซ็นเซอร์', 129, 80, 2],
      ['TJ-PIR-01', 'เซ็นเซอร์ตรวจจับความเคลื่อนไหว PIR', 'PIR Motion Sensor', 'เซ็นเซอร์ตรวจจับการเคลื่อนไหวสำหรับระบบรักษาความปลอดภัย/สมาร์ทโฮม', 'Motion detection sensor for security and smart home systems.', 'เซ็นเซอร์', 59, 120, 3],
      ['TJ-RELAY4-01', 'โมดูลรีเลย์ 4 ช่อง 5V', '4-Channel 5V Relay Module', 'โมดูลควบคุมอุปกรณ์ไฟฟ้า 4 ช่องทาง ใช้งานร่วมกับ IoT ได้', '4-channel relay module for controlling electrical appliances via IoT.', 'โมดูล', 149, 60, 4],
      ['TJ-CAM-01', 'กล้อง IP Camera Wi-Fi', 'Wi-Fi IP Camera', 'กล้องวงจรปิด Wi-Fi ดูผ่านมือถือได้แบบเรียลไทม์', 'Wi-Fi IP camera with real-time mobile viewing.', 'อุปกรณ์ IoT', 890, 25, 5],
      ['TJ-SMARTPLUG-01', 'ปลั๊กไฟอัจฉริยะ Smart Plug Wi-Fi', 'Wi-Fi Smart Plug', 'ปลั๊กไฟควบคุมผ่านแอปมือถือ เปิด-ปิดอุปกรณ์ไฟฟ้าจากที่ไหนก็ได้', 'Wi-Fi smart plug controllable from a mobile app anywhere.', 'อุปกรณ์ IoT', 349, 40, 6]
    ];
    for (const p of seedProducts) {
      await query(
        `INSERT INTO products (sku, name_th, name_en, desc_th, desc_en, category, price, stock_qty, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]]
      );
    }
  }
}

module.exports = { query, ensureInit, pool };
