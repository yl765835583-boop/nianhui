const router = require('express').Router();
const { generateVideo } = require('../services/ai');
const { ok, fail } = require('../utils/helpers');

// AI 视频生成（年会祝福短视频 / 搞笑片段）
router.post('/generate', async (req, res) => {
  const { prompt, duration, style } = req.body;
  if (!prompt) return res.json(fail('请填写视频描述'));

  try {
    const result = await generateVideo(prompt, {
      duration: duration || 5,
      style: style || '年会喜庆',
    });
    res.json(ok(result));
  } catch (e) {
    res.json(fail('视频生成失败：' + e.message));
  }
});

module.exports = router;
