const app = getApp();

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.apiBase + '/api' + path,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'X-User-Token': app.globalData.userToken || '',
      },
      success(res) {
        const token = res.header['X-User-Token'] || res.header['x-user-token'];
        if (token) {
          app.globalData.userToken = token;
          wx.setStorageSync('userToken', token);
        }
        resolve(res.data);
      },
      fail(err) {
        wx.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      },
    });
  });
}

module.exports = {
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),

  // 文案
  generateWenan: (data) => request('POST', '/wenan/generate', data),
  generateScript: (data) => request('POST', '/wenan/script', data),
  generateLyrics: (data) => request('POST', '/wenan/lyrics', data),
  rewriteText: (data) => request('POST', '/wenan/rewrite', data),

  // 形象
  generateAvatar: (data) => request('POST', '/avatar/generate', data),
  generatePersona: (data) => request('POST', '/avatar/persona', data),
  getAvatarRecords: () => request('GET', '/avatar/records'),

  // 留言
  sendMessage: (data) => request('POST', '/wall/send', data),
  getMessages: () => request('GET', '/wall/list'),
  likeMessage: (id) => request('POST', '/wall/like/' + id),

  // 签到
  signin: (data) => request('POST', '/signin/checkin', data),

  // 抽奖
  getLotteryState: () => request('GET', '/lottery/state'),
  getWinners: () => request('GET', '/lottery/winners'),

  // 游戏
  generateQuiz: (data) => request('POST', '/game/quiz/generate', data),
  submitQuiz: (data) => request('POST', '/game/quiz/submit', data),
  getRanks: () => request('GET', '/game/ranks'),
  checkIdiom: (data) => request('POST', '/game/idiom/check', data),
  checkFeihua: (data) => request('POST', '/game/feihua/check', data),
  transformVoice: (data) => request('POST', '/game/voice/transform', data),

  // 设置
  getSettings: () => request('GET', '/settings'),

  // 视频
  generateVideo: (data) => request('POST', '/video/generate', data),

  // 音乐
  generateMusic: (data) => request('POST', '/music/generate', data),
};
