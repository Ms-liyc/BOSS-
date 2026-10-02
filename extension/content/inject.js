(() => {
  if (window.__zpingHooked) return;
  window.__zpingHooked = true;

  let lastJobs = [];
  let lastUrl = "";

  function normalizeItem(item) {
    if (!item || typeof item !== "object") return null;
    const title = item.jobName || item.title || item.name;
    const salary = item.salaryDesc || item.salary || item.salaryMonth;
    if (!title && !salary) return null;
    return item;
  }

  function extractList(data) {
    const zp = data?.zpData;
    const candidates = [
      zp?.jobList,
      zp?.list,
      zp?.cardList,
      zp?.jobs,
      data?.jobList,
      data?.list,
    ];
    for (const list of candidates) {
      if (!Array.isArray(list) || !list.length) continue;
      const normalized = list.map(normalizeItem).filter(Boolean);
      if (normalized.length) return normalized;
    }
    return null;
  }

  function takeList(data, url) {
    const list = extractList(data);
    if (!list) return false;
    lastJobs = list;
    lastUrl = String(url || "");
    return true;
  }

  function publish(jobs, message) {
    window.postMessage({ source: "zping", type: "jobs-result", jobs, message: message || "" }, "*");
  }

  function shouldWatch(url) {
    return /\/wapi\/zpgeek\//i.test(String(url || ""));
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const input = args[0];
      const url = typeof input === "string" ? input : input?.url || "";
      if (shouldWatch(url)) {
        response.clone().json().then((data) => takeList(data, url)).catch(() => {});
      }
    } catch {
      /* 页面自己的请求失败时不要影响原逻辑 */
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__zpingUrl = String(url || "");
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        if (!shouldWatch(this.__zpingUrl)) return;
        takeList(JSON.parse(this.responseText), this.__zpingUrl);
      } catch {
        /* 非职位接口 */
      }
    });
    return originalSend.apply(this, args);
  };

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data?.source !== "zping-ask") return;
    const query = event.data.query || "";
    const city = event.data.city || "";
    const page = Number(event.data.page) || 1;
    const force = Boolean(event.data.force);
    if (!force && page === 1 && lastJobs.length) {
      publish(lastJobs, "");
      return;
    }
    const urls = [
      `/wapi/zpgeek/search/joblist.json?scene=1&query=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}&page=${page}&pageSize=30`,
      `/wapi/zpgeek/pc/recommend/job/list.json?page=${page}&pageSize=30&city=${encodeURIComponent(city)}&encryptExpectId=&mixExpectType=&expectInfo=&jobType=&salary=&experience=&degree=&industry=&scale=`,
    ];
    let message = "没有从接口拿到职位";
    for (const url of urls) {
      try {
        const response = await originalFetch(url, { credentials: "include" });
        const data = await response.json();
        if (takeList(data, url)) {
          publish(lastJobs, "");
          return;
        }
        message = data?.message || data?.zpData?.message || `接口返回 ${data?.code}`;
      } catch (error) {
        message = error?.message || message;
      }
    }
    publish([], message);
  });
})();
