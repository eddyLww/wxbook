// utils/cloud.js — 云函数调用封装
const callFunction = (name, data) => {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: res => resolve(res.result),
      fail: err => reject(err)
    });
  });
};

const db = () => wx.cloud.database();

module.exports = { callFunction, db };
