const api = require('../../utils/api');

Page({
  data: {
    tab: 'wall',
    msgText: '',
    msgNick: '',
    messages: [],
    lotteryState: null,
    winners: [],
    sending: false
  },
  onShow() {
    this.loadMessages();
    this.loadLottery();
  },
  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
    if (e.currentTarget.dataset.tab === 'wall') this.loadMessages();
    if (e.currentTarget.dataset.tab === 'lottery') this.loadLottery();
  },
  onMsgInput(e) { this.setData({ msgText: e.detail.value }); },
  onNickInput(e) { this.setData({ msgNick: e.detail.value }); },
  async sendMessage() {
    const { msgText, msgNick } = this.data;
    if (!msgText.trim()) { wx.showToast({ title: '请输入留言内容', icon: 'none' }); return; }
    this.setData({ sending: true });
    try {
      await api.sendMessage({ text: msgText, nickname: msgNick || '年会小伙伴' });
      wx.showToast({ title: '发送成功！', icon: 'success' });
      this.setData({ msgText: '' });
      this.loadMessages();
    } catch (e) { wx.showToast({ title: '发送失败', icon: 'none' }); }
    this.setData({ sending: false });
  },
  async loadMessages() {
    try { const res = await api.getMessages(); this.setData({ messages: res.data || [] }); } catch {}
  },
  async likeMsg(e) {
    try { await api.likeMessage(e.currentTarget.dataset.id); this.loadMessages(); } catch {}
  },
  async loadLottery() {
    try {
      const [state, winners] = await Promise.all([api.getLotteryState(), api.getWinners()]);
      this.setData({ lotteryState: state.data, winners: winners.data || [] });
    } catch {}
  }
});
