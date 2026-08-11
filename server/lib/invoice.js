const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_REGULAR = path.join(__dirname, '..', 'fonts', 'Sarabun-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'fonts', 'Sarabun-Bold.ttf');

function formatMoney(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// สร้าง PDF ใบแจ้งหนี้/ใบเสร็จ แล้ว pipe ตรงไปที่ res (stream) — ไม่ต้องเก็บไฟล์ไว้ที่ไหน
function streamInvoice(res, { order, items, settings }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.registerFont('Sarabun', FONT_REGULAR);
  doc.registerFont('Sarabun-Bold', FONT_BOLD);
  doc.font('Sarabun');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.order_number}.pdf"`);
  doc.pipe(res);

  const siteName = settings?.site_name_th || 'TECH-TJ Solution Technology';

  // หัวเอกสาร
  doc.font('Sarabun-Bold').fontSize(20).fillColor('#111').text(siteName, 50, 50);
  doc.font('Sarabun').fontSize(10).fillColor('#555')
    .text(`โทร: ${settings?.phone || '-'}  |  LINE: ${settings?.line_id || '-'}  |  อีเมล: ${settings?.email_display || '-'}`, 50, 76);

  doc.font('Sarabun-Bold').fontSize(16).fillColor('#111').text('ใบแจ้งหนี้ / ใบเสร็จรับเงิน', 50, 110);
  doc.font('Sarabun').fontSize(10).fillColor('#333');
  doc.text(`เลขที่คำสั่งซื้อ: ${order.order_number}`, 50, 132);
  doc.text(`วันที่: ${new Date(order.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, 148);
  doc.text(`สถานะการชำระเงิน: ${paymentStatusLabel(order.payment_status)}`, 50, 164);
  doc.text(`สถานะคำสั่งซื้อ: ${orderStatusLabel(order.status)}`, 50, 180);

  // ที่อยู่จัดส่ง
  doc.font('Sarabun-Bold').fontSize(11).text('จัดส่งถึง', 320, 132);
  doc.font('Sarabun').fontSize(10);
  doc.text(order.shipping_name || '-', 320, 148);
  doc.text(order.shipping_phone || '-', 320, 164);
  doc.text(order.shipping_address || '-', 320, 180, { width: 220 });

  // ตารางรายการสินค้า
  let y = 250;
  doc.font('Sarabun-Bold').fontSize(10);
  doc.text('รายการ', 50, y);
  doc.text('ราคา/หน่วย', 300, y, { width: 80, align: 'right' });
  doc.text('จำนวน', 380, y, { width: 60, align: 'right' });
  doc.text('รวม', 450, y, { width: 95, align: 'right' });
  y += 16;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#ccc').stroke();
  y += 8;

  doc.font('Sarabun').fontSize(10);
  for (const item of items) {
    if (y > 720) { doc.addPage(); y = 50; }
    doc.text(item.product_name, 50, y, { width: 240 });
    doc.text(formatMoney(item.unit_price), 300, y, { width: 80, align: 'right' });
    doc.text(String(item.quantity), 380, y, { width: 60, align: 'right' });
    doc.text(formatMoney(item.subtotal), 450, y, { width: 95, align: 'right' });
    y += 20;
  }

  y += 8;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#ccc').stroke();
  y += 12;

  doc.font('Sarabun-Bold').fontSize(11);
  doc.text('ยอดรวมทั้งสิ้น', 350, y, { width: 100, align: 'right' });
  doc.text(`฿ ${formatMoney(order.total_amount)}`, 450, y, { width: 95, align: 'right' });

  y += 40;
  doc.font('Sarabun').fontSize(9).fillColor('#888')
    .text('เอกสารนี้สร้างโดยระบบอัตโนมัติ ขอบคุณที่ใช้บริการ ' + siteName, 50, y);

  doc.end();
}

function orderStatusLabel(s) {
  return { pending: 'รอดำเนินการ', processing: 'กำลังจัดเตรียม', shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก' }[s] || s;
}
function paymentStatusLabel(s) {
  return { unpaid: 'ยังไม่ชำระเงิน', pending_verification: 'รอตรวจสอบสลิป', paid: 'ชำระเงินแล้ว', rejected: 'สลิปไม่ผ่านการตรวจสอบ' }[s] || s;
}

module.exports = { streamInvoice, orderStatusLabel, paymentStatusLabel };
