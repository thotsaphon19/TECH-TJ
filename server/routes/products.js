const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  await db.ensureInit();
  const all = req.query.all === '1';
  const { rows } = all
    ? await db.query('SELECT * FROM products ORDER BY sort_order ASC, id DESC')
    : await db.query('SELECT * FROM products WHERE active = TRUE ORDER BY sort_order ASC, id DESC');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'ไม่พบสินค้า' });
  res.json(rows[0]);
});

router.post('/', requireAuth, async (req, res) => {
  const b = req.body || {};
  const { rows } = await db.query(
    `INSERT INTO products (sku, name_th, name_en, desc_th, desc_en, category, price, stock_qty, image_url, sort_order, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      b.sku || '', b.name_th || '', b.name_en || '', b.desc_th || '', b.desc_en || '',
      b.category || 'ทั่วไป', Number(b.price) || 0, Number(b.stock_qty) || 0,
      b.image_url || null, Number(b.sort_order) || 0, b.active === false ? false : true
    ]
  );
  res.json(rows[0]);
});

router.put('/:id', requireAuth, async (req, res) => {
  const b = req.body || {};
  const { rows: existingRows } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'ไม่พบสินค้า' });
  const merged = { ...existing, ...b };
  const { rows } = await db.query(
    `UPDATE products SET sku=$1, name_th=$2, name_en=$3, desc_th=$4, desc_en=$5, category=$6,
      price=$7, stock_qty=$8, image_url=$9, sort_order=$10, active=$11 WHERE id=$12 RETURNING *`,
    [
      merged.sku, merged.name_th, merged.name_en, merged.desc_th, merged.desc_en, merged.category,
      Number(merged.price) || 0, Number(merged.stock_qty) || 0, merged.image_url,
      Number(merged.sort_order) || 0, merged.active ? true : false, existing.id
    ]
  );
  res.json(rows[0]);
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
