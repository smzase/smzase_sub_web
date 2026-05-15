## 想部署很简单，你先fork，然后打开你的cf

1、先创建一个 KV空间（Workers KV），命名空间名称为 `subKV`

2、创建 R2 象存储，名称为 `smzase-fonts` ，位置选 `亚太地区`

3、修改 `wrangler.toml` 内 `kv_namespaces` 的 `id`
```
[[kv_namespaces]]
binding = "subKV"
id = "修改这里的ID"
```
改为你 KV空间（Workers KV）的那一串 ID

4、去 workers 创建，并绑定 `KV命名空间` （变量名称为 `subKV` ） 和 `R2存储桶` （变量名称为 `smzase-fonts` ）<br>
在**设置**里找到 **变量和机密**：类型`密钥`，变量名称 `ENCRYPTION_KEY` ,值你自己想一个
<br><br>
以及，建议开个小黄云+字体缓存 `ttf otf ttc zip 7z rar`，要不然 R2存储 分分钟给你刷爆

5、部署好后，进网页创建账号密码，随后进**设置**里添加你的 `Personal Access Token` <br>（你问我这个在哪弄？[点这里自己创一个](https://github.com/settings/personal-access-tokens)）<br>有限期选 `No expiration` ，指定你的字幕仓库，权限选择这几个：`Codespaces user secrets` 选择 `Read and Write`
<br><br>

注意事项：不要在网页上传超过35MB的字幕，超过 35MB 推荐使用 Git 进行推送，随后点击 `刷新排序` 即可。

<br><br><br>
下面那一堆是 ai 生成的
<br><br><br>

# smzase_sub_web

smzase_sub 字幕仓库的统一管理网页端，基于 Vue 3 + Naive UI + Cloudflare Workers 构建。

## 功能

- 字幕上传：支持点击、拖拽、粘贴上传 ASS 字幕文件，自动重命名（如 `01.zh-hans.ass` -> `[smzase] Title - S01E01.zh-hans.ass`）
- 字幕列表：按年份/动画浏览，支持编辑、删除、批量操作
- README 维护：支持更新年份 README，也支持生成 `Anime subtitles/README.md` 总索引
- 字体管理：字体上传至 Cloudflare R2 对象存储（绕过 GitHub 25MB 限制），支持单个/批量关联到动画 README
- 字体上传关联：上传字体时可选择关联动画；如果同名字体已存在于 R2，会跳过上传但仍继续关联
- 字体名称识别：上传字体时读取字体内部名称，优先使用中文名称；字体名称写入 R2 元数据和 R2 索引文件
- 模板管理：保存/加载常用标题模板，模板存储在 Workers KV
- 账号系统：账号密码登录，密码使用 PBKDF2-SHA256（310K 迭代）哈希，GitHub Token 使用 AES-256-GCM 加密存储在 Workers KV
- 系统设置：GitHub Token 和 R2 下载域名通过网页端配置，存储在 Workers KV

## 技术栈

- 前端：Vue 3 + TypeScript + Naive UI + Vue Router
- 后端：Cloudflare Workers
- 存储：Workers KV（账号/Token/模板/配置）、R2（字体文件、字体元数据索引）
- 部署：Cloudflare Workers + Assets

## 部署

### 1. 创建 Cloudflare 资源

```bash
# 创建 KV 命名空间
wrangler kv namespace create "subKV"

# 创建 R2 存储桶
wrangler r2 bucket create smzase-fonts
```

### 2. 配置 wrangler.toml

将 `wrangler.toml` 中的 KV namespace ID 替换为实际创建的 KV 命名空间 ID，并确认 Assets 绑定、KV 绑定、R2 绑定存在。

```toml
[assets]
directory = "./dist"
binding = "ASSETS"

[[kv_namespaces]]
binding = "subKV"
id = "你的 KV namespace ID"

[[r2_buckets]]
binding = "R2"
bucket_name = "smzase-fonts"
```

### 3. 设置加密密钥

Worker 使用 AES-256-GCM 加密敏感数据（GitHub Token、账号凭证等），需要设置加密密钥环境变量：

```bash
# 生产环境（通过 Cloudflare Secret 存储，不会出现在代码或配置中）
wrangler secret put ENCRYPTION_KEY
```

输入一个强随机字符串作为密钥（建议 32 字符以上），例如 `openssl rand -base64 32` 生成。

本地开发时，在项目根目录创建 `.dev.vars` 文件（已被 `.gitignore` 忽略）：

```text
ENCRYPTION_KEY=你的本地开发密钥
```

> **注意**：本地开发密钥和生产密钥不同，因此本地加密的数据无法在生产环境解密，反之亦然。

### 4. 部署

```bash
npm install
npm run deploy
```

### 5. 初始化

首次访问网页会进入创建管理员账号页面，设置用户名和密码后登录。

登录后进入「设置」页面配置：

- **GitHub Personal Access Token**（需要 `repo` 权限）
- **R2 字体下载域名**（用于生成字体下载链接，如 `https://sub.example.com`）

## README 生成规则

### Anime subtitles/README.md

在「字幕列表」点击「更新总README」生成，总索引按年份分组，每个年份下列出该年份所有动画。

```markdown
# Anime subtitles

## 2025

| 标题 | 中文名 |
| --- | --- |
| [Game Center Shoujo to Ibunka Kouryuu](./2025/Game%20Center%20Shoujo%20to%20Ibunka%20Kouryuu/) | 与游戏中心的少女异文化交流的故事 |

## 2026

| 标题 | 中文名 |
| --- | --- |
| [Ichijyoma Mankitsu Gurashi](./2026/Ichijyoma%20Mankitsu%20Gurashi/) | 一叠间漫画咖啡屋生活 |
```

### 年份 README.md

在「字幕列表」中每个年份右侧点击「更新README」生成，格式如下：

```markdown
# 2026

| 标题 | 中文名 |
| --- | --- |
| [Ichijyoma Mankitsu Gurashi](./Ichijyoma%20Mankitsu%20Gurashi/) | 一叠间漫画咖啡屋生活 |
```

### 动画 README.md

动画文件夹内 README 会包含：

- 封面图
- 中文标题（`## 中文名`）
- 字幕语言（简体优先，繁体其次）
- 字幕列表
- 使用字体

使用字体排序规则：

1. 数字开头：`0~9`
2. 英文开头：`A~Z`
3. 中文或其他字符

字体表格格式：

```markdown
## 使用字体

| 字体名 | 字体下载 |
| --- | --- |
| 梦源黑体 CN W15 | [DreamHanSansCN-W15.ttf](https://example.com/fonts/DreamHanSansCN-W15.ttf) |
```

## 字体存储说明

字体文件存储在 Cloudflare R2：

```text
fonts/字体文件名.ttf
```

字体内部名称不再存储为 KV 的 `fontmeta:*` 键，而是写入 R2：

- 单个字体对象的 `customMetadata.fontNameBase64`
- R2 索引文件 `fonts/_metadata.json`

`fonts/_metadata.json` 用于加速字体列表加载，避免每次列出字体时都读取每个字体对象。

示例：

```json
{
  "fonts/DreamHanSansCN-W15.ttf": {
    "fontName": "梦源黑体 CN W15",
    "originalName": "DreamHanSansCN-W15.ttf"
  }
}
```

## KV 存储说明

Workers KV 用于保存：

- `auth:credentials`：管理员账号信息（AES-256-GCM 加密，密码使用 PBKDF2-SHA256 哈希）
- `auth:gh_token`：GitHub Token（AES-256-GCM 加密）
- `auth:second_password`：二密设置（AES-256-GCM 加密）
- `session:active`：当前登录会话
- `templates:list`：上传模板列表
- `config:r2_domain`：R2 字体下载域名

字体名称元数据不再占用 KV。

## 安全说明

- **加密**：敏感数据（GitHub Token、账号凭证、二密）使用 AES-256-GCM 加密后存储在 Workers KV，加密密钥通过 Cloudflare Secret 环境变量管理，不硬编码在源码中
- **密码哈希**：使用 PBKDF2-SHA256（100,000 次迭代 + 随机 16 字节盐）
- **Token 存储**：GitHub Personal Access Token 仅保存在后端 KV 中，前端不持久化存储（仅内存中临时持有，页面刷新后从后端重新获取）

## 仓库目录结构

```text
smzase_sub/
├── Anime subtitles/
│   ├── README.md                        # 总索引（按年份分组列出动画）
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

R2 字体目录：

```text
smzase-fonts/
└── fonts/
    ├── _metadata.json                   # 字体名称索引
    ├── DreamHanSansCN-W15.ttf
    └── ...
```

## 开发

```bash
npm install
npm run dev
```

本地开发前，在项目根目录创建 `.dev.vars` 文件配置环境变量：

```text
ENCRYPTION_KEY=你的本地开发密钥
```

## 项目结构

```text
src/
├── App.vue              # 主布局（登录检查、导航）
├── main.ts              # 应用入口
├── router/index.ts      # 路由配置
├── types.ts             # TypeScript 类型定义
├── views/
│   ├── LoginView.vue    # 登录/注册页面
│   ├── UploadView.vue   # 上传页面（字幕+字体，可上传字体并关联动画）
│   ├── SubtitleView.vue # 字幕列表页面（更新年份/总 README）
│   ├── FontView.vue     # 字体列表页面（字体管理/关联动画）
│   └── SettingsView.vue # 设置页面（Token/R2 域名）
├── utils/
│   ├── api.ts           # Worker API 封装（认证/R2/KV）
│   ├── github.ts        # GitHub API 封装（Git Data API）
│   ├── rename.ts        # 字幕自动重命名
│   └── readme.ts        # README 生成/解析
worker/
└── index.ts             # Cloudflare Worker 入口（API 路由/R2/KV）
```

## 常用命令

```bash
npm run dev      # 本地开发
npm run build    # 类型检查并构建
npm run deploy   # 构建并部署到 Cloudflare Workers
```
