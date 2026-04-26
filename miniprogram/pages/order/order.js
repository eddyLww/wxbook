// miniprogram/pages/order/order.js
const app = getApp();

Page({
  data: {
    orders: [],
    loading: true
  },

  onLoad() {
    this.fetchOrders();
  },

  async fetchOrders() {
    try {
      const db = wx.cloud.database();
      const wxContext = await wx.cloud.callFunction({ name: 'userCenter', data: { action: 'login' } });
      const openid = wxContext.result.data._id;
      
      const res = await db.collection('order')
        .where({ openId: openid })
        .orderBy('createTime', 'desc')
        .get();
        
      const orders = res.data.map(item => {
        const d = new Date(item.createTime);
        item.createTimeStr = d.toLocaleString();
        return item;
      });
      
      this.setData({ orders, loading: false });
    } catch (err) {
      this.setData({ loading: false });
    }
  }
});
