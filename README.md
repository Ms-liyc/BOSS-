<h1 align="center">BOSS-</h1>

<p align="center"><strong>BOSS直聘 + 鱼泡网 简历投递助手</strong></p>

<p align="center">在 Microsoft Edge 中按条件筛选职位，每次投递前人工确认公司、岗位、地点、薪资与学历，避免误投。</p>

<p align="center">✨ <strong>当前版本 1.0.0</strong></p>

<p align="center">Edge 扩展 · Boss直聘 + 鱼泡网 · 投递前确认 · Excel 导出</p>

<p align="center">🌟 <strong>项目亮点</strong></p>

<p align="center">
🎯 <strong>双平台支持</strong> — Boss直聘、鱼泡网同一套筛选与确认流程<br>
🔍 <strong>多条件筛选</strong> — 岗位、城市、薪资、学历、公司白名单 / 黑名单<br>
✅ <strong>投递前确认</strong> — 页面右下角展示 5 项关键信息，确认后才点击投递<br>
🤖 <strong>半自动流程</strong> — 自动翻页、自动点「立即沟通 / 免费聊」，每一步由你决定<br>
📊 <strong>Excel 导出</strong> — 导出 .xlsx 投递记录，投递状态与公司重复标记带颜色<br>
🗺️ <strong>城市直达</strong> — 鱼泡网按所选城市打开对应列表（如成都 a322）<br>
🔐 <strong>沿用登录态</strong> — 使用你已登录的 Edge 账号，无需额外配置
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Edge-Extension-0078D7?style=flat-square" alt="Edge Extension" />
  <img src="https://img.shields.io/badge/version-1.0.0-brightgreen?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/platform-Boss%20%2B%20%E9%B1%BC%E6%B3%A1-orange?style=flat-square" alt="platform" />
  <img src="https://img.shields.io/badge/export-.xlsx-217346?style=flat-square" alt="export" />
  <img src="https://img.shields.io/github/stars/Ms-liyc/BOSS-?style=flat-square" alt="stars" />
  <img src="https://img.shields.io/github/issues/Ms-liyc/BOSS-?style=flat-square" alt="issues" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license" />
</p>

<p align="center">它做的是辅助投递，不是全自动海投。请在已登录的浏览器中合理使用。</p>

> ⚠️ **注意：** 本工具仅在当前 Edge 窗口模拟点击，不收集账号密码。请控制投递频率并遵守各平台服务条款；网站改版可能导致识别失效，导出结果仅供参考。

---

## 📦 安装

```bash
git clone https://github.com/Ms-liyc/BOSS-.git
cd BOSS-
```

1. 打开 Edge，地址栏输入 `edge://extensions`
2. 开启左下角 **开发人员模式**
3. 点击 **加载解压缩的扩展**
4. 选择仓库中的 `extension` 文件夹
5. 若招聘网站页面在安装扩展前已打开，请先 **刷新页面**

---

## 🚀 使用步骤

1. 在 Edge 中登录 [Boss直聘](https://www.zhipin.com/) 或 [鱼泡直聘](https://www.yupao.com/)
2. 点击工具栏中的 **Zping 简历投递助手** 图标
3. 选择平台，填写筛选条件
4. 选择开始方式：
   - **在当前页开始** — 已停留在职位列表时使用
   - **打开搜索页并开始** — 按岗位和城市打开搜索结果，加载后自动开始
5. 在页面右下角确认框操作：
   - **确认投递** → 点击沟通 / 免费聊
   - **跳过** → 查看下一条
   - **停止** → 结束本轮
6. 投递成功后可点 **下一条** 继续，或 **留在这里** 结束

### 平台说明

| 平台 | 列表页要求 | 投递按钮 | 成功标志 |
|------|-----------|---------|---------|
| Boss直聘 | `/web/geek/job` 职位搜索列表 | 立即沟通 | 弹出「已向BOSS发送消息」 |
| 鱼泡网 | `/zhaogong/` 招工列表 | 免费聊 | 聊天框出现 / 「你向对方发起了沟通」 |

鱼泡网选城市后请用 **「打开搜索页并开始」**，会打开对应城市列表（如成都 → `yupao.com/zhaogong/a322/`）。

---

## ✅ 投递前确认项

| 项目 | 说明 |
|------|------|
| 公司名称 | 招聘方名称 |
| 工作岗位 | 职位名称 |
| 工作地点 | 城市 / 区域 |
| 薪资范围 | 如 15-25K、8000-10000元/月 |
| 学历要求 | 职位要求的学历 |

---

## 🔎 筛选规则

| 筛选项 | 规则 |
|--------|------|
| 公司名称 | 多个关键词用逗号分隔，公司名包含任意一个即通过；留空不限 |
| 排除公司 | 公司名包含任意一个关键词则跳过 |
| 学历 | 职位要求不高于所选学历；职位写「不限」则保留 |
| 薪资 | 识别 `15-25K`、`8000-16000元/月`、`1.5-2万元/月`、`100-200元/天`；「面议」不拦截 |
| 城市 | 职位地点需包含所选城市 |

---

## 📊 导出 Excel

每轮结束（跑完上限、手动停止）后，可点击 **导出 Excel**（确认面板或扩展弹窗均可）。

| 列 | 内容 |
|----|------|
| 1–5 | 筛选五项（公司、学历、岗位、地点、薪资） |
| 6 | 公司名称（**第一次**=绿色，**重复**=红色） |
| 7 | 工资 |
| 8 | 是否投递简历（**是**=绿色，**否**=红色） |
| 9 | 招聘详细信息（岗位、地点、学历、时间、链接等） |

---

## 📁 项目结构

```
BOSS-/
├── README.md
└── extension/              # Edge 扩展（加载此目录）
    ├── manifest.json
    ├── popup.html / .js / .css
    ├── content/
    │   ├── common.js       # 筛选、确认面板、投递流程、导出
    │   ├── boss.js         # Boss直聘适配
    │   ├── yupao.js        # 鱼泡网适配
    │   └── inject.js       # Boss API 数据拦截
    └── lib/
        ├── cities.js       # 城市编码（含鱼泡 URL）
        ├── zping-export.js # Excel 导出逻辑
        └── xlsx.bundle.js  # Excel 样式库
```

---

## ❓ 常见问题

**识别不到职位？**  
刷新职位列表页，重新加载扩展后再试。Boss 需停留在搜索列表；鱼泡需停留在招工列表（非详情页、非空白聊天页）。

**鱼泡选了城市仍是全国？**  
使用「打开搜索页并开始」，或先在鱼泡网页顶部切换到目标城市。

**公司名显示「未识别」？**  
鱼泡部分卡片格式特殊，可在确认面板核对后再决定是否投递。

---

<p align="center">
  <a href="https://github.com/Ms-liyc/BOSS-">GitHub 仓库</a>
</p>

<p align="center">MIT License</p>
