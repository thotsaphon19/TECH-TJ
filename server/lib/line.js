const crypto = require('crypto');

const LINE_API = 'https://api.line.me/v2/bot/message';

function isConfigured() {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

function verifySignature(rawBody, signature) {
  if (!process.env.LINE_CHANNEL_SECRET) return true; // ยังไม่ตั้งค่า secret -> ข้ามการตรวจสอบ (dev only)
  const hash = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET)
    .update(rawBody)
    .digest('base64');
  return hash === signature;
}

async function callLineApi(path, body) {
  if (!isConfigured()) {
    console.log('[line] LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า — ข้ามการเรียก LINE API', path, body);
    return { skipped: true };
  }
  const res = await fetch(`${LINE_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('[line] API error', res.status, text);
  }
  return res;
}

// ส่งข้อความ push ไปหาแอดมิน/ร้าน เช่น เมื่อมีลูกค้ากรอกฟอร์มติดต่อ
async function pushToAdmin(text) {
  const to = process.env.LINE_ADMIN_USER_ID;
  if (!to) {
    console.log('[line] LINE_ADMIN_USER_ID ยังไม่ได้ตั้งค่า — ข้ามการแจ้งเตือนไลน์');
    return { skipped: true };
  }
  return callLineApi('/push', { to, messages: [{ type: 'text', text }] });
}

// ส่งข้อความ push ไปหาลูกค้า LINE คนใดคนหนึ่ง (ใช้ตอนแอดมินตอบแชทจากหลังบ้าน)
async function pushMessage(toUserId, text) {
  if (!toUserId) return { skipped: true };
  return callLineApi('/push', { to: toUserId, messages: [{ type: 'text', text }] });
}

// ตอบกลับข้อความในแชท (reply token ได้จาก webhook event)
async function replyMessage(replyToken, text) {
  return callLineApi('/reply', { replyToken, messages: [{ type: 'text', text }] });
}

module.exports = { verifySignature, pushToAdmin, pushMessage, replyMessage, isConfigured };
