const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  await db.ensureInit();
  const all = req.query.all === '1';
  const { rows } = all
    ? await db.query('SELECT * FROM portfolio ORDER BY sort_order ASC, id ASC')
    : await db.query('SELECT * FROM portfolio WHERE active = TRUE ORDER BY sort_order ASC, id ASC');
  res.json(rows);
});

router.post('/', requireAuth, async (req, res) => {
  const b = req.body || {};
  const { rows } = await db.query(
    `INSERT INTO portfolio (image_url, title_th, title_en, desc_th, desc_en, link_url, sort_order, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [b.image_url || null, b.title_th || '', b.title_en || '', b.desc_th || '', b.desc_en || '', b.link_url || '', b.sort_order || 0, b.active === false ? false : true]
  );
  res.json(rows[0]);
});

router.put('/:id', requireAuth, async (req, res) => {
  const b = req.body || {};
  const { rows: existingRows } = await db.query('SELECT * FROM portfolio WHERE id = $1', [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
  const merged = { ...existing, ...b };
  const { rows } = await db.query(
    `UPDATE portfolio SET image_url=$1, title_th=$2, title_en=$3, desc_th=$4, desc_en=$5, link_url=$6, sort_order=$7, active=$8
     WHERE id=$9 RETURNING *`,
    [merged.image_url, merged.title_th, merged.title_en, merged.desc_th, merged.desc_en, merged.link_url, merged.sort_order, merged.active ? true : false, existing.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.query('DELETE FROM portfolio WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
