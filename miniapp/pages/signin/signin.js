const api = require('../../utils/api');

Page({
  data: {
    name: '',
    dept: '',
    signed: false,
    signedName: '',
    signedTotal: 0,
    scanned: false,
    scanning: false,
    submitting: false,
  },
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },
  onDeptInput(e) {
    this.setData({ dept: e.detail.value });
  },
  // 扫大屏二维码：识别签到入口
  scanCode() {
    this.setData({ scanning: true });
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const url = res.result || '';
        if (url.indexOf('/api/wechat/auth') > -1 || url.indexOf('/mobile/') > -1) {
          this.setData({ scanned: true });
          wx.showToast({ title: '已识别签到二维码', icon: 'success' });
        } else {
          wx.showToast({ title: '不是本场签到二维码', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '已取消扫码', icon: 'none' });
      },
      complete: () => {
        this.setData({ scanning: false });
      },
    });
  },
  async doSignin() {
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const res = await api.signin({ nickname: name, dept: this.data.dept });
      if (res.code === 0) {
        this.setData({
          signed: true,
          signedName: res.data.name,
          signedTotal: res.data.total,
        });
        wx.showToast({ title: '签到成功！', icon: 'success' });
      } else {
        wx.showToast({ title: res.msg || '签到失败', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '签到失败', icon: 'none' });
    }
    this.setData({ submitting: false });
  },
  resign() {
    this.setData({ signed: false, name: '', dept: '', scanned: false });
  },
});
