// utils/storage.js — 本地缓存工具
const KEYS = {
  USER_INFO: 'userInfo',
  PREFERENCES: 'userPreferences'
};

const set = (key, value) => {
  try { wx.setStorageSync(key, value); } catch (e) { console.error('storage set error', e); }
};

const get = (key, defaultValue = null) => {
  try {
    const val = wx.getStorageSync(key);
    return val !== '' ? val : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const remove = (key) => {
  try { wx.removeStorageSync(key); } catch (e) {}
};

module.exports = { KEYS, set, get, remove };
