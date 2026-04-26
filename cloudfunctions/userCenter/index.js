// cloudfunctions/userCenter/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, data } = event;

  const getTodayStr = () => {
    const d = new Date();
    // UTC+8
    d.setHours(d.getHours() + 8);
    return d.toISOString().split('T')[0];
  };

  try {
    if (action === 'login') {
      let userRes;
      try {
        userRes = await db.collection('user').where({ _id: openid }).get();
      } catch (err) {
        // Handle -502005: database collection not exists
        if (err.errCode === -502005 || (err.message && err.message.includes('not exists'))) {
          await db.createCollection('user');
          userRes = { data: [] };
        } else {
          throw err;
        }
      }
      let user = null;
      const today = getTodayStr();

      if (userRes.data.length === 0) {
        // new user
        user = {
          _id: openid,
          freeCount: 9999,
          isVip: false,
          vipExpireTime: null,
          collections: [],
          lastResetDate: today,
          createTime: db.serverDate()
        };
        await db.collection('user').add({ data: user });
      } else {
        user = userRes.data[0];
        // 激进重置逻辑：如果日期变了，或者次数被用完了（且用户希望是 9999 次），则重置
        if (user.lastResetDate !== today || user.freeCount < 9999) {
          user.freeCount = 9999;
          user.lastResetDate = today;
          // check VIP expire
          if (user.isVip && user.vipExpireTime && new Date() > new Date(user.vipExpireTime)) {
            user.isVip = false;
          }
          await db.collection('user').doc(openid).update({
            data: {
              freeCount: 9999,
              lastResetDate: today,
              isVip: user.isVip
            }
          });
        }
      }
      return { success: true, data: user };

    } else if (action === 'useFreeCount') {
      const userRes = await db.collection('user').doc(openid).get();
      const user = userRes.data;
      if (user.isVip) return { success: true, msg: 'VIP' };
      if (user.freeCount > 0) {
        await db.collection('user').doc(openid).update({
          data: { freeCount: _.inc(-1) }
        });
        return { success: true, remain: user.freeCount - 1 };
      } else {
        return { success: false, msg: '免费次数已用完' };
      }
    } else if (action === 'addFreeCount') {
       // Watch ad to add count
       await db.collection('user').doc(openid).update({
          data: { freeCount: _.inc(1) }
       });
       return { success: true };
    } else if (action === 'toggleCollect') {
       const { bookId } = data;
       const userRes = await db.collection('user').doc(openid).get();
       let collections = userRes.data.collections || [];
       if (collections.includes(bookId)) {
         collections = collections.filter(id => id !== bookId);
       } else {
         collections.push(bookId);
       }
       await db.collection('user').doc(openid).update({
          data: { collections }
       });
       return { success: true, collections };
    }

    return { success: false, msg: 'Unknown action' };
  } catch (err) {
    console.error(err);
    return { success: false, error: err };
  }
};
