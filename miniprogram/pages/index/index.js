// miniprogram/pages/index/index.js
const app = getApp();

Page({
  data: {
    banners: [
      { id: 1, image: 'https://dummyimage.com/750x280/8B7355/FFFFFF.png&text=AI+Book+Reading' }
    ],
    recommendBooks: [],
    hotBooks: [],
    loading: true
  },

  onLoad() {
    this.fetchData();
  },

  onPullDownRefresh() {
    this.fetchData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async fetchData() {
    this.setData({ loading: true });
    try {
      // Get Hot Books (general recommend)
      const res = await wx.cloud.callFunction({
        name: 'bookService',
        data: { action: 'getRecommend', data: {} }
      });
      
      if (res.result.success) {
        // Randomly split to recommend and hot for demo
        const list = res.result.data || [];
        this.setData({
          recommendBooks: list.slice(0, 5),
          hotBooks: list.slice(0),
          loading: false
        });
      }
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
    }
  },

  onSearch(e) {
    const keyword = e.detail.value.trim();
    if (!keyword) return;

    // 预生成逻辑：静默调用一次详情接口，触发后台 AI 生成
    // 注意：这里不使用 await，让它在后台跑，直接跳转页面
    wx.cloud.callFunction({
      name: 'bookService',
      data: { action: 'searchBook', data: { keyword } }
    }).then(res => {
      if (res.result.success && res.result.data.length > 0) {
        const book = res.result.data[0];
        // 静默触发 AI 生成任务
        wx.cloud.callFunction({
          name: 'bookService',
          data: { 
            action: 'getBookDetail', 
            data: { bookId: book._id, bookInfo: book } 
          }
        });
      }
    });

    wx.navigateTo({
      url: `/pages/detail/detail?keyword=${encodeURIComponent(keyword)}`
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    // 静默触发 (针对推荐位点击)
    wx.cloud.callFunction({
      name: 'bookService',
      data: { action: 'getBookDetail', data: { bookId: id } }
    });
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});
