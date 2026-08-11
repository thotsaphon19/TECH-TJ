require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cookieParser());
app.use(express.json({ limit: '5mb' })); // รองรับรูปแบบ base64 ที่ส่งมาตอนอัปโหลด

// เมื่อรันในเครื่อง (local dev) ให้เสิร์ฟไฟล์ static ด้วย เพราะไม่มี Vercel คอยเสิร์ฟให้
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

// ---------- API routes ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/content-texts', require('./routes/contentTexts'));
app.use('/api/services', require('./routes/services'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/realtime-config', require('./routes/realtimeConfig'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customer-auth', require('./routes/customerAuth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/webhook/line', require('./routes/lineWebhook'));

// ---------- หน้าเว็บ (เฉพาะตอนรัน local ที่ Express เป็นคนเสิร์ฟ static เอง) ----------
if (!process.env.VERCEL) {
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
  app.get('/shop', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'shop.html')));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
}

module.exports = app;
