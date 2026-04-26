# 读书小程序 — 任务实施计划

## 实施计划

- [ ] 1. 项目脚手架与 CloudBase 初始化
  - 创建小程序目录结构（`miniprogram/`）
  - 配置 `app.json`（tabBar、pages、云开发 envId）
  - 初始化 CloudBase 数据库集合和安全规则
  - 写入种子数据（books、bloggers）
  - _Requirement: AC-02, AC-03_

- [ ] 2. 微信登录 + 用户偏好引导流（`login` 页）
  - 实现 `fn-login` 云函数（code → openid → upsert users）
  - 登录页 UI：书页背景 + 微信授权按钮
  - 领域选择多选卡片组（7 个领域，至少选 1）
  - 博主选择卡片组（5 位博主，至少选 1，含头像+简介）
  - 偏好保存逻辑，跳转首页
  - _Requirement: US-01, AC-01, AC-02_

- [ ] 3. 首页书单推荐与搜索（`home` 页）
  - 实现 `fn-books` 云函数（recommend + search）
  - 首页布局：杂志式不对称网格，顶部搜索栏
  - `book-card` 组件（封面图、书名、作者、领域标签）
  - 搜索防抖（300ms）+ 结果列表
  - 下拉刷新 + 上拉加载更多
  - _Requirement: US-02, AC-03_

- [ ] 4. 书籍详情 + 博主选择 + 生成入口（`book-detail` 页）
  - 书籍详情展示（封面、简介、基本信息）
  - 博主选择横向滚动卡片（按用户偏好优先排序）
  - "生成书摘"按钮 → 触发 `fn-generate`
  - `loading-generate` 组件（书页翻动 loading + 进度文案）
  - 错误处理与重试逻辑
  - _Requirement: US-03, AC-04, AC-07_

- [ ] 5. 云函数 `fn-generate`（LLM 生成 + 缓存）
  - 缓存检查逻辑（`{bookId}_{bloggerId}` 查询）
  - Prompt 构建（博主风格 + 书名）
  - 调用 @cloudbase/node-sdk AI（混元 hunyuan-lite）
  - 响应解析：按 `[PAGE_BREAK]` 拆页，提取章节标题
  - 写入 `book_summaries`，返回 pages 数组
  - 超时处理（60s）
  - _Requirement: US-03, US-04, AC-04, AC-06_

- [ ] 6. 翻书阅读页（`reader` 页）
  - `page-flip` 核心组件（CSS3 perspective + rotateY）
  - 触摸事件处理（touchstart/move/end → 判断翻页方向）
  - 双页展开布局（纸张纹理背景、书脊阴影）
  - 章节标题浮层、页码显示
  - 阅读进度实时保存（翻页后写 users 集合）
  - 进度恢复（进入时读取上次页码）
  - _Requirement: US-05, US-06, AC-05_

- [ ] 7. 个人中心页（`profile` 页）
  - 用户头像、昵称展示
  - 已读书目列表（含进度）
  - 偏好修改入口（领域 + 博主重新选择）
  - _Requirement: US-01, US-06_

## 任务优先级

| 优先级 | 任务 |
|--------|------|
| P0（核心） | 任务 1、2、5、6 |
| P1（主流程） | 任务 3、4 |
| P2（完善） | 任务 7 |
