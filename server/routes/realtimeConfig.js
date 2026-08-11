const express = require('express');
const { isConfigured } = require('../lib/realtime');

const router = express.Router();

// สาธารณะ: ให้หน้าเว็บ/หลังบ้านดึงค่าไปสร้าง Supabase client ฝั่ง browser
// (anon key ปลอดภัยที่จะเปิดเผยฝั่ง client — เป็นค่ามาตรฐานของ Supabase สำหรับ Realtime/Auth ฝั่ง browser)
router.get('/', (req, res) => {
  if (!isConfigured()) return res.json({ enabled: false });
  res.json({
    enabled: true,
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  });
});

module.exports = router;
