// app.js
App({
  globalData: {
    userInfo: null,
    envId: 'cloud1-d6g0lfx5q68825c68'
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d6g0lfx5q68825c68',
        traceUser: true
      });
    }
  }
});
