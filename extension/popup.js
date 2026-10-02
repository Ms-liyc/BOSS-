const CITIES = [
  "全国", "北京", "上海", "广州", "深圳", "杭州", "成都", "南京", "武汉",
  "西安", "苏州", "天津", "重庆", "长沙", "郑州", "青岛", "厦门", "合肥",
  "东莞", "佛山",
];

const BOSS_CITY = {
  全国: "100010000",
  北京: "101010100",
  上海: "101020100",
  广州: "101280100",
  深圳: "101280600",
  杭州: "101210100",
  成都: "101270100",
  南京: "101190100",
  武汉: "101200100",
  西安: "101110100",
  苏州: "101190400",
  天津: "101030100",
  重庆: "101040100",
  长沙: "101250100",
  郑州: "101180100",
  青岛: "101120200",
  厦门: "101230200",
  合肥: "101220100",
  东莞: "101281600",
  佛山: "101280800",
};

const DEFAULTS = {
  platform: "boss",
  keyword: "Python开发",
  city: "北京",
  salaryMin: 10,
  salaryMax: 30,
  education: "本科",
  companies: "",
  exclude: "",
  maxApply: 20,
  maxPages: 5,
};

const form = document.getElementById("form");
const message = document.getElementById("message");

function fillCities() {
  const select = form.city;
  CITIES.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    select.appendChild(option);
  });
}

function readFilters() {
  const data = new FormData(form);
  return {
    platform: data.get("platform"),
    keyword: String(data.get("keyword") || "").trim(),
    city: data.get("city"),
    salaryMin: numberOrNull(data.get("salaryMin")),
    salaryMax: numberOrNull(data.get("salaryMax")),
    education: data.get("education") || "",
    companies: String(data.get("companies") || "").trim(),
    exclude: String(data.get("exclude") || "").trim(),
    maxApply: Math.max(1, Number(data.get("maxApply")) || 20),
    maxPages: Math.max(1, Number(data.get("maxPages")) || 5),
  };
}

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function writeFilters(filters) {
  Object.entries(filters).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
}

function setMessage(text, isError) {
  message.textContent = text;
  message.className = isError ? "error" : "";
}

function searchUrl(filters) {
  const keyword = encodeURIComponent(filters.keyword || "");
  if (filters.platform === "yupao") {
    return ZpingCities.yupaoSearchUrl(filters.city, filters.keyword);
  }
  const city = BOSS_CITY[filters.city] || BOSS_CITY["北京"];
  return `https://www.zhipin.com/web/geek/job?query=${keyword}&city=${city}`;
}

function onListPage(url, platform) {
  if (platform === "yupao") return /yupao\.com/i.test(url) && !/\/zhaogong\/\d+\.html/i.test(url);
  return /zhipin\.com/i.test(url) && url.includes("/web/geek/job");
}

function scriptFiles(platform) {
  return platform === "yupao"
    ? ["content/common.js", "content/yupao.js"]
    : ["content/common.js", "content/boss.js"];
}

async function sendToTab(tab, filters, type) {
  const message = { type, filters };
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: scriptFiles(filters.platform),
    });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("找不到当前标签页");
  return tab;
}

async function startHere() {
  const filters = readFilters();
  await chrome.storage.local.set({ filters });
  const tab = await activeTab();
  if (!onListPage(tab.url, filters.platform)) {
    setMessage("请先打开对应网站的职位列表，或使用「打开搜索页并开始」。", true);
    return;
  }
  const result = await sendToTab(tab, filters, "ZPING_START");
  setMessage(result?.message || "已开始，请看页面右下角确认框。");
  if (result?.ok) window.close();
}

async function startSearch() {
  const filters = readFilters();
  await chrome.storage.local.set({ filters });
  await chrome.storage.local.set({ autostart: { enabled: true, filters } });
  const tab = await activeTab();
  await chrome.tabs.update(tab.id, { url: searchUrl(filters) });
  setMessage("正在打开搜索页，列表出来后会自动开始。");
}

async function stop() {
  const filters = readFilters();
  const tab = await activeTab();
  try {
    await sendToTab(tab, filters, "ZPING_STOP");
    setMessage("已停止。");
  } catch (error) {
    setMessage(error.message || "停止失败", true);
  }
}

fillCities();

chrome.storage.local.get("filters").then(({ filters }) => {
  writeFilters({ ...DEFAULTS, ...(filters || {}) });
});

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (!tab?.url) return;
  if (tab.url.includes("yupao.com")) form.platform.value = "yupao";
  if (tab.url.includes("zhipin.com")) form.platform.value = "boss";
});

document.getElementById("start-here").addEventListener("click", () => {
  startHere().catch((error) => setMessage(error.message, true));
});
document.getElementById("start-search").addEventListener("click", () => {
  startSearch().catch((error) => setMessage(error.message, true));
});
document.getElementById("stop").addEventListener("click", () => {
  stop().catch((error) => setMessage(error.message, true));
});
async function exportExcel() {
  const { zping_export: data } = await chrome.storage.local.get("zping_export");
  if (!data?.records?.length) {
    setMessage("没有可导出的记录。请先完成一轮投递。", true);
    return;
  }
  const count = ZpingExport.downloadZpingXlsx(data);
  setMessage(`已导出 ${count} 条记录为 .xlsx 文件。`);
}

document.getElementById("export").addEventListener("click", () => {
  exportExcel().catch((error) => setMessage(error.message, true));
});
chrome.storage.local.get("zping_export").then(({ zping_export }) => {
  if (zping_export?.records?.length) {
    setMessage(`上次共 ${zping_export.records.length} 条记录，可点「导出 Excel」。`);
  }
});
