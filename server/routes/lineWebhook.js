const express = require('express');
const db = require('../db');
const { verifySignature, replyMessage } = require('../lib/line');
const realtime = require('../lib/realtime');

const router = express.Router();

// LINE จะ POST มาที่ /webhook/line เมื่อมีลูกค้าทักแชท LINE OA เข้ามา
// ต้องตั้งค่า Webhook URL นี้ใน LINE Developers Console -> Messaging API
router.post('/', express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}), async (req, res) => {
  await db.ensureInit();
  const signature = req.headers['x-line-signature'];
  if (!verifySignature(req.rawBody, signature)) {
    return res.status(401).send('invalid signature');
  }
  res.status(200).send('OK'); // ตอบ LINE ทันทีตามข้อกำหนด

  const events = req.body.events || [];

  for (const event of events) {
    if (event.type === 'message' && event.message?.type === 'text') {
      const lineUserId = event.source?.userId;
      console.log(`[line] ข้อความจากลูกค้า LINE userId=${lineUserId}: ${event.message.text}`);

      const sessionId = `line:${lineUserId}`;
      const { rows } = await db.query('SELECT * FROM chat_sessions WHERE id = $1', [sessionId]);
      if (!rows.length) {
        await db.query('INSERT INTO chat_sessions (id, customer_name, status) VALUES ($1,$2,$3)', [sessionId, 'ลูกค้าจาก LINE OA', 'open']);
      } else {
        await db.query(`UPDATE chat_sessions SET last_message_at = now(), status='open' WHERE id = $1`, [sessionId]);
      }
      const { rows: msgRows } = await db.query(
        `INSERT INTO chat_messages (session_id, sender, message) VALUES ($1,'customer',$2) RETURNING *`,
        [sessionId, event.message.text]
      );

      realtime.broadcast(realtime.sessionChannel(sessionId), 'message', msgRows[0]).catch(() => {});
      realtime.broadcast(realtime.ADMIN_FEED_CHANNEL, 'new_message', { sessionId, sender: 'customer', message: event.message.text }).catch(() => {});

      // ตอบรับอัตโนมัติสั้น ๆ ว่าได้รับข้อความแล้ว ทีมงานจะติดต่อกลับ
      if (event.replyToken) {
        await replyMessage(event.replyToken, 'ขอบคุณที่ติดต่อ TECH-TJ ครับ ทีมงานได้รับข้อความแล้ว จะรีบตอบกลับโดยเร็วที่สุด 🙏');
      }
    }
  }
});

module.exports = router;
