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

function upsertScanSignin(game, token, extra) {
  extra = extra || {};
  let existing =
    (extra.openid && game.signins.find((s) => s.openid === extra.openid)) ||
    (token && game.signins.find((s) => s.token === token));
  if (existing) {
    return { record: existing, created: false };
  }
  const n = game.signins.length + 1;
  const record = {
    id: Date.now().toString(36),
    name: extra.name || '来宾' + String(n).padStart(3, '0'),
    dept: extra.dept || '',
    token: token || '',
    openid: extra.openid || '',
    avatar: extra.avatar || '',
    time: new Date().toISOString(),
    source: extra.source || 'scan',
  };
  game.signins.push(record);
  storage.saveGame(game);
  ws.emit('signin:new', {
    name: record.name,
    dept: record.dept,
    avatar: record.avatar || '',
    total: game.signins.length,
  });
  return { record, created: true };
}

function applyScan(req) {
  const game = getData();
  const result = upsertScanSignin(game, req.userToken, { source: 'scan' });
  return { record: result.record, total: game.signins.length, created: result.created };
}

// 微信/浏览器扫码入口：打开就算签到，然后跳到手机成功页
router.get('/scan', (req, res) => {
  const { record, total } = applyScan(req);
  const params = new URLSearchParams({
    signed: '1',
    name: record.name,
    total: String(total),
  });
  res.redirect('/mobile/?' + params.toString());
});

// 手机页自动签到（JSON）
router.post('/scan', (req, res) => {
  const { record, total } = applyScan(req);
  res.json(ok({ name: record.name, total }));
});

// 用户签到
router.post('/checkin', (req, res) => {
  const { nickname, dept, openid, avatar } = req.body || {};
  const game = getData();
  const token = req.userToken;
  const name = (nickname || '').trim();

  const existing =
    (openid && game.signins.find((s) => s.openid === openid)) ||
    (token && game.signins.find((s) => s.token === token)) ||
    (name && game.signins.find((s) => s.name === name));
  if (existing) {
    return res.json(ok({ name: existing.name, total: game.signins.length, already: true }));
  }
  if (!name) return res.json(fail('请输入姓名'));

  const { record } = upsertScanSignin(game, token, {
    name,
    dept: (dept || '').trim(),
    openid: openid || '',
    avatar: avatar || '',
    source: openid ? 'wechat' : 'manual',
  });
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
