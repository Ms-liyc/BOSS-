(() => {
  if (globalThis.__ZPING_BOSS__) return;
  globalThis.__ZPING_BOSS__ = true;

  const EDU_RE = /博士|硕士|本科|大专|高中|中专|中技|初中/;
  let scanHint = "";
  let cache = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function cards() {
    const found = [...document.querySelectorAll(".job-card-box, .job-card-wrapper, .job-card-wrap")];
    return found.length ? found : [...document.querySelectorAll("li")].filter((el) => el.querySelector(".job-name, .job-salary, a[href*='job_detail']"));
  }

  function askApi() {
    const params = new URL(location.href).searchParams;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve({ jobs: [], message: "读取职位接口超时" });
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
      }, "*");
    });
  }

  function toJob(raw, card) {
    const labels = Array.isArray(raw.jobLabels) ? raw.jobLabels.join(" ") : "";
    const education = raw.jobDegree || labels.match(EDU_RE)?.[0] || "不限";
    const city = [raw.cityName, raw.areaDistrict, raw.businessDistrict].filter(Boolean).join("·");
    const title = raw.jobName || "";
    const company = raw.brandName || "";
    const salary = raw.salaryDesc || "面议";
    return {
      title,
      company,
      city,
      salary,
      education: /不限/.test(education) ? "不限" : education,
      url: raw.encryptJobId ? `https://www.zhipin.com/job_detail/${raw.encryptJobId}.html` : "",
      key: raw.encryptJobId || `${title}|${company}|${salary}|${city}`,
      card: card || null,
    };
  }

  async function collectJobs() {
    if (!cache) {
      const result = await askApi();
      cache = result.jobs;
      scanHint = cache.length ? "" : (result.message || "没有读到职位数据");
    }
    const nodes = cards();
    return cache.map((raw, index) => toJob(raw, nodes[index] || null)).filter((job) => job.title);
  }

  function findChatButton() {
    const hits = [...document.querySelectorAll("button, a, div, span")].filter((el) => {
      const text = (el.innerText || "").trim();
      if (text !== "立即沟通" && text !== "继续沟通") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 36 && rect.height > 16;
    });
    return hits[0] || null;
  }

  function bossMessageSent() {
    return /已向BOSS发送消息|已向Boss发送消息/.test(document.body?.innerText || "");
  }

  function clickStay() {
    const stay = [...document.querySelectorAll("button, a, div, span")].find((el) => {
      if (el.closest("#zping-host")) return false;
      return (el.innerText || "").trim() === "留在此页" && el.getBoundingClientRect().width > 0;
    });
    stay?.click();
  }

  async function applyHere(job) {
    if (!job?.card) return job?.url ? "need-nav" : "missing";
    job.card.scrollIntoView({ block: "center", behavior: "smooth" });
    const titleEl = job.card.querySelector(".job-name") || job.card;
    titleEl.click();
    await sleep(700);
    const button = findChatButton();
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

  function clickNextPage() {
    return false;
  }

  Zping.boot({
    id: "boss",
    label: "Boss直聘",
    isListPage: () => location.pathname.includes("/web/geek/job"),
    isDetailPage: () => location.pathname.includes("job_detail"),
    collectJobs,
    scanHint: () => scanHint,
    findApplyButton: findChatButton,
    applyHere,
    clickNextPage,
    reset() {
      cache = null;
    },
  });
})();
