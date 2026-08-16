const router = require('express').Router();
const storage = require('../services/storage');
const sensitive = require('../middleware/sensitive');
const { chatLLM } = require('../services/ai');
const { ok, fail } = require('../utils/helpers');

// 已抽中的留言 ID 集合（内存 + 文件持久化）
let drawnIds = new Set(storage.getDrawnMessages() || []);

function saveDrawnIds() {
  storage.saveDrawnMessages([...drawnIds]);
}

router.post('/send', async (req, res) => {
  const { text, nickname } = req.body;
  if (!text || !text.trim()) return res.json(fail('留言不能为空'));

  const check = sensitive.check(text);
  if (!check.ok) return res.json(fail('内容包含敏感词：' + check.word));

  let polished = sensitive.filter(text.trim());
  try {
    const result = await chatLLM(
      '请润色以下年会留言，使其更有趣但保留原意（50字以内）：' + polished,
      { style: '幽默轻松' }
    );
    polished = result.slice(0, 200);
  } catch {
    /* 润色失败时用原文 */
  }

  const msg = storage.addMessage({
    text: polished,
    original: text.trim(),
    nickname: nickname || '匿名',
  });
  res.json(ok(msg));
});

router.get('/list', (req, res) => {
  const msgs = storage.getMessages();
  res.json(ok(msgs.slice(-100).reverse()));
});

router.post('/like/:id', (req, res) => {
  const msg = storage.likeMessage(req.params.id);
  if (!msg) return res.json(fail('留言不存在'));
  res.json(ok({ likes: msg.likes }));
});

// 随机抽留言（送小礼品）—— 每人只抽一次
router.post('/random', async (req, res) => {
  const msgs = storage.getMessages();
  // 过滤掉已抽中的留言
  const available = msgs.filter((m) => !drawnIds.has(m.id));
  if (available.length === 0) return res.json(fail('所有留言都已抽过奖了，请先重置'));
  const pick = available[Math.floor(Math.random() * available.length)];
  drawnIds.add(pick.id);
  saveDrawnIds();

  let giftMsg = '';
  try {
    giftMsg = await chatLLM(
      '为留言"' +
        pick.text.slice(0, 50) +
        '"的发布者' +
        pick.nickname +
        '写一句年会礼品颁奖词（20字以内）',
      { style: '幽默轻松' }
    );
  } catch {
    /* 颁奖词失败时保持空串 */
  }
  res.json(ok({ winner: pick, giftMsg: giftMsg.slice(0, 100), remaining: available.length - 1 }));
});

// 重置已抽记录
router.post('/random/reset', (req, res) => {
  drawnIds.clear();
  saveDrawnIds();
  res.json(ok(null, '已重置，所有留言可重新参与抽奖'));
});

module.exports = router;
