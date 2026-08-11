const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies?.tj_admin_token;
  if (!token) return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

module.exports = { requireAuth };
