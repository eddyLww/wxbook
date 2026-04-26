// cloudfunctions/payService/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

// 商户配置信息 (根据实际情况填写)
const MCH_ID = 'YOUR_MCH_ID';
const SUB_MCH_ID = 'YOUR_SUB_MCH_ID'; // 如果是服务商模式

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, data } = event;

  try {
    if (action === 'createOrder') {
      const { type, bookId } = data; // type: SINGLE_BOOK, VIP_MONTH, VIP_YEAR
      let amount = 0;
      let body = 'AI书籍精读-支付';
      
      if (type === 'SINGLE_BOOK') {
         amount = 300; // 3元
         body = '解锁单本AI精读';
      } else if (type === 'VIP_MONTH') {
         amount = 1200; // 12元
         body = '月度会员';
      } else if (type === 'VIP_YEAR') {
         amount = 9800; // 98元
         body = '年度会员';
      }

      const outTradeNo = 'ORDER_' + Date.now() + '_' + Math.floor(Math.random()*1000);

      // Save order to DB
      await db.collection('order').add({
        data: {
          _id: outTradeNo,
          openId: openid,
          orderType: type,
          targetId: bookId || null,
          amount,
          status: 'PENDING',
          createTime: db.serverDate()
        }
      });

      // Call wx.cloudPay.unifiedOrder
      // Note: This requires real MCH_ID config. We return a mock success for development.
      if (MCH_ID === 'YOUR_MCH_ID') {
         // MOCK SUCCESS
         return {
           success: true,
           mock: true,
           payment: {
             outTradeNo,
             msg: '由于未配置商户号，当前为模拟支付。调用后端 payCallback 进行完成。'
           }
         };
      }

      const res = await cloud.cloudPay.unifiedOrder({
        body,
        outTradeNo,
        spbillCreateIp: '127.0.0.1',
        subMchId: MCH_ID,
        totalFee: amount,
        envId: cloud.DYNAMIC_CURRENT_ENV,
        functionName: 'payService' // callback function
      });

      return { success: true, payment: res.payment };

    } else if (event.action === 'payCallback' || event.Type === 'payCallback' || event.returnCode === 'SUCCESS') {
      // Handle WeChat pay callback
      // For mock, we allow manual trigger of payCallback
      const outTradeNo = event.outTradeNo || data.outTradeNo;
      const orderRes = await db.collection('order').doc(outTradeNo).get();
      const order = orderRes.data;

      if (order.status === 'SUCCESS') return { errcode: 0, errmsg: 'OK' };

      // Update order status
      await db.collection('order').doc(outTradeNo).update({
        data: {
          status: 'SUCCESS',
          payTime: db.serverDate()
        }
      });

      // Grant rewards
      if (order.orderType === 'SINGLE_BOOK') {
         // add to user unlocked books or it's just record
      } else if (order.orderType === 'VIP_MONTH' || order.orderType === 'VIP_YEAR') {
         const days = order.orderType === 'VIP_MONTH' ? 31 : 365;
         const userRes = await db.collection('user').doc(order.openId).get();
         let expireTime = userRes.data.vipExpireTime ? new Date(userRes.data.vipExpireTime) : new Date();
         if (expireTime < new Date()) expireTime = new Date();
         expireTime.setDate(expireTime.getDate() + days);

         await db.collection('user').doc(order.openId).update({
           data: {
             isVip: true,
             vipExpireTime: expireTime
           }
         });
      }

      return { errcode: 0, errmsg: 'OK' };
    }

    return { success: false, msg: 'Unknown action' };
  } catch (err) {
    console.error(err);
    return { success: false, error: err };
  }
};
