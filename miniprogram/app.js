// app.js
App({
  globalData: {
    userInfo: null,
    envId: 'ai-native-d5gmlaatiacab24cc'
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'ai-native-d5gmlaatiacab24cc',
        traceUser: true
      });
    }
  }
});
