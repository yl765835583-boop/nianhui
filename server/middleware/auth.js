const { genId } = require('../utils/helpers');

module.exports = function (req, res, next) {
  let token = req.headers['x-user-token'];
  if (!token) { token = 'u_' + genId(); }
  req.userToken = token;
  res.set('X-User-Token', token);
  next();
};
