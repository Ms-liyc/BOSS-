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

  function cards() {
    const selectors = [
      ".job-card-box",
      ".job-card-wrapper",
      ".job-card-wrap",
      ".job-list-box li",
      ".rec-job-list li",
      "[class*='job-card']",
    ];
    const found = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el.closest("#zping-host")) return;
        if (el.querySelector(".job-name, .job-title, a[href*='job_detail'], a[href*='/job/']")) {
          found.push(el);
        }
      });
    });
    if (found.length) {
      return found.filter((el) => !found.some((other) => other !== el && other.contains(el)));
    }
    return [...document.querySelectorAll("li")].filter((el) => el.querySelector(".job-name, .job-salary, a[href*='job_detail'], a[href*='/job/']"));
  }

  function askApi(force = false) {
    const params = new URL(location.href).searchParams;
    const page = Number(params.get("page") || 1);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve({ jobs: [], message: "读取职位接口超时，将尝试从页面卡片识别。" });
      }, 8000);
      function onMessage(event) {
        if (event.source !== window || event.data?.source !== "zping" || event.data?.type !== "jobs-result") return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve({ jobs: event.data.jobs || [], message: event.data.message || "" });
      }
      window.addEventListener("message", onMessage);
      window.postMessage({
        source: "zping-ask",
        query: params.get("query") || "",
        city: params.get("city") || "",
        page,
        force,
      }, "*");
    });
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

  function parseBossCard(card) {
    const title = pickText(card, [".job-name", ".job-title", "[class*='job-name']", "a[href*='job_detail']"]);
    const company = pickText(card, [".company-name", ".info-company", ".boss-info-attr", "[class*='company-name']", "a[href*='/gongsi/']", "a[href*='/company/']"]);
    const salary = pickText(card, [".job-salary", ".salary", "[class*='job-salary']", "[class*='salary']"]) || "面议";
    const city = pickText(card, [".job-area", ".job-location", ".job-area-wrapper", "[class*='job-area']", "[class*='job-location']"]);
    const link = card.querySelector("a[href*='job_detail'], a[href*='/job/']");
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
    return clean(raw.brandName || raw.companyName || "");
  }

  function toJob(raw, card) {
    const labels = Array.isArray(raw.jobLabels) ? raw.jobLabels.join(" ") : String(raw.jobLabels || "");
    const tagText = [labels, raw.experienceName, raw.degreeName].filter(Boolean).join(" ");
    const education = raw.jobDegree || raw.degreeName || tagText.match(EDU_RE)?.[0] || "不限";
    const city = [raw.cityName, raw.areaDistrict, raw.businessDistrict].filter(Boolean).join("·");
    const title = raw.jobName || raw.title || "";
    const salary = raw.salaryDesc || raw.salary || "面议";
    const id = raw.encryptJobId || raw.encryptId || raw.jobId || "";
    const dom = card ? parseBossCard(card) : null;
    const company = dom?.company || apiCompany(raw) || "";
    return {
      title: dom?.title || title || "",
      company,
      city: dom?.city || city || "",
      salary: dom?.salary || salary || "面议",
      education: dom?.education || (/不限/.test(education) ? "不限" : (education.match(EDU_RE)?.[0] || "不限")),
      tags: mergeTags(tagsFromRaw(raw), tagsFromDom(card), dom?.tags ? dom.tags.split(" / ") : []),
      url: id ? `https://www.zhipin.com/job_detail/${id}.html` : (dom?.url || ""),
      key: id || dom?.key || `${title}|${company}|${salary}|${city}`,
      card: card || dom?.card || null,
    };
  }

  function syncJobFromCard(job) {
    if (!job?.card) return job;
    const dom = parseBossCard(job.card);
    if (!dom) return job;
    job.title = dom.title || job.title;
    job.company = dom.company || job.company;
    job.city = dom.city || job.city;
    job.salary = dom.salary || job.salary;
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

  function clickJobCard(job) {
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

  async function collectJobs() {
    const nodes = cards();
    if (!cache) {
      const result = await askApi(true);
      cache = result.jobs;
      scanHint = cache.length ? "" : (result.message || "没有读到职位数据，正在尝试页面卡片识别。");
    }

    if (cache.length) {
      const used = new Set();
      const jobs = cache.map((raw) => {
        const card = cardForJob(raw, nodes.filter((node) => !used.has(node)));
        if (card) used.add(card);
        return toJob(raw, card);
      }).filter((job) => job.title);
      if (jobs.length) {
        scanHint = "";
        return jobs;
      }
    }

    const domJobs = nodes.map((card) => parseBossCard(card)).filter(Boolean);
    if (domJobs.length) {
      scanHint = "";
      return domJobs;
    }
    scanHint = scanHint || "没有识别到 Boss 职位卡片。请确认在搜索列表页并刷新后重试。";
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

  async function applyHere(job) {
    if (!job?.card) return job?.url ? "need-nav" : "missing";
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
    const start = Date.now();
    while (Date.now() - start < 8000) {
      if (bossMessageSent()) {
        clickStay();
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
    isListPage: () => /\/web\/geek\/job|\/geek\/jobs/i.test(location.pathname),
    isDetailPage: () => /job_detail|\/job\//i.test(location.pathname),
    collectJobs,
    scanHint: () => scanHint,
    findApplyButton: () => findChatButton(detailRoot()),
    applyHere,
    fetchJobDetail,
    syncJobFromCard,
    clickNextPage,
    reset() {
      cache = null;
    },
  });
})();
