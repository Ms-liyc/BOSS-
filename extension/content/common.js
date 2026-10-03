(() => {
  if (globalThis.Zping?.boot) return;

  const EDU_LEVELS = globalThis.ZpingCities?.EDU_LEVELS || ["初中", "中专", "中技", "高中", "大专", "本科", "硕士", "博士"];
  const SESSION_KEY = "session";
  const SESSION_EXPIRED_KEY = "zping_session_expired";
  const EXPORT_KEY = "zping_export";
  const SESSION_TTL_MS = 60 * 60 * 1000;

  let adapter = null;
  let session = null;
  let shadow = null;
  let applying = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function splitWords(value) {
    return String(value || "")
      .split(/[,，、\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseSalary(text) {
    const raw = String(text || "").toUpperCase().replace(/[–—－]/g, "-");
    let match = raw.match(/(\d+)\s*[-~～]\s*(\d+)\s*[K千]/);
    if (match) return [Number(match[1]), Number(match[2])];
    match = raw.match(/(\d+)\s*[K千]\s*(?:以上|起|\+)/);
    if (match) return [Number(match[1]), Number(match[1]) + 50];
    match = raw.match(/(\d+(?:\.\d+)?)\s*千\s*[-~～]\s*(\d+(?:\.\d+)?)\s*万/);
    if (match) return [Math.round(Number(match[1])), Math.round(Number(match[2]) * 10)];
    match = raw.match(/(\d+(?:\.\d+)?)\s*[-~～]\s*(\d+(?:\.\d+)?)\s*万(?:元)?(?:\s*\/\s*月)?/);
    if (match) return [Math.round(Number(match[1]) * 10), Math.round(Number(match[2]) * 10)];
    match = raw.match(/(\d+(?:\.\d+)?)\s*万\s*[-~～]\s*(\d+(?:\.\d+)?)\s*万/);
    if (match) return [Math.round(Number(match[1]) * 10), Math.round(Number(match[2]) * 10)];
    match = raw.match(/(\d+)\s*[-~～]\s*(\d+)\s*元\s*\/\s*月/);
    if (match) return [Math.round(Number(match[1]) / 1000), Math.round(Number(match[2]) / 1000)];
    match = raw.match(/(\d+)\s*[-~～]\s*(\d+)\s*元\s*\/\s*天/);
    if (match) return [Math.round(Number(match[1]) * 21.75 / 1000), Math.round(Number(match[2]) * 21.75 / 1000)];
    match = raw.match(/(\d+)\s*元\s*\/\s*时/);
    if (match) return [Math.round(Number(match[1]) * 160 / 1000), Math.round(Number(match[1]) * 160 / 1000)];
    return null;
  }

  function cityMatch(filterCity, jobCity, jobTitle) {
    if (!filterCity || filterCity === "全国") return true;
    const city = String(jobCity || "");
    const title = String(jobTitle || "");
    if (city.includes(filterCity) || filterCity.includes(city)) return true;
    if (title.includes(filterCity)) return true;
    const district = filterCity.replace(/市$/, "");
    if (district && (city.includes(district) || title.includes(district))) return true;
    return false;
  }

  function eduIndex(text) {
    const value = String(text || "");
    if (!value || /不限/.test(value)) return -1;
    return EDU_LEVELS.findIndex((level) => value.includes(level));
  }

  function matchJob(job, filters) {
    const company = String(job.company || "");
    const city = String(job.city || "");
    const title = String(job.title || "");
    const keywords = splitWords(filters.keyword);
    const includes = splitWords(filters.companies);
    const excludes = splitWords(filters.exclude);

    if (keywords.length && !keywords.some((word) => title.includes(word) || company.includes(word))) {
      return false;
    }
    if (excludes.some((word) => company.includes(word) || title.includes(word))) return false;
    if (includes.length && !includes.some((word) => company.includes(word))) return false;

    const required = eduIndex(filters.education);
    const actual = eduIndex(job.education);
    if (required >= 0 && actual > required) return false;

    const range = parseSalary(job.salary);
    if (range) {
      const [low, high] = range;
      if (filters.salaryMin != null && high < filters.salaryMin) return false;
      if (filters.salaryMax != null && low > filters.salaryMax) return false;
    }

    if (!cityMatch(filters.city, city, title)) return false;
    return true;
  }

  async function filterEligibleJobs(jobs, filters) {
    const out = [];
    let historySkipped = 0;
    for (const job of jobs) {
      if (!matchJob(job, filters)) continue;
      const block = await globalThis.ZpingHistory?.isBlocked(job, {
        skipCompany: Boolean(filters.skipCompanyHistory),
      });
      if (block?.blocked) {
        historySkipped += 1;
        continue;
      }
      out.push(job);
    }
    return { jobs: out, historySkipped };
  }

  async function waitApplyDelay() {
    const sec = Number(session?.filters?.applyDelay);
    if (!sec || sec <= 0) return;
    setStatus(`投递间隔：等待 ${sec} 秒…`);
    await sleep(sec * 1000);
  }

  function absUrl(href) {
    try {
      return new URL(href, location.href).href;
    } catch {
      return "";
    }
  }

  async function loadSession() {
    const data = await chrome.storage.local.get(SESSION_KEY);
    const saved = data[SESSION_KEY] || null;
    if (saved?.updatedAt && Date.now() - saved.updatedAt > SESSION_TTL_MS) {
      await chrome.storage.local.remove(SESSION_KEY);
      await chrome.storage.local.set({ [SESSION_EXPIRED_KEY]: true });
      return null;
    }
    return saved;
  }

  async function saveSession(next) {
    session = next;
    if (!next) {
      await chrome.storage.local.remove(SESSION_KEY);
      return;
    }
    const copy = {
      ...next,
      updatedAt: Date.now(),
      jobs: next.jobs.map(({ card, ...job }) => job),
    };
    await chrome.storage.local.set({ [SESSION_KEY]: copy });
  }

  function ensurePanel() {
    let host = document.getElementById("zping-host");
    if (host) {
      shadow = host.shadowRoot;
      return;
    }
    host = document.createElement("div");
    host.id = "zping-host";
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:340px;";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .card {
          font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
          background: #fff;
          color: #1f2933;
          border: 1px solid #d9e2ec;
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(15, 23, 42, .18);
          padding: 14px;
        }
        h2 { margin: 0; font-size: 15px; }
        .meta { margin: 4px 0 10px; color: #52606d; font-size: 12px; }
        .row {
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: 6px;
          padding: 5px 0;
          border-top: 1px solid #f0f4f8;
          font-size: 13px;
        }
        .row span { color: #7b8794; }
        .row strong { font-weight: 600; word-break: break-all; }
        .actions { display: flex; gap: 8px; margin-top: 12px; }
        button {
          flex: 1;
          border: 0;
          border-radius: 8px;
          padding: 8px 6px;
          cursor: pointer;
          font: 13px "Segoe UI", "Microsoft YaHei", sans-serif;
        }
        .yes { background: #0f766e; color: #fff; }
        .no { background: #e4e7eb; color: #1f2933; }
        .stop { background: #fff; color: #b42318; border: 1px solid #fecdca !important; }
        .export { background: #2563eb; color: #fff; width: 100%; margin-top: 8px; }
        .export-wrap { display: none; margin-top: 8px; }
        .export-wrap.show { display: block; }
        .status { min-height: 18px; margin: 8px 0 0; font-size: 12px; color: #0f766e; }
        .hint { margin-top: 8px; font-size: 11px; color: #9aa5b1; }
        .row.hide { display: none; }
      </style>
      <div class="card">
        <h2>投递前确认</h2>
        <div class="meta" id="meta"></div>
        <div class="row"><span>公司名称</span><strong id="company"></strong></div>
        <div class="row"><span>工作岗位</span><strong id="title"></strong></div>
        <div class="row"><span>工作地点</span><strong id="city"></strong></div>
        <div class="row"><span>薪资范围</span><strong id="salary"></strong></div>
        <div class="row"><span>学历要求</span><strong id="education"></strong></div>
        <div class="row hide" id="tags-row"><span>职位标签</span><strong id="tags"></strong></div>
        <div class="hint">快捷键：Y 确认 · N 跳过 · S 停止</div>
        <div class="actions">
          <button class="yes" id="yes" type="button">确认投递</button>
          <button class="no" id="no" type="button">跳过</button>
          <button class="stop" id="stop" type="button">停止</button>
        </div>
        <div class="export-wrap" id="export-wrap">
          <button class="export" id="export" type="button">导出 Excel</button>
        </div>
        <div class="status" id="status"></div>
      </div>
    `;
    document.documentElement.appendChild(host);
    shadow.getElementById("yes").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onYes();
    });
    shadow.getElementById("no").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onNo();
    });
    shadow.getElementById("stop").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      stop();
    });
    shadow.getElementById("export").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      exportExcel();
    });
    const style = document.createElement("style");
    style.textContent = ".zping-highlight{outline:2px solid #0f766e !important;outline-offset:2px;}";
    document.documentElement.appendChild(style);
    bindPanelKeys();
  }

  function bindPanelKeys() {
    if (globalThis.__ZPING_KEYS__) return;
    globalThis.__ZPING_KEYS__ = true;
    document.addEventListener("keydown", (event) => {
      if (!session?.running || applying) return;
      if (!document.getElementById("zping-host")) return;
      const tag = String(event.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || event.target?.isContentEditable) return;
      if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        onYes();
      } else if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        onNo();
      } else if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        stop();
      }
    }, true);
  }

  function setStatus(text) {
    ensurePanel();
    shadow.getElementById("status").textContent = text || "";
  }

  function platformLabel(id) {
    return id === "yupao" ? "鱼泡网" : "Boss直聘";
  }

  function salaryFilterText(filters) {
    const min = filters?.salaryMin;
    const max = filters?.salaryMax;
    if (min == null && max == null) return "不限";
    return `${min ?? 0}k - ${max ?? "∞"}k`;
  }

  async function addRecord(job, result) {
    if (!session) return;
    applying = true;
    setButtons("busy");
    if (!session.records) session.records = [];
    const f = session.filters || {};
    const historyOpts = { skipCompany: Boolean(f.skipCompanyHistory) };
    let detail = job?.detail || "";
    let tags = job?.tags || "";
    try {
      if (adapter?.fetchJobDetail && (!detail || !tags)) {
        setStatus("正在抓取职位详情…");
        try {
          const fetched = await adapter.fetchJobDetail(job);
          if (!detail) detail = fetched || "";
          tags = job?.tags || tags || "";
        } catch {
          detail = detail || "";
        }
      }
      await globalThis.ZpingHistory?.remember(job, result, platformLabel(session.platform), historyOpts);
      session.records.push({
      time: new Date().toLocaleString("zh-CN"),
      result,
      platform: platformLabel(session.platform),
      filterKeyword: f.keyword || "",
      filterCity: f.city || "",
      filterSalary: salaryFilterText(f),
      filterEducation: f.education || "不限",
      filterCompanies: f.companies || "",
      filterExclude: f.exclude || "",
      company: job?.company || "",
      title: job?.title || "",
      city: job?.city || "",
      salary: job?.salary || "",
      education: job?.education || "",
      tags,
      url: job?.url || "",
        detail,
      });
      const record = session.records[session.records.length - 1];
      const platform = session.platform === "yupao" ? "yupao" : "boss";
      await globalThis.ZpingExport.appendToLedger(platform, [record]);
    } finally {
      applying = false;
      if (session?.running) {
        setButtons(session.phase === "chat-shown" ? "next" : "confirm");
      }
    }
  }

  async function saveExportSnapshot() {
    const data = {
      finishedAt: new Date().toISOString(),
      filters: session?.filters || {},
      platform: session?.platform || adapter?.id || "",
      applied: session?.applied || 0,
      skipped: session?.skipped || 0,
      records: session?.records || [],
    };
    await chrome.storage.local.set({ [EXPORT_KEY]: data });
    return data;
  }

  async function exportExcel() {
    const platform = session?.platform || adapter?.id || "boss";
    const records = await globalThis.ZpingExport.loadLedger(platform);
    if (!records.length) {
      setStatus("没有可导出的记录。请先完成一轮投递。");
      return;
    }
    const count = await globalThis.ZpingExport.downloadLedger(platform, records);
    const name = globalThis.ZpingExport.exportFilename(platform);
    setStatus(`已更新 ${name}，累计 ${count} 条。`);
  }

  function showExportButton(show) {
    ensurePanel();
    shadow.getElementById("export-wrap").classList.toggle("show", show);
  }

  async function endRun(message, options = {}) {
    const exportData = await saveExportSnapshot();
    const platform = exportData.platform === "yupao" ? "yupao" : "boss";
    const total = (await globalThis.ZpingExport.loadLedger(platform)).length;
    const shouldSave = options.saveExcel !== false && total > 0;
    if (shouldSave) {
      try {
        await globalThis.ZpingExport.downloadLedger(platform);
      } catch {
        /* 导出失败不阻断结束流程 */
      }
    }
    await saveSession(null);
    showExportButton(total > 0);
    const fileName = globalThis.ZpingExport.exportFilename(platform);
    const tail = shouldSave && total ? `，已自动保存 ${fileName}（累计 ${total} 条）` : "";
    setStatus(message || `本轮结束。已投 ${exportData.applied}，跳过 ${exportData.skipped}${tail}。`);
  }

  function setButtons(mode) {
    ensurePanel();
    const yes = shadow.getElementById("yes");
    const no = shadow.getElementById("no");
    const stopBtn = shadow.getElementById("stop");
    const busy = mode === "busy";
    yes.disabled = busy;
    no.disabled = busy;
    stopBtn.disabled = busy;
    if (mode === "next") {
      yes.textContent = "下一条";
      no.textContent = "留在这里";
      return;
    }
    yes.textContent = "确认投递";
    no.textContent = "跳过";
  }

  function highlight(job) {
    document.querySelectorAll(".zping-highlight").forEach((el) => el.classList.remove("zping-highlight"));
    if (!job?.card) return;
    job.card.classList.add("zping-highlight");
    job.card.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function jobKey(job) {
    return job?.key || job?.url || `${job?.title}|${job?.company}|${job?.salary}|${job?.city}`;
  }

  function jobUrlId(job) {
    const boss = job?.url?.match(/job_detail\/([^./?#]+)/i)?.[1];
    if (boss) return `boss:${boss}`;
    const yupao = job?.url?.match(/\/zhaogong\/(\d+)\.html/i)?.[1];
    if (yupao) return `yupao:${yupao}`;
    return "";
  }

  async function attachCards(jobs) {
    const live = await adapter.collectJobs();
    const byId = new Map();
    const byKey = new Map();
    const byUrl = new Map();
    const titleCounts = new Map();
    live.forEach((job) => {
      const id = jobUrlId(job);
      if (id) byId.set(id, job.card);
      byKey.set(jobKey(job), job.card);
      if (job.url) byUrl.set(job.url.split("?")[0], job.card);
      if (job.title) titleCounts.set(job.title, (titleCounts.get(job.title) || 0) + 1);
    });
    const byTitle = new Map();
    live.forEach((job) => {
      if (job.title && titleCounts.get(job.title) === 1) byTitle.set(job.title, job.card);
    });
    jobs.forEach((job) => {
      const id = jobUrlId(job);
      job.card = (id && byId.get(id))
        || byKey.get(jobKey(job))
        || (job.url ? byUrl.get(job.url.split("?")[0]) : null)
        || (job.title ? byTitle.get(job.title) : null)
        || null;
      adapter.syncJobFromCard?.(job);
    });
  }

  async function prepareCurrentJob() {
    if (!session?.jobs?.length) return;
    const job = session.jobs[session.index];
    if (!job) return;
    await attachCards([job]);
  }

  async function renderJob() {
    ensurePanel();
    await prepareCurrentJob();
    const job = session.jobs[session.index];
    const meta = shadow.getElementById("meta");
    if (!job) {
      meta.textContent = "没有更多职位";
      ["company", "title", "city", "salary", "education", "tags"].forEach((id) => {
        shadow.getElementById(id).textContent = "-";
      });
      shadow.getElementById("tags-row")?.classList.add("hide");
      return;
    }
    meta.textContent = `${adapter.label} · 第 ${session.index + 1}/${session.jobs.length} 个 · 已投 ${session.applied} · 跳过 ${session.skipped}`;
    shadow.getElementById("company").textContent = job.company || "未识别";
    shadow.getElementById("title").textContent = job.title || "未识别";
    shadow.getElementById("city").textContent = job.city || "未识别";
    shadow.getElementById("salary").textContent = job.salary || "未识别";
    shadow.getElementById("education").textContent = job.education || "不限";
    const tagsRow = shadow.getElementById("tags-row");
    const tagsEl = shadow.getElementById("tags");
    if (job.tags) {
      tagsRow?.classList.remove("hide");
      tagsEl.textContent = job.tags;
    } else {
      tagsRow?.classList.add("hide");
      tagsEl.textContent = "";
    }
    setButtons("confirm");
    setStatus(job.card ? "核对信息与左侧高亮卡片一致后，点「确认投递」或按 Y。" : "未绑定到列表卡片，建议刷新页面后重新开始。");
    highlight(job);
  }

  async function waitForJobs(timeout = 12000) {
    const start = Date.now();
    let jobs = [];
    while (Date.now() - start < timeout) {
      jobs = await adapter.collectJobs();
      if (jobs.length) return jobs;
      await sleep(400);
    }
    return jobs;
  }

  async function begin(filters) {
    adapter.reset?.();
    if (filters?.platform && filters.platform !== adapter.id) {
      return { ok: false, message: `当前页面是 ${adapter.label}，请切换扩展里的平台选项。` };
    }
    if (!adapter.isListPage()) {
      return { ok: false, message: "请先打开职位列表页。" };
    }
    const cityHint = adapter.cityPageHint?.(filters) || globalThis.ZpingCities?.yupaoCityHint?.(filters.city);
    if (cityHint) {
      ensurePanel();
      setStatus(cityHint);
      return { ok: false, message: cityHint };
    }
    const raw = await waitForJobs();
    const { jobs, historySkipped } = await filterEligibleJobs(raw, filters);
    if (!jobs.length) {
      ensurePanel();
      const rule = `岗位 ${filters.keyword || "不限"}，城市 ${filters.city || "不限"}，学历 ${filters.education || "不限"}，薪资 ${filters.salaryMin ?? "不限"}-${filters.salaryMax ?? "不限"}k`;
      const hint = adapter.scanHint?.() || "";
      const historyHint = historySkipped ? `，历史去重跳过 ${historySkipped} 个` : "";
      setStatus(raw.length ? `本页 ${raw.length} 个职位都不符合当前筛选（${rule}${historyHint}）。` : `没有识别到职位。${hint}`);
      renderEmpty(raw.length);
      return { ok: false, message: raw.length ? "没有符合条件的职位。" : "没有识别到职位列表。" };
    }
    await saveSession({
      running: true,
      phase: "confirm",
      platform: adapter.id,
      jobs,
      index: 0,
      listUrl: location.href,
      page: 1,
      maxPages: filters.maxPages || 5,
      maxApply: filters.maxApply || 20,
      applied: 0,
      skipped: 0,
      records: [],
      filters,
    });
    showExportButton(false);
    await renderJob();
    const historyMsg = historySkipped ? `，已跳过历史记录 ${historySkipped} 个` : "";
    return { ok: true, message: `找到 ${jobs.length} 个职位${historyMsg}，请在页面右下角确认。` };
  }

  function renderEmpty(found) {
    shadow.getElementById("meta").textContent = found ? "筛选后为空" : "未识别到职位";
    ["company", "title", "city", "salary", "education"].forEach((id) => {
      shadow.getElementById(id).textContent = "-";
    });
  }

  function actionName() {
    return adapter.id === "yupao" ? "免费聊" : "立即沟通";
  }

  async function goNext() {
    session.index += 1;
    session.phase = "confirm";
    await saveSession(session);
    if (location.pathname.includes("/chat") && session.listUrl) {
      location.assign(session.listUrl);
      return;
    }
    await advance();
  }

  async function onYes() {
    if (applying) return;
    if (!session?.running) {
      setStatus("这轮已经停了。请回到职位列表，重新点扩展里的「在当前页开始」。");
      return;
    }
    if (session.phase === "chat-shown") {
      setStatus("正在下一条…");
      await goNext();
      return;
    }
    if (session.applied >= session.maxApply) {
      await finish("已达到最多投递数量。");
      return;
    }
    applying = true;
    setButtons("busy");
    try {
      await prepareCurrentJob();
      const job = session.jobs[session.index];
      if (typeof adapter.applyHere === "function") {
        session.phase = "opening-chat";
        await saveSession(session);
        setStatus(`第 2 步：正在打开「${job.company || "当前公司"}」并点击「${actionName()}」。`);
        const result = await adapter.applyHere(job);
        if (result === "mismatch") {
          session.phase = "confirm";
          await saveSession(session);
          setButtons("confirm");
          setStatus("右侧详情与确认框不一致，已停止投递。请核对左侧高亮卡片，或点跳过。");
          return;
        }
        if (result === "need-nav" && job?.url) {
          session.phase = "apply";
          await saveSession(session);
          location.assign(job.url);
          return;
        }
        if (result === "opened-chat" || result === "ok") {
          await addRecord(job, "已投递");
          session.applied += 1;
          session.phase = "chat-shown";
          await saveSession(session);
          await waitApplyDelay();
          setButtons("next");
          setStatus(`第 3 步：已发起沟通（${job?.title || "当前职位"}）。看完点「下一条」。`);
          return;
        }
        if (result === "already") {
          await addRecord(job, "已沟通过");
          session.skipped += 1;
          session.index += 1;
          session.phase = "confirm";
          await saveSession(session);
          setStatus("这个职位已经沟通过，正在下一条…");
          await advance();
          return;
        }
        session.phase = "confirm";
        await saveSession(session);
        setButtons("confirm");
        setStatus(result === "missing"
          ? `没找到「${actionName()}」，还停在这一条。可以再点确认投递，或点跳过。`
          : "没有发起成功，聊天记录没出现。还停在这一条，可重试或跳过。");
        if (location.pathname.includes("/chat") && session.listUrl) location.assign(session.listUrl);
        return;
      }
    if (!job?.url) {
      await addRecord(job, "已跳过");
      session.skipped += 1;
      session.index += 1;
      await saveSession(session);
      await advance();
      return;
    }
    session.phase = "apply";
    await saveSession(session);
    setStatus("正在打开职位并投递…");
    location.assign(job.url);
    } finally {
      applying = false;
    }
  }

  async function onNo() {
    try {
      if (!session?.running) {
        setStatus("这轮已经停了。请回到职位列表，重新点扩展里的「在当前页开始」。");
        return;
      }
      if (session.phase === "chat-shown") {
        setStatus("先留在当前页。要继续投递，点「下一条」。");
        return;
      }
      const skippedJob = session.jobs[session.index];
      await addRecord(skippedJob, "已跳过");
      session.skipped += 1;
      session.index += 1;
      session.phase = "confirm";
      await saveSession(session);
      setStatus("已跳过，正在下一条…");
      if (location.pathname.includes("/chat") && session.listUrl) {
        location.assign(session.listUrl);
        return;
      }
      await advance();
    } catch (error) {
      setStatus(error?.message || "跳过失败");
    }
  }

  async function stop() {
    await endRun(null, { saveExcel: true });
    document.querySelectorAll(".zping-highlight").forEach((el) => el.classList.remove("zping-highlight"));
  }

  async function finish(text) {
    await endRun(text, { saveExcel: true });
  }

  async function advance() {
    if (!session?.running) return;
    if (session.applied >= session.maxApply) {
      await finish("已达到最多投递数量。");
      return;
    }
    if (session.index < session.jobs.length) {
      session.phase = "confirm";
      await saveSession(session);
      await renderJob();
      return;
    }
    if (session.page >= session.maxPages || !adapter.clickNextPage) {
      await finish();
      return;
    }
    session.phase = "paging";
    session.page += 1;
    await saveSession(session);
    setStatus("正在翻到下一页…");
    adapter.reset?.();
    const before = location.href;
    const clicked = adapter.clickNextPage();
    if (!clicked) {
      await finish("没有下一页了。");
      return;
    }
    const start = Date.now();
    while (Date.now() - start < 15000) {
      await sleep(500);
      if (location.href !== before) return;
      const fresh = (await adapter.collectJobs()).filter((job) => !session.jobs.some((item) => jobKey(item) === jobKey(job)));
      const { jobs: matched } = await filterEligibleJobs(fresh, session.filters);
      if (matched.length) {
        session.jobs.push(...matched);
        session.listUrl = location.href;
        session.phase = "confirm";
        await saveSession(session);
        await renderJob();
        return;
      }
    }
    await finish("没有翻到新的职位。");
  }

  function findButton(pattern) {
    const nodes = [...document.querySelectorAll("a, button, span, div")];
    const hits = nodes.filter((el) => {
      const text = (el.innerText || "").trim();
      if (!text || text.length > 8 || !pattern.test(text)) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    hits.sort((a, b) => a.innerText.trim().length - b.innerText.trim().length);
    return hits[0] || null;
  }

  async function performApply() {
    ensurePanel();
    const job = session.jobs[session.index];
    shadow.getElementById("meta").textContent = "正在投递";
    if (job) {
      shadow.getElementById("company").textContent = job.company || "未识别";
      shadow.getElementById("title").textContent = job.title || "未识别";
      shadow.getElementById("city").textContent = job.city || "未识别";
      shadow.getElementById("salary").textContent = job.salary || "未识别";
      shadow.getElementById("education").textContent = job.education || "不限";
    }
    if (/login|\/web\/user/i.test(location.href)) {
      setStatus("请先登录。登录后回到职位列表，再点扩展里的「在当前页开始」。");
      await saveSession(null);
      return;
    }
    let button = null;
    const start = Date.now();
    while (Date.now() - start < 8000) {
      button = adapter.findApplyButton?.() || findButton(/立即沟通|聊一聊|免费聊|投递简历|申请职位|联系老板|继续沟通|电话直聊/);
      if (button) break;
      await sleep(400);
    }
    if (!button) {
      await addRecord(job, "投递失败");
      session.skipped += 1;
      session.index += 1;
      session.phase = "confirm";
      await saveSession(session);
      setStatus("没找到投递按钮，返回列表。");
      await sleep(800);
      if (session.listUrl) location.assign(session.listUrl);
      else history.back();
      return;
    }
    const label = button.innerText.trim();
    if (/继续沟通/.test(label)) {
      await addRecord(job, "已沟通过");
      session.skipped += 1;
      setStatus("这个职位已经沟通过，跳过。");
    } else {
      button.click();
      await sleep(1000);
      const confirm = findButton(/^确定$|^发送$|确认投递/);
      if (confirm) confirm.click();
      await addRecord(job, "已投递");
      session.applied += 1;
      await waitApplyDelay();
      setStatus("已发起沟通，返回列表。");
    }
    session.index += 1;
    session.phase = "confirm";
    await saveSession(session);
    await sleep(900);
    if (session.listUrl) location.assign(session.listUrl);
    else history.back();
  }

  async function resumeOnList() {
    await waitForJobs();
    await attachCards(session.jobs);
    if (session.phase === "paging") {
      adapter.reset?.();
      const start = Date.now();
      let matched = [];
      while (Date.now() - start < 15000) {
        const fresh = (await adapter.collectJobs()).filter((job) => !session.jobs.some((item) => jobKey(item) === jobKey(job)));
        const filtered = await filterEligibleJobs(fresh, session.filters);
        matched = filtered.jobs;
        if (matched.length) break;
        await sleep(400);
      }
      session.jobs.push(...matched);
      session.listUrl = location.href;
      session.phase = "confirm";
      await saveSession(session);
    }
    if (session.index >= session.jobs.length) {
      await advance();
      return;
    }
    await renderJob();
  }

  function recordExists(job, result) {
    const url = String(job?.url || "").split("?")[0];
    return (session?.records || []).some((row) => row.result === result && String(row.url || "").split("?")[0] === url);
  }

  async function maybeAutostart() {
    const data = await chrome.storage.local.get("autostart");
    const auto = data.autostart;
    if (!auto?.enabled || !adapter.isListPage()) return;
    if (auto.filters?.platform && auto.filters.platform !== adapter.id) return;
    const result = await begin(auto.filters);
    if (result?.ok) await chrome.storage.local.remove("autostart");
  }

  async function boot(nextAdapter) {
    if (globalThis.__ZPING_BOOTED__) return;
    globalThis.__ZPING_BOOTED__ = true;
    adapter = nextAdapter;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "ZPING_START") {
        if (!adapter.isListPage()) {
          sendResponse({ ok: false, message: "请先打开职位列表页。" });
          return false;
        }
        if (message.filters?.platform && message.filters.platform !== adapter.id) {
          sendResponse({ ok: false, message: `当前页面是 ${adapter.label}，请切换扩展里的平台选项。` });
          return false;
        }
        if (session?.running) {
          sendResponse({ ok: false, message: "已有任务进行中，请先点「停止」。" });
          return false;
        }
        ensurePanel();
        setStatus("正在扫描职位…");
        begin(message.filters)
          .then((result) => sendResponse(result || { ok: true, message: "已开始。" }))
          .catch((error) => sendResponse({ ok: false, message: error?.message || "启动失败" }));
        return true;
      }
      if (message.type === "ZPING_STOP") {
        sendResponse({ ok: true, message: "已停止。" });
        stop().catch((error) => setStatus(error?.message || "停止失败"));
        return false;
      }
      if (message.type === "ZPING_EXPORT") {
        exportExcel()
          .then(() => sendResponse({ ok: true, message: "已导出。" }))
          .catch((error) => sendResponse({ ok: false, message: error?.message || "导出失败" }));
        return true;
      }
      return false;
    });
    session = await loadSession();
    if (adapter.id === "yupao" && location.pathname.includes("/chat") && session?.running) {
      const job = session.jobs?.[session.index];
      ensurePanel();
      setStatus("正在确认有没有发起对话…");
      let opened = false;
      let empty = false;
      const waitStart = Date.now();
      while (Date.now() - waitStart < 5000) {
        const text = document.body?.innerText || "";
        opened = /发起了沟通|你向对方发起/.test(text) || (/发简历|换电话|换微信/.test(text) && !/未选中联系人/.test(text));
        empty = /暂无30天内联系人|未选中联系人/.test(text) && !opened;
        if (opened || empty) break;
        await sleep(400);
      }
      if (empty) {
        session.phase = "confirm";
        await saveSession(session);
        setStatus("聊天页是空的，没有发起成功。正在回到职位列表。");
        if (session.listUrl) location.assign(session.listUrl);
        return;
      }
      if (session.phase === "opening-chat") {
        if (job && !recordExists(job, "已投递")) {
          await addRecord(job, "已投递");
          session.applied = (session.applied || 0) + 1;
          await waitApplyDelay();
        }
        session.phase = "chat-shown";
        await saveSession(session);
      }
      if (job) {
        shadow.getElementById("meta").textContent = "对话已打开";
        shadow.getElementById("company").textContent = job.company || "未识别";
        shadow.getElementById("title").textContent = job.title || "未识别";
        shadow.getElementById("city").textContent = job.city || "未识别";
        shadow.getElementById("salary").textContent = job.salary || "未识别";
        shadow.getElementById("education").textContent = job.education || "不限";
      }
      setButtons("next");
      setStatus("第 3 步：对话已出现。看完点「下一条」，回到列表继续。");
      return;
    }
    if (session?.running && session.platform !== adapter.id) {
      ensurePanel();
      const other = session.platform === "yupao" ? "鱼泡网" : "Boss直聘";
      setStatus(`进行中的任务是 ${other}。请回到对应网站继续，或点扩展里的「停止」。`);
      return;
    }
    if (session?.running && session.platform === adapter.id) {
      const job = session.jobs[session.index];
      const here = location.href.split("?")[0];
      const list = String(session.listUrl || "").split("?")[0];
      if (session.phase === "apply" && job && here !== list) {
        await performApply();
        return;
      }
      if (adapter.isListPage()) {
        await resumeOnList();
        return;
      }
    }
    const expiredData = await chrome.storage.local.get(SESSION_EXPIRED_KEY);
    if (expiredData[SESSION_EXPIRED_KEY]) {
      await chrome.storage.local.remove(SESSION_EXPIRED_KEY);
      ensurePanel();
      setStatus("上一轮会话已过期（超过 1 小时）。请重新点扩展里的「在当前页开始」。");
    }
    await maybeAutostart();
  }

  globalThis.Zping = {
    boot,
    absUrl,
    text(root, selector) {
      return root.querySelector(selector)?.innerText?.trim() || "";
    },
  };
})();
