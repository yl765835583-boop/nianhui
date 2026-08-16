const router = require('express').Router();
const QRCode = require('qrcode');

// 生成二维码（返回 SVG）
router.get('/', (req, res) => {
  const url = req.query.url || req.protocol + '://' + req.get('host') + '/mobile/';
  QRCode.toString(
    url,
    { type: 'svg', margin: 2, width: 200, color: { dark: '#1a1a2e', light: '#00000000' } },
    (err, svg) => {
      if (err) return res.status(500).json({ code: -1, msg: 'QR生成失败' });
      res.set('Content-Type', 'image/svg+xml');
      res.send(svg);
    }
  );
});

module.exports = router;
