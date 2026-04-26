// cloudfunctions/fn-books/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action } = event;

  // ===== 获取博主列表 =====
  if (action === 'getBloggers') {
    const res = await db.collection('bloggers').limit(20).get();
    return { bloggers: res.data };
  }

  // ===== 搜索书籍 =====
  if (action === 'search') {
    const { keyword } = event;
    if (!keyword) return { books: [] };
    const regex = db.RegExp({ regexp: keyword, options: 'i' });
    const res = await db.collection('books')
      .where(_.or([
        { title: regex },
        { author: regex }
      ]))
      .orderBy('hotScore', 'desc')
      .limit(20)
      .get();
    return { books: res.data };
  }

  // ===== 推荐书籍（默认） =====
  const { categories = [], limit = 18, offset = 0 } = event;

  let query = db.collection('books');
  if (categories.length > 0) {
    query = query.where({ categories: _.elemMatch(_.in(categories)) });
  }

  const res = await query
    .orderBy('hotScore', 'desc')
    .skip(offset)
    .limit(limit)
    .get();

  // 若按兴趣无结果，降级为全量推荐
  if (res.data.length === 0 && categories.length > 0) {
    const fallback = await db.collection('books')
      .orderBy('hotScore', 'desc')
      .skip(offset)
      .limit(limit)
      .get();
    return { books: fallback.data };
  }

  return { books: res.data };
};
