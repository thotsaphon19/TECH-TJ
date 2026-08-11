const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function getAllSettings() {
  const { rows } = await db.query('SELECT key, value FROM settings');
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

// สาธารณะ: หน้าบ้านดึงไปใช้แสดงผล
router.get('/', async (req, res) => {
  await db.ensureInit();
  res.json(await getAllSettings());
});

// หลังบ้าน: บันทึกการตั้งค่า
router.put('/', requireAuth, async (req, res) => {
  const updates = req.body || {};
  for (const [k, v] of Object.entries(updates)) {
    await db.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [k, String(v ?? '')]
    );
  }
  res.json({ ok: true, settings: await getAllSettings() });
});

module.exports = router;
