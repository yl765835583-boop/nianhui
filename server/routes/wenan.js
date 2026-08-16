const router = require('express').Router();
const { chatLLM } = require('../services/ai');
const sensitive = require('../middleware/sensitive');
const { ok, fail } = require('../utils/helpers');

// 文案生成
router.post('/generate', async (req, res) => {
  const { type, style, topic, wordCount } = req.body;
  if (!type) return res.json(fail('请选择文案类型'));

  let prompt = `请生成一段年会${type}`;
  if (topic) prompt += `，主题：${topic}`;
  prompt += `，风格：${style || '正式大气'}`;
  if (type === '对联') {
    prompt = `请为年会创作一副对联。主题：${topic || '年会'}，风格：${style || '正式大气'}。要求：上联、下联、横批，对仗工整。`;
  } else if (wordCount) {
    prompt += `，字数：${wordCount}字左右`;
  }
  try {
    const text = await chatLLM(prompt, { style });
    res.json(ok({ text, type, style }));
  } catch (e) {
    res.json(fail('生成失败：' + e.message));
  }
});

// 节目创作
router.post('/script', async (req, res) => {
  const { scriptType, topic, people, duration, style } = req.body;
  if (!scriptType) return res.json(fail('请选择节目类型'));

  const prompt = `请创作年会${scriptType}剧本。主题：${topic || '年会'}，人数：${people || 3}人，时长：${duration || 5}分钟，风格：${style || '幽默轻松'}`;
  try {
    const text = await chatLLM(prompt, { style: style || '幽默轻松' });
    res.json(ok({ text, scriptType }));
  } catch (e) {
    res.json(fail('生成失败：' + e.message));
  }
});

// 歌词改编
router.post('/lyrics', async (req, res) => {
  const { song, topic, style } = req.body;
  if (!song) return res.json(fail('请填写原歌曲名'));

  const prompt = `请将歌曲《${song}》改编为年会版本。主题：${topic || '公司年会'}，风格：${style || '幽默轻松'}。请保留原曲结构，重新填词。`;
  try {
    const text = await chatLLM(prompt, { style });
    res.json(ok({ text, song }));
  } catch (e) {
    res.json(fail('生成失败：' + e.message));
  }
});

// 一键改写
router.post('/rewrite', async (req, res) => {
  const { text, style } = req.body;
  if (!text) return res.json(fail('请提供原文'));

  try {
    const result = await chatLLM(
      '请改写以下文本，风格：' + (style || '正式大气') + '\n\n原文：' + text,
      { style }
    );
    res.json(ok({ text: result }));
  } catch (e) {
    res.json(fail('改写失败：' + e.message));
  }
});

// 敏感词检查
router.post('/check', (req, res) => {
  const { text } = req.body;
  const result = sensitive.check(text);
  res.json(ok(result));
});

module.exports = router;
