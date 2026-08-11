const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireCustomerAuth } = require('../middleware/customerAuth');

const router = express.Router();

function signCustomerToken(customer) {
  return jwt.sign(
    { id: customer.id, name: customer.name, email: customer.email, type: 'customer' },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '30d' }
  );
}
function setCustomerCookie(res, token) {
  res.cookie('tj_customer_token', token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

router.post('/register', async (req, res) => {
  await db.ensureInit();
  const { name, email, phone, password, address } = req.body || {};
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ อีเมล และรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)' });
  }
  const { rows: existing } = await db.query('SELECT id FROM customers WHERE email = $1', [email.toLowerCase()]);
  if (existing.length) return res.status(400).json({ error: 'อีเมลนี้เคยสมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ' });

  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await db.query(
    `INSERT INTO customers (name, email, phone, password_hash, address) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, phone, address`,
    [name, email.toLowerCase(), phone || '', hash, address || '']
  );
  const customer = rows[0];
  setCustomerCookie(res, signCustomerToken(customer));
  res.json({ ok: true, customer });
});

router.post('/login', async (req, res) => {
  await db.ensureInit();
  const { email, password } = req.body || {};
  const { rows } = await db.query('SELECT * FROM customers WHERE email = $1', [(email || '').toLowerCase()]);
  const customer = rows[0];
  if (!customer || !bcrypt.compareSync(password || '', customer.password_hash)) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }
  setCustomerCookie(res, signCustomerToken(customer));
  res.json({ ok: true, customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('tj_customer_token');
  res.json({ ok: true });
});

router.get('/me', requireCustomerAuth, async (req, res) => {
  const { rows } = await db.query('SELECT id, name, email, phone, address FROM customers WHERE id = $1', [req.customer.id]);
  if (!rows.length) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });
  res.json({ ok: true, customer: rows[0] });
});

router.put('/me', requireCustomerAuth, async (req, res) => {
  const { name, phone, address } = req.body || {};
  const { rows } = await db.query(
    `UPDATE customers SET name = $1, phone = $2, address = $3 WHERE id = $4 RETURNING id, name, email, phone, address`,
    [name, phone || '', address || '', req.customer.id]
  );
  res.json({ ok: true, customer: rows[0] });
});

module.exports = router;
