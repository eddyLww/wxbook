// pages/profile/profile.js
const { callFunction } = require('../../utils/cloud');
const { get, KEYS } = require('../../utils/storage');

Page({
  data: {
    userInfo: {},
    interests: [],
    favBloggers: [],
    readCount: 0,
    totalPages: 0,
    readHistory: []
  },

  onLoad() {
    this.initUser();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadHistory();
  },

  initUser() {
    const userInfo = get(KEYS.USER_INFO) || {};
    const prefs = get(KEYS.PREFERENCES) || {};
    this.setData({
      userInfo,
      interests: prefs.interests || []
    });
    this.loadFavBloggers(prefs.favBloggers || []);
  },

  async loadFavBloggers(ids) {
    if (!ids.length) return;
    try {
      const res = await callFunction('fn-books', { action: 'getBloggers' });
      if (res && res.bloggers) {
        const favBloggers = res.bloggers.filter(b => ids.includes(b._id));
        this.setData({ favBloggers });
      }
    } catch (e) {
      // 静默失败
    }
  },

  async loadHistory() {
    try {
      const res = await callFunction('fn-login', { action: 'getHistory' });
      if (res && res.history) {
        const history = res.history.map(item => ({
          ...item,
          percent: item.totalPages
            ? Math.round(((item.currentPage + 2) / item.totalPages) * 100)
            : 0
        }));
        this.setData({
          readHistory: history,
          readCount: history.length,
          totalPages: history.reduce((s, i) => s + (i.totalPages || 0), 0)
        });
      }
    } catch (e) {
      // 静默失败
    }
  },

  continueReading(e) {
    const item = e.currentTarget.dataset.item;
    const dataStr = encodeURIComponent(JSON.stringify(item));
    wx.navigateTo({ url: `/pages/reader/reader?data=${dataStr}` });
  },

  goEditPreferences() {
    wx.redirectTo({ url: '/pages/login/login?step=1' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
