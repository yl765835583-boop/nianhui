const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { ok, fail } = require('../utils/helpers');

const storage = multer.diskStorage({
  destination: config.upload.dir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now().toString(36) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: config.upload.maxSize } });

// 上传图片（头像原图等）
router.post('/image', upload.single('file'), (req, res) => {
  if (!req.file) return res.json(fail('请选择文件'));
  const url = '/uploads/' + req.file.filename;
  res.json(ok({ url, filename: req.file.filename }));
});

module.exports = router;
