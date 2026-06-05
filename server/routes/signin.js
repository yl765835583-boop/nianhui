const router = require('express').Router();
const storage = require('../services/storage');
const ws = require('../services/socket');
const { ok, fail } = require('../utils/helpers');

// 签到数据存在 game.json 的 signins 字段
function getData() {
  const game = storage.getGame();
  if (!game.signins) game.signins = [];
  return game;
}

// 用户签到
router.post('/checkin', (req, res) => {
  const { nickname, dept } = req.body;
  if (!nickname || !nickname.trim()) return res.json(fail('请输入姓名'));
  const game = getData();
  const name = nickname.trim();
  // 检查是否已签到
  if (game.signins.find(s => s.name === name)) {
    return res.json(fail('您已签到过了'));
  }
  const record = { id: Date.now().toString(36), name, dept: (dept || '').trim(), time: new Date().toISOString() };
  game.signins.push(record);
  storage.saveGame(game);
  ws.emit('signin:new', { name: record.name, dept: record.dept, total: game.signins.length });
  res.json(ok({ name: record.name, total: game.signins.length }));
});

// 签到列表
router.get('/list', (req, res) => {
  const game = getData();
  res.json(ok({ list: game.signins, total: game.signins.length }));
});

// 管理员重置签到
router.post('/reset', (req, res) => {
  const game = storage.getGame();
  game.signins = [];
  storage.saveGame(game);
  ws.emit('signin:reset');
  res.json(ok(null, '签到已重置'));
});

module.exports = router;