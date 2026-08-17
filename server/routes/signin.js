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

function findExisting(game, extra) {
  extra = extra || {};
  if (extra.openid) {
    const byOpenid = game.signins.find((s) => s.openid && s.openid === extra.openid);
    if (byOpenid) return byOpenid;
  }
  if (extra.token) {
    const byToken = game.signins.find((s) => s.token && s.token === extra.token);
    if (byToken) return byToken;
  }
  return null;
}

function publicRecord(record, total, extra) {
  extra = extra || {};
  return {
    name: record.name,
    dept: record.dept || '',
    avatar: record.avatar || '',
    total: total,
    already: !!extra.already,
    updated: !!extra.updated,
  };
}

function upsertScanSignin(game, token, extra) {
  extra = extra || {};
  const existing = findExisting(game, {
    token: token,
    openid: extra.openid,
  });
  if (existing) {
    let updated = false;
    if (extra.name && extra.name !== existing.name) {
      existing.name = extra.name;
      updated = true;
    }
    if (extra.dept !== undefined && extra.dept !== existing.dept) {
      existing.dept = extra.dept;
      updated = true;
    }
    if (extra.openid && !existing.openid) {
      existing.openid = extra.openid;
      updated = true;
    }
    if (extra.avatar && extra.avatar !== existing.avatar) {
      existing.avatar = extra.avatar;
      updated = true;
    }
    if (token && !existing.token) {
      existing.token = token;
      updated = true;
    }
    if (updated) {
      storage.saveGame(game);
      ws.emit('signin:updated', {
        name: existing.name,
        dept: existing.dept,
        avatar: existing.avatar || '',
        total: game.signins.length,
      });
    }
    return { record: existing, created: false, updated: updated };
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
  return { record, created: true, updated: false };
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
    uid: req.userToken,
  });
  res.redirect('/mobile/?' + params.toString());
});

// 手机页自动签到（JSON）
router.post('/scan', (req, res) => {
  const { record, total } = applyScan(req);
  res.json(ok({ name: record.name, total }));
});

// 当前身份是否已签到
router.get('/me', (req, res) => {
  const game = getData();
  const existing = findExisting(game, { token: req.userToken, openid: req.query.openid });
  if (!existing) return res.json(ok({ signed: false, total: game.signins.length }));
  res.json(
    ok({
      signed: true,
      name: existing.name,
      dept: existing.dept || '',
      avatar: existing.avatar || '',
      total: game.signins.length,
    })
  );
});

// 用户签到：同一人改名只更新，不新增
router.post('/checkin', (req, res) => {
  const { nickname, dept, openid, avatar } = req.body || {};
  const game = getData();
  const token = req.userToken;
  const name = (nickname || '').trim();
  const existing = findExisting(game, { token, openid });
  if (existing) {
    const { record, updated } = upsertScanSignin(game, token, {
      name: name || existing.name,
      dept: dept !== undefined ? String(dept).trim() : existing.dept,
      openid: openid || existing.openid,
      avatar: avatar || existing.avatar,
      source: existing.source || 'manual',
    });
    return res.json(ok(publicRecord(record, game.signins.length, { already: true, updated })));
  }
  if (!name) return res.json(fail('请输入姓名'));

  const { record } = upsertScanSignin(game, token, {
    name,
    dept: (dept || '').trim(),
    openid: openid || '',
    avatar: avatar || '',
    source: openid ? 'wechat' : 'manual',
  });
  res.json(ok(publicRecord(record, game.signins.length)));
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
