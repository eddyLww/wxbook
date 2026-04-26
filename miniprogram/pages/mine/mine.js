// miniprogram/pages/mine/mine.js
const app = getApp();

Page({
  data: {
    userInfo: {},
    openid: '',
    freeCount: 3,
    isVip: false,
    vipExpireTime: ''
  },

  onShow() {
    this.loginAndFetch();
  },

  async loginAndFetch() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userCenter',
        data: { action: 'login' }
      });
      if (res.result.success) {
        const user = res.result.data;
        const expireStr = user.vipExpireTime ? new Date(user.vipExpireTime).toLocaleDateString() : '';
        this.setData({
          openid: user._id,
          freeCount: user.freeCount,
          isVip: user.isVip,
          vipExpireTime: expireStr,
          userInfo: wx.getStorageSync('userInfo') || {}
        });
      }
    } catch (err) {
      console.error(err);
    }
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    const userInfo = { ...this.data.userInfo, avatarUrl };
    this.setData({ userInfo });
    wx.setStorageSync('userInfo', userInfo);
  },

  onInputNickname(e) {
    const nickName = e.detail.value;
    const userInfo = { ...this.data.userInfo, nickName };
    this.setData({ userInfo });
    wx.setStorageSync('userInfo', userInfo);
  },

  async onPayVip(e) {
    const type = e.currentTarget.dataset.type;
    wx.showLoading({ title: '准备支付' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'payService',
        data: { action: 'createOrder', data: { type } }
      });
      wx.hideLoading();
      if (res.result.success) {
        if (res.result.mock) {
          wx.showModal({
            title: '模拟支付成功',
            content: res.result.payment.msg,
            success: async (m) => {
              if (m.confirm) {
                await wx.cloud.callFunction({
                  name: 'payService',
                  data: { action: 'payCallback', data: { outTradeNo: res.result.payment.outTradeNo } }
                });
                wx.showToast({ title: '开通成功' });
                this.loginAndFetch();
              }
            }
          });
        }
      }
    } catch(err) {
      wx.hideLoading();
    }
  },

  goToOrder() {
    wx.navigateTo({
      url: '/pages/order/order'
    });
  },

  contactCustomerService() {
    wx.showToast({ title: '请添加客服微信: AI-BOOK', icon: 'none' });
  }
});
