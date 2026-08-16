App({
  globalData: {
    // 本地开发：http://localhost:3456
    // 线上部署：https://你的域名.com
    apiBase: 'https://express-ld5z-266566-8-1440184449.sh.run.tcloudbase.com',
    userToken: '',
  },
  onLaunch() {
    const token = wx.getStorageSync('userToken');
    if (token) {
      this.globalData.userToken = token;
    }
  },
});
