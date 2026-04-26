# 读书小程序 — 技术设计文档

## 1. 架构总览

```
微信小程序前端
    │
    ├── wx.cloud.callFunction()
    │
CloudBase 云函数层
    ├── fn-login          # 微信登录 + 用户初始化
    ├── fn-books          # 书籍查询 / 搜索
    └── fn-generate       # LLM 书摘生成 + 缓存命中检查
    │
CloudBase 数据库（NoSQL）
    ├── users             # 用户信息与偏好
    ├── books             # 书籍元数据
    ├── bloggers          # 知识博主信息与风格 Prompt
    └── book_summaries    # LLM 生成内容缓存（共享）
    │
CloudBase 存储
    └── covers/           # 书籍封面图片
```

---

## 2. 数据模型

### 2.1 `users` 集合
```json
{
  "_id": "<openid>",
  "openid": "string",
  "nickname": "string",
  "avatarUrl": "string",
  "interests": ["科技", "人文"],
  "favBloggers": ["blogger_001", "blogger_002"],
  "readingProgress": {
    "<summaryId>": { "page": 3, "updatedAt": "timestamp" }
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 2.2 `books` 集合
```json
{
  "_id": "book_001",
  "title": "薛兆丰经济学讲义",
  "author": "薛兆丰",
  "coverUrl": "cloud://...",
  "categories": ["科技", "商业"],
  "description": "string",
  "isbn": "string",
  "publishYear": 2019,
  "hotScore": 95
}
```

### 2.3 `bloggers` 集合
```json
{
  "_id": "blogger_001",
  "name": "樊登",
  "avatar": "cloud://...",
  "stylePrompt": "用樊登读书的风格：语言亲切口语化，善用故事举例，结构清晰分三点，结尾给出行动建议，多引用书中金句并加上自己的点评...",
  "categories": ["教育", "人文", "心理"]
}
```

### 2.4 `book_summaries` 集合
```json
{
  "_id": "<bookId>_<bloggerId>",
  "bookId": "book_001",
  "bloggerId": "blogger_001",
  "bookTitle": "string",
  "bloggerName": "string",
  "pages": [
    { "pageNo": 1, "content": "string（400-600字）", "chapterTitle": "第一章" },
    { "pageNo": 2, "content": "string" }
  ],
  "totalPages": 12,
  "wordCount": 7200,
  "generatedAt": "timestamp",
  "generatedBy": "openid（首位生成用户）"
}
```

---

## 3. 云函数设计

### 3.1 `fn-login`
**触发**：用户进入小程序首次调用  
**逻辑**：
1. 接收 `code`，调用微信 `jscode2session` 获取 `openid`
2. 查询 `users` 集合，若不存在则创建文档（_id = openid）
3. 返回用户信息和是否已完成偏好设置的标志

### 3.2 `fn-books`
**触发**：推荐列表请求、搜索请求  
**逻辑**：
- `action=recommend`：根据 `categories[]` 查询 `books`，按 `hotScore` 降序，返回前 20 条
- `action=search`：对 `title`、`author` 做模糊查询（正则）

### 3.3 `fn-generate`
**触发**：用户点击"生成书摘"  
**逻辑**：
```
1. 以 {bookId}_{bloggerId} 为 _id 查询 book_summaries
2. 若已存在 → 直接返回 pages 数组
3. 若不存在：
   a. 查询 books 和 bloggers 获取必要信息
   b. 构建 Prompt（见下方模板）
   c. 调用 @cloudbase/node-sdk AI（混元 hunyuan-lite 或 DeepSeek）
   d. 解析响应，按 [PAGE_BREAK] 分页
   e. 写入 book_summaries 集合
   f. 返回 pages 数组
```

**Prompt 模板**：
```
你是知识博主「{bloggerName}」，请按照以下要求为《{bookTitle}》写一篇书摘：

风格要求：{stylePrompt}

内容要求：
- 总字数控制在7000-8000字（约30分钟阅读量）
- 重新组织章节，提炼核心观点，每个核心点用具体例子支撑
- 分为8-12个小节，每节400-600字
- 每个小节开头用「{chapterTitle}」标记章节名
- 每个小节结尾加上「[PAGE_BREAK]」作为分页符

请开始：
```

---

## 4. 小程序页面结构

```
miniprogram/
├── app.js / app.json / app.wxss
├── pages/
│   ├── login/            # 登录 + 偏好设置（引导流）
│   ├── home/             # 首页：推荐书单 + 搜索
│   ├── book-detail/      # 书籍详情 + 选择博主 + 生成入口
│   ├── reader/           # 翻书阅读页（核心交互）
│   └── profile/          # 个人中心：已读书目、偏好修改
├── components/
│   ├── book-card/        # 书籍卡片组件
│   ├── blogger-card/     # 博主选择卡片
│   ├── page-flip/        # 翻书动画核心组件
│   └── loading-generate/ # 生成中动画
└── utils/
    ├── cloud.js          # 云函数调用封装
    └── storage.js        # 本地缓存工具
```

---

## 5. 翻书动画实现方案

采用 **CSS3 perspective + rotateY** 实现 3D 翻页效果：

```
结构：
<view class="book-container">
  <view class="page current">  <!-- 当前页（左侧） -->
  <view class="page next">     <!-- 下一页（右侧） -->
  <view class="page turning">  <!-- 翻转中页面（CSS动画） -->
</view>
```

**核心 CSS 动画**：
```css
.page-flip-forward {
  animation: flipForward 0.5s cubic-bezier(0.645, 0.045, 0.355, 1.000);
  transform-origin: left center;
  transform-style: preserve-3d;
}

@keyframes flipForward {
  0%   { transform: perspective(1200rpx) rotateY(0deg); }
  100% { transform: perspective(1200rpx) rotateY(-180deg); }
}
```

触摸事件：`bindtouchstart` → `bindtouchmove` → `bindtouchend` 判断滑动方向和距离（>50rpx 触发翻页）。

---

## 6. UI 设计规范

**DESIGN SPECIFICATION**
```
1. Purpose Statement: 一款让职场人在碎片时间高效阅读书籍精华的小程序，
   通过博主风格化讲述拉近与知识的距离，翻书动画营造纸质书仪式感。

2. Aesthetic Direction: 文艺/奢华编辑风（Editorial/Luxury）
   — 致敬经典出版物的版式美学，暗金色点缀传递高端感

3. Color Palette:
   - 主背景：#F5F0E8（米白/书页色）
   - 文字主色：#1A1410（深墨棕）
   - 强调色/金：#C9A84C（暗金）
   - 辅助色：#8B7355（棕褐）
   - 卡片背景：#FEFCF7（象牙白）

4. Typography:
   - 标题：Noto Serif SC（衬线，书卷气）
   - 正文：PingFang SC Regular（清晰易读）
   - 数字/英文装饰：Cormorant Garamond（典雅衬线）

5. Layout Strategy:
   - 首页采用杂志式不对称网格布局
   - 书籍卡片带有轻微倾斜 rotate(-1~1deg) 打破规整感
   - 阅读页模拟纸质书双页展开，带纸张纹理背景
   - 导航采用极简底栏，icon + 文字并排
```

---

## 7. 安全规则

| 集合 | 读权限 | 写权限 |
|------|--------|--------|
| `users` | 仅本人 (`auth.openid == doc._openid`) | 仅本人 |
| `books` | 所有人 | 仅后台/云函数 |
| `bloggers` | 所有人 | 仅后台/云函数 |
| `book_summaries` | 所有人（共享复用） | 仅云函数 |

---

## 8. 技术选型依据

| 决策 | 选择 | 原因 |
|------|------|------|
| LLM | 混元 hunyuan-lite（主）/ DeepSeek-v3（备） | CloudBase 内置，无需额外密钥 |
| 翻页方案 | CSS3 + WXML | 小程序限制 WebGL，CSS3 性能足够 |
| 数据库 | CloudBase NoSQL | 灵活 Schema，适合书摘内容分页存储 |
| 图片 | CloudBase 存储 CDN | 封面图统一管理，CDN 加速 |
