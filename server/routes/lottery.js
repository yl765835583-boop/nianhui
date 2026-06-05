const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const storage = require('../services/storage');
const { chatLLM } = require('../services/ai');
const { ok, fail } = require('../utils/helpers');
const ws = require('../services/socket');

// 获取候选名单（用于大屏滚动）
router.get('/pool', (req, res) => {
  const data = storage.getLottery();
  const pool = data.pool.filter(p => !data.drawn.includes(p.id) && !data.blacklist.includes(p.name));
  res.json(ok(pool));
});

// 获取抽奖状态
router.get('/state', (req, res) => {
  const data = storage.getLottery();
  const info = {
    poolCount: data.pool.length,
    winnersCount: data.winners.length,
    prizes: data.prizes,
    currentPrize: data.currentPrize || null,
    isActive: data.isActive || false
  };
  res.json(ok(info));
});

router.use('/admin', adminAuth);

// 管理：导入名单
router.post('/admin/import', (req, res) => {
  const { names } = req.body;
  if (!Array.isArray(names)) return res.json(fail('名单格式错误'));
  const data = storage.getLottery();
  data.pool = names.map((n, i) => ({ id: 'p' + i, name: typeof n === 'string' ? n : n.name, dept: typeof n === 'string' ? '' : (n.dept || '') }));
  data.winners = [];
  data.drawn = [];
  storage.saveLottery(data);
  res.json(ok({ count: data.pool.length }));
});

// 管理：设置奖项
router.post('/admin/prizes', (req, res) => {
  const { prizes } = req.body;
  const data = storage.getLottery();
  data.prizes = prizes || [];
  storage.saveLottery(data);
  res.json(ok(data.prizes));
});

// 管理：设置黑名单
router.post('/admin/blacklist', (req, res) => {
  const { names } = req.body;
  const data = storage.getLottery();
  data.blacklist = names || [];
  storage.saveLottery(data);
  res.json(ok(data.blacklist));
});

// 管理：开启/关闭抽奖
router.post('/admin/toggle', (req, res) => {
  const data = storage.getLottery();
  data.isActive = !data.isActive;
  if (data.isActive && !data.currentPrize && data.prizes.length > 0) {
    data.currentPrize = data.prizes[0];
  }
  storage.saveLottery(data);
  res.json(ok({ isActive: data.isActive, currentPrize: data.currentPrize }));
});

// 执行抽奖
router.post('/draw', async (req, res) => {
  const data = storage.getLottery();
  if (!data.isActive) return res.json(fail('抽奖未开启'));
  if (!data.currentPrize) return res.json(fail('请先设置奖项'));

  const { count = 1 } = req.body;
  const remaining = data.pool.filter(p => !data.drawn.includes(p.id) && !data.blacklist.includes(p.name));
  if (remaining.length === 0) return res.json(fail('候选名单已空'));

  const drawn = [];
  const pool = [...remaining];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const winner = pool.splice(idx, 1)[0];
    data.drawn.push(winner.id);
    drawn.push(winner);
  }

  const results = [];
  for (const w of drawn) {
    let msg = '';
    try { msg = await chatLLM('为' + w.name + '生成一段年会中奖幸运寄语（30字以内）', { style: '幽默轻松' }); } catch {}
    const record = { id: Date.now().toString(36), name: w.name, dept: w.dept, prize: data.currentPrize, message: msg.slice(0, 100), time: new Date().toISOString() };
    data.winners.push(record);
    results.push(record);
  }
  storage.saveLottery(data);
  res.json(ok({ winners: results, remaining: data.pool.length - data.drawn.length }));
});

// 获取中奖记录
router.get('/winners', (req, res) => {
  const data = storage.getLottery();
  res.json(ok(data.winners.reverse()));
});

// 管理：重置
router.post('/admin/reset', (req, res) => {
  storage.saveLottery({ prizes: [], winners: [], pool: [], blacklist: [], drawn: [], isActive: false, currentPrize: null });
  res.json(ok(null, '已重置'));
});

module.exports = router;
