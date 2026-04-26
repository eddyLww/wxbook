// miniprogram/pages/read/read.js
const app = getApp();

Page({
  data: {
    book: null,
    currentIndex: 0,
    theme: 'light',
    fontSize: 34,
    statusBarHeight: 20,
    loading: true
  },

  async onLoad(options) {
    const windowInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight
    });

    let book = wx.getStorageSync('currentBook');
    const bookId = options.id || (book ? book._id : '');

    // 如果 storage 里没有，或者没有全文内容，则尝试重新拉取
    if (!book || !book.aiFullContent || book._id !== options.id) {
      if (!bookId) {
        wx.showToast({ title: '参数缺失', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }
      
      try {
        const res = await wx.cloud.callFunction({
          name: 'bookService',
          data: { action: 'getBookDetail', data: { bookId } }
        });
        if (res.result.success) {
          book = res.result.data;
        }
      } catch (err) {
        console.error('Failed to fetch book in read page:', err);
      }
    }

    if (book && book.aiFullContent) {
      if (!Array.isArray(book.aiFullContent)) {
         book.aiFullContent = [String(book.aiFullContent)];
      }
      this.setData({ book, loading: false });
    } else {
      this.setData({ loading: false });
      wx.showToast({ title: '内容获取失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  goBack() {
    wx.navigateBack();
  },

  toggleTheme() {
    this.setData({
      theme: this.data.theme === 'light' ? 'dark' : 'light'
    });
  },

  onSwiperChange(e) {
    this.setData({ currentIndex: e.detail.current });
  }
});
