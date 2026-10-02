(function (global) {
  const KEY = "zping_history";
  const MAX_JOBS = 4000;
  const BLOCK_RESULTS = new Set(["已投递", "已跳过", "已沟通过"]);

  function normalizeCompany(name) {
    return String(name || "").replace(/\s+/g, "").trim().toLowerCase();
  }

  function jobId(job) {
    const url = String(job?.url || "").split("?")[0];
    if (url) return url;
    return String(job?.key || "").trim();
  }

  async function load() {
    const data = await chrome.storage.local.get(KEY);
    return data[KEY] || { jobs: {}, companies: {} };
  }

  async function save(data) {
    const jobs = Object.entries(data.jobs || {});
    if (jobs.length > MAX_JOBS) {
      jobs.sort((a, b) => (b[1]?.time || 0) - (a[1]?.time || 0));
      data.jobs = Object.fromEntries(jobs.slice(0, MAX_JOBS));
    }
    await chrome.storage.local.set({ [KEY]: data });
  }

  async function isBlocked(job, options = {}) {
    const history = await load();
    const id = jobId(job);
    if (id && history.jobs[id]) {
      return { blocked: true, reason: history.jobs[id].result, kind: "job" };
    }
    if (options.skipCompany) {
      const company = normalizeCompany(job?.company);
      if (company && history.companies[company]) {
        return { blocked: true, reason: history.companies[company].result, kind: "company" };
      }
    }
    return { blocked: false };
  }

  async function remember(job, result, platform, options = {}) {
    if (!job) return;
    const history = await load();
    const id = jobId(job);
    const entry = {
      result,
      company: job.company || "",
      title: job.title || "",
      platform: platform || "",
      time: Date.now(),
    };
    if (id) history.jobs[id] = entry;
    if (options.skipCompany) {
      const company = normalizeCompany(job.company);
      if (company && BLOCK_RESULTS.has(result)) {
        history.companies[company] = { result, time: Date.now() };
      }
    }
    await save(history);
  }

  async function clear() {
    await chrome.storage.local.remove(KEY);
  }

  async function count() {
    const history = await load();
    return {
      jobs: Object.keys(history.jobs || {}).length,
      companies: Object.keys(history.companies || {}).length,
    };
  }

  global.ZpingHistory = { isBlocked, remember, load, clear, count, normalizeCompany, jobId };
})(typeof globalThis !== "undefined" ? globalThis : window);
