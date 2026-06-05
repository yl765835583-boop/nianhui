const router = require('express').Router();
const { generateMusic } = require('../services/ai');
const { ok, fail } = require('../utils/helpers');

router.post('/generate', async (req, res) => {
  const { prompt, lyrics, duration, style } = req.body;
  if (!prompt) return res.json(fail('请填写音乐描述'));

  try {
    const result = await generateMusic(prompt, {
      lyrics: lyrics || prompt,
      duration: duration || 30,
      style: style || '欢快',
    });
    res.json(ok(result));
  } catch (e) {
    res.json(fail('音乐生成失败：' + e.message));
  }
});

module.exports = router;
