const config = require('../config');
const { readJSON, writeJSON } = require('../utils/helpers');
const path = require('path');

const usageFile = path.join(__dirname, '..', 'data', 'usage.json');
let requestCount = 0;

// 定期清理过期记录（保留最近 3 天）
function cleanup(usage) {
  const now = Date.now();
  const maxAge = 3 * 24 * 60 * 60 * 1000;
  let changed = false;
  for (const key of Object.keys(usage)) {
    const datePart = key.split('_').pop();
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const entryDate = new Date(datePart).getTime();
      if (now - entryDate > maxAge) {
        delete usage[key];
        changed = true;
      }
    }
  }
  return changed;
}

module.exports = function (req, res, next) {
  if (req.method === 'GET') return next();
  const token = req.userToken;
  const today = new Date().toISOString().slice(0, 10);
  const usage = readJSON(usageFile, {});

  // 每 100 次请求清理一次过期记录
  requestCount++;
  if (requestCount % 100 === 0) {
    if (cleanup(usage)) {
      writeJSON(usageFile, usage);
    }
  }

  const key = token + '_' + today;
  const count = (usage[key] || 0) + 1;
  if (count > config.rateLimit.perUserPerDay) {
    return res.status(429).json({ code: -2, msg: '今日调用次数已达上限，请明天再来', data: null });
  }
  usage[key] = count;
  writeJSON(usageFile, usage);
  res.set('X-RateLimit-Remaining', config.rateLimit.perUserPerDay - count);
  next();
};
