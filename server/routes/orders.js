const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireCustomerAuth } = require('../middleware/customerAuth');
const { streamInvoice } = require('../lib/invoice');
const cloudinaryLib = require('../lib/cloudinary');

const router = express.Router();

function genOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `TJ${ymd}${String(Date.now()).slice(-5)}`;
}

// สร้างคำสั่งซื้อจริง ใช้ transaction เพื่อกันสต๊อกติดลบ / ข้อมูลไม่ตรงกัน
// items: [{ product_id, quantity }]
async function createOrder({ items, customer_id, channel, shipping_name, shipping_phone, shipping_address, payment_status, status, note }) {
  if (!items || !items.length) throw Object.assign(new Error('ตะกร้าสินค้าว่างเปล่า'), { status: 400 });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    let subtotal = 0;
    const resolvedItems = [];
    for (const it of items) {
      const { rows } = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [it.product_id]);
      const product = rows[0];
      if (!product) throw Object.assign(new Error(`ไม่พบสินค้ารหัส ${it.product_id}`), { status: 400 });
      const qty = Number(it.quantity) || 0;
      if (qty <= 0) throw Object.assign(new Error('จำนวนสินค้าต้องมากกว่า 0'), { status: 400 });
      if (product.stock_qty < qty) throw Object.assign(new Error(`สินค้า "${product.name_th}" มีไม่พอในสต๊อก (เหลือ ${product.stock_qty})`), { status: 400 });
      const lineSubtotal = Number(product.price) * qty;
      subtotal += lineSubtotal;
      resolvedItems.push({ product, qty, unit_price: product.price, subtotal: lineSubtotal });
      await client.query('UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2', [qty, product.id]);
    }
    const orderNumber = genOrderNumber();
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, customer_id, channel, shipping_name, shipping_phone, shipping_address, subtotal, total_amount, status, payment_status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [orderNumber, customer_id || null, channel || 'online', shipping_name || '', shipping_phone || '', shipping_address || '',
       subtotal, subtotal, status || 'pending', payment_status || 'unpaid', note || '']
    );
    const order = orderRows[0];
    for (const ri of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal) VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, ri.product.id, ri.product.name_th, ri.unit_price, ri.qty, ri.subtotal]
      );
    }
    await client.query('COMMIT');
    return order;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getOrderWithItems(orderId) {
  const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!orderRows.length) return null;
  const { rows: items } = await db.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [orderId]);
  return { order: orderRows[0], items };
}

// ---------- ลูกค้า (ต้อง login) ----------

// สั่งซื้อสินค้าจากตะกร้า
router.post('/', requireCustomerAuth, async (req, res) => {
  await db.ensureInit();
  const b = req.body || {};
  try {
    const order = await createOrder({
      items: b.items, customer_id: req.customer.id, channel: 'online',
      shipping_name: b.shipping_name, shipping_phone: b.shipping_phone, shipping_address: b.shipping_address,
      status: 'pending', payment_status: 'unpaid'
    });
    res.json({ ok: true, order });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'สั่งซื้อไม่สำเร็จ' });
  }
});

// รายการคำสั่งซื้อของตัวเอง
router.get('/my', requireCustomerAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY id DESC', [req.customer.id]);
  res.json(rows);
});

router.get('/my/:id', requireCustomerAuth, async (req, res) => {
  const data = await getOrderWithItems(req.params.id);
  if (!data || data.order.customer_id !== req.customer.id) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  res.json(data);
});

// อัปโหลดสลิปการโอนเงิน (base64 -> Cloudinary) แล้วตั้งสถานะรอตรวจสอบ
router.post('/my/:id/payment-slip', requireCustomerAuth, async (req, res) => {
  const { dataUrl } = req.body || {};
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return res.status(400).json({ error: 'กรุณาแนบรูปสลิปการโอนเงิน' });
  const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const order = rows[0];
  if (!order || order.customer_id !== req.customer.id) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  try {
    const uploaded = await cloudinaryLib.uploadDataUrl(dataUrl);
    const { rows: updated } = await db.query(
      `UPDATE orders SET payment_slip_url = $1, payment_status = 'pending_verification', updated_at = now() WHERE id = $2 RETURNING *`,
      [uploaded.url, order.id]
    );
    res.json({ ok: true, order: updated[0] });
  } catch (e) {
    res.status(500).json({ error: e.message || 'อัปโหลดสลิปไม่สำเร็จ' });
  }
});

// ดาวน์โหลดใบแจ้งหนี้/ใบเสร็จ เป็น PDF
router.get('/my/:id/invoice', requireCustomerAuth, async (req, res) => {
  const data = await getOrderWithItems(req.params.id);
  if (!data || data.order.customer_id !== req.customer.id) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  const { rows: settingsRows } = await db.query('SELECT key, value FROM settings');
  const settings = {}; settingsRows.forEach(r => settings[r.key] = r.value);
  streamInvoice(res, { order: data.order, items: data.items, settings });
});

// ---------- หลังบ้าน (admin) ----------

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await db.query(`
    SELECT o.*, c.name as customer_name, c.email as customer_email
    FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
    ORDER BY o.id DESC
  `);
  res.json(rows);
});

router.get('/:id', requireAuth, async (req, res) => {
  const data = await getOrderWithItems(req.params.id);
  if (!data) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  res.json(data);
});

router.put('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body || {};
  const { rows } = await db.query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *', [status, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  res.json({ ok: true, order: rows[0] });
});

// ตรวจสอบสลิป: อนุมัติ (paid) หรือ ปฏิเสธ (rejected -> คืนสต๊อก)
router.put('/:id/payment-status', requireAuth, async (req, res) => {
  const { payment_status } = req.body || {};
  const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const order = orderRows[0];
  if (!order) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });

  if (payment_status === 'rejected' && order.payment_status !== 'rejected') {
    // คืนสต๊อกเมื่อสลิปไม่ผ่าน
    const { rows: items } = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    for (const it of items) {
      await db.query('UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2', [it.quantity, it.product_id]);
    }
  }
  const { rows } = await db.query(
    'UPDATE orders SET payment_status = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [payment_status, req.params.id]
  );
  res.json({ ok: true, order: rows[0] });
});

router.get('/:id/invoice', requireAuth, async (req, res) => {
  const data = await getOrderWithItems(req.params.id);
  if (!data) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  const { rows: settingsRows } = await db.query('SELECT key, value FROM settings');
  const settings = {}; settingsRows.forEach(r => settings[r.key] = r.value);
  streamInvoice(res, { order: data.order, items: data.items, settings });
});

// POS: แอดมินสร้างออเดอร์ขายหน้าร้านโดยตรง (ชำระเงินและเสร็จสิ้นทันที)
router.post('/pos', requireAuth, async (req, res) => {
  const b = req.body || {};
  try {
    const order = await createOrder({
      items: b.items, customer_id: null, channel: 'pos',
      shipping_name: b.customer_name || 'ลูกค้าหน้าร้าน', shipping_phone: b.customer_phone || '', shipping_address: '',
      status: 'completed', payment_status: 'paid', note: 'ขายหน้าร้าน (POS)'
    });
    res.json({ ok: true, order });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'บันทึกการขายไม่สำเร็จ' });
  }
});

module.exports = router;
