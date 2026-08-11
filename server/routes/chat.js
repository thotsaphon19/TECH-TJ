const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const realtime = require('../lib/realtime');

const router = express.Router();

async function touchSession(sessionId, name) {
  const { rows } = await db.query('SELECT * FROM chat_sessions WHERE id = $1', [sessionId]);
  if (!rows.length) {
    await db.query('INSERT INTO chat_sessions (id, customer_name, status) VALUES ($1,$2,$3)', [sessionId, name || 'ผู้เยี่ยมชม', 'open']);
  } else {
    await db.query(`UPDATE chat_sessions SET last_message_at = now(), status='open' WHERE id = $1`, [sessionId]);
  }
}

// สาธารณะ: ลูกค้าโหลดประวัติแชทของตัวเอง (polling ทุก 2-3 วิ)
router.get('/history/:sessionId', async (req, res) => {
  await db.ensureInit();
  const { rows } = await db.query('SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY id ASC', [req.params.sessionId]);
  res.json(rows);
});

// สาธารณะ: ลูกค้าส่งข้อความ
router.post('/message', async (req, res) => {
  await db.ensureInit();
  const { sessionId, name, message } = req.body || {};
  if (!sessionId || !message) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  await touchSession(sessionId, name);
  const { rows } = await db.query(
    `INSERT INTO chat_messages (session_id, sender, message) VALUES ($1,'customer',$2) RETURNING *`,
    [sessionId, message]
  );

  // แจ้งเตือนแบบเรียลไทม์ผ่าน Supabase (ไม่บล็อกการตอบกลับลูกค้า — ถ้ายังไม่ตั้งค่า Supabase จะข้ามไปเฉยๆ)
  realtime.broadcast(realtime.sessionChannel(sessionId), 'message', rows[0]).catch(() => {});
  realtime.broadcast(realtime.ADMIN_FEED_CHANNEL, 'new_message', { sessionId, sender: 'customer', message }).catch(() => {});

  res.json(rows[0]);
});

// หลังบ้าน: รายการห้องแชททั้งหมด เรียงตามข้อความล่าสุด (polling)
router.get('/sessions', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM chat_sessions ORDER BY last_message_at DESC');
  res.json(rows);
});

router.get('/sessions/:id/messages', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY id ASC', [req.params.id]);
  res.json(rows);
});

// หลังบ้าน: แอดมินตอบกลับข้อความ
router.post('/sessions/:id/reply', requireAuth, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'กรุณาระบุข้อความ' });
  const sessionId = req.params.id;
  await db.query(`UPDATE chat_sessions SET last_message_at = now() WHERE id = $1`, [sessionId]);
  const { rows } = await db.query(
    `INSERT INTO chat_messages (session_id, sender, message) VALUES ($1,'admin',$2) RETURNING *`,
    [sessionId, message]
  );

  // ถ้าเป็นห้องแชทที่มาจาก LINE OA (session id ขึ้นต้นด้วย "line:") ส่งข้อความกลับไปที่ LINE ด้วย
  if (sessionId.startsWith('line:')) {
    const lineUserId = sessionId.slice('line:'.length);
    const { pushMessage } = require('../lib/line');
    if (pushMessage) await pushMessage(lineUserId, message).catch((e) => console.error('[line] ส่งข้อความล้มเหลว', e.message));
  }

  // แจ้งเตือนลูกค้าแบบเรียลไทม์ผ่าน Supabase
  realtime.broadcast(realtime.sessionChannel(sessionId), 'message', rows[0]).catch(() => {});

  res.json(rows[0]);
});

module.exports = router;
