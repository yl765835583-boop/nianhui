const router = require('express').Router();
const { chatLLM, generateImage } = require('../services/ai');
const { ok, fail } = require('../utils/helpers');
const storage = require('../services/storage');

// 趣味头像生成
router.post('/generate', async (req, res) => {
  const { style, gender } = req.body;
  if (!style) return res.json(fail('请选择头像风格'));

  try {
    const image = await generateImage(style + '头像 ' + (gender || ''), { style });
    const record = storage.addAvatar({ type: 'avatar', style, gender, image });
    res.json(ok({ url: image.url, style, id: record.id }));
  } catch (e) {
    res.json(fail('生成失败：' + e.message));
  }
});

// 年度人设卡片
router.post('/persona', async (req, res) => {
  const { nickname, role, department } = req.body;
  if (!nickname) return res.json(fail('请填写昵称'));

  try {
    const prompt =
      '请为以下同事生成年度人设总结。昵称：' +
      nickname +
      '，岗位：' +
      (role || '员工') +
      '，部门：' +
      (department || '') +
      '。请生成年度关键词、趣味标签、年度总结。';
    const text = await chatLLM(prompt, { style: '温情走心' });
    const image = await generateImage(nickname + ' 人设卡片 ' + role, { style: '年会礼服' });
    const record = storage.addAvatar({ type: 'persona', nickname, role, department, text, image });
    res.json(ok({ text, imageUrl: image.url, id: record.id }));
  } catch (e) {
    res.json(fail('生成失败：' + e.message));
  }
});

// 获取生成记录
router.get('/records', (req, res) => {
  const records = storage.getAvatars();
  res.json(ok(records.reverse().slice(0, 20)));
});

module.exports = router;
