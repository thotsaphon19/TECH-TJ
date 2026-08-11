const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  await db.ensureInit();
  const { username, password } = req.body || {};
  const { rows } = await db.query('SELECT * FROM admin_users WHERE username = $1', [username]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '12h' });
  res.cookie('tj_admin_token', token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000
  });
  res.json({ ok: true, username: user.username });
});

router.post('/logout', (req, res) => {
  res.clearCookie('tj_admin_token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const { rows } = await db.query('SELECT * FROM admin_users WHERE id = $1', [req.admin.id]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(400).json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
  res.json({ ok: true });
});

module.exports = router;
