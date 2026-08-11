const cloudinary = require('cloudinary').v2;

function isConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

if (isConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

// อัปโหลดรูป (รับเป็น base64 data URL) ขึ้น Cloudinary แล้วคืน URL แบบถาวร (CDN)
async function uploadDataUrl(dataUrl) {
  if (!isConfigured()) {
    throw new Error('ยังไม่ได้ตั้งค่า Cloudinary (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET) ใน .env');
  }
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: 'tech-tj',
    resource_type: 'image',
    // บีบอัด/ปรับคุณภาพอัตโนมัติให้เหมาะกับเว็บ โดยไม่ลดขนาดภาพต้นฉบับ
    transformation: [{ quality: 'auto', fetch_format: 'auto' }]
  });
  return { url: result.secure_url, publicId: result.public_id };
}

async function deleteImage(publicId) {
  if (!isConfigured() || !publicId) return;
  return cloudinary.uploader.destroy(publicId).catch((e) => console.error('[cloudinary] ลบรูปล้มเหลว', e.message));
}

module.exports = { uploadDataUrl, deleteImage, isConfigured };
