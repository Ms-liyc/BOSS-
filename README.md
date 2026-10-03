<h1 align="center">BOSS-</h1>

<p align="center"><strong>BOSS直聘 + 鱼泡网 简历投递助手</strong></p>

<p align="center">在 Microsoft Edge 中按条件筛选职位，每次投递前人工确认公司、岗位、地点、薪资与学历，避免误投。</p>

<p align="center">✨ <strong>当前版本 1.3.0</strong></p>

<p align="center">Edge 扩展 · Boss直聘 + 鱼泡网 · 投递前确认 · Excel 导出</p>

<p align="center">🌟 <strong>项目亮点</strong></p>

<p align="center">
🎯 <strong>双平台支持</strong> — Boss直聘、鱼泡网同一套筛选与确认流程<br>
🔍 <strong>多条件筛选</strong> — 岗位、城市、薪资、学历、公司白名单 / 黑名单<br>
✅ <strong>投递前确认</strong> — 页面右下角展示 5 项关键信息，确认后才点击投递<br>
🤖 <strong>半自动流程</strong> — 自动翻页、自动点「立即沟通 / 免费聊」，每一步由你决定<br>
📊 <strong>Excel 导出</strong> — 导出 .xlsx 投递记录，投递状态与公司重复标记带颜色<br>
🗺️ <strong>城市直达</strong> — 鱼泡网按所选城市打开对应列表（如成都 a322）<br>
🔐 <strong>沿用登录态</strong> — 使用你已登录的 Edge 账号，无需额外配置<br>
🧠 <strong>投递去重记忆</strong> — 记住已投 / 已跳过 / 已沟通过的职位与公司，下次自动跳过<br>
📄 <strong>完整 JD 抓取</strong> — 导出 JD详情 列为详情页职位描述全文<br>
💾 <strong>筛选方案保存</strong> — 多套条件一键切换（如「成都 Python」「北京 Java」）<br>
⏱️ <strong>投递间隔</strong> — 每次投递后等待 N 秒，降低风控风险<br>
💾 <strong>数据备份</strong> — 一键导出 / 恢复去重记录与 Excel 累计，重装扩展也不丢数据
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Edge-Extension-0078D7?style=flat-square" alt="Edge Extension" />
  <img src="https://img.shields.io/badge/version-1.3.0-brightgreen?style=flat-square" alt="version" />
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

> 同样适用于 **Chrome** 浏览器（`chrome://extensions` 加载 `extension` 目录）。

### 开发者构建（可选）

```bash
cd extension
npm install
```

`lib/xlsx.bundle.js` 已预置在仓库中，一般无需重新构建。若需自行打包 Excel 库，可在 `extension` 目录执行：

```bash
npx esbuild node_modules/xlsx-js-style/dist/xlsx.min.js --bundle --format=iife --global-name=XLSX --outfile=lib/xlsx.bundle.js
```

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

### 快捷键

确认面板支持键盘操作（输入框聚焦时无效）：

| 键 | 操作 |
|----|------|
| Y | 确认投递 |
| N | 跳过 |
| S | 停止 |

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
| 排除岗位 | 岗位名包含任意一个关键词则跳过（如 销售、实习） |
| 必须包含标签 | 职位标签需包含任意一个关键词（如 远程、双休）；留空不限 |
| 跳过面议 | 开启后，薪资为「面议」的职位会被过滤 |
| 学历 | 职位要求不高于所选学历；职位写「不限」则保留 |
| 薪资 | 识别 `15-25K`、`8000-16000元/月`、`1.5-2万元/月`、`100-200元/天`；未开启「跳过面议」时，面议不过滤 |
| 城市 | 职位地点需包含所选城市 |

---

## 💾 数据备份

弹窗底部提供 **备份数据** / **恢复数据**：

| 操作 | 说明 |
|------|------|
| 备份数据 | 导出 JSON，包含去重记录、筛选方案、两平台 Excel 累计 |
| 恢复数据 | 选择备份文件；**确定** = 合并导入，**取消** = 完全替换 |

重装扩展、换电脑或清理浏览器数据前，建议先备份。

---

## 📊 导出 Excel

按平台分别累积，固定文件名：

| 平台 | 文件名 |
|------|--------|
| Boss直聘 | `BOSS直聘列表.xlsx` |
| 鱼泡网 | `鱼泡网列表.xlsx` |

每条记录处理后会**自动追加**到对应平台的累计表；点击确认面板的 **「停止」** 或本轮自然结束时，会**自动下载/覆盖**同名 Excel 文件（浏览器若提示覆盖，选「替换」即可）。弹窗内也可随时手动导出。

| 列 | 内容 |
|----|------|
| 1 | 筛选条件（城市、岗位、学历、薪资等合并为一列） |
| 2 | 公司名称（**第一次**=绿色，**重复**=红色） |
| 3 | 工作岗位 |
| 4 | 工作地点 |
| 5 | 学历要求 |
| 6 | 工资 |
| 7 | 职位标签（如 远程 / 双休 / 五险一金） |
| 8 | 是否投递（**是**=绿色，**否**=红色） |
| 9 | 处理时间 |
| 10 | 职位链接 |
| 11 | JD详情（详情页全文；未抓到则留空） |

同一职位链接再次出现时，会用最新记录覆盖旧行，避免重复堆积。

---

## 🆕 v1.3.0 体验增强

| 改进 | 说明 |
|------|------|
| 扩展图标 | 工具栏与扩展管理页显示品牌图标 |
| 排除岗位 / 标签筛选 | 更精细地过滤不想要的职位 |
| 跳过面议 | 可选过滤薪资未标明的职位 |
| 数据备份恢复 | JSON 导出 / 导入，支持合并或替换 |
| 登录检测 | 开始前识别登录页，避免无效运行 |
| 风控提示 | 验证码或频繁操作时给出明确提示 |

完整历史见 [CHANGELOG.md](CHANGELOG.md)。

## 🆕 v1.2.2 安全与稳定性

| 改进 | 说明 |
|------|------|
| API 数据可信 | Boss 职位优先由扩展直接请求接口，postMessage 需 nonce 校验 |
| 站点校验 | 仅在 Boss/鱼泡官网注入脚本，平台与 URL 必须一致 |
| 防重复启动 | 已有任务进行中时拒绝再次开始 |
| 存储串行化 | 去重记录与 Excel 累计写入加队列，避免并发丢失 |
| 防重复计数 | 鱼泡聊天页不再重复记「已投递」 |
| Excel 防注入 | 单元格内容过滤公式前缀；累计表有容量上限 |

## 🆕 v1.2 改进

| 改进 | 说明 |
|------|------|
| 弹窗状态栏 | 显示进行中 / 已投 / 跳过 / Excel 累计条数 |
| 去重策略优化 | **默认仅按职位链接去重**；可选开启「跳过整家公司」 |
| 一键清理 | 弹窗内可清除去重记录、清空当前平台 Excel 累计 |
| 键盘快捷键 | 确认面板：Y 确认 · N 跳过 · S 停止 |
| 标签展示 | 确认面板显示职位标签（远程 / 双休等） |
| 稳定性 | Boss 动态注入补 API 拦截；关闭 iframe 重复注入 |
| Excel 着色 | 「已沟通过」改为橙色；导出按时间排序后标记公司重复 |
| 鱼泡翻页 | 支持分页器、URL 参数与滚动加载兜底 |

## 🆕 v1.1 功能

| 功能 | 说明 |
|------|------|
| 投递去重记忆 | 本地记录已投 / 已跳过 / 已沟通过的职位，下次自动过滤 |
| 完整 JD 抓取 | 异步拉取详情页描述，写入 JD详情 列 |
| 筛选方案 | 多套条件一键切换 |
| Boss 自动翻页 | 连续扫描多页 |
| 投递间隔 | 每次成功投递后等待 N 秒 |

---

## 📁 项目结构

```
BOSS-/
├── README.md
├── CHANGELOG.md
├── LICENSE
└── extension/              # Edge / Chrome 扩展（加载此目录）
    ├── manifest.json
    ├── icons/              # 扩展图标 16 / 48 / 128
    ├── popup.html / .js / .css
    ├── content/
    │   ├── common.js       # 筛选、确认面板、投递流程、导出
    │   ├── boss.js         # Boss直聘适配
    │   ├── yupao.js        # 鱼泡网适配
    │   └── inject.js       # Boss API 数据拦截
    └── lib/
        ├── cities.js       # 城市编码（含鱼泡 URL）
        ├── history.js      # 投递去重记忆
        ├── backup.js       # 数据备份 / 恢复
        ├── storage-queue.js
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

**重装扩展后记录没了？**  
使用弹窗里的「备份数据」提前导出 JSON，装好后用「恢复数据」导入。

**提示验证码或操作过快？**  
暂停一段时间，在网页手动完成验证后再继续；可适当增大投递间隔。

---

## 📜 开源协议

本项目采用 [MIT License](LICENSE)。

**你可以：**

- 自由使用、复制、修改本项目（二次开发）
- 将修改后的版本分发或用于商业售卖

**你必须：**

- 在分发、售卖或提供服务的任何副本中，**保留本项目的版权声明与 MIT 协议全文**
- **注明原作者信息**，至少包含：
  - 原作者：小李（[Ms-liyc](https://github.com/Ms-liyc)）
  - 原项目地址：https://github.com/Ms-liyc/BOSS-

不得以原作者名义背书你的衍生版本；软件按「原样」提供，不提供任何担保。

---

<p align="center">
  <a href="https://github.com/Ms-liyc/BOSS-">GitHub 仓库</a>
</p>

<p align="center"><a href="LICENSE">MIT License</a></p>
