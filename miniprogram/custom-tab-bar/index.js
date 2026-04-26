// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: 'pages/home/home', text: '书房', icon: 'icon-home' },
      { pagePath: 'pages/profile/profile', text: '我的', icon: 'icon-user' }
    ]
  },
  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      wx.switchTab({ url: '/' + path });
    }
  }
});
