const router = require('express').Router();
const https = require('https');
const config = require('../config');
const storage = require('../services/storage');
const ws = require('../services/socket');
const { ok, fail } = require('../utils/helpers');

// 是否已配置微信 OAuth
function isConfigured() {
  return !!(config.wechat && config.wechat.appId && config.wechat.appSecret);
}

// 获取基础 URL（用于回调）
function getBaseUrl(req) {
  // 优先使用配置中的 PUBLIC_URL，否则从请求推断
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  return req.protocol + '://' + req.get('host');
}

// 微信 OAuth 入口：扫码后跳转到微信授权页
router.get('/auth', (req, res) => {
  if (!isConfigured()) {
    // 未配置微信，直接跳转到手机签到页
    return res.redirect('/mobile/?scan=1');
  }

  const appId = config.wechat.appId;
  const redirectUri = encodeURIComponent(getBaseUrl(req) + '/api/wechat/callback');
  const state = Math.random().toString(36).substring(2, 10);
  const scope = config.wechat.oauthScope || 'snsapi_base';

  // snsapi_userinfo: 需要用户手动同意，可获取昵称和头像
  const wxUrl = 'https://open.weixin.qq.com/connect/oauth2/authorize'
    + '?appid=' + appId
    + '&redirect_uri=' + redirectUri
    + '&response_type=code'
    + '&scope=' + scope
    + '&state=' + state
    + '#wechat_redirect';

  res.redirect(wxUrl);
});

// HTTP GET 辅助
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

// 微信 OAuth 回调：用 code 换取用户信息，自动签到
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    // 用户拒绝授权，回退到手动签到
    return res.redirect('/mobile/?scan=1&reason=denied');
  }

  if (!isConfigured()) {
    return res.redirect('/mobile/?scan=1');
  }

  try {
    const appId = config.wechat.appId;
    const appSecret = config.wechat.appSecret;

    // 1. 用 code 换取 access_token 和 openid
    const tokenUrl = 'https://api.weixin.qq.com/sns/oauth2/access_token'
      + '?appid=' + appId
      + '&secret=' + appSecret
      + '&code=' + code
      + '&grant_type=authorization_code';

    const tokenData = await httpGet(tokenUrl);

    if (tokenData.errcode) {
      console.error('[微信OAuth] token 换取失败:', tokenData);
      return res.redirect('/mobile/?scan=1&reason=token_fail');
    }

    const { access_token, openid } = tokenData;
    const skipUserinfo = (config.wechat.oauthScope || 'snsapi_base') !== 'snsapi_userinfo';

    // 2. 用 access_token 和 openid 获取用户信息
    const userUrl = 'https://api.weixin.qq.com/sns/userinfo'
      + '?access_token=' + access_token
      + '&openid=' + openid
      + '&lang=zh_CN';

    const userData = skipUserinfo ? {} : await httpGet(userUrl);

    if (userData.errcode) {
      console.error('[微信OAuth] 用户信息获取失败:', userData);
      return res.redirect('/mobile/?scan=1&reason=userinfo_fail');
    }

    const nickname = userData.nickname || ('微信用户' + openid.substring(0, 6));
    const headimg = userData.headimgurl || '';

    // 3. 自动签到
    const game = storage.getGame();
    if (!game.signins) game.signins = [];

    // 检查 openid 是否已签到（避免重复）
    const existing = game.signins.find(s => s.openid === openid);
    if (!existing) {
      const record = {
        id: Date.now().toString(36),
        name: nickname,
        dept: '',
        openid: openid,
        avatar: headimg,
        time: new Date().toISOString(),
        source: 'wechat'
      };
      game.signins.push(record);
      storage.saveGame(game);

      // 通过 WebSocket 通知大屏
      ws.emit('signin:new', {
        name: record.name,
        dept: record.dept,
        avatar: record.avatar || '',
        total: game.signins.length
      });
    }

    // 4. 重定向到手机端，带上签到信息
    const params = new URLSearchParams({
      signed: '1',
      name: nickname,
      openid: openid,
      avatar: headimg
    });
    res.redirect('/mobile/?' + params.toString());

  } catch (err) {
    console.error('[微信OAuth] 回调异常:', err);
    res.redirect('/mobile/?scan=1&reason=error');
  }
});

// 获取微信 JS-SDK 签名（供前端调用 wx.config）
router.get('/jssdk-sign', (req, res) => {
  if (!isConfigured()) {
    return res.json(fail('微信未配置'));
  }
  // JS-SDK 签名需要 access_token 和 jsapi_ticket，流程较复杂
  // 此处返回基本配置，实际使用时需要缓存 ticket
  res.json(ok({
    appId: config.wechat.appId,
    debug: false,
    jsApiList: ['scanQRCode']
  }));
});

module.exports = router;
