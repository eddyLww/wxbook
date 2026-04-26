// pages/home/home.js
const { callFunction } = require('../../utils/cloud');
const { get, KEYS } = require('../../utils/storage');

let searchTimer = null;
const PAGE_SIZE = 18;

Page({
  data: {
    greeting: '',
    userAvatar: '/images/default-avatar.png',
    featuredBook: null,
    recommendBooks: [],
    loading: true,
    refreshing: false,
    loadingMore: false,
    noMore: false,
    searchKeyword: '',
    searching: false,
    searchResults: [],
    offset: 0
  },

  onLoad() {
    this.initGreeting();
    this.initUser();
    this.loadBooks();
  },

  onShow() {
    // 更新 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  initGreeting() {
    const h = new Date().getHours();
    let greeting = '早上好';
    if (h >= 12 && h < 18) greeting = '下午好';
    else if (h >= 18) greeting = '晚上好';
    this.setData({ greeting });
  },

  initUser() {
    const userInfo = get(KEYS.USER_INFO);
    if (userInfo && userInfo.avatarUrl) {
      this.setData({ userAvatar: userInfo.avatarUrl });
    }
    // 检查登录状态
    const app = getApp();
    if (!app.globalData.userInfo && !userInfo) {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  async loadBooks(refresh = false) {
    if (refresh) {
      this.setData({ offset: 0, noMore: false, recommendBooks: [] });
    }
    const prefs = get(KEYS.PREFERENCES) || {};
    const interests = prefs.interests || [];

    try {
      const res = await callFunction('fn-books', {
        action: 'recommend',
        categories: interests,
        limit: PAGE_SIZE,
        offset: this.data.offset
      });

      if (res && res.books) {
        const books = res.books;
        const newList = refresh
          ? books
          : [...this.data.recommendBooks, ...books];

        this.setData({
          recommendBooks: newList.slice(1),
          featuredBook: refresh ? books[0] : this.data.featuredBook || books[0],
          loading: false,
          refreshing: false,
          loadingMore: false,
          noMore: books.length < PAGE_SIZE,
          offset: this.data.offset + books.length
        });
      }
    } catch (e) {
      console.error('加载书籍失败', e);
      this.setData({ loading: false, refreshing: false, loadingMore: false });
      // 使用本地 mock 数据展示
      this.loadMockData();
    }
  },

  loadMockData() {
    const mockBooks = Array.from({ length: 12 }, (_, i) => ({
      _id: `book_mock_${i}`,
      title: ['原则', '思考，快与慢', '刻意练习', '贫穷的本质', '人类简史', '活出生命的意义', '乌合之众', '社会动物', '影响力', '幸福的方法', '心流', '非暴力沟通'][i],
      author: ['达利欧', '丹尼尔·卡尼曼', '安德斯·艾利克森', '阿比吉特·班纳吉', '尤瓦尔·赫拉利', '维克多·弗兰克尔', '古斯塔夫·勒庞', '埃利奥特·阿伦森', '罗伯特·西奥迪尼', '塔尔·本-沙哈尔', '米哈里·契克森', '马歇尔·卢森堡'][i],
      categories: [['商业'], ['心理'], ['教育'], ['商业'], ['历史'], ['心理'], ['心理'], ['心理'], ['商业'], ['心理'], ['心理'], ['教育']][i],
      coverUrl: '',
      hotScore: 90 + i
    }));
    this.setData({
      featuredBook: mockBooks[0],
      recommendBooks: mockBooks.slice(1),
      loading: false,
      noMore: true
    });
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadBooks(true);
  },

  loadMore() {
    if (this.data.loadingMore || this.data.noMore) return;
    this.setData({ loadingMore: true });
    this.loadBooks();
  },

  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({ searchKeyword: keyword });
    if (!keyword) {
      this.setData({ searchResults: [] });
      return;
    }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => this.doSearch(), 300);
  },

  async doSearch() {
    const keyword = this.data.searchKeyword;
    if (!keyword) return;
    this.setData({ searching: true });
    try {
      const res = await callFunction('fn-books', { action: 'search', keyword });
      this.setData({
        searchResults: res ? res.books : [],
        searching: false
      });
    } catch (e) {
      this.setData({ searching: false, searchResults: [] });
    }
  },

  clearSearch() {
    this.setData({ searchKeyword: '', searchResults: [] });
  },

  goBookDetail(e) {
    const book = e.currentTarget.dataset.book;
    const bookStr = encodeURIComponent(JSON.stringify(book));
    wx.navigateTo({ url: `/pages/book-detail/book-detail?book=${bookStr}` });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  }
});
