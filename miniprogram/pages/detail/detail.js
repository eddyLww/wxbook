// miniprogram/pages/detail/detail.js
const app = getApp();

Page({
  data: {
    bookId: '',
    book: null,
    loading: true,
    isCollected: false,
    freeCount: 0,
    isVip: false,
    userInfoLoaded: false,
    aiLoading: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ bookId: options.id });
      this.fetchBookDetail(options.id);
    } else if (options.keyword) {
      this.searchAndFetch(decodeURIComponent(options.keyword));
    }
  },

  onShow() {
    this.fetchUserInfo();
  },

  async fetchUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userCenter',
        data: { action: 'login' }
      });
      if (res.result.success) {
        const user = res.result.data;
        const isCollected = user.collections && user.collections.includes(this.data.bookId);
        this.setData({
          freeCount: user.freeCount,
          isVip: user.isVip,
          isCollected,
          userInfoLoaded: true
        });
      } else {
        this.setData({ userInfoLoaded: true });
      }
    } catch (err) {
      console.error(err);
      this.setData({ userInfoLoaded: true });
    }
  },

  async searchAndFetch(keyword) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'bookService',
        data: { action: 'searchBook', data: { keyword } }
      });
      if (res.result.success && res.result.data.length > 0) {
        const book = res.result.data[0];
        this.setData({ bookId: book._id });
        this.fetchBookDetail(book._id, book);
      } else {
        const errorMsg = res.result && res.result.error && res.result.error.message ? res.result.error.message : (res.result && res.result.msg ? res.result.msg : '未找到该书籍');
        wx.showToast({ title: errorMsg, icon: 'none', duration: 3000 });
        setTimeout(() => wx.navigateBack(), 3000);
      }
    } catch(err) {
      console.error('searchAndFetch error:', err);
      wx.showToast({ title: '请求异常，请检查网络或部署', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async fetchBookDetail(bookId, bookInfo = null) {
    // 体验优化：如果有传入的基础信息，先展示出来，避免全屏 loading 阻塞
    if (bookInfo) {
      this.setData({ 
        book: { 
          ...bookInfo, 
          aiShortSummary: 'AI 正在深度解析全书精华，请稍候...', 
          briefIntro: bookInfo.briefIntro || '内容正在由 AI 极速生成中...' 
        }, 
        loading: false,
        aiLoading: true 
      });
    } else {
      this.setData({ loading: true });
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'bookService',
        data: { 
          action: 'getBookDetail', 
          data: { bookId, bookInfo: bookInfo || { title: '加载中' } } 
        }
      });
      if (res.result.success) {
        this.setData({ book: res.result.data, loading: false, aiLoading: false });
      } else {
        wx.showToast({ title: res.result.msg || '加载失败', icon: 'none' });
        this.setData({ loading: false, aiLoading: false });
      }
    } catch(err) {
      this.setData({ loading: false, aiLoading: false });
    }
  },

  async toggleCollect() {
    if (!this.data.bookId) return;
    try {
      const res = await wx.cloud.callFunction({
        name: 'userCenter',
        data: { action: 'toggleCollect', data: { bookId: this.data.bookId } }
      });
      if (res.result.success) {
        this.setData({ isCollected: !this.data.isCollected });
        wx.showToast({ title: this.data.isCollected ? '已收藏' : '已取消收藏', icon: 'success' });
      }
    } catch(err) {}
  },

  async onReadFree() {
    if (this.data.loading) {
       wx.showToast({ title: '内容正在加载，请稍后', icon: 'none' });
       return;
    }
    
    if (this.data.aiLoading) {
      wx.showToast({ title: 'AI 正在深度解析全书精华，请稍候...', icon: 'none' });
      return;
    }

    if (!this.data.book) {
      wx.showToast({ title: '书籍信息获取失败', icon: 'none' });
      return;
    }

    // 如果不是 VIP，且没有免费次数
    if (!this.data.isVip && this.data.freeCount <= 0) {
      wx.showModal({
        title: '提示',
        content: '今日免费精读次数已用完，看视频可额外增加次数',
        confirmText: '看视频',
        success: (res) => {
          if (res.confirm) {
            this.onWatchAd();
          }
        }
      });
      return;
    }

    // 执行扣减次数 (如果是 VIP 则免除)
    if (!this.data.isVip) {
      wx.showLoading({ title: '正在开启精读...' });
      try {
        const res = await wx.cloud.callFunction({
          name: 'userCenter',
          data: { action: 'useFreeCount' }
        });
        wx.hideLoading();
        if (!res.result.success) {
          wx.showToast({ title: res.result.msg || '次数扣减失败', icon: 'none' });
          return;
        }
        // 更新本地次数
        this.setData({ freeCount: res.result.remain });
      } catch (err) {
        wx.hideLoading();
        console.error(err);
      }
    }

    // 跳转阅读页
    wx.setStorageSync('currentBook', this.data.book);
    wx.navigateTo({
      url: `/pages/read/read?id=${this.data.book._id}`
    });
  },

  onWatchAd() {
    // 模拟观看广告成功
    wx.showLoading({ title: '广告加载中' });
    setTimeout(async () => {
      wx.hideLoading();
      wx.showModal({
        title: '提示',
        content: '模拟观看完激励视频，为您增加1次免费阅读机会',
        success: async (res) => {
          if (res.confirm) {
            await wx.cloud.callFunction({
              name: 'userCenter',
              data: { action: 'addFreeCount' }
            });
            this.fetchUserInfo();
          }
        }
      });
    }, 1000);
  },

  async onPaySingle() {
    wx.showLoading({ title: '发起支付' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'payService',
        data: { action: 'createOrder', data: { type: 'SINGLE_BOOK', bookId: this.data.bookId } }
      });
      wx.hideLoading();
      if (res.result.success) {
        if (res.result.mock) {
          wx.showModal({
            title: '模拟支付成功',
            content: res.result.payment.msg,
            success: async (m) => {
              if(m.confirm) {
                await wx.cloud.callFunction({
                  name: 'payService',
                  data: { action: 'payCallback', data: { outTradeNo: res.result.payment.outTradeNo } }
                });
                wx.showToast({ title: '解锁成功' });
                this.onReadFree(); // mock VIP or bypass for read
              }
            }
          });
        } else {
          const payment = res.result.payment;
          wx.requestPayment({
            ...payment,
            success: () => {
              wx.showToast({ title: '支付成功' });
              // 跳转阅读页...
            },
            fail: () => {
              wx.showToast({ title: '支付取消', icon: 'none' });
            }
          });
        }
      }
    } catch(err) {
      wx.hideLoading();
    }
  }
});
