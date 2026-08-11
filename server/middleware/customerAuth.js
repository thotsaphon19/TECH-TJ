const jwt = require('jsonwebtoken');

function requireCustomerAuth(req, res, next) {
  const token = req.cookies?.tj_customer_token;
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบสมาชิกก่อนสั่งซื้อ' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    if (payload.type !== 'customer') throw new Error('wrong token type');
    req.customer = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

module.exports = { requireCustomerAuth };
