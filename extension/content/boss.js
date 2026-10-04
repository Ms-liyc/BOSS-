(() => {
  if (globalThis.__ZPING_BOSS__) return;
  globalThis.__ZPING_BOSS__ = true;

  const EDU_RE = /博士|硕士|本科|大专|高中|中专|中技|初中/;
  const TAG_META_RE = /^(经验不限|\d+[-~～]?\d*年|\d+年以上|应届|在校|初中|中专|中技|高中|大专|本科|硕士|博士|学历不限|不限|统招|急聘|全职|兼职|实习|校招|社招|\d+人|\d+-\d+人)$/i;
  const BENEFIT_RE = /远程|双休|五险一金|六险一金|五险|一金|年终奖|带薪年假|年假|股票期权|弹性|补充医疗|定期体检|加班补助|全勤|餐补|交通补助|节日福利|团建|包吃|包住|住房补贴|通讯补贴|零食|下午茶|免费班车|高温补贴|绩效|奖金|员工旅游|落户|班车|社保/;
  let scanHint = "";
  let cache = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function clean(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function dedupeNodes(nodes) {
    return nodes.filter((el) => !nodes.some((other) => other !== el && other.contains(el)));
  }

  function cardsFromLinks() {
    const found = [];
    document.querySelectorAll("a[href*='job_detail'], a.job-card-left, a[href*='/job/']").forEach((link) => {
      if (link.closest("#zping-host, header, nav, footer")) return;
      const card = link.closest("li, .job-card-box, .job-card-wrapper, .job-card-wrap, [class*='job-card']") || link.parentElement?.parentElement || link.parentElement;
      if (card && !found.includes(card)) found.push(card);
    });
    return found;
  }

  function cards() {
    const selectors = [
      "li.job-card-box",
      ".job-card-box",
      ".job-card-wrapper",
      ".job-card-wrap",
      ".job-list-box > li",
      ".rec-job-list li",
      "[class*='job-card']",
    ];
    const found = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el.closest("#zping-host")) return;
        if (el.querySelector(".job-name, .job-title, a[href*='job_detail'], a[href*='/job/'], a.job-card-left")) {
          found.push(el);
        }
      });
    });
    const merged = dedupeNodes([...found, ...cardsFromLinks()]);
    if (merged.length) return merged;
    return [...document.querySelectorAll("li")].filter((el) => el.querySelector(".job-name, .job-salary, a[href*='job_detail'], a[href*='/job/'], a.job-card-left"));
  }

  function zpingNonce() {
    return document.documentElement.dataset.zpingNonce || "";
  }

  function extractApiList(data) {
    const zp = data?.zpData;
    const candidates = [zp?.jobList, zp?.list, zp?.cardList, zp?.jobs, data?.jobList, data?.list];
    for (const list of candidates) {
      if (Array.isArray(list) && list.length) return list;
    }
    return [];
  }

  async function fetchApiJobs(params, page) {
    const query = params.get("query") || "";
    const city = params.get("city") || "";
    const urls = [
      `https://www.zhipin.com/wapi/zpgeek/search/joblist.json?scene=1&query=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}&page=${page}&pageSize=30`,
      `https://www.zhipin.com/wapi/zpgeek/pc/recommend/job/list.json?page=${page}&pageSize=30&city=${encodeURIComponent(city)}&encryptExpectId=&mixExpectType=&expectInfo=&jobType=&salary=&experience=&degree=&industry=&scale=`,
    ];
    let message = "没有从接口拿到职位";
    for (const url of urls) {
      try {
        const response = await fetch(url, { credentials: "include" });
        const data = await response.json();
        const jobs = extractApiList(data);
        if (jobs.length) return { jobs, message: "" };
        message = data?.message || data?.zpData?.message || message;
      } catch (error) {
        message = error?.message || message;
      }
    }
    return { jobs: [], message };
  }

  function askApiViaMessage(params, page, force) {
    const nonce = zpingNonce();
    if (!nonce) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve(null);
      }, 4000);
      function onMessage(event) {
        if (event.origin !== location.origin) return;
        if (event.source !== window || event.data?.source !== "zping" || event.data?.type !== "jobs-result") return;
        if (event.data?.nonce !== nonce) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve({ jobs: event.data.jobs || [], message: event.data.message || "" });
      }
      window.addEventListener("message", onMessage);
      window.postMessage({
        source: "zping-ask",
        nonce,
        query: params.get("query") || "",
        city: params.get("city") || "",
        page,
        force,
      }, location.origin);
    });
  }

  async function askApi(force = false) {
    const params = new URL(location.href).searchParams;
    const page = Number(params.get("page") || 1);
    const direct = await fetchApiJobs(params, page);
    if (direct.jobs.length) return direct;
    const viaMessage = await askApiViaMessage(params, page, force);
    if (viaMessage?.jobs?.length) return viaMessage;
    return direct.jobs.length ? direct : (viaMessage || direct);
  }

  function jobIdFromHref(href) {
    const match = String(href || "").match(/job_detail\/([^.?#/]+)|\/job\/([^.?#/]+)/i);
    return match?.[1] || match?.[2] || "";
  }

  function pickText(root, selectors) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const text = clean(node?.innerText || node?.getAttribute("title") || "");
      if (text) return text;
    }
    return "";
  }

  function normalizeTag(text) {
    return clean(text).replace(/^[\[【]|[\]】]/g, "");
  }

  function isJobTag(text) {
    const value = normalizeTag(text);
    if (!value || value.length > 16) return false;
    if (TAG_META_RE.test(value)) return false;
    if (EDU_RE.test(value) && value.length < 8) return false;
    if (/\d+\s*[kK千]|面议/.test(value)) return false;
    return BENEFIT_RE.test(value) || (value.length <= 8 && !/[·•]/.test(value));
  }

  function joinTags(tags) {
    const seen = new Set();
    const out = [];
    tags.forEach((tag) => {
      const value = normalizeTag(tag);
      if (!isJobTag(value) || seen.has(value)) return;
      seen.add(value);
      out.push(value);
    });
    return out.join(" / ");
  }

  function tagsFromDom(card) {
    if (!card) return [];
    const tags = [];
    card.querySelectorAll(".tag-list span, .tag-list li, [class*='job-tag'] span, [class*='welfare'] span, .job-card-footer span").forEach((el) => {
      const value = normalizeTag(el.innerText);
      if (isJobTag(value)) tags.push(value);
    });
    return tags;
  }

  function tagsFromRaw(raw) {
    const tags = [];
    [raw?.jobLabels, raw?.welfareList, raw?.jobWelfareList, raw?.labels].forEach((list) => {
      if (!list) return;
      const items = Array.isArray(list) ? list : String(list).split(/[,，/\s]+/);
      items.forEach((item) => {
        const value = normalizeTag(typeof item === "string" ? item : item?.name || item?.label || "");
        if (isJobTag(value)) tags.push(value);
      });
    });
    return tags;
  }

  function mergeTags(...sources) {
    return joinTags(sources.flat());
  }

  function isBossEncryptedSalary(text) {
    const value = String(text || "");
    if (/[\uE000-\uF8FF]/.test(value)) return true;
    if (/[kK千]|万|元/.test(value) && !/\d/.test(value)) return true;
    return false;
  }

  function pickSalary(...candidates) {
    for (const item of candidates) {
      const value = clean(item);
      if (!value || isBossEncryptedSalary(value)) continue;
      if (/\d/.test(value) || /面议/.test(value)) return value;
      if (/[kK千]|万|元/.test(value)) return value;
    }
    return "面议";
  }

  function normalizeBossSalary(text) {
    return pickSalary(text);
  }

  function parseBossCard(card) {
    const title = pickText(card, [".job-name", ".job-title", "[class*='job-name']", "a[href*='job_detail']", "a.job-card-left"]);
    const company = pickText(card, [
      ".boss-name",
      ".company-name",
      ".info-company",
      ".company-info h3 a",
      ".company-info .name",
      ".boss-info-attr",
      "[class*='boss-name']",
      "[class*='company-name']",
      "a[href*='/gongsi/']",
      "a[href*='/company/']",
    ]);
    const salaryRaw = pickText(card, [".job-salary", ".salary", "[class*='job-salary']", "[class*='salary']"]);
    const salary = pickSalary(salaryRaw);
    const city = pickText(card, [
      ".company-location",
      ".job-area",
      ".job-location",
      ".job-area-wrapper",
      "[class*='company-location']",
      "[class*='job-area']",
      "[class*='job-location']",
    ]);
    const link = card.querySelector("a[href*='job_detail'], a[href*='/job/'], a.job-card-left");
    const href = link?.href || "";
    const id = jobIdFromHref(href);
    const tagText = clean(card.querySelector(".job-info, .tag-list, .info-desc, [class*='job-info']")?.innerText);
    const educationRaw = tagText.match(EDU_RE)?.[0] || "";
    const education = /不限/.test(educationRaw) || !educationRaw ? "不限" : educationRaw;
    if (!title) return null;
    return {
      title,
      company,
      city,
      salary,
      education,
      tags: mergeTags(tagsFromDom(card)),
      url: id ? `https://www.zhipin.com/job_detail/${id}.html` : href.split("?")[0],
      key: id || `${title}|${company}|${salary}|${city}`,
      card,
    };
  }

  function jobIdFromJob(job) {
    const fromUrl = jobIdFromHref(job?.url);
    if (fromUrl) return fromUrl;
    const key = String(job?.key || "");
    return key.length > 8 ? key : "";
  }

  function cardLink(card) {
    return card?.querySelector("a[href*='job_detail'], a[href*='/job/']") || null;
  }

  function cardForJob(raw, nodes) {
    const id = raw.encryptJobId || raw.encryptId || raw.jobId;
    if (id) {
      const byId = nodes.find((node) => {
        const href = cardLink(node)?.href || "";
        return href.includes(id);
      });
      if (byId) return byId;
    }
    const title = clean(raw.jobName);
    const salary = clean(raw.salaryDesc || raw.salary);
    if (title) {
      const candidates = nodes.filter((node) => clean(parseBossCard(node)?.title) === title);
      if (candidates.length === 1) return candidates[0];
      if (salary && candidates.length > 1) {
        const bySalary = candidates.find((node) => clean(parseBossCard(node)?.salary) === salary);
        if (bySalary) return bySalary;
      }
    }
    return null;
  }

  function apiCompany(raw) {
    return clean(raw.brandName || raw.companyName || raw.bossName || raw.comName || "");
  }

  function toJob(raw, card) {
    const labels = Array.isArray(raw.jobLabels) ? raw.jobLabels.join(" ") : String(raw.jobLabels || "");
    const tagText = [labels, raw.experienceName, raw.degreeName].filter(Boolean).join(" ");
    const education = raw.jobDegree || raw.degreeName || tagText.match(EDU_RE)?.[0] || "不限";
    const city = [raw.cityName, raw.areaDistrict, raw.businessDistrict, raw.cityDistrict].filter(Boolean).join("·");
    const title = raw.jobName || raw.title || raw.positionName || raw.postName || "";
    const apiSalary = raw.salaryDesc || raw.salary || raw.salaryName || "";
    const id = raw.encryptJobId || raw.encryptId || raw.jobId || "";
    const dom = card ? parseBossCard(card) : null;
    const domSalaryRaw = card
      ? pickText(card, [".job-salary", ".salary", "[class*='job-salary']", "[class*='salary']"])
      : "";
    const salary = pickSalary(apiSalary, domSalaryRaw);
    const company = dom?.company || apiCompany(raw) || "";
    return {
      title: dom?.title || title || "",
      company,
      city: dom?.city || city || "",
      salary,
      education: dom?.education || (/不限/.test(education) ? "不限" : (education.match(EDU_RE)?.[0] || "不限")),
      tags: mergeTags(tagsFromRaw(raw), tagsFromDom(card), dom?.tags ? dom.tags.split(" / ") : []),
      url: id ? `https://www.zhipin.com/job_detail/${id}.html` : (dom?.url || ""),
      key: id || dom?.key || `${title}|${company}|${salary}|${city}`,
      securityId: raw.securityId || raw.secureId || "",
      lid: raw.lid || raw.lidTag || "",
      card: card || dom?.card || null,
    };
  }

  function parseQueryParam(href, name) {
    const text = String(href || "");
    const match = text.match(new RegExp(`[?&]${name}=([^&#]+)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function collectSecurityFromDom(scope) {
    let securityId = "";
    let lid = "";
    if (!scope) return { securityId, lid };
    scope.querySelectorAll("a[href], button[data-url], [data-securityid], [data-security-id]").forEach((el) => {
      const href = el.getAttribute("href") || el.getAttribute("data-url") || "";
      if (!securityId) securityId = parseQueryParam(href, "securityId") || el.getAttribute("data-securityid") || el.getAttribute("data-security-id") || "";
      if (!lid) lid = parseQueryParam(href, "lid");
    });
    return { securityId, lid };
  }

  function extractJobApiParams(job) {
    const encryptId = jobIdFromJob(job);
    let securityId = String(job?.securityId || "");
    let lid = String(job?.lid || "");
    const scopes = [detailRoot(), job?.card].filter(Boolean);
    scopes.forEach((scope) => {
      const found = collectSecurityFromDom(scope);
      if (!securityId) securityId = found.securityId;
      if (!lid) lid = found.lid;
    });
    if (!encryptId || !securityId) return null;
    return { encryptId, securityId, lid };
  }

  async function fetchJobApiParams(job) {
    const cached = extractJobApiParams(job);
    if (cached) return cached;
    const id = jobIdFromJob(job);
    if (!id) return null;
    try {
      const response = await fetch(`https://www.zhipin.com/wapi/zpgeek/job/detail.json?jobId=${encodeURIComponent(id)}`, { credentials: "include" });
      const data = await response.json();
      const info = data?.zpData?.jobInfo || data?.zpData?.jobDetail || data?.zpData || {};
      const securityId = info.securityId || info.secureId || "";
      const lid = info.lid || info.lidTag || "";
      if (securityId) {
        job.securityId = securityId;
        job.lid = lid;
        return { encryptId: id, securityId, lid };
      }
    } catch {
      /* 详情接口失败时走 DOM 兜底 */
    }
    return extractJobApiParams(job);
  }

  async function saveBossCustomGreeting(encryptId, content) {
    const body = new URLSearchParams({ encryptId, content });
    const response = await fetch("https://www.zhipin.com/wapi/zpchat/greeting/custom/save", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    const data = await response.json().catch(() => ({}));
    return data?.code === 0;
  }

  async function parseBossApiResult(response) {
    const data = await response.json().catch(() => ({}));
    const message = String(data?.message || "");
    if (data?.code === 0) return "ok";
    if (/已沟通|沟通过|已是好友|重复/.test(message)) return "already";
    return "failed";
  }

  async function addBossFriend(params) {
    const body = new URLSearchParams({
      securityId: params.securityId,
      jobId: params.encryptId,
    });
    if (params.lid) body.set("lid", params.lid);
    const getResult = await parseBossApiResult(await fetch(`https://www.zhipin.com/wapi/zpgeek/friend/add.json?${body}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    }));
    if (getResult !== "failed") return getResult;
    return parseBossApiResult(await fetch("https://www.zhipin.com/wapi/zpgeek/friend/add.json", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    }));
  }

  async function handleBossPostApplyDialogs() {
    const selectDlg = document.querySelector(".upload-select-dialog");
    if (selectDlg && window.getComputedStyle(selectDlg).display !== "none") {
      const items = selectDlg.querySelectorAll(".select-one");
      if (items.length >= 2) {
        items[1].click();
        await sleep(1200);
      }
    }
    if (bossMessageSent()) {
      clickStay();
      await sleep(400);
    }
  }

  async function sendGreetingViaApi(job, greeting) {
    const params = await fetchJobApiParams(job);
    if (!params) {
      globalThis.ZpingRuntime?.appendLog?.("未获取到职位 securityId，无法发送自定义招呼语", "warn");
      return "missing-params";
    }
    const saved = await saveBossCustomGreeting(params.encryptId, greeting);
    if (!saved) {
      globalThis.ZpingRuntime?.appendLog?.("保存自定义招呼语失败，将尝试页面兜底", "warn");
      return "save-failed";
    }
    await sleep(350 + Math.floor(Math.random() * 400));
    const added = await addBossFriend(params);
    if (added === "already") return "already";
    if (added !== "ok") {
      globalThis.ZpingRuntime?.appendLog?.("发起沟通接口失败，将尝试点击「立即沟通」", "warn");
      return "add-failed";
    }
    await sleep(700);
    await handleBossPostApplyDialogs();
    job.greetingSent = true;
    return "ok";
  }

  function syncJobFromCard(job) {
    if (!job?.card) return job;
    const dom = parseBossCard(job.card);
    if (!dom) return job;
    job.title = dom.title || job.title;
    job.company = dom.company || job.company;
    job.city = dom.city || job.city;
    job.salary = pickSalary(job.salary, dom.salary);
    job.education = dom.education || job.education;
    job.tags = mergeTags(dom.tags ? dom.tags.split(" / ") : [], job.tags ? job.tags.split(" / ") : []);
    if (dom.url) job.url = dom.url;
    if (dom.key) job.key = dom.key;
    return job;
  }

  function detailRoot() {
    const selectors = [
      ".job-detail-box",
      ".job-detail-wrapper",
      ".job-detail-container",
      ".job-box",
      "[class*='job-detail-box']",
      "[class*='job-detail-wrapper']",
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node && node.getBoundingClientRect().width > 180) return node;
    }
    return null;
  }

  function readBossDetailPanel() {
    const root = detailRoot();
    if (!root) return { title: "", company: "", id: "" };
    const title = pickText(root, [".job-name", ".name", "h1", "[class*='job-name']", "[class*='position-name']"]);
    const company = pickText(root, [
      ".company-name",
      ".info-company",
      ".boss-info-company",
      ".company-info-name",
      "[class*='company-name']",
      ".info-primary .name",
    ]);
    const link = root.querySelector("a[href*='job_detail'], a[href*='/job/']");
    return { title, company, id: jobIdFromHref(link?.href) };
  }

  function textClose(a, b) {
    const left = clean(a);
    const right = clean(b);
    if (!left || !right) return false;
    return left === right || left.includes(right) || right.includes(left);
  }

  async function waitForDetailPanel(job, timeout = 6000) {
    const expectId = jobIdFromJob(job);
    const expectTitle = clean(job?.title);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const panel = readBossDetailPanel();
      if (expectId && panel.id && panel.id === expectId) return panel;
      if (expectTitle && textClose(panel.title, expectTitle)) return panel;
      await sleep(200);
    }
    return readBossDetailPanel();
  }

  function cardContainer(el) {
    if (!el) return null;
    return el.closest("li.job-card-box, li, .job-card-box, .job-card-wrapper, .job-card-wrap, [class*='job-card']") || el.parentElement;
  }

  function findCardOnPage(job) {
    const id = jobIdFromJob(job);
    if (id) {
      const links = document.querySelectorAll(`a[href*='job_detail/${id}'], a[href*='${id}.html'], a[href*='${id}']`);
      for (const link of links) {
        if (link.closest("#zping-host")) continue;
        const card = cardContainer(link);
        if (card) return card;
      }
    }
    const title = clean(job?.title);
    const company = clean(job?.company);
    for (const card of cards()) {
      const parsed = parseBossCard(card);
      if (!parsed) continue;
      if (id && jobIdFromHref(parsed.url) === id) return card;
      if (title && company && textClose(parsed.title, title) && textClose(parsed.company, company)) return card;
      if (title && textClose(parsed.title, title) && clean(parsed.salary) === clean(job?.salary)) return card;
    }
    return null;
  }

  function clickJobCard(job) {
    if (!job?.card) return false;
    const expectId = jobIdFromJob(job);
    const link = cardLink(job.card);
    if (link) {
      if (!expectId || String(link.href).includes(expectId)) {
        link.click();
        return true;
      }
    }
    const titleEl = job.card.querySelector(".job-name, .job-title, a[href*='job_detail'], a[href*='/job/']") || job.card;
    titleEl.click();
    return true;
  }

  function mergeApiDom(apiJobs, domJobs) {
    if (!apiJobs.length) return domJobs;
    if (!domJobs.length) return apiJobs;
    const used = new Set();
    return apiJobs.map((job, index) => {
      const dom = domJobs.find((item) => {
        if (!item?.title || used.has(item)) return false;
        if (job.url && item.url && job.url.split("?")[0] === item.url.split("?")[0]) return true;
        return clean(item.title) === clean(job.title);
      }) || domJobs[index];
      if (dom) used.add(dom);
      return {
        ...job,
        title: job.title || dom?.title || "",
        company: job.company || dom?.company || "",
        city: job.city || dom?.city || "",
        salary: pickSalary(job.salary, dom?.salary),
        education: job.education || dom?.education || "不限",
        tags: mergeTags(job.tags ? job.tags.split(" / ") : [], dom?.tags ? dom.tags.split(" / ") : []),
        url: job.url || dom?.url || "",
        key: job.key || dom?.key || "",
        card: dom?.card || job.card || null,
      };
    }).filter((job) => job.title);
  }

  async function collectJobs() {
    const nodes = cards();
    const domJobs = nodes.map((card) => parseBossCard(card)).filter(Boolean);
    if (!cache) {
      const result = await askApi(true);
      cache = result.jobs;
      scanHint = cache.length ? "" : (result.message || "没有读到职位数据，正在尝试页面卡片识别。");
    }

    if (cache.length) {
      const used = new Set();
      const apiJobs = cache.map((raw) => {
        const card = cardForJob(raw, nodes.filter((node) => !used.has(node)));
        if (card) used.add(card);
        const job = toJob(raw, card);
        if (job.salary === "面议" && raw.salaryDesc) {
          job.salary = pickSalary(raw.salaryDesc, raw.salary, raw.salaryName);
        }
        return job;
      }).filter((job) => job.title);
      const merged = mergeApiDom(apiJobs, domJobs);
      if (merged.length) {
        scanHint = "";
        return merged;
      }
    }

    if (domJobs.length) {
      scanHint = "";
      return domJobs;
    }
    scanHint = scanHint || "没有识别到 Boss 职位卡片。请确认在搜索列表页（/web/geek/job）并刷新后重试。";
    return [];
  }

  function findChatButton(root) {
    const scope = root || detailRoot() || document;
    const hits = [...scope.querySelectorAll("button, a, div, span")].filter((el) => {
      if (el.closest("#zping-host")) return false;
      const text = clean(el.innerText);
      if (!/^(立即沟通|继续沟通)$/.test(text)) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 36 && rect.height > 16;
    });
    hits.sort((a, b) => {
      const score = (el) => (/立即沟通/.test(clean(el.innerText)) ? 1 : 0);
      return score(b) - score(a);
    });
    return hits[0] || null;
  }

  function bossMessageSent() {
    return /已向BOSS发送消息|已向Boss发送消息|消息已发送/.test(document.body?.innerText || "");
  }

  function clickStay() {
    const stay = [...document.querySelectorAll("button, a, div, span")].find((el) => {
      if (el.closest("#zping-host")) return false;
      return clean(el.innerText) === "留在此页" && el.getBoundingClientRect().width > 0;
    });
    stay?.click();
  }

  async function ensureJobCard(job) {
    if (job?.card) return job.card;
    cache = null;
    for (let i = 0; i < 8; i++) {
      job.card = findCardOnPage(job);
      if (job.card) return job.card;
      const id = jobIdFromJob(job);
      if (id) {
        const link = document.querySelector(`a[href*='${id}']`);
        link?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      await sleep(350);
    }
    return null;
  }

  async function applyHere(job) {
    job.card = await ensureJobCard(job);
    if (!job.card) return "missing";
    syncJobFromCard(job);
    job.card.scrollIntoView({ block: "center", behavior: "smooth" });
    clickJobCard(job);
    const panel = await waitForDetailPanel(job);
    const expectId = jobIdFromJob(job);
    if (expectId && panel.id && panel.id !== expectId) return "mismatch";
    if (panel.title && job.title && !textClose(panel.title, job.title)) return "mismatch";
    if (panel.company && job.company && !textClose(panel.company, job.company)) return "mismatch";
    if (panel.company) job.company = panel.company;
    if (panel.title) job.title = panel.title;
    const greeting = await globalThis.ZpingRuntime?.resolveGreeting?.()
      || globalThis.ZpingRuntime?.getGreeting?.()
      || "";
    if (greeting) {
      const apiResult = await sendGreetingViaApi(job, greeting);
      if (apiResult === "ok") {
        cache = null;
        return "ok";
      }
      if (apiResult === "already") return "already";
    }
    const root = detailRoot();
    let button = findChatButton(root);
    if (!button) {
      clickJobCard(job);
      await sleep(500);
      button = findChatButton(detailRoot());
    }
    if (!button) return "missing";
    if (/继续沟通/.test(button.innerText || "")) return "already";
    button.click();
    await sleep(900);
    if (greeting) {
      const greet = await globalThis.ZpingGreeting?.fillAndSend?.(greeting);
      if (greet?.sent) {
        job.greetingSent = true;
      } else {
        globalThis.ZpingRuntime?.appendLog?.("页面未找到可编辑招呼语输入框，可能已发送网站默认话术", "warn");
        await handleBossPostApplyDialogs();
        if (bossMessageSent()) {
          cache = null;
          return "ok";
        }
        return "greeting-failed";
      }
      await sleep(800);
    }
    const start = Date.now();
    while (Date.now() - start < 12000) {
      if (bossMessageSent()) {
        clickStay();
        cache = null;
        return "ok";
      }
      await sleep(300);
    }
    return "failed";
  }

  function stripHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return doc.body.innerText.replace(/\n{3,}/g, "\n\n").trim();
  }

  async function fetchJobDetail(job) {
    const cached = job?.detail || "";
    const id = job?.url?.match(/job_detail\/([^./?#]+)/i)?.[1] || (String(job?.key || "").length > 8 ? job.key : "");
    if (!id) return cached;
    try {
      const response = await fetch(`https://www.zhipin.com/wapi/zpgeek/job/detail.json?jobId=${encodeURIComponent(id)}`, { credentials: "include" });
      const data = await response.json();
      const info = data?.zpData?.jobInfo || data?.zpData?.jobDetail || {};
      const html = info.postDescription || info.jobDesc || "";
      const welfare = info.showWelfareList || info.welfareList || info.jobWelfareList || [];
      const detailTags = mergeTags(tagsFromRaw({ welfareList: welfare, jobLabels: info.jobLabels }), job?.tags ? job.tags.split(" / ") : []);
      if (detailTags) job.tags = detailTags;
      const detailCompany = clean(info.brandName || info.companyName || "");
      if (detailCompany) job.company = detailCompany;
      if (cached) return cached;
      return stripHtml(html).slice(0, 12000);
    } catch {
      return cached;
    }
  }

  function clickNextPage() {
    cache = null;
    const pager = document.querySelector(".options-pages, .pagination, [class*='options-pages'], [class*='pagination']");
    if (pager) {
      const current = pager.querySelector(".selected, .active, .cur, [class*='selected'], [class*='current']");
      let candidate = current?.nextElementSibling;
      while (candidate) {
        if (candidate.tagName === "A" || candidate.querySelector("a")) {
          const link = candidate.tagName === "A" ? candidate : candidate.querySelector("a");
          if (link && !link.classList.contains("disabled")) {
            link.click();
            return true;
          }
        }
        candidate = candidate.nextElementSibling;
      }
    }
    const next = [...document.querySelectorAll("a, button, span, .ui-icon-arrow-right, [class*='next']")].find((el) => {
      if (el.closest("#zping-host")) return false;
      const text = clean(el.innerText);
      const cls = String(el.className || "");
      if (text === "下一页" || text === ">" || text === "›") return true;
      return /next|下一页/i.test(cls);
    });
    if (next && !next.classList.contains("disabled") && next.getAttribute("aria-disabled") !== "true") {
      next.click();
      return true;
    }
    const url = new URL(location.href);
    const page = Number(url.searchParams.get("page") || 1);
    const nextPage = page + 1;
    const disabled = document.querySelector(".disabled, [aria-disabled='true']");
    if (disabled && /下一页|next/i.test(disabled.innerText || "")) return false;
    url.searchParams.set("page", String(nextPage));
    if (url.toString() !== location.href) {
      location.assign(url.toString());
      return true;
    }
    return false;
  }

  Zping.boot({
    id: "boss",
    label: "Boss直聘",
    isListPage: () => globalThis.ZpingCities?.isListPage?.(location.href, "boss") || /\/web\/geek\/job|\/geek\/jobs/i.test(location.pathname),
    isDetailPage: () => /job_detail|\/job\//i.test(location.pathname),
    collectJobs,
    scanHint: () => scanHint,
    findApplyButton: () => findChatButton(detailRoot()),
    applyHere,
    fetchJobDetail,
    syncJobFromCard,
    locateCard: findCardOnPage,
    clickNextPage,
    reset() {
      cache = null;
    },
  });
})();
