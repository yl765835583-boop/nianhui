const api = require('../../utils/api');

Page({
  data: {
    mode: 'avatar',
    avatarStyle: '古风',
    photoUrl: '',
    uploaded: false,
    avatarStyles: ['财神','古风','Q版','职场潮人','年会礼服'],
    nickname: '',
    role: '',
    department: '',
    loading: false,
    resultImage: '',
    resultText: '',
    showResult: false
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, showResult: false });
  },
  selectStyle(e) { this.setData({ avatarStyle: e.currentTarget.dataset.value }); },
  choosePhoto() {
    const that = this;
    wx.chooseImage({
      count: 1, sizeType: ['compressed'],
      success(res) {
        that.setData({ photoUrl: res.tempFilePaths[0], uploaded: true });
        wx.showToast({ title: '照片已选择' });
      }
    });
  },
  onNickInput(e) { this.setData({ nickname: e.detail.value }); },
  onRoleInput(e) { this.setData({ role: e.detail.value }); },
  onDeptInput(e) { this.setData({ department: e.detail.value }); },

  async doGenerateAvatar() {
    this.setData({ loading: true, showResult: false });
    try {
      const res = await api.generateAvatar({ style: this.data.avatarStyle });
      this.setData({ resultImage: res.data.url, resultText: '', showResult: true });
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
    this.setData({ loading: false });
  },

  async doGeneratePersona() {
    const { nickname, role, department } = this.data;
    if (!nickname.trim()) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    this.setData({ loading: true, showResult: false });
    try {
      const res = await api.generatePersona({ nickname, role, department });
      this.setData({
        resultText: res.data.text,
        resultImage: res.data.imageUrl,
        showResult: true
      });
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
    this.setData({ loading: false });
  },

  saveImage() {
    if (!this.data.resultImage) {
      wx.showToast({ title: '请先生成头像', icon: 'none' });
      return;
    }
    wx.downloadFile({
      url: this.data.resultImage,
      success(res) {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
          fail: () => wx.showToast({ title: '请授权相册权限', icon: 'none' })
        });
      },
      fail: () => wx.showToast({ title: '下载失败', icon: 'none' })
    });
  },

  shareCard() {
    wx.showShareMenu({ withShareTicket: true });
  }
});
