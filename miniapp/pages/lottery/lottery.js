const api = require('../../utils/api');
Page({
  data: {
    isActive: false,
    currentPrize: null,
    poolCount: 0,
    winnersCount: 0,
    winners: [],
    loading: true
  },
  onLoad() {
    this.refresh();
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    this.loadState();
    this.loadWinners();
  },
  async loadState() {
    try {
      const res = await api.getLotteryState();
      if (res.code === 0) {
        this.setData({
          isActive: res.data.isActive,
          currentPrize: res.data.currentPrize,
          poolCount: res.data.poolCount,
          winnersCount: res.data.winnersCount,
          loading: false
        });
      }
    } catch {}
  },
  async loadWinners() {
    try {
      const res = await api.getWinners();
      if (res.code === 0) {
        this.setData({ winners: (res.data || []).slice(0, 30) });
      }
    } catch {}
  },
  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  }
});
