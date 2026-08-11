const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  await db.ensureInit();
  const all = req.query.all === '1';
  const { rows } = all
    ? await db.query('SELECT * FROM services ORDER BY sort_order ASC, id ASC')
    : await db.query('SELECT * FROM services WHERE active = TRUE ORDER BY sort_order ASC, id ASC');
  res.json(rows);
});

router.post('/', requireAuth, async (req, res) => {
  const b = req.body || {};
  const { rows } = await db.query(
    `INSERT INTO services (icon, image_url, title_th, title_en, desc_th, desc_en, sort_order, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [b.icon || '💡', b.image_url || null, b.title_th || '', b.title_en || '', b.desc_th || '', b.desc_en || '', b.sort_order || 0, b.active === false ? false : true]
  );
  res.json(rows[0]);
});

router.put('/:id', requireAuth, async (req, res) => {
  const b = req.body || {};
  const { rows: existingRows } = await db.query('SELECT * FROM services WHERE id = $1', [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
  const merged = { ...existing, ...b };
  const { rows } = await db.query(
    `UPDATE services SET icon=$1, image_url=$2, title_th=$3, title_en=$4, desc_th=$5, desc_en=$6, sort_order=$7, active=$8
     WHERE id=$9 RETURNING *`,
    [merged.icon, merged.image_url, merged.title_th, merged.title_en, merged.desc_th, merged.desc_en, merged.sort_order, merged.active ? true : false, existing.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.query('DELETE FROM services WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
