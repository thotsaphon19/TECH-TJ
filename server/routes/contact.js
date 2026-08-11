const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendInquiryEmail } = require('../lib/mailer');
const { pushToAdmin } = require('../lib/line');

const router = express.Router();

// สาธารณะ: ลูกค้าส่งฟอร์มติดต่อจากหน้าเว็บ
router.post('/', async (req, res) => {
  await db.ensureInit();
  const b = req.body || {};
  if (!b.name || (!b.phone && !b.email)) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ และเบอร์โทรหรืออีเมลอย่างน้อย 1 อย่าง' });
  }
  const { rows } = await db.query(
    `INSERT INTO inquiries (name, phone, email, service_interested, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [b.name || '', b.phone || '', b.email || '', b.service_interested || '', b.message || '']
  );
  const inquiry = rows[0];

  // แจ้งเตือนแบบไม่บล็อกการตอบกลับลูกค้า (best effort)
  sendInquiryEmail(inquiry).catch((e) => console.error('[mailer] ส่งอีเมลล้มเหลว', e.message));
  pushToAdmin(
    `📩 มีลูกค้าติดต่อใหม่จากเว็บไซต์\nชื่อ: ${inquiry.name}\nโทร: ${inquiry.phone || '-'}\nอีเมล: ${inquiry.email || '-'}\nสนใจ: ${inquiry.service_interested || '-'}\nข้อความ: ${inquiry.message || '-'}`
  ).catch((e) => console.error('[line] แจ้งเตือนล้มเหลว', e.message));

  res.json({ ok: true });
});

// หลังบ้าน: รายการคำขอติดต่อทั้งหมด
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM inquiries ORDER BY id DESC');
  res.json(rows);
});

router.put('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body || {};
  await db.query('UPDATE inquiries SET status = $1 WHERE id = $2', [status || 'new', req.params.id]);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.query('DELETE FROM inquiries WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
