# smzase_sub_web

smzase_sub 字幕仓库的统一管理网页端，基于 Vue 3 + Naive UI + Cloudflare Workers 构建。

## 功能

- 字幕上传：支持点击、拖拽、粘贴上传 ASS 字幕文件，自动重命名（如 `01.zh-hans.ass` -> `[smzase] Title - S01E01.zh-hans.ass`）
- 字幕列表：按年份/动画浏览，支持编辑、删除、批量操作
- 字体管理：字体上传至 Cloudflare R2 对象存储（绕过 GitHub 25MB 限制），支持关联到动画 README
- 模板管理：保存/加载常用标题模板，模板存储在 Workers KV
- 账号系统：账号密码登录，GitHub Token 加密存储在 Workers KV

## 技术栈

- 前端：Vue 3 + TypeScript + Naive UI + Vue Router
- 后端：Cloudflare Workers
- 存储：Workers KV（账号/Token/模板）、R2（字体文件）
- 部署：Cloudflare Workers + Assets

## 部署

### 1. 创建 Cloudflare 资源

```bash
# 创建 KV 命名空间
wrangler kv namespace create "KV"

# 创建 R2 存储桶
wrangler r2 bucket create smzase-fonts
```

### 2. 配置 wrangler.toml

将 `wrangler.toml` 中的 `YOUR_KV_NAMESPACE_ID` 替换为实际创建的 KV 命名空间 ID。

如需自定义 R2 字体下载域名，修改 `R2_PUBLIC_DOMAIN` 变量。

### 3. 部署

```bash
npm install
npm run deploy
```

### 4. 初始化

首次访问网页会进入创建管理员账号页面，设置用户名和密码后登录。

登录后在右上角设置 GitHub Personal Access Token（需要 `repo` 权限）。

## 仓库目录结构

```
smzase_sub/
├── Anime subtitles/
│   ├── 2026/
│   │   ├── README.md                    # 年份索引（标题/中文名对照表）
│   │   └── Ichijyoma Mankitsu Gurashi/
│   │       ├── README.md                # 动画详情（封面/字幕列表/字体列表）
│   │       ├── [smzase] Title - S01E01.zh-hans.ass
│   │       └── [smzase] Title - S01E01.zh-hant.ass
│   └── 2025/
│       └── ...
└── Fonts/
    └── (小字体文件，大字体存储在 R2)
```

## 开发

```bash
npm install
npm run dev
```

## 项目结构

```
src/
├── App.vue              # 主布局（登录检查、导航、Token 管理）
├── main.ts              # 应用入口
├── router/index.ts      # 路由配置
├── types.ts             # TypeScript 类型定义
├── views/
│   ├── LoginView.vue    # 登录/注册页面
│   ├── UploadView.vue   # 上传页面（字幕+字体）
│   ├── SubtitleView.vue # 字幕列表页面
│   └── FontView.vue     # 字体列表页面
├── utils/
│   ├── api.ts           # Worker API 封装（认证/R2/KV）
│   ├── github.ts        # GitHub API 封装（Git Data API）
│   ├── rename.ts        # 字幕自动重命名
│   └── readme.ts        # README 生成/解析
worker/
└── index.ts             # Cloudflare Worker 入口（API 路由/R2/KV）
```
