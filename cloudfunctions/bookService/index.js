// cloudfunctions/bookService/index.js
const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const { action, data } = event;

  try {
    if (action === 'searchBook') {
      const { keyword } = data;
      // First try to search in our own db (fuzzy search)
      let localRes = await db.collection('bookCache').where({
        title: db.RegExp({ regexp: keyword, options: 'i' })
      }).limit(10).get();

      // If we have local data, return it. For real project, you might call external API here.
      // Since public ISBN APIs vary, we return local mock or call external if needed.
      // Placeholder: If none found locally, we mock one to let AI generate it
      if (localRes.data.length === 0) {
         return {
           success: true,
           data: [{
             _id: 'mock_' + new Date().getTime(),
             title: keyword,
             author: 'Unknown',
             cover: 'https://dummyimage.com/300x400/8B7355/FFFFFF.png&text=' + encodeURIComponent(keyword),
             category: '文学',
             briefIntro: '正在尝试通过AI生成该书信息...'
           }]
         };
      }
      return { success: true, data: localRes.data };

    } else if (action === 'getBookDetail') {
      const { bookId, bookInfo } = data;
      
      // 1. Check cache
      let cacheRes;
      try {
        cacheRes = await db.collection('bookCache').where({ _id: bookId }).get();
      } catch (err) {
        if (err.errCode === -502005 || (err.message && err.message.includes('not exists'))) {
          await db.createCollection('bookCache');
          cacheRes = { data: [] };
        } else {
          throw err;
        }
      }

      if (cacheRes.data.length > 0) {
        const cachedBook = cacheRes.data[0];
        // 确保缓存的数据包含 aiFullContent 才直接返回，否则重新生成
        if (cachedBook.aiFullContent && cachedBook.aiFullContent.length > 0) {
          if (cachedBook.aiFullContent[0] === '内容生成中...') {
            // 检查锁是否过期（防止云函数崩溃导致的死锁）
            const lastUpdate = cachedBook.lastUpdate ? new Date(cachedBook.lastUpdate).getTime() : 0;
            const now = new Date().getTime();
            if (lastUpdate > 0 && now - lastUpdate > 150000) { // 150秒过期
              console.log('Lock expired for book:', bookId);
              return { success: true, needsGeneration: true, baseBookData: cachedBook };
            }
            return { success: true, isGenerating: true, baseBookData: cachedBook };
          }
          // Increment view count
          await db.collection('bookCache').doc(bookId).update({
            viewCount: _.inc(1)
          });
          return { success: true, data: cachedBook };
        }
      }

      // 1.5 写入生成状态互斥锁
      const colors = ['#8B7355', '#5D4037', '#2C3E50', '#1A5276', '#1D8348'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const defaultCover = `https://singlecolorimage.com/get/${randomColor.replace('#', '')}/400x600`;

      const baseBookData = {
        title: bookInfo.title,
        author: bookInfo.author || '未知',
        cover: bookInfo.cover && !bookInfo.cover.includes('dummyimage') ? bookInfo.cover : defaultCover,
        category: '综合',
        viewCount: 1,
        createTime: db.serverDate()
      };

      try {
        await db.collection('bookCache').doc(bookId).set({
          ...baseBookData,
          briefIntro: '正在深度分析本书并生成精读摘要，请稍候...',
          aiShortSummary: '分析中...',
          aiFullContent: ['内容生成中...'],
          lastUpdate: db.serverDate()
        });
      } catch (err) {
        console.error('Write lock failed:', err);
      }

      // 交给前端去异步触发 aiGenerator，避免云函数间调用超时和事件循环挂起问题
      return { success: true, needsGeneration: true, baseBookData };

    } else if (action === 'getRecommend') {
       const { category } = data;
       let condition = category ? { category } : {};
       const res = await db.collection('bookCache').where(condition).orderBy('viewCount', 'desc').limit(10).get();
       return { success: true, data: res.data };
    }

    return { success: false, msg: 'Unknown action' };
  } catch (err) {
    console.error(err);
    return { success: false, error: err };
  }
};
