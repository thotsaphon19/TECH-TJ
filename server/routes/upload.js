const express = require('express');
const { requireAuth } = require('../middleware/auth');
const cloudinaryLib = require('../lib/cloudinary');

const router = express.Router();

// หลังบ้านเท่านั้น: อัปโหลดรูป — รับเป็น base64 data URL จากฝั่ง client แล้วส่งขึ้น Cloudinary
router.post('/', requireAuth, async (req, res) => {
  const { dataUrl } = req.body || {};
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return res.status(400).json({ error: 'ไม่พบข้อมูลรูปภาพ' });
  }
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  if (!match || !/^image\//.test(match[1])) {
    return res.status(400).json({ error: 'อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น' });
  }
  // จำกัดขนาดคร่าวๆ ก่อนส่งขึ้น Cloudinary (กัน request ใหญ่เกินไป)
  if (dataUrl.length > 8 * 1024 * 1024) {
    return res.status(400).json({ error: 'ไฟล์รูปใหญ่เกินไป กรุณาใช้ไฟล์ไม่เกิน ~6MB' });
  }
  try {
    const result = await cloudinaryLib.uploadDataUrl(dataUrl);
    res.json({ url: result.url, publicId: result.publicId });
  } catch (e) {
    console.error('[upload] Cloudinary error:', e.message);
    res.status(500).json({ error: e.message || 'อัปโหลดรูปไม่สำเร็จ' });
  }
});

module.exports = router;
