// cloudfunctions/aiGenerator/index.js
const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// IMPORTANT: Replace with actual LLM API endpoint and Key
const LLM_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = 'sk-90bf5fdffdc84a639ca0ebf156cbdfbd';

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    if (action === 'generateSummary') {
      const { title, author } = data;
      
      const prompt = `你是一个极具洞察力的千万级粉丝读书博主。请为书籍《${title}》（作者：${author}）生成一份深度且详细的解读报告。
请务必返回合法的JSON格式，包含以下字段：
{
  "category": "书籍分类(如商业、心理、文学等)",
  "briefIntro": "100字左右原书简介",
  "aiShortSummary": "150字极具吸引力的钩子摘要",
  "aiFullContent": [
    "第一部分：破题与背景（核心主题引入）", 
    "第二部分：核心精华提炼（包含书中经典金句）", 
    "第三部分：深度逻辑拆解（分析作者的核心论证）", 
    "第四部分：实践应用建议（结合生活工作的具体应用）", 
    "第五部分：全书总结与延伸启发"
  ]
}
要求：
1. aiFullContent必须是一个长度为5的字符串数组。
2. 内容要生动自然，每段长度在300字左右。
3. 每段开头带有章节标题。
请确保直接返回纯JSON文本，不要带有Markdown标记。`;

      // Mock response for testing if no API_KEY is provided
      if (API_KEY === 'sk-YOUR_API_KEY') {
         return {
           success: true,
           data: {
             category: '文学',
             briefIntro: `《${title}》是一本引人深思的作品...`,
             aiShortSummary: `这本书从独特视角剖析了核心问题，精简版摘要：这是测试数据...`,
             aiFullContent: [
               `《${title}》的第一部分带我们走进了作者设定的背景中...`,
               `第二部分是高潮，核心观点在此展开...`,
               `最后一部分是对未来的展望和思考...`
             ]
           }
         };
      }

      const response = await axios.post(LLM_API_URL, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const content = response.data.choices[0].message.content;
      // 使用正则安全地提取包含大括号的 JSON 片段
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI 返回内容无法识别为合法JSON');
      const result = JSON.parse(jsonMatch[0]);

      return { success: true, data: result };
    }

    return { success: false, msg: 'Unknown action' };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};
