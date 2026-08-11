const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// สาธารณะ: หน้าบ้านดึงข้อความ UI ทั้งหมดไปใช้ (คืนเป็น { key: {th, en, group_name} })
router.get('/', async (req, res) => {
  await db.ensureInit();
  const { rows } = await db.query('SELECT key, group_name, th, en FROM content_texts ORDER BY key ASC');
  const map = {};
  for (const r of rows) map[r.key] = { th: r.th, en: r.en, group: r.group_name };
  res.json(map);
});

// หลังบ้าน: บันทึกข้อความ UI ทีละหลายรายการพร้อมกัน — body: { key: {th, en}, ... }
router.put('/', requireAuth, async (req, res) => {
  const updates = req.body || {};
  for (const [key, val] of Object.entries(updates)) {
    await db.query(
      `INSERT INTO content_texts (key, th, en) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET th = excluded.th, en = excluded.en`,
      [key, val?.th ?? '', val?.en ?? '']
    );
  }
  const { rows } = await db.query('SELECT key, group_name, th, en FROM content_texts ORDER BY key ASC');
  const map = {};
  for (const r of rows) map[r.key] = { th: r.th, en: r.en, group: r.group_name };
  res.json(map);
});

module.exports = router;
