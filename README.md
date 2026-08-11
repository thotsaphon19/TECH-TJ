# TECH-TJ Website (หน้าบ้าน + หลังบ้าน) — Vercel + Neon + Cloudinary + Supabase Realtime

เว็บไซต์ธุรกิจ TECH-TJ Solution Technology แบบครบวงจร ออกแบบให้ **deploy บน Vercel ได้ตรงๆ**:

- **หน้าบ้าน**: เว็บไซต์แอนิเมชันสวยงาม โหลดเนื้อหาแบบไดนามิกจากฐานข้อมูล รองรับ 2 ภาษา (ไทย/อังกฤษ) พร้อมฟอร์มติดต่อและแชทสด
- **ร้านค้าออนไลน์** (`/shop`): แคตตาล็อกสินค้า ตะกร้า ระบบสมาชิกลูกค้า (สมัคร/เข้าสู่ระบบ) checkout อัปโหลดสลิปโอนเงิน ดูประวัติคำสั่งซื้อ และดาวน์โหลดใบเสร็จเป็น PDF ได้เอง
- **หลังบ้าน** (`/admin`): จัดการทุกเมนู/เนื้อหาได้เอง — บริการ, ผลงาน, **สินค้า+สต๊อก**, **คำสั่งซื้อ+ตรวจสลิป**, **POS ขายหน้าร้าน**, ข้อความติดต่อ, แชทลูกค้า, ตั้งค่าเว็บ (โลโก้/ชื่อ/ฟอนต์/สี/รูป Hero), เปลี่ยนรหัสผ่าน
- **ฐานข้อมูล**: [Neon](https://neon.tech) (Postgres แบบ serverless — ฟรี, เข้ากับ Vercel ได้ดี) — เก็บข้อมูลจริงทั้งหมด (บริการ/ผลงาน/สินค้า/คำสั่งซื้อ/ข้อความ/แชท)
- **รูปภาพ**: อัปโหลดขึ้น [Cloudinary](https://cloudinary.com) (ฟรี, มี CDN, ปรับคุณภาพรูปอัตโนมัติ)
- **ใบเสร็จ PDF**: สร้างด้วย pdfkit ฝังฟอนต์ไทย (Sarabun) แสดงภาษาไทยได้ถูกต้อง 100%
- **LINE OA**: รับ-ส่งข้อความผ่าน LINE Messaging API, แจ้งเตือนเข้า LINE เมื่อมีลูกค้ากรอกฟอร์ม
- **อีเมล**: ส่งอีเมลแจ้งเตือนอัตโนมัติเมื่อมีลูกค้าติดต่อเข้ามา (SMTP)
- **แชทเรียลไทม์**: ใช้ [Supabase Realtime](https://supabase.com) ส่งข้อความถึงกันแบบทันที (ไม่ต้องรอ) เสริมด้วย polling เป็นตัวสำรอง — ถ้ายังไม่ตั้งค่า Supabase ระบบจะ fallback ไปใช้ polling ล้วนโดยอัตโนมัติ ใช้งานได้ปกติไม่พัง

> **หมายเหตุการชำระเงิน**: ระบบใช้วิธี "แนบสลิปโอนเงิน → แอดมินตรวจสอบและกดยืนยัน" (มาตรฐานร้านค้าออนไลน์ไทยขนาดเล็ก-กลาง) ยังไม่ได้เชื่อมต่อ payment gateway อัตโนมัติ (เช่น Omise, 2C2P, พร้อมเพย์ QR อัตโนมัติ) เพราะต้องใช้ API key ของผู้ให้บริการที่ต้องสมัครเอง หากต้องการเพิ่มในอนาคตสามารถแจ้งได้

> **หมายเหตุสถาปัตยกรรม**: Neon คือฐานข้อมูลหลักที่เก็บข้อมูลจริงทั้งหมด ส่วน Supabase ในโปรเจกต์นี้ใช้ **เฉพาะฟีเจอร์ Realtime (broadcast)** เพื่อดันข้อความแชทถึงกันแบบทันที ไม่ได้ใช้ Supabase เป็นฐานข้อมูล — จึงไม่ต้องย้ายข้อมูลอะไร ใช้ควบคู่กับ Neon ได้เลย

---

## 0) เตรียมบัญชีที่ต้องใช้ (ทำครั้งเดียว ฟรีทั้งหมด)

| บริการ | ใช้ทำอะไร | ลิงก์สมัคร |
|---|---|---|
| Vercel | โฮสต์เว็บ | https://vercel.com/signup |
| Neon | ฐานข้อมูล Postgres | https://neon.tech |
| Cloudinary | เก็บรูปภาพ | https://cloudinary.com/users/register/free |
| Supabase | แชทเรียลไทม์ (ไม่บังคับ — ถ้าข้ามได้ แชทจะยังทำงานผ่าน polling) | https://supabase.com |
| LINE Developers | LINE OA (ถ้าต้องการ) | https://developers.line.biz/console/ |

---

## 1) ตั้งค่า Neon (ฐานข้อมูล)

1. สมัคร/ล็อกอิน https://neon.tech → กด **Create a project**
2. ตั้งชื่อโปรเจกต์ เช่น `tech-tj`, เลือก Region ใกล้ไทย (Singapore ถ้ามี)
3. หลังสร้างเสร็จ ไปที่หน้า **Dashboard → Connection string**
4. เลือกแบบ **Pooled connection** (มีคำว่า `-pooler` ใน host) แล้วคัดลอกมาใส่ `.env` ที่ `DATABASE_URL`
   - หน้าตาประมาณ: `postgresql://user:pass@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

ไม่ต้องสร้างตารางเอง — โค้ดจะสร้างตารางและข้อมูลตัวอย่างให้อัตโนมัติตอนรันครั้งแรก

---

## 2) ตั้งค่า Cloudinary (เก็บรูปภาพ)

1. สมัคร/ล็อกอิน https://cloudinary.com
2. หน้า **Dashboard** จะโชว์ 3 ค่าให้คัดลอกไปใส่ `.env`:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

รูปที่แอดมินอัปโหลด (โลโก้ บริการ ผลงาน QR) จะถูกส่งขึ้น Cloudinary อัตโนมัติ ได้ URL แบบ CDN ที่โหลดเร็ว

---

## 2.5) ตั้งค่า Supabase Realtime (แชททันที — ไม่บังคับ)

ขั้นตอนนี้ข้ามได้ถ้าไม่รีบ — ไม่ตั้งค่าก็ใช้งานได้ปกติ แชทจะ sync กันทุก 15-20 วินาทีแทนที่จะทันทีทันใด

1. สมัคร/ล็อกอิน https://supabase.com → **New project** (เลือก region Singapore ถ้ามี)
2. รอสร้างโปรเจกต์เสร็จ (1-2 นาที) → ไปที่ **Project Settings → API**
3. คัดลอก 2 ค่านี้ไปใส่ `.env`:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`

ไม่ต้องสร้างตารางหรือตั้งค่าอะไรเพิ่มใน Supabase — โปรเจกต์นี้ใช้แค่ฟีเจอร์ **Realtime Broadcast** ซึ่งพร้อมใช้งานทันทีที่สร้างโปรเจกต์ (ไม่ได้ใช้ฐานข้อมูลของ Supabase เลย ข้อมูลจริงยังอยู่ที่ Neon เหมือนเดิม)

**วิธีการทำงาน**: เมื่อมีข้อความใหม่ (จากลูกค้า, แอดมิน หรือ LINE OA) เซิร์ฟเวอร์จะบันทึกลง Neon ก่อน แล้วส่งสัญญาณผ่าน Supabase Realtime ไปบอกฝั่งตรงข้ามให้รีเฟรชทันที — ถ้า Supabase ตอบช้าหรือล่ม ระบบจะไม่ค้าง (มี timeout กันไว้ 3 วินาที) และ polling ที่เหลือไว้เป็นตัวสำรองจะ sync ให้เองภายใน 15-20 วินาที

---

## 3) รันทดสอบบนเครื่อง (Local)

ต้องมี Node.js 18+

```bash
cd tech-tj-app
npm install
cp .env.example .env
```

แก้ไข `.env` ใส่ค่าที่ได้จากขั้นตอน 1-2 อย่างน้อย: `DATABASE_URL`, `CLOUDINARY_*`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`

```bash
npm start
```

เปิด http://localhost:3000 (หน้าบ้าน) และ http://localhost:3000/admin (หลังบ้าน)

---

## 4) Deploy ขึ้น Vercel

**วิธีที่ง่ายที่สุด — ผ่านเว็บ Vercel:**

1. Push โค้ดโปรเจกต์นี้ขึ้น GitHub repo (ถ้ายังไม่มี บอกผมได้ ช่วยตั้งขั้นตอนให้)
2. ไปที่ https://vercel.com/new → เลือก **Import** repo ที่ push ไว้
3. Framework Preset: เลือก **Other** (ไม่ต้อง build เพราะเป็น Node.js function ธรรมดา)
4. ก่อนกด Deploy ให้เปิด **Environment Variables** แล้วใส่ค่าทั้งหมดจาก `.env` ของคุณ (DATABASE_URL, CLOUDINARY_*, SUPABASE_* ถ้าใช้, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD, LINE_*, SMTP_* ตามที่ใช้)
5. กด **Deploy** — รอ 1-2 นาที จะได้โดเมนแบบ `https://your-project.vercel.app` ให้ทันที (HTTPS ให้อัตโนมัติ)

**หรือผ่าน CLI:**
```bash
npm install -g vercel
vercel login
vercel                # deploy แบบทดสอบ (preview)
vercel --prod         # deploy จริงขึ้น production
```
ตั้งค่า environment variables ผ่าน CLI ได้ด้วย:
```bash
vercel env add DATABASE_URL production
vercel env add CLOUDINARY_CLOUD_NAME production
vercel env add CLOUDINARY_API_KEY production
vercel env add CLOUDINARY_API_SECRET production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add JWT_SECRET production
vercel env add ADMIN_USERNAME production
vercel env add ADMIN_PASSWORD production
# ทำแบบเดียวกันสำหรับ LINE_* และ SMTP_* ถ้าต้องการใช้
```
หลัง deploy เสร็จ เว็บจะขึ้นที่ `https://ชื่อโปรเจกต์.vercel.app` และหลังบ้านที่ `/admin`

> ⚠️ เข้าหลังบ้านครั้งแรกแล้วไปเปลี่ยนรหัสผ่านทันทีที่เมนู "บัญชีผู้ดูแล"

**ต่อโดเมนของตัวเอง:** ไปที่ Vercel Dashboard → โปรเจกต์ → Settings → Domains → เพิ่มโดเมน แล้วตั้งค่า DNS ตามที่ Vercel บอก (จะได้ HTTPS อัตโนมัติ)

---

## 5) เชื่อมต่อ LINE Official Account (LINE OA)

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/) → สร้าง Provider → สร้าง Channel ประเภท **Messaging API**
2. แท็บ **Messaging API**:
   - กด **Issue** เพื่อสร้าง `Channel access token` → ใส่ใน Vercel env ที่ `LINE_CHANNEL_ACCESS_TOKEN`
   - ตั้ง **Webhook URL** เป็น `https://ชื่อโปรเจกต์ของคุณ.vercel.app/webhook/line` แล้วกด **Verify**
   - เปิด **Use webhook** เป็น ON
3. แท็บ **Basic settings** → คัดลอก `Channel secret` → ใส่ที่ `LINE_CHANNEL_SECRET`
4. ปิด **Auto-reply messages** และ **Greeting messages** เพื่อให้ระบบของเราตอบแทน
5. ที่ Vercel: ใส่ env vars แล้ว redeploy (Vercel Dashboard → Deployments → ⋯ → Redeploy)

**หา LINE_ADMIN_USER_ID** (สำหรับรับแจ้งเตือนเข้า LINE แอดมินเมื่อมีลูกค้ากรอกฟอร์ม): ทักแชทเข้า LINE OA จากบัญชีแอดมิน แล้วดู userId จาก Vercel → โปรเจกต์ → **Logs** (จะพิมพ์ทุกครั้งที่มีข้อความเข้า webhook)

---

## 6) เชื่อมต่ออีเมล (SMTP)

ตัวอย่าง Gmail:
1. เปิด 2-Step Verification ที่บัญชี Gmail
2. สร้าง App Password ที่ https://myaccount.google.com/apppasswords
3. ใส่ค่าใน Vercel env: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASS`, `MAIL_TO`

---

## 7) โครงสร้างโปรเจกต์

```
tech-tj-app/
  vercel.json           การตั้งค่า route ของ Vercel
  api/index.js           entry point ของ Vercel serverless function (ครอบ Express app)
  server/
    app.js                Express app หลัก (ใช้ร่วมกันทั้ง local และ Vercel)
    local.js               entry point ตอนรันบนเครื่อง (npm start)
    db.js                   เชื่อมต่อ Neon Postgres + schema + seed ข้อมูลเริ่มต้น
    fonts/                  ฟอนต์ Sarabun (ใช้สร้าง PDF ใบเสร็จภาษาไทย)
    lib/mailer.js            ส่งอีเมลแจ้งเตือน (SMTP)
    lib/line.js               เรียก LINE Messaging API
    lib/cloudinary.js          อัปโหลดรูปขึ้น Cloudinary
    lib/invoice.js              สร้าง PDF ใบเสร็จ/ใบแจ้งหนี้
    lib/realtime.js              ส่ง broadcast ผ่าน Supabase Realtime
    middleware/auth.js            ตรวจสอบสิทธิ์แอดมิน
    middleware/customerAuth.js     ตรวจสอบสิทธิ์ลูกค้า (แยกจากแอดมิน)
    routes/                        REST API ทั้งหมด (auth, products, orders, customer-auth, ฯลฯ)
  public/
    index.html              หน้าบ้าน
    admin.html                หลังบ้าน
    shop.html                  ร้านค้าออนไลน์ (แคตตาล็อก/ตะกร้า/checkout/บัญชีลูกค้า)
    assets/css, assets/js      สไตล์ + สคริปต์ (รวม polling chat, shop.js)
    assets/img/hero-showcase.jpg  รูปภาพ HUD หน้าแรก
```

## 8) สิ่งที่จัดการได้จากหลังบ้านทั้งหมด
- บริการ (เพิ่ม/แก้ไข/ลบ, ไอคอน, รูปผ่าน Cloudinary, ข้อความ 2 ภาษา, ลำดับการแสดงผล)
- ผลงาน/พอร์ตโฟลิโอ (เพิ่ม/แก้ไข/ลบ, รูป, ลิงก์, ข้อความ 2 ภาษา)
- **สินค้า**: เพิ่ม/แก้ไข/ลบ, รูปผ่าน Cloudinary, ราคา, สต๊อก, หมวดหมู่, SKU, ข้อความ 2 ภาษา
- **คำสั่งซื้อ**: ดูรายละเอียด/รายการสินค้า, ดูสลิปโอนเงิน, อนุมัติ/ปฏิเสธการชำระเงิน (ปฏิเสธจะคืนสต๊อกอัตโนมัติ), อัปเดตสถานะจัดส่ง, ดูใบเสร็จ PDF
- **POS ขายหน้าร้าน**: เลือกสินค้า คิดเงิน บันทึกการขายทันที (ตัดสต๊อกอัตโนมัติ)
- **เนื้อหาหน้าเว็บ**: ข้อความทุกจุดที่แสดงหน้าบ้าน — เมนู navbar, ข้อความหน้าแรก (badge/ปุ่ม/สถิติ), หัวข้อและคำอธิบายทุกส่วน (บริการ/ผลงาน/ทำไมต้องเรา/ติดต่อ), label ในฟอร์ม, ข้อความแชท — แก้ได้ทั้งภาษาไทยและอังกฤษ บันทึกลง Neon แล้วหน้าบ้านอัปเดตทันทีตามภาษาที่ผู้ใช้เลือก
- ข้อความติดต่อจากลูกค้า (ดู/เปลี่ยนสถานะ/ลบ)
- แชทลูกค้าแบบ near-real-time (ทั้งจากหน้าเว็บและจาก LINE OA) ผ่าน Supabase Realtime + polling สำรอง
- ตั้งค่าเว็บไซต์: โลโก้, ชื่อเว็บ 2 ภาษา, สโลแกน, สี, ฟอนต์, ภาษาเริ่มต้น, ข้อมูลติดต่อ, QR LINE OA, ตัวเลขสถิติหน้าแรก, **รูปภาพ HUD หน้าแรก + ข้อความป้าย**
- เปลี่ยนรหัสผ่านผู้ดูแลระบบ

ทุกจุดที่แก้ไขในหลังบ้านจะสะท้อนไปหน้าบ้านทันทีโดยไม่ต้องแก้โค้ดหรือ deploy ใหม่ — ไม่มีข้อความ hardcode เหลืออยู่ในหน้าบ้านเลย ทุกอย่างดึงจากฐานข้อมูล

## 9) ระบบร้านค้าออนไลน์ (Shop) — รายละเอียดเพิ่มเติม

**ฝั่งลูกค้า** (`/shop`):
- สมัครสมาชิก/เข้าสู่ระบบ (แยกบัญชีจากแอดมิน — ใช้ cookie คนละตัว)
- เลือกดูสินค้า ค้นหา กรองตามหมวดหมู่ ใส่ตะกร้า (เก็บใน localStorage ไม่ต้อง login ก็หยิบใส่ตะกร้าได้ แต่ต้อง login ตอนสั่งซื้อจริง)
- Checkout กรอกที่อยู่จัดส่ง → ระบบสร้างคำสั่งซื้อและตัดสต๊อกทันที (ป้องกันสินค้าเกินสต๊อกด้วย database lock)
- แนบสลิปโอนเงิน (อัปโหลดรูปผ่าน Cloudinary) รอแอดมินตรวจสอบ
- ดูประวัติคำสั่งซื้อ + สถานะ + ดาวน์โหลดใบเสร็จเป็น PDF ได้ทุกออเดอร์

**ฝั่งแอดมิน**:
- เมนู "สินค้า": จัดการสินค้า+สต๊อกแบบเดียวกับบริการ/ผลงาน
- เมนู "คำสั่งซื้อ": เห็นออเดอร์ทั้งหมด, ดูสลิป, กดอนุมัติ/ปฏิเสธการชำระเงิน, เปลี่ยนสถานะ (รอดำเนินการ → กำลังจัดเตรียม → จัดส่งแล้ว → สำเร็จ)
- เมนู "POS": ขายหน้าร้านให้ลูกค้าที่มาซื้อสด ไม่ต้องผ่านขั้นตอนสมัครสมาชิก/ตะกร้า/สลิป — บันทึกและตัดสต๊อกทันที

**สต๊อกสินค้า**: ตัดอัตโนมัติเมื่อมีคำสั่งซื้อ (ทั้งจากลูกค้าและ POS), คืนอัตโนมัติเมื่อแอดมินปฏิเสธสลิป, ป้องกันการสั่งเกินจำนวนที่มีด้วย transaction lock ระดับฐานข้อมูล — ตัวเลขสต๊อกที่แอดมินเห็นกับที่ลูกค้าเห็นหน้าร้านจะตรงกันเสมอ

