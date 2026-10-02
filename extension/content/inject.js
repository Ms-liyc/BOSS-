(() => {
  if (window.__zpingHooked) return;
  window.__zpingHooked = true;

  let lastJobs = [];

  function takeList(data) {
    const list = data?.zpData?.jobList || data?.zpData?.list;
    if (!Array.isArray(list) || !list.length) return false;
    if (!list[0] || (!list[0].jobName && !list[0].salaryDesc)) return false;
    lastJobs = list;
    return true;
  }

  function publish(jobs, message) {
    window.postMessage({ source: "zping", type: "jobs-result", jobs, message: message || "" }, "*");
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const input = args[0];
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("/wapi/zpgeek/")) {
        response.clone().json().then(takeList).catch(() => {});
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
        if (!String(this.__zpingUrl || "").includes("/wapi/zpgeek/")) return;
        takeList(JSON.parse(this.responseText));
      } catch {
        /* 非职位接口 */
      }
    });
    return originalSend.apply(this, args);
  };

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data?.source !== "zping-ask") return;
    if (lastJobs.length) {
      publish(lastJobs, "");
      return;
    }
    const query = event.data.query || "";
    const city = event.data.city || "";
    const urls = [
      `/wapi/zpgeek/search/joblist.json?scene=1&query=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}&page=1&pageSize=15`,
      `/wapi/zpgeek/pc/recommend/job/list.json?page=1&pageSize=15&city=${encodeURIComponent(city)}&encryptExpectId=&mixExpectType=&expectInfo=&jobType=&salary=&experience=&degree=&industry=&scale=`,
    ];
    let message = "没有从接口拿到职位";
    for (const url of urls) {
      try {
        const response = await originalFetch(url, { credentials: "include" });
        const data = await response.json();
        if (takeList(data)) {
          publish(lastJobs, "");
          return;
        }
        message = data?.message || `接口返回 ${data?.code}`;
      } catch (error) {
        message = error?.message || message;
      }
    }
    publish([], message);
  });
})();
