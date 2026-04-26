// pages/reader/reader.js
const { callFunction } = require('../../utils/cloud');
const { get, KEYS } = require('../../utils/storage');

const EMPTY_PAGE = { pageNo: 0, content: '', chapterTitle: '' };

Page({
  data: {
    bookTitle: '',
    bloggerName: '',
    summaryId: '',
    pages: [],
    totalPages: 0,
    currentPage: 0,       // 当前展开的左页索引（偶数）
    leftPage: EMPTY_PAGE,
    rightPage: EMPTY_PAGE,
    isTurning: false,
    turningClass: '',
    turningFrontPage: EMPTY_PAGE,
    turningBackPage: EMPTY_PAGE,
    progressPercent: 0,
    headerVisible: true,
    showTapHint: false,
    settingsVisible: false,
    bgColor: '#F5F0E8',
    fontSize: 30,
    bgOptions: [
      { color: '#F5F0E8' },
      { color: '#FEFCF7' },
      { color: '#E8F0E0' },
      { color: '#1A1410' }
    ]
  },

  touchStartX: 0,
  touchStartY: 0,
  isSwiping: false,

  onLoad(options) {
    if (options.data) {
      const data = JSON.parse(decodeURIComponent(options.data));
      const { summaryId, bookTitle, bloggerName, pages, totalPages } = data;

      // 恢复阅读进度
      const userInfo = get(KEYS.USER_INFO);
      let savedPage = 0;
      if (userInfo && userInfo.readingProgress && userInfo.readingProgress[summaryId]) {
        savedPage = Math.floor(userInfo.readingProgress[summaryId].page / 2) * 2;
      }

      this.setData({
        summaryId,
        bookTitle,
        bloggerName,
        pages,
        totalPages,
        currentPage: savedPage
      });

      this.renderPages(savedPage);
    }

    // 短暂显示点击提示
    setTimeout(() => {
      this.setData({ showTapHint: true });
      setTimeout(() => this.setData({ showTapHint: false }), 2000);
    }, 800);
  },

  renderPages(pageIndex) {
    const { pages } = this.data;
    const leftPage = pages[pageIndex] || EMPTY_PAGE;
    const rightPage = pages[pageIndex + 1] || EMPTY_PAGE;
    const progressPercent = pages.length > 1
      ? Math.round(((pageIndex + 2) / pages.length) * 100)
      : 100;

    this.setData({ leftPage, rightPage, progressPercent });
  },

  onTouchStart(e) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.isSwiping = false;
  },

  onTouchMove(e) {
    const dx = e.touches[0].clientX - this.touchStartX;
    const dy = e.touches[0].clientY - this.touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      this.isSwiping = true;
    }
  },

  onTouchEnd(e) {
    if (!this.isSwiping) return;
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const threshold = 60;
    if (dx < -threshold) {
      this.flipForward();
    } else if (dx > threshold) {
      this.flipBackward();
    }
    this.isSwiping = false;
  },

  onTap(e) {
    const { pages, currentPage, totalPages, isTurning } = this.data;
    if (isTurning) return;

    const screenWidth = wx.getSystemInfoSync().windowWidth;
    const tapX = e.touches ? e.touches[0].clientX : e.detail.x;

    // 左右各 1/4 区域触发翻页，中间区域切换 Header
    if (tapX < screenWidth * 0.25) {
      this.flipBackward();
    } else if (tapX > screenWidth * 0.75) {
      this.flipForward();
    } else {
      this.setData({ headerVisible: !this.data.headerVisible });
    }
  },

  flipForward() {
    const { currentPage, pages, isTurning } = this.data;
    if (isTurning || currentPage + 2 >= pages.length) return;

    const turningFrontPage = pages[currentPage + 1] || EMPTY_PAGE;
    const turningBackPage  = pages[currentPage + 2] || EMPTY_PAGE;

    this.setData({
      isTurning: true,
      turningClass: 'flip-forward',
      turningFrontPage,
      turningBackPage
    });

    setTimeout(() => {
      const newPage = currentPage + 2;
      this.setData({ isTurning: false, turningClass: '', currentPage: newPage });
      this.renderPages(newPage);
      this.saveProgress(newPage);
    }, 520);
  },

  flipBackward() {
    const { currentPage, pages, isTurning } = this.data;
    if (isTurning || currentPage <= 0) return;

    const turningFrontPage = pages[currentPage] || EMPTY_PAGE;
    const turningBackPage  = pages[currentPage - 1] || EMPTY_PAGE;

    this.setData({
      isTurning: true,
      turningClass: 'flip-backward',
      turningFrontPage,
      turningBackPage
    });

    setTimeout(() => {
      const newPage = currentPage - 2;
      this.setData({ isTurning: false, turningClass: '', currentPage: newPage });
      this.renderPages(newPage);
      this.saveProgress(newPage);
    }, 520);
  },

  async saveProgress(pageIndex) {
    const { summaryId } = this.data;
    try {
      await callFunction('fn-login', {
        action: 'saveProgress',
        summaryId,
        page: pageIndex
      });
    } catch (e) {
      // 静默失败，不影响阅读体验
    }
  },

  toggleSettings() {
    this.setData({ settingsVisible: !this.data.settingsVisible });
  },

  changeBg(e) {
    this.setData({ bgColor: e.currentTarget.dataset.color });
  },

  increaseFontSize() {
    const size = Math.min(this.data.fontSize + 2, 44);
    this.setData({ fontSize: size });
  },

  decreaseFontSize() {
    const size = Math.max(this.data.fontSize - 2, 24);
    this.setData({ fontSize: size });
  },

  goBack() {
    wx.navigateBack();
  }
});
