const router = require('express').Router();
const storage = require('../services/storage');
const { ok, fail } = require('../utils/helpers');

// 获取/更新全局设置
router.get('/', (req, res) => {
  res.json(ok(storage.getSettings()));
});

router.post('/', (req, res) => {
  const s = storage.getSettings();
  Object.assign(s, req.body);
  storage.saveSettings(s);
  res.json(ok(s));
});

module.exports = router;
