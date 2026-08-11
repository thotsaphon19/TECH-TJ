const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ TECH-TJ server (local dev) running: http://localhost:${PORT}`);
  console.log(`   หลังบ้าน (admin): http://localhost:${PORT}/admin`);
});
