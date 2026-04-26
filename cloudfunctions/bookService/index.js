// cloudfunctions/bookService/index.js
const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
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
      let cacheRes = await db.collection('bookCache').where({ _id: bookId }).get();
      if (cacheRes.data.length > 0) {
        // Increment view count
        await db.collection('bookCache').doc(bookId).update({ data: { viewCount: _.inc(1) } });
        return { success: true, data: cacheRes.data[0] };
      }

      // 2. Not in cache, call aiGenerator
      const aiRes = await cloud.callFunction({
        name: 'aiGenerator',
        data: {
          action: 'generateSummary',
          data: { title: bookInfo.title, author: bookInfo.author }
        }
      });

      if (!aiRes.result.success) {
        return { success: false, msg: 'AI生成失败' };
      }

      const generated = aiRes.result.data;

      // 生成一个更精美的渐变封面图 (使用随机色)
      const colors = ['#8B7355', '#5D4037', '#2C3E50', '#1A5276', '#1D8348'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const defaultCover = `https://singlecolorimage.com/get/${randomColor.replace('#', '')}/400x600`;
      
      const newBook = {
        _id: bookId,
        title: bookInfo.title,
        author: bookInfo.author || generated.author || '未知',
        cover: bookInfo.cover && !bookInfo.cover.includes('dummyimage') ? bookInfo.cover : defaultCover,
        category: generated.category || '综合',
        briefIntro: generated.briefIntro,
        aiShortSummary: generated.aiShortSummary,
        aiFullContent: generated.aiFullContent,
        viewCount: 1,
        createTime: db.serverDate()
      };

      // 3. Save to cache
      await db.collection('bookCache').add({ data: newBook });

      return { success: true, data: newBook };

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
