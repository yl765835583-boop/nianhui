const { genId } = require('../utils/helpers');

function readCookie(header, name) {
  const parts = String(header || '').split(';');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const idx = p.indexOf('=');
    if (idx < 1) continue;
    if (p.slice(0, idx).trim() !== name) continue;
    try {
      return decodeURIComponent(p.slice(idx + 1).trim());
    } catch {
      return p.slice(idx + 1).trim();
    }
  }
  return '';
}

module.exports = function (req, res, next) {
  let token = req.headers['x-user-token'] || req.query.uid || readCookie(req.headers.cookie, 'nh_uid');
  if (!token || typeof token !== 'string' || token.length < 8 || token.length > 80) {
    token = 'u_' + genId();
  }
  req.userToken = token;
  res.set('X-User-Token', token);
  const httpsOn = req.secure || String(req.headers['x-forwarded-proto'] || '') === 'https';
  const cookie =
    'nh_uid=' +
    encodeURIComponent(token) +
    '; Path=/; Max-Age=31536000; SameSite=' +
    (httpsOn ? 'None; Secure' : 'Lax');
  res.set('Set-Cookie', cookie);
  next();
};
