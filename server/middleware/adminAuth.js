const config = require('../config');
module.exports = function (req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== config.adminToken) {
    return res.status(403).json({ code: -99, msg: '无管理权限', data: null });
  }
  next();
};
