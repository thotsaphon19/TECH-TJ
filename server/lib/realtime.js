const { createClient } = require('@supabase/supabase-js');

function isConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

let client = null;
function getClient() {
  if (!isConfigured()) return null;
  if (!client) client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  return client;
}

// ส่งข้อความแบบ broadcast ผ่าน Supabase Realtime ไปยัง channel ที่ระบุ
// ใช้เป็นตัว "แจ้งเตือนทันที" เสริมจาก Neon (Neon ยังเป็นที่เก็บข้อมูลจริงเหมือนเดิม
// ถ้ายังไม่ได้ตั้งค่า Supabase ระบบจะข้ามส่วนนี้ไปเฉยๆ แชทจะยังทำงานได้ผ่าน polling ตามปกติ)
async function broadcast(channelName, event, payload) {
  const supabase = getClient();
  if (!supabase) return; // ยังไม่ตั้งค่า Supabase -> ข้าม ไม่กระทบการทำงานหลัก

  const channel = supabase.channel(channelName);
  const sendPromise = new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event, payload }).finally(() => resolve());
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        resolve();
      }
    });
  });
  // กันไม่ให้ค้างนานเกินไปถ้า Supabase ตอบช้า/ล่ม
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
  await Promise.race([sendPromise, timeoutPromise]);
  try { supabase.removeChannel(channel); } catch (e) { /* noop */ }
}

// ช่องแชทของห้องหนึ่งๆ (ลูกค้า <-> แอดมิน คุยกันในห้องนี้)
function sessionChannel(sessionId) {
  return `chat-session-${sessionId}`;
}
// ช่องกลางที่แอดมินฟังไว้เพื่อรู้ว่ามีข้อความใหม่เข้ามาในห้องไหนบ้าง (อัปเดตรายชื่อห้อง/badge)
const ADMIN_FEED_CHANNEL = 'chat-admin-feed';

module.exports = { broadcast, isConfigured, sessionChannel, ADMIN_FEED_CHANNEL };
