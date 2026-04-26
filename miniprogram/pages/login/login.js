// pages/login/login.js
const { callFunction } = require('../../utils/cloud');
const { set, KEYS } = require('../../utils/storage');

const CATEGORIES = [
  { id: 'education', name: '教育', emoji: '📚', selected: false },
  { id: 'technology', name: '科技', emoji: '🔬', selected: false },
  { id: 'humanities', name: '人文', emoji: '🏛️', selected: false },
  { id: 'literature', name: '文学', emoji: '✍️', selected: false },
  { id: 'business', name: '商业', emoji: '💼', selected: false },
  { id: 'psychology', name: '心理', emoji: '🧠', selected: false },
  { id: 'history', name: '历史', emoji: '🗺️', selected: false }
];

Page({
  data: {
    step: 0,
    loginLoading: false,
    saving: false,
    categories: JSON.parse(JSON.stringify(CATEGORIES)),
    bloggers: [],
    selectedCategories: [],
    selectedBloggers: []
  },

  onLoad() {
    this.loadBloggers();
  },

  async loadBloggers() {
    try {
      const res = await callFunction('fn-books', { action: 'getBloggers' });
      if (res && res.bloggers) {
        this.setData({ bloggers: res.bloggers.map(b => ({ ...b, selected: false })) });
      }
    } catch (e) {
      // 使用本地备用数据
      this.setData({
        bloggers: [
          { _id: 'blogger_001', name: '樊登', avatar: '/images/blogger-default.png', description: '樊登读书会创始人，擅长从心理学角度解读书籍，语言幽默风趣、贴近生活。', categories: ['教育', '心理', '人文'], selected: false },
          { _id: 'blogger_002', name: '薛兆丰', avatar: '/images/blogger-default.png', description: '北京大学国家发展研究院教授，用经济学思维解读世界，逻辑严密、深入浅出。', categories: ['科技', '商业'], selected: false },
          { _id: 'blogger_003', name: '王煜全', avatar: '/images/blogger-default.png', description: '前哨科技产业研究院院长，专注全球科技前沿，视野宏观、数据详实。', categories: ['科技', '商业'], selected: false },
          { _id: 'blogger_004', name: '罗振宇', avatar: '/images/blogger-default.png', description: '得到App创始人，善用商业案例阐释复杂概念，知识密度高、故事性强。', categories: ['商业', '历史', '人文'], selected: false },
          { _id: 'blogger_005', name: '吴晓波', avatar: '/images/blogger-default.png', description: '财经作家，聚焦中国商业史与企业发展，文笔流畅、见解独到。', categories: ['商业', '历史'], selected: false }
        ]
      });
    }
  },

  async handleLogin() {
    if (this.data.loginLoading) return;
    this.setData({ loginLoading: true });
    try {
      // 获取微信 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      // 调用云函数登录
      const result = await callFunction('fn-login', { code: loginRes.code });

      if (result && result.success) {
        set(KEYS.USER_INFO, result.userInfo);
        const app = getApp();
        app.globalData.userInfo = result.userInfo;

        // 判断是否已设置偏好
        if (result.hasPreferences) {
          wx.switchTab({ url: '/pages/home/home' });
        } else {
          this.setData({ step: 1, loginLoading: false });
        }
      } else {
        throw new Error('登录失败');
      }
    } catch (err) {
      console.error('登录错误', err);
      this.setData({ loginLoading: false });
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    }
  },

  toggleCategory(e) {
    const { id } = e.currentTarget.dataset;
    const categories = this.data.categories.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    );
    const selected = categories.filter(c => c.selected).map(c => c.id);
    this.setData({ categories, selectedCategories: selected });
  },

  toggleBlogger(e) {
    const { id } = e.currentTarget.dataset;
    const bloggers = this.data.bloggers.map(b =>
      b._id === id ? { ...b, selected: !b.selected } : b
    );
    const selected = bloggers.filter(b => b.selected).map(b => b._id);
    this.setData({ bloggers, selectedBloggers: selected });
  },

  nextStep() {
    if (this.data.selectedCategories.length === 0) {
      wx.showToast({ title: '请至少选择一个领域', icon: 'none' });
      return;
    }
    this.setData({ step: 2 });
  },

  prevStep() {
    this.setData({ step: Math.max(0, this.data.step - 1) });
  },

  async finishSetup() {
    if (this.data.selectedBloggers.length === 0) {
      wx.showToast({ title: '请至少选择一位博主', icon: 'none' });
      return;
    }
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      await callFunction('fn-login', {
        action: 'savePreferences',
        interests: this.data.selectedCategories,
        favBloggers: this.data.selectedBloggers
      });

      set(KEYS.PREFERENCES, {
        interests: this.data.selectedCategories,
        favBloggers: this.data.selectedBloggers
      });

      wx.showToast({ title: '设置完成', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/home' });
      }, 800);
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
