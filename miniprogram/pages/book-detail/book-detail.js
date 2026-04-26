// pages/book-detail/book-detail.js
const { callFunction } = require('../../utils/cloud');
const { get, KEYS } = require('../../utils/storage');

const GEN_STAGES = [
  '理解书籍核心思想...',
  '提炼关键内容框架...',
  '融入博主讲述风格...',
  '重新编排章节结构...',
  '精雕细琢表达细节...',
  '最终润色中...'
];

Page({
  data: {
    book: {},
    bloggers: [],
    selectedBlogger: null,
    descExpanded: false,
    generating: false,
    checking: false,
    genStage: GEN_STAGES[0],
    genProgress: 0
  },

  onLoad(options) {
    if (options.book) {
      const book = JSON.parse(decodeURIComponent(options.book));
      this.setData({ book });
      wx.setNavigationBarTitle({ title: book.title });
    }
    this.loadBloggers();
  },

  async loadBloggers() {
    const prefs = get(KEYS.PREFERENCES) || {};
    const favIds = prefs.favBloggers || [];
    try {
      const res = await callFunction('fn-books', { action: 'getBloggers' });
      if (res && res.bloggers) {
        // 优先排列用户喜欢的博主
        const sorted = [...res.bloggers].sort((a, b) => {
          const aFav = favIds.includes(a._id) ? -1 : 1;
          const bFav = favIds.includes(b._id) ? -1 : 1;
          return aFav - bFav;
        });
        this.setData({ bloggers: sorted });
      }
    } catch (e) {
      // 本地备用博主数据
      this.setData({
        bloggers: [
          { _id: 'blogger_001', name: '樊登', avatar: '/images/blogger-default.png', styleTag: '故事口语风', stylePreview: '用生活中的故事举例，语言亲切幽默，给你三个核心要点，让知识真正内化为行动。' },
          { _id: 'blogger_002', name: '薛兆丰', avatar: '/images/blogger-default.png', styleTag: '经济学思维', stylePreview: '用经济学视角拆解书中逻辑，数据支撑论点，严密推理，让你看清事物背后的规律。' },
          { _id: 'blogger_003', name: '王煜全', avatar: '/images/blogger-default.png', styleTag: '前沿科技视野', stylePreview: '结合全球科技趋势解读，数据翔实，宏观视野，带你理解未来世界的运行逻辑。' },
          { _id: 'blogger_004', name: '罗振宇', avatar: '/images/blogger-default.png', styleTag: '知识密度型', stylePreview: '高密度知识输出，善用商业案例，把复杂概念讲透彻，让你在碎片时间获取最大价值。' },
          { _id: 'blogger_005', name: '吴晓波', avatar: '/images/blogger-default.png', styleTag: '财经叙事风', stylePreview: '以财经作家的笔触娓娓道来，历史与现实交织，让书中的知识融入商业文明的脉络。' }
        ]
      });
    }
  },

  selectBlogger(e) {
    const blogger = e.currentTarget.dataset.blogger;
    this.setData({ selectedBlogger: blogger });
  },

  toggleDesc() {
    this.setData({ descExpanded: !this.data.descExpanded });
  },

  goBack() {
    wx.navigateBack();
  },

  preventBubble() {},

  async generateSummary() {
    const { selectedBlogger, book, generating } = this.data;
    if (!selectedBlogger || generating) return;

    this.setData({ checking: true });

    try {
      // 启动进度动画
      this.startProgressAnimation();

      const result = await callFunction('fn-generate', {
        bookId: book._id,
        bloggerId: selectedBlogger._id,
        bookTitle: book.title,
        bloggerName: selectedBlogger.name
      });

      this.stopProgressAnimation();

      if (result && result.pages) {
        // 跳转阅读页
        const dataStr = encodeURIComponent(JSON.stringify({
          summaryId: result.summaryId || `${book._id}_${selectedBlogger._id}`,
          bookTitle: book.title,
          bloggerName: selectedBlogger.name,
          pages: result.pages,
          totalPages: result.pages.length
        }));
        this.setData({ generating: false, checking: false });
        wx.navigateTo({ url: `/pages/reader/reader?data=${dataStr}` });
      }
    } catch (e) {
      console.error('生成失败', e);
      this.stopProgressAnimation();
      this.setData({ generating: false, checking: false });
      wx.showModal({
        title: '生成失败',
        content: '网络繁忙或超时，请稍后重试',
        confirmText: '重试',
        success: res => { if (res.confirm) this.generateSummary(); }
      });
    }
  },

  startProgressAnimation() {
    this.setData({ generating: true, checking: false, genProgress: 0 });
    let stage = 0;
    let progress = 0;
    this.progressTimer = setInterval(() => {
      progress = Math.min(progress + Math.random() * 8 + 2, 90);
      stage = Math.min(Math.floor(progress / 16), GEN_STAGES.length - 1);
      this.setData({ genProgress: progress, genStage: GEN_STAGES[stage] });
    }, 1500);
  },

  stopProgressAnimation() {
    clearInterval(this.progressTimer);
    this.setData({ genProgress: 100, genStage: '书摘生成完成！' });
    setTimeout(() => {
      this.setData({ generating: false, genProgress: 0 });
    }, 600);
  },

  onUnload() {
    clearInterval(this.progressTimer);
  }
});
