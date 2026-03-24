# 🌊 FlowSales: 自主型AI SDR系统

FlowSales是一个为最大化任何产品或服务销售而设计的完全自主型AI SDR（销售开发代表）系统。从潜在客户获取、公司研究、个性化邮件生成到发送预约，实现不间断自动化。

## 🚀 主要功能

- **潜在客户获取**：使用Apollo.io API进行精确的目标筛选。
- **深度调研**：使用Firecrawl抓取网站，利用Claude 3.5 Sonnet自动分析技术栈和潜在痛点。
- **超个性化**：基于调研结果，AI生成完全贴合对方上下文的1对1销售邮件。产品信息可通过环境变量轻松自定义。
- **无缝触达**：将个性化邮件自动投入Instantly.ai的营销活动中。
- **潜在客户跟踪**：通过SQLite + Drizzle ORM实现强大的去重和进度管理。

## 🛠 技术栈

- **运行环境**: [Bun](https://bun.sh/)
- **框架**: [Hono](https://hono.dev/)
- **数据库**: SQLite (通过 LibSQL)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **AI/LLM**: [Anthropic Claude 3.5 Sonnet](https://www.anthropic.com/claude)
- **外部服务**:
  - Apollo.io (潜在客户数据)
  - Firecrawl (网页抓取 / Markdown提取)
  - Instantly.ai (冷邮件自动化)

## 📁 项目结构

```text
src/
├── db/              # 数据库模式与连接
├── services/        # 业务逻辑（API集成、AI工作流）
│   ├── ApolloService.ts   # 潜在客户获取
│   ├── ResearchService.ts # 网站分析（Firecrawl + Claude）
│   ├── PersonalizationService.ts # 邮件生成（Claude）
│   ├── InstantlyService.ts  # 触达自动化
│   ├── LeadService.ts     # 数据管理（增删改查）
│   ├── AgentService.ts    # 主协调器
│   ├── ExclusionService.ts # 基于域名的过滤
│   ├── SlackService.ts     # 错误与状态通知
│   └── SettingsService.ts  # 应用设置管理
├── routes/          # 类似Express的API路由
├── index.ts         # Hono服务器入口点
└── test-flow.ts     # 逻辑验证脚本
```

## 🏁 快速开始

### 1. 环境要求

- 已安装 [Bun](https://bun.sh/)。

### 2. 安装

```bash
bun install
```

### 3. 配置

准备 `.env` 文件，设置以下API密钥。

```bash
cp .env.example .env
# 用编辑器打开.env，设置各密钥
```

#### 必需的环境变量

| 变量名 | 获取地址 | 说明 |
|---|---|---|
| `APOLLO_API_KEY` | [Apollo.io](https://app.apollo.io/) | 用于潜在客户搜索 |
| `FIRECRAWL_API_KEY` | [Firecrawl](https://www.firecrawl.dev/) | 用于网页抓取 |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | 用于Claude（AI分析・邮件生成） |
| `INSTANTLY_API_KEY` | [Instantly.ai](https://app.instantly.ai/) | 用于邮件发送 |
| `INSTANTLY_CAMPAIGN_ID` | Instantly.ai 仪表盘 | 目标营销活动的ID |

#### 可选的环境变量

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `DAILY_SEND_LIMIT` | `50` | 每日最大发送数量 |
| `REQUIRE_APPROVAL` | `true` | 设为 `true` 时，发送前会进入等待批准状态（`WAITING_APPROVAL`）并停止 |
| `DATABASE_URL` | `file:sqlite.db` | SQLite数据库路径 |
| `EXCLUDED_DOMAINS` | - | 要排除的域名（逗号分隔。例如：`gmail.com,example.com`） |
| `SLACK_WEBHOOK_URL` | - | 用于Slack通知的Webhook URL |
| `APP_URL` | `http://localhost:3000` | 通知等使用的应用基础URL |

#### 各API密钥获取步骤

<details>
<summary>🔑 Apollo.io API密钥</summary>

1. 登录 [app.apollo.io](https://app.apollo.io/)（若无账号可免费创建）
2. 点击左下角的 **⚙️ 设置**
3. 从左侧菜单选择 **集成** → **API** 标签页
4. 点击 **API密钥** → **创建新密钥**
5. 输入名称（例如：`FlowSales`）并创建
6. 复制显示的密钥并粘贴到 `.env` 文件中

> 💡 即使免费套餐也可访问API，但存在月度积分限制。
</details>

<details>
<summary>🔥 Firecrawl API密钥</summary>

1. 访问 [firecrawl.dev](https://www.firecrawl.dev/)
2. **注册**（可使用GitHub / Google账号）
3. 登录后的仪表盘上会显示 **API密钥**（以 `fc-` 开头的密钥）
4. 复制并粘贴到 `.env` 文件中

> 💡 免费套餐每月可使用500积分。1次抓取（最多5页）大约消耗5积分。
</details>

<details>
<summary>🤖 Anthropic API密钥</summary>

1. 访问 [console.anthropic.com](https://console.anthropic.com/)
2. **注册**创建账号（※与Claude聊天账号不同）
3. 点击左侧菜单的 **API密钥**
4. **创建密钥** → 输入名称并创建
5. **⚠️ 密钥仅显示一次**，请立即复制并粘贴到 `.env` 文件中
6. 从左侧菜单的 **计费** 购买积分（最低 $5〜）

> 💡 API采用按量付费制。Claude 3.5 Sonnet 大约为输入 $3/100万tokens，输出 $15/100万tokens。
</details>

<details>
<summary>📧 Instantly.ai API密钥 & 营销活动ID</summary>

**API密钥:**
1. 登录 [app.instantly.ai](https://app.instantly.ai/)
2. 点击左侧边栏的 **集成**
3. 在 **API密钥** 部分 → **创建API密钥**
4. 输入名称，选择所需范围并创建
5. 复制并粘贴到 `.env` 文件中

**营销活动ID:**
1. 在Instantly仪表盘中打开目标营销活动
2. URL栏中显示的UUID（例如：`https://app.instantly.ai/campaigns/xxxxxxxx-xxxx-...`）即为营销活动ID
3. 复制并粘贴到 `.env` 的 `INSTANTLY_CAMPAIGN_ID` 中

> ⚠️ 使用API功能可能需要 **Hypergrowth 套餐以上** 的合约。
</details>

### 4. 数据库设置

```bash
bun db:push
```

### 5. 验证（测试运行）

可以测试针对特定域名从调研到邮件生成的整个流程（实际不会发送邮件，会停留在等待批准状态）。

```bash
# 基本测试执行
bun test-flow

# 指定目标进行测试
# bun test-flow <域名> <名> <姓> <职位>
bun test-flow google.com Larry Page CEO
```

### 6. 运行系统

```bash
bun dev
```

- `GET /`: 管理控制面板（旧版）
- `http://localhost:5173`: 主仪表盘（推荐）
- `GET /api/data`: 前端数据API

## 🤖 SDR工作流程详解

1. **Apollo获取**：搜索目标（例如：CTO、创始人），获取公司URL和邮箱地址。
2. **Firecrawl抓取**：将公司URL传递给Firecrawl，以干净的Markdown格式提取内容。
3. **Claude分析**：
   - 识别技术栈（Next.js、Tailwind等）
   - 把握商业模式
   - 推断开发中的“痛点”
4. **邮件撰写**：基于提取的信息，撰写具体说明所推广产品如何发挥作用的邮件。
5. **Instantly推送**：将潜在客户连同 `personalization` 变量一起注册到Instantly。

## ⚠️ 安全与最佳实践

- **去重**：通过数据库级别严格检查，避免重复跟进同一邮箱地址。
- **速率限制**：请注意各API的限制，合理安排Agent的执行间隔。
- **合规性**：遵守特定电子邮件法等法规，建议在Instantly设置中包含退订链接。
