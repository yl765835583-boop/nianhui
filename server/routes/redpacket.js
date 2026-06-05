const router = require('express').Router();
const ws = require('../services/socket');
const { ok, fail } = require('../utils/helpers');

// 红包雨状态
let rainState = { active: false, packets: [], claimed: {}, totalCount: 0 };

// 管理：开始红包雨
router.post('/start', (req, res) => {
  const { count = 20, duration = 15 } = req.body;
  const packetCount = Math.min(count, 50);
  rainState = { active: true, packets: [], claimed: {}, totalCount: packetCount };

  // 生成随机红包（金额 1-10 元随机）
  for (let i = 0; i < packetCount; i++) {
    let amount = (Math.random() * 9 + 1).toFixed(2);
    // 少数几个大红包
    if (i < Math.ceil(packetCount * 0.1)) amount = (Math.random() * 50 + 10).toFixed(2);
    rainState.packets.push({
      id: 'rp_' + Date.now().toString(36) + '_' + i,
      x: Math.random() * 90 + 5,         // 横向位置 %
      delay: Math.random() * (duration - 2), // 延迟出现（秒）
      speed: Math.random() * 3 + 2,       // 下落速度
      amount: parseFloat(amount),
      claimed: false
    });
  }

  console.log('[RedPacket] 发射红包雨，count=' + packetCount + '，已连接客户端数=' + (ws.getIO() ? ws.getIO().engine.clientsCount : 0));
  ws.emit('redpacket:start', { count: packetCount, duration });
  res.json(ok({ count: packetCount }));

  // 自动结束
  setTimeout(() => {
    if (rainState.active) {
      rainState.active = false;
      ws.emit('redpacket:end', { claimed: Object.keys(rainState.claimed).length, total: packetCount });
    }
  }, duration * 1000);
});

// 用户：抢红包（手机端点一下抢任意未领取的红包）
router.post('/claim', (req, res) => {
  const { nickname } = req.body;
  if (!rainState.active) return res.json(fail('红包雨已结束'));

  // 找一个还没被抢的红包
  const packet = rainState.packets.find(p => !rainState.claimed[p.id]);
  if (!packet) return res.json(fail('红包已被抢光啦'));

  const pid = packet.id;
  rainState.claimed[pid] = { nickname: nickname || '匿名', amount: packet.amount, time: Date.now() };
  ws.emit('redpacket:claimed', {
    packetId: pid,
    nickname: nickname || '匿名',
    amount: packet.amount,
    remaining: rainState.totalCount - Object.keys(rainState.claimed).length
  });
  console.log('[RedPacket] ' + (nickname || '匿名') + ' 抢到 ¥' + packet.amount.toFixed(2) + '，剩余 ' + (rainState.totalCount - Object.keys(rainState.claimed).length));
  res.json(ok({ amount: packet.amount }));
});

// 用户：通过 WebSocket 抢（实时性更好）
router.post('/stop', (req, res) => {
  rainState.active = false;
  ws.emit('redpacket:end', { claimed: Object.keys(rainState.claimed).length, total: rainState.totalCount });
  res.json(ok(null, '已停止'));
});

// 获取当前状态
router.get('/state', (req, res) => {
  res.json(ok({
    active: rainState.active,
    totalCount: rainState.totalCount,
    claimedCount: Object.keys(rainState.claimed).length
  }));
});

module.exports = router;
