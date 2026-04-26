// cloudfunctions/fn-login/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action } = event;

  // ===== 保存阅读进度 =====
  if (action === 'saveProgress') {
    const { summaryId, page } = event;
    await db.collection('users').doc(openid).update({
      data: {
        [`readingProgress.${summaryId}.page`]: page,
        [`readingProgress.${summaryId}.updatedAt`]: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    return { success: true };
  }

  // ===== 保存偏好 =====
  if (action === 'savePreferences') {
    const { interests, favBloggers } = event;
    await db.collection('users').doc(openid).update({
      data: { interests, favBloggers, updatedAt: db.serverDate() }
    });
    return { success: true };
  }

  // ===== 获取阅读历史 =====
  if (action === 'getHistory') {
    const userRes = await db.collection('users').doc(openid).get().catch(() => null);
    if (!userRes || !userRes.data) return { history: [] };

    const progress = userRes.data.readingProgress || {};
    const summaryIds = Object.keys(progress);
    if (!summaryIds.length) return { history: [] };

    // 批量查询书摘
    const summaries = await Promise.all(
      summaryIds.slice(0, 20).map(id =>
        db.collection('book_summaries').doc(id).get().catch(() => null)
      )
    );

    const history = summaries
      .filter(Boolean)
      .map(s => ({
        summaryId: s.data._id,
        bookTitle: s.data.bookTitle,
        bloggerName: s.data.bloggerName,
        currentPage: progress[s.data._id]?.page || 0,
        totalPages: s.data.totalPages,
        pages: s.data.pages
      }));

    return { history };
  }

  // ===== 默认：登录 =====
  const { code } = event;

  try {
    // 查询用户是否已存在
    let userDoc = null;
    try {
      const res = await db.collection('users').doc(openid).get();
      userDoc = res.data;
    } catch (e) {
      // 不存在，新建
    }

    if (!userDoc) {
      await db.collection('users').add({
        data: {
          _id: openid,
          openid,
          nickname: '',
          avatarUrl: '',
          interests: [],
          favBloggers: [],
          readingProgress: {},
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      userDoc = { openid, interests: [], favBloggers: [], readingProgress: {} };
    }

    const hasPreferences = userDoc.interests && userDoc.interests.length > 0;
    return {
      success: true,
      userInfo: {
        openid,
        nickname: userDoc.nickname || '',
        avatarUrl: userDoc.avatarUrl || '',
        readingProgress: userDoc.readingProgress || {}
      },
      hasPreferences
    };
  } catch (err) {
    console.error('fn-login error:', err);
    return { success: false, error: err.message };
  }
};
