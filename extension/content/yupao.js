(() => {
  if (globalThis.__ZPING_YUPAO__) return;
  globalThis.__ZPING_YUPAO__ = true;

  const EDU_RE = /博士|硕士|本科|大专|高中|中专|中技|初中|学历不限/;
  const SALARY_RE = /\d+(?:\.\d+)?\s*千\s*[-~～]\s*\d+(?:\.\d+)?\s*万|\d+(?:\.\d+)?\s*[-~～]\s*\d+(?:\.\d+)?\s*(?:万元\/月|万\/月|万元|元\/月|元\/天|元\/时|[kK千])|面议|\d+(?:\.\d+)?\s*万\s*[-~～]\s*\d+(?:\.\d+)?\s*万/;
  const CITY_RE = /北京|上海|广州|深圳|杭州|成都|南京|武汉|西安|重庆|天津|苏州|郑州|长沙|青岛|厦门|合肥|东莞|佛山|宁波|无锡|浦东|武侯|锦江|高新|天府|青羊|成华|龙泉驿|双流|郫都|新都|温江|金牛|青白江|简阳|金堂|大邑|蒲江|新津|都江堰|彭州|邛崃|崇州|天府新区/;
  const NOISE = /查看更多|添加求职|立即沟通|免费聊|聊一聊|职位详情|岗位职责|任职要求|活跃|灵活用工|已招满|新发布|该职位于|IP：|人查看|分钟前|小时前|天前|刚刚|置顶/;
  const TAG_RE = /^(月结|日结|周结|全职|兼职|包住|包吃|五险|五险一金|经验不限|学历不限|远程|双休|带薪年假|年终奖|弹性工作|\d+[-~～]\d+年|\d+年以上|应届|在校|\d+人|\d+-\d+人)$/;
  const TAG_HINT_RE = /远程|双休|五险一金|五险|包吃|包住|月结|日结|周结|带薪|年假|交通补助|餐补|弹性|加班费|社保|一金|六险/;
  const COMPANY_HINT = /(?:有限责任公司|股份有限公司|有限公司|集团公司|集团|公司|企业|工作室|经营部|服务中心|餐饮店|酒店|宾馆|物流|人力|传媒|科技|网络|贸易|实业|工程|装饰|物业|汽车|医药|教育|咨询|管理|服务|餐饮|食品|娱乐|建设|制造|制品|配送|家政|保安|经纪|美容|美发|足浴|沐足|酒吧|超市|门店|旗舰店|合作社|养殖场|农场|商行|店铺|医院|学校|工厂|俱乐部|会所|药房|药店|超市|便利店)/;
  let scanHint = "";

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isDetailPath() {
    return /\/zhaogong\/\d+\.html/i.test(location.pathname);
  }

  function cleanLine(line) {
    return String(line || "").replace(/\s+/g, " ").trim();
  }

  function linesOf(card) {
    return (card.innerText || "").split("\n").map((line) => cleanLine(line)).filter((line) => line && !NOISE.test(line));
  }

  function salaryCount(text) {
    return text.match(/\d+(?:\.\d+)?\s*千\s*[-~～]\s*\d|\d+(?:\.\d+)?\s*[-~～]\s*\d+(?:\.\d+)?\s*(?:万元\/月|万\/月|万|元\/月|元\/天)|\d+(?:\.\d+)?\s*万\s*[-~～]\s*\d/g)?.length || 0;
  }

  function dedupeCards(items) {
    return items.filter((el) => !items.some((other) => other !== el && other.contains(el)));
  }

  function findCards() {
    const byLink = [];
    document.querySelectorAll("a[href*='/zhaogong/']").forEach((link) => {
      if (link.closest("#zping-host, header, nav, footer")) return;
      const href = link.href || "";
      if (!/\/zhaogong\/\d+\.html/i.test(href)) return;
      let card = link.closest("li, article, [class*='item' i], [class*='card' i], [class*='job' i], [class*='list' i] > div, [class*='recruit' i]");
      if (!card || card === link) card = link.parentElement;
      if (!card || card.closest("#zping-host")) return;
      if ((card.innerText || "").length < 10) card = link.parentElement?.parentElement || card;
      byLink.push(card);
    });
    if (byLink.length) return dedupeCards(byLink);

    const found = [];
    document.querySelectorAll("li, article, div").forEach((el) => {
      if (el.closest("header, nav, footer, #zping-host")) return;
      const text = (el.innerText || "").trim();
      if (text.length < 16 || text.length > 420) return;
      if (/职位详情|岗位职责|任职要求|职位描述/.test(text)) return;
      if (salaryCount(text) !== 1) return;
      const lineCount = linesOf(el).length;
      if (lineCount < 3 || lineCount > 14) return;
      found.push(el);
    });
    return dedupeCards(found);
  }

  function parseSalary(lines) {
    const hit = lines.find((line) => SALARY_RE.test(line) && line.length < 28);
    return hit || "面议";
  }

  function parseCity(lines) {
    const dotted = lines.find((line) => /[·•]/.test(line) && line.length <= 28 && (CITY_RE.test(line) || /区|县|市/.test(line)));
    if (dotted) return dotted;
    const cityOnly = lines.find((line) => CITY_RE.test(line) && line.length <= 16);
    if (cityOnly) return cityOnly;
    const region = lines.find((line) => /^(?:四川|广东|北京|上海|浙江|江苏|湖北|湖南|陕西|重庆|天津|福建|山东|河南|安徽|河北|辽宁|吉林|黑龙江|云南|贵州|广西|海南|山西|内蒙古|宁夏|青海|甘肃|西藏|新疆|香港|澳门|台湾)?[\u4e00-\u9fa5]{2,8}(?:市|州|盟|地区)/.test(line) && line.length <= 20);
    return region || "";
  }

  function parseEducation(lines) {
    const combined = lines.join(" ");
    if (/学历不限|不限学历/.test(combined)) return "不限";
    const hit = combined.match(/博士|硕士|本科|大专|高中|中专|中技|初中/);
    return hit?.[0] || "不限";
  }

  function isMetaLine(line) {
    const text = cleanLine(line);
    if (!text || text.length > 42) return true;
    if (SALARY_RE.test(text)) return true;
    if (TAG_RE.test(text)) return true;
    if (/经验|应届|在校|年以下|年以上|\d+\s*[-~～]\s*\d+年/.test(text)) return true;
    if (EDU_RE.test(text) && text.length < 20) return true;
    if (NOISE.test(text)) return true;
    if (/^[\u4e00-\u9fa5]{1,2}先生$|^[\u4e00-\u9fa5]{1,2}女士$/.test(text)) return true;
    if (/^IP：/.test(text)) return true;
    return false;
  }

  function companyFromDom(card) {
    const qiye = card.querySelector("a[href*='/qiye/'], a[href*='qiye/']");
    if (qiye) {
      const text = cleanLine((qiye.innerText || qiye.getAttribute("title") || "").split("\n")[0]);
      if (text && text.length <= 40 && !isMetaLine(text)) return text;
    }
    const selectors = [
      "[class*='company' i]",
      "[class*='enterprise' i]",
      "[class*='corp' i]",
      "[class*='firm' i]",
      "[class*='employer' i]",
      "[class*='boss' i]",
      "[class*='recruit' i]",
      "[class*='shop' i]",
      "[class*='store' i]",
    ];
    for (const selector of selectors) {
      const hit = card.querySelector(selector);
      const text = cleanLine(hit?.innerText || hit?.getAttribute("title") || "");
      if (text && text.length >= 2 && text.length <= 40 && !isMetaLine(text)) return text;
    }
    return "";
  }

  function companyFromLines(lines, used, city) {
    const dotted = lines.find((line) => {
      const text = cleanLine(line);
      if (!text || used.has(text) || isMetaLine(text)) return false;
      if (!/[·•]/.test(text)) return false;
      const parts = text.split(/[·•]/).map((part) => cleanLine(part)).filter(Boolean);
      const companyPart = parts.find((part) => COMPANY_HINT.test(part) || (part.length >= 3 && part.length <= 24 && !CITY_RE.test(part) && !/区$|县$/.test(part)));
      return companyPart;
    });
    if (dotted) {
      const parts = dotted.split(/[·•]/).map((part) => cleanLine(part)).filter(Boolean);
      const companyPart = parts.find((part) => COMPANY_HINT.test(part) || (part.length >= 3 && part.length <= 24 && part !== city && !CITY_RE.test(part)));
      if (companyPart) return companyPart;
    }

    const cityIdx = lines.findIndex((line) => line === city || (line.includes("·") && line.length <= 28));
    if (cityIdx >= 0) {
      for (let i = cityIdx + 1; i < lines.length; i += 1) {
        const text = cleanLine(lines[i]);
        if (!text || used.has(text) || isMetaLine(text)) continue;
        if (text.length >= 2 && text.length <= 30) return text;
      }
      for (let i = cityIdx - 1; i >= 0; i -= 1) {
        const text = cleanLine(lines[i]);
        if (!text || used.has(text) || isMetaLine(text)) continue;
        if ((COMPANY_HINT.test(text) || text.length >= 3) && text.length <= 30) return text;
      }
    }

    const hinted = lines.find((line) => {
      const text = cleanLine(line);
      if (!text || used.has(text) || isMetaLine(text)) return false;
      return COMPANY_HINT.test(text) && text.length <= 40;
    });
    if (hinted) return cleanLine(hinted);

    const tail = [...lines].reverse().find((line) => {
      const text = cleanLine(line);
      if (!text || used.has(text) || isMetaLine(text)) return false;
      return text.length >= 2 && text.length <= 28 && !/免费聊|立即沟通/.test(text);
    });
    return tail ? cleanLine(tail) : "";
  }

  function parseTags(card, lines, used) {
    const tags = new Set();
    lines.forEach((line) => {
      const text = cleanLine(line);
      if (!text || used.has(text) || isMetaLine(text)) return;
      if (TAG_RE.test(text) || (TAG_HINT_RE.test(text) && text.length <= 12)) tags.add(text);
    });
    card?.querySelectorAll("[class*='tag' i] span, [class*='tag' i], [class*='label' i], [class*='welfare' i]").forEach((el) => {
      const text = cleanLine(el.innerText);
      if (!text || text.length > 16) return;
      if (TAG_RE.test(text) || TAG_HINT_RE.test(text)) tags.add(text);
    });
    return [...tags].join(" / ");
  }

  function parseTitle(card, lines, used) {
    const titleNode = card.querySelector("h1, h2, h3, h4, [class*='title' i], [class*='job-name' i], [class*='position' i], a[href*='/zhaogong/']");
    const fromDom = cleanLine(titleNode?.innerText || titleNode?.getAttribute("title") || "");
    if (fromDom && fromDom.length >= 2 && fromDom.length <= 40 && !isMetaLine(fromDom) && !used.has(fromDom)) {
      return fromDom.split("\n")[0];
    }
    const candidate = lines.find((line) => {
      const text = cleanLine(line);
      if (!text || used.has(text) || isMetaLine(text)) return false;
      if (text.length < 2 || text.length > 40) return false;
      return true;
    });
    return candidate ? cleanLine(candidate) : "";
  }

  function parseCard(card) {
    const lines = linesOf(card);
    const salary = parseSalary(lines);
    const education = parseEducation(lines);
    const city = parseCity(lines);
    const educationRaw = lines.find((line) => EDU_RE.test(line) && line.length < 20) || "";
    const used = new Set([salary, city, educationRaw].filter(Boolean));
    const company = companyFromDom(card) || companyFromLines(lines, used, city);
    if (company) used.add(company);
    const title = parseTitle(card, lines, used);
    if (title) used.add(title);
    const tags = parseTags(card, lines, used);
    const link = card.querySelector("a[href*='/zhaogong/']");
    const href = link?.href || "";
    const url = /\/zhaogong\/\d+\.html/i.test(href) ? href.split("?")[0] : "";
    const jobId = url.match(/\/zhaogong\/(\d+)\.html/i)?.[1] || "";
    if (!title || NOISE.test(title)) return null;
    return {
      title,
      company,
      city,
      salary,
      education,
      tags,
      url,
      key: jobId || url || `${title}|${company}|${salary}|${city}`,
      card,
    };
  }

  function enrichFromDetailPanel(jobs) {
    const panel = document.querySelector("[class*='detail' i], [class*='right' i], [class*='content' i]");
    if (!panel) return jobs;
    const panelText = panel.innerText || "";
    const panelCompany = companyFromDom(panel) || cleanLine(panel.querySelector("[class*='company' i], [class*='boss' i]")?.innerText || "");
    if (!panelCompany) return jobs;
    return jobs.map((job, index) => {
      if (job.company || index !== 0) return job;
      return { ...job, company: panelCompany };
    });
  }

  function collectJobs() {
    const seen = new Set();
    const jobs = [];
    findCards().forEach((card) => {
      const job = parseCard(card);
      if (!job || seen.has(job.key)) return;
      seen.add(job.key);
      jobs.push(job);
    });
    const enriched = enrichFromDetailPanel(jobs);
    scanHint = enriched.length
      ? ""
      : "没有从职位卡片读到信息。请确认当前是鱼泡职位列表（左侧有职位卡片），并刷新后再开始。";
    return enriched;
  }

  function compactText(el) {
    return (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim().replace(/\s+/g, "");
  }

  function isJobLink(el) {
    const href = el.href || el.getAttribute?.("href") || "";
    return /\/zhaogong\/\d+\.html/i.test(href);
  }

  function findFreeChat(root = document) {
    const hits = [...root.querySelectorAll("a, button, span, div")].filter((el) => {
      if (el.closest("#zping-host")) return false;
      if (isJobLink(el)) return false;
      const text = compactText(el);
      if (text !== "免费聊") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 28 && rect.height > 14;
    });
    hits.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);
    return hits[0] || null;
  }

  function findApplyButton(root = document) {
    return findFreeChat(root);
  }

  function threadVisible() {
    const text = document.body?.innerText || "";
    if (/暂无30天内联系人|未选中联系人/.test(text) && !/发起了沟通|你向对方发起/.test(text)) return false;
    if (/发起了沟通|你向对方发起/.test(text)) return true;
    const box = [...document.querySelectorAll("textarea, [contenteditable='true']")].find((el) => {
      if (el.closest("#zping-host")) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 120 && rect.height > 24;
    });
    return Boolean(box && /发简历|换电话|换微信|按Enter发送/.test(text));
  }

  function clickSendIfAny() {
    const send = [...document.querySelectorAll("button, div, span, a")].find((el) => {
      if (el.closest("#zping-host")) return false;
      const text = compactText(el);
      if (!["发送", "确定", "确认发送"].includes(text)) return false;
      return el.getBoundingClientRect().width > 20 && el.getBoundingClientRect().height > 12;
    });
    if (send) send.click();
  }

  function syncJobFromCard(job) {
    if (!job?.card) return job;
    const dom = parseCard(job.card);
    if (!dom) return job;
    job.title = dom.title || job.title;
    job.company = dom.company || job.company;
    job.city = dom.city || job.city;
    job.salary = dom.salary || job.salary;
    job.education = dom.education || job.education;
    job.tags = dom.tags || job.tags;
    if (dom.url) job.url = dom.url;
    if (dom.key) job.key = dom.key;
    return job;
  }

  async function applyHere(job) {
    if (job?.card) {
      syncJobFromCard(job);
      job.card.scrollIntoView({ block: "center", behavior: "smooth" });
      const link = job.card.querySelector("a[href*='/zhaogong/']");
      if (link) link.click();
      else job.card.click();
      await sleep(800);
    }
    let button = null;
    const start = Date.now();
    while (Date.now() - start < 4000) {
      button = findFreeChat();
      if (button) break;
      await sleep(300);
    }
    if (!button) return "missing";
    button.scrollIntoView({ block: "center", behavior: "smooth" });
    button.click();
    await sleep(500);
    clickSendIfAny();
    const started = Date.now();
    while (Date.now() - started < 6000) {
      clickSendIfAny();
      if (threadVisible()) return "opened-chat";
      await sleep(400);
    }
    return "failed";
  }

  function clickNextPage() {
    const next = [...document.querySelectorAll("a, button, span")].find((el) => {
      if (el.closest("#zping-host")) return false;
      const text = (el.innerText || "").trim();
      return (text === "下一页" || text === ">") && !el.classList.contains("disabled");
    });
    if (next) {
      next.click();
      return true;
    }
    const pager = document.querySelector("[class*='pagination' i], [class*='page' i]");
    if (pager) {
      const current = pager.querySelector(".active, .current, [class*='active' i], [class*='current' i]");
      let candidate = current?.nextElementSibling;
      while (candidate) {
        const link = candidate.tagName === "A" ? candidate : candidate.querySelector("a");
        if (link && !link.classList.contains("disabled")) {
          link.click();
          return true;
        }
        candidate = candidate.nextElementSibling;
      }
    }
    const url = new URL(location.href);
    const page = Number(url.searchParams.get("page") || 1);
    if (page > 1 || url.searchParams.has("page")) {
      url.searchParams.set("page", String(page + 1));
      location.assign(url.toString());
      return true;
    }
    const before = document.documentElement.scrollHeight;
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    return document.documentElement.scrollHeight > before;
  }

  function reset() {
    scanHint = "";
  }

  function cityPageHint(filters) {
    return globalThis.ZpingCities?.yupaoCityHint?.(filters?.city) || "";
  }

  async function fetchJobDetail(job) {
    if (job?.detail) return job.detail;
    if (!job?.url) return "";
    try {
      const response = await fetch(job.url, { credentials: "include" });
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      if (!job.tags) {
        const detailTags = new Set();
        doc.querySelectorAll("[class*='tag' i], [class*='welfare' i], [class*='label' i]").forEach((el) => {
          const text = cleanLine(el.innerText);
          if (text && text.length <= 16 && (TAG_RE.test(text) || TAG_HINT_RE.test(text))) detailTags.add(text);
        });
        if (detailTags.size) job.tags = [...detailTags].join(" / ");
      }
      const selectors = [
        "[class*='job-detail' i]",
        "[class*='position-detail' i]",
        "[class*='detail-content' i]",
        ".job-detail",
        ".detail-content",
      ];
      for (const selector of selectors) {
        const node = doc.querySelector(selector);
        const text = (node?.innerText || "").trim();
        if (text.length > 80) return text.slice(0, 12000);
      }
      const body = doc.body?.innerText || "";
      const match = body.match(/职位详情[：:\s]*([\s\S]{80,6000}?)(?=职位总结|招聘人数|薪资报酬|工作地址|核心工作|岗位基本条件|公司地址|$)/);
      if (match?.[1]) return match[1].trim().slice(0, 12000);
      return body.replace(/\s+\n/g, "\n").trim().slice(0, 4000);
    } catch {
      return "";
    }
  }

  Zping.boot({
    id: "yupao",
    label: "鱼泡网",
    cityPageHint,
    isListPage: () => !location.pathname.includes("/chat") && !isDetailPath() && /\/zhaogong\/a\d+/i.test(location.pathname),
    isDetailPage: isDetailPath,
    collectJobs,
    scanHint: () => scanHint,
    findApplyButton,
    applyHere,
    fetchJobDetail,
    clickNextPage,
    reset,
    syncJobFromCard,
  });
})();
