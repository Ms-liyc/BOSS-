(() => {
  if (globalThis.__ZPING_YUPAO__) return;
  globalThis.__ZPING_YUPAO__ = true;

  const EDU_RE = /博士|硕士|本科|大专|高中|中专|中技|初中|学历不限/;
  const SALARY_RE = /\d+(?:\.\d+)?\s*千\s*[-~～]\s*\d+(?:\.\d+)?\s*万|\d+(?:\.\d+)?\s*[-~～]\s*\d+(?:\.\d+)?\s*(?:万元\/月|元\/月|元\/天|元\/时|[kK千])|面议/;
  const CITY_RE = /北京|上海|广州|深圳|杭州|成都|南京|武汉|西安|重庆|天津|苏州|郑州|长沙|青岛|厦门|合肥|东莞|佛山|浦东/;
  const NOISE = /查看更多|添加求职|立即沟通|免费聊|聊一聊|职位详情|岗位职责|任职要求|活跃|灵活用工|已招满|新发布/;
  const TAG_RE = /月结|日结|周结|全职|兼职|包住|包吃|五险|五险一金|经验不限|学历不限|^\d+[-~～]\d+年$|^\d+年以上$|^应届|^在校|^\d+人$|^\d+-\d+人$/;
  const COMPANY_HINT = /(?:有限责任公司|股份有限公司|有限公司|集团公司|集团|公司|企业|工作室|经营部|服务中心|餐饮店|酒店|宾馆|物流|人力|传媒|科技|网络|贸易|实业|工程|装饰|物业|汽车|医药|教育|咨询|管理|服务|餐饮|食品|娱乐|建设|制造|制品|配送|家政|保安|经纪|美容|美发|足浴|沐足|酒吧|超市|门店|旗舰店|合作社|养殖场|农场|商行|店铺)/;
  let scanHint = "";

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isDetailPath() {
    return /\/zhaogong\/\d+\.html/i.test(location.pathname);
  }

  function linesOf(card) {
    return (card.innerText || "").split("\n").map((line) => line.trim()).filter((line) => line && !NOISE.test(line));
  }

  function salaryCount(text) {
    return text.match(/\d+(?:\.\d+)?\s*千\s*[-~～]\s*\d|\d+(?:\.\d+)?\s*[-~～]\s*\d+(?:\.\d+)?\s*(?:万元\/月|元\/月|元\/天)/g)?.length || 0;
  }

  function findCards() {
    const found = [];
    document.querySelectorAll("li, article, a, div").forEach((el) => {
      if (el.closest("header, nav, footer, #zping-host")) return;
      const text = (el.innerText || "").trim();
      if (text.length < 16 || text.length > 380) return;
      if (/职位详情|岗位职责|任职要求|职位描述/.test(text)) return;
      if (salaryCount(text) !== 1) return;
      const lineCount = linesOf(el).length;
      if (lineCount < 3 || lineCount > 12) return;
      found.push(el);
    });
    return found.filter((el) => !found.some((other) => other !== el && el.contains(other)));
  }

  function cleanLine(line) {
    return String(line || "").replace(/\s+/g, " ").trim();
  }

  function isMetaLine(line) {
    const text = cleanLine(line);
    if (!text || text.length > 40) return true;
    if (SALARY_RE.test(text)) return true;
    if (TAG_RE.test(text)) return true;
    if (/经验|应届|在校|年以下|年以上|\d+\s*[-~～]\s*\d+年/.test(text)) return true;
    if (EDU_RE.test(text) && text.length < 18) return true;
    if (NOISE.test(text)) return true;
    return false;
  }

  function companyFromDom(card) {
    const qiye = card.querySelector("a[href*='/qiye/'], a[href*='qiye/']");
    if (qiye) {
      const text = cleanLine((qiye.innerText || qiye.getAttribute("title") || "").split("\n")[0]);
      if (text && text.length <= 40 && !isMetaLine(text)) return text;
    }
    const hit = card.querySelector(
      "[class*='company' i], [class*='enterprise' i], [class*='corp' i], [class*='firm' i], [class*='employer' i]",
    );
    if (hit) {
      const text = cleanLine(hit.innerText || hit.getAttribute("title") || "");
      if (text && text.length <= 40 && !isMetaLine(text)) return text;
    }
    return "";
  }

  function companyFromLines(lines, used) {
    const cityIdx = lines.findIndex((line) => (line.includes("·") && line.length <= 24) || (CITY_RE.test(line) && line.length <= 12));
    if (cityIdx >= 0) {
      for (let i = cityIdx + 1; i < lines.length; i += 1) {
        const text = cleanLine(lines[i]);
        if (!text || used.has(text) || isMetaLine(text)) continue;
        if (text.length >= 2 && text.length <= 30) return text;
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
      return text.length >= 2 && text.length <= 24 && !/免费聊|立即沟通/.test(text);
    });
    return tail ? cleanLine(tail) : "";
  }

  function parseCard(card) {
    const lines = linesOf(card);
    const salary = lines.find((line) => SALARY_RE.test(line) && line.length < 24) || "面议";
    const educationRaw = lines.find((line) => EDU_RE.test(line) && line.length < 16) || "";
    const education = /学历不限|^不限$/.test(educationRaw) ? "不限" : (educationRaw.match(/博士|硕士|本科|大专|高中|中专|中技|初中/)?.[0] || "不限");
    const city = lines.find((line) => line.includes("·") && line.length <= 24)
      || lines.find((line) => CITY_RE.test(line) && line.length <= 12)
      || "";
    const used = new Set([salary, city, educationRaw].filter(Boolean));
    const company = companyFromDom(card) || companyFromLines(lines, used);
    if (company) used.add(company);
    const title = lines.find((line) => {
      const text = cleanLine(line);
      if (!text || used.has(text)) return false;
      if (text.length < 2 || text.length > 40) return false;
      if (isMetaLine(text)) return false;
      return true;
    }) || "";
    const link = card.querySelector("a[href*='/zhaogong/']");
    const href = link?.href || "";
    const url = /\/zhaogong\/\d+\.html/i.test(href) ? href.split("?")[0] : "";
    if (!title || NOISE.test(title)) return null;
    return {
      title,
      company,
      city,
      salary,
      education,
      url,
      key: `${title}|${company}|${salary}|${city}`,
      card,
    };
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
    scanHint = jobs.length
      ? ""
      : "没有从左侧职位卡片读到薪资。请确认当前是鱼泡职位列表，并刷新后再开始。";
    return jobs;
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

  async function applyHere(job) {
    if (job?.card) {
      job.card.scrollIntoView({ block: "center", behavior: "smooth" });
      const titleNode = [...job.card.querySelectorAll("div, span, p, h3")].find((el) => compactText(el) === String(job.title || "").replace(/\s+/g, ""));
      (titleNode || job.card).click();
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
    const next = [...document.querySelectorAll("a, button")].find((el) => {
      const text = (el.innerText || "").trim();
      return text === "下一页" && !el.classList.contains("disabled");
    });
    if (!next) return false;
    next.click();
    return true;
  }

  function cityPageHint(filters) {
    return globalThis.ZpingCities?.yupaoCityHint?.(filters?.city) || "";
  }

  Zping.boot({
    id: "yupao",
    label: "鱼泡网",
    cityPageHint,
    isListPage: () => !location.pathname.includes("/chat") && !isDetailPath() && /\/zhaogong\/|\/s\//i.test(location.pathname),
    isDetailPage: isDetailPath,
    collectJobs,
    scanHint: () => scanHint,
    findApplyButton,
    applyHere,
    clickNextPage,
  });
})();
