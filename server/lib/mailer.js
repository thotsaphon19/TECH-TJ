const nodemailer = require('nodemailer');

function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendInquiryEmail(inquiry) {
  const transport = getTransport();
  if (!transport) {
    console.log('[mailer] SMTP ยังไม่ได้ตั้งค่าใน .env — ข้ามการส่งอีเมล');
    return { skipped: true };
  }
  const to = process.env.MAIL_TO || process.env.SMTP_USER;
  const html = `
    <h2>มีลูกค้าติดต่อเข้ามาใหม่ (TECH-TJ)</h2>
    <p><b>ชื่อ:</b> ${inquiry.name || '-'}</p>
    <p><b>เบอร์โทร:</b> ${inquiry.phone || '-'}</p>
    <p><b>อีเมล:</b> ${inquiry.email || '-'}</p>
    <p><b>บริการที่สนใจ:</b> ${inquiry.service_interested || '-'}</p>
    <p><b>ข้อความ:</b><br/>${(inquiry.message || '-').replace(/\n/g, '<br/>')}</p>
  `;
  return transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `[TECH-TJ] มีลูกค้าติดต่อใหม่ จาก ${inquiry.name || 'เว็บไซต์'}`,
    html
  });
}

module.exports = { sendInquiryEmail };
