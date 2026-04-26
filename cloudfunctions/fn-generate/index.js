// cloudfunctions/fn-generate/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const WORDS_PER_PAGE = 500;   // 每页字数
const MAX_WORDS = 8000;       // 最大书摘字数

exports.main = async (event, context) => {
  const { bookId, bloggerId, bookTitle, bloggerName } = event;
  const summaryId = `${bookId}_${bloggerId}`;

  // ===== Step 1：检查缓存 =====
  try {
    const cached = await db.collection('book_summaries').doc(summaryId).get();
    if (cached && cached.data) {
      return {
        summaryId,
        pages: cached.data.pages,
        fromCache: true
      };
    }
  } catch (e) {
    // 不存在，继续生成
  }

  // ===== Step 2：获取博主风格 Prompt =====
  let stylePrompt = getDefaultStylePrompt(bloggerName);
  try {
    const bloggerDoc = await db.collection('bloggers').doc(bloggerId).get();
    if (bloggerDoc.data && bloggerDoc.data.stylePrompt) {
      stylePrompt = bloggerDoc.data.stylePrompt;
    }
  } catch (e) {}

  // ===== Step 3：调用 LLM =====
  const prompt = buildPrompt(bookTitle, bloggerName, stylePrompt);

  let rawContent = '';
  try {
    const aiRes = await cloud.ai.generateText({
      model: 'hunyuan-lite',
      messages: [
        {
          role: 'system',
          content: `你是知识博主「${bloggerName}」，擅长用独特的讲述风格帮助读者快速理解书籍精华。`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 4096
    });
    rawContent = aiRes?.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.error('LLM 调用失败', e);
    // 降级：使用占位内容
    rawContent = generateFallbackContent(bookTitle, bloggerName);
  }

  // ===== Step 4：解析分页 =====
  const pages = parsePages(rawContent, bookTitle);

  // ===== Step 5：存入数据库 =====
  const wxContext = cloud.getWXContext();
  try {
    await db.collection('book_summaries').add({
      data: {
        _id: summaryId,
        bookId,
        bloggerId,
        bookTitle,
        bloggerName,
        pages,
        totalPages: pages.length,
        wordCount: rawContent.replace(/\[PAGE_BREAK\]/g, '').length,
        generatedAt: db.serverDate(),
        generatedBy: wxContext.OPENID
      }
    });
  } catch (e) {
    // 并发时可能重复写入，忽略
    console.error('写入 book_summaries 失败', e);
  }

  return { summaryId, pages, fromCache: false };
};

// 构建 Prompt
function buildPrompt(bookTitle, bloggerName, stylePrompt) {
  return `请为《${bookTitle}》创作一篇书摘，要求如下：

【讲述风格】
${stylePrompt}

【内容要求】
1. 总字数控制在6000-8000字（约30分钟阅读量）
2. 重新组织书中内容，提炼8-12个核心主题/章节
3. 每个章节400-600字，包含：核心观点、具体例子、读者启示
4. 每个章节开头格式：「章节名称」（用书名号括起来）
5. 每个章节结尾加上 [PAGE_BREAK] 标记
6. 开篇写200字左右的导读，结尾写100字左右的总结

请直接开始创作，不需要任何额外说明：`;
}

// 解析页面
function parsePages(content, bookTitle) {
  if (!content) return [{ pageNo: 1, chapterTitle: bookTitle, content: '内容生成中，请稍后重试。' }];

  const parts = content.split('[PAGE_BREAK]').filter(p => p.trim());
  const pages = [];

  parts.forEach((part, idx) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    // 提取章节标题（「...」格式）
    const titleMatch = trimmed.match(/^[「『](.+?)[」』]/);
    const chapterTitle = titleMatch ? titleMatch[1] : (idx === 0 ? '导读' : `第${idx}节`);

    // 去掉标题行，保留正文
    const contentText = trimmed.replace(/^[「『].+?[」』]\s*/, '').trim();

    // 若单页超长则切分子页
    if (contentText.length > WORDS_PER_PAGE * 1.5) {
      const subParts = splitLongPage(contentText);
      subParts.forEach((sub, subIdx) => {
        pages.push({
          pageNo: pages.length + 1,
          chapterTitle: subIdx === 0 ? chapterTitle : `${chapterTitle}（续）`,
          content: sub
        });
      });
    } else {
      pages.push({ pageNo: pages.length + 1, chapterTitle, content: contentText });
    }
  });

  return pages.length > 0 ? pages : [{ pageNo: 1, chapterTitle: bookTitle, content: content.slice(0, 500) }];
}

// 切分超长页
function splitLongPage(text) {
  const result = [];
  let start = 0;
  while (start < text.length) {
    let end = start + WORDS_PER_PAGE;
    if (end < text.length) {
      // 在句号/换行处截断
      const breakPoint = Math.max(
        text.lastIndexOf('。', end),
        text.lastIndexOf('\n', end)
      );
      if (breakPoint > start) end = breakPoint + 1;
    }
    result.push(text.slice(start, end).trim());
    start = end;
  }
  return result.filter(Boolean);
}

// 默认博主风格（当数据库没有配置时使用）
function getDefaultStylePrompt(name) {
  const styles = {
    '樊登': '语言亲切口语化，善用生活中的故事和类比，结构清晰分三点展开，结尾给出实际可操作的行动建议，时常引用书中金句并加上自己的感悟和点评。',
    '薛兆丰': '用经济学思维框架分析，逻辑严密，善用数据和案例支撑观点，帮读者建立系统性的思维模型，语言精准、直接、理性。',
    '王煜全': '结合全球科技和商业趋势，视野宏观，数据详实，站在科技创业者的角度解读，让读者看清未来10年的机遇与挑战。',
    '罗振宇': '知识密度极高，善用历史典故和商业案例，语言犀利有趣，让你在短时间内获得别人读10年书的浓缩精华，金句频出。',
    '吴晓波': '以财经作家的笔触娓娓道来，历史感强，在商业文明的大背景下解读书中观点，语言优美流畅，兼具深度与可读性。'
  };
  return styles[name] || '语言清晰易懂，重点突出，帮助读者快速掌握书中核心知识点和实用方法论。';
}

// 降级内容（LLM 失败时）
function generateFallbackContent(bookTitle, bloggerName) {
  return `「导读」\n这是一本值得深度阅读的好书。让我以${bloggerName}的视角，带你领略《${bookTitle}》的核心精华。\n[PAGE_BREAK]\n「核心思想」\n本书的核心观点为我们提供了全新的思维框架，帮助我们重新理解这个领域的底层逻辑。\n[PAGE_BREAK]\n「总结」\n通过这本书，我们学到了许多有价值的知识和方法。希望你能将这些洞见运用到实际生活中。\n[PAGE_BREAK]`;
}
