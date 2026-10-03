const PRESET_KEY = "zping_presets";
const CITIES = ZpingCities.CITIES;

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
  applyDelay: 3,
  skipCompanyHistory: false,
};

const form = document.getElementById("form");
const message = document.getElementById("message");
const statusBar = document.getElementById("status-bar");
let saveTimer = null;

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
    applyDelay: Math.max(0, Number(data.get("applyDelay")) || 0),
    skipCompanyHistory: Boolean(form.elements.skipCompanyHistory?.checked),
  };
}

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function writeFilters(filters) {
  Object.entries(filters).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value ?? "";
  });
}

function setMessage(text, isError) {
  message.textContent = text;
  message.className = isError ? "error" : "";
}

function setStatusBar(text, kind) {
  statusBar.textContent = text;
  statusBar.className = `status-bar${kind ? ` ${kind}` : ""}`;
}

function searchUrl(filters) {
  if (filters.platform === "yupao") {
    return ZpingCities.yupaoSearchUrl(filters.city, filters.keyword);
  }
  return ZpingCities.bossSearchUrl(filters.city, filters.keyword);
}

function onListPage(url, platform) {
  return ZpingCities.isListPage(url, platform);
}

function ensurePlatformMatch(tabUrl, filters) {
  const detected = ZpingCities.platformForUrl(tabUrl);
  if (detected && detected !== filters.platform) {
    const name = detected === "yupao" ? "鱼泡网" : "Boss直聘";
    throw new Error(`当前页面是 ${name}，请把扩展里的平台切换为 ${name}。`);
  }
}

function scriptFiles(platform) {
  const shared = ["lib/cities.js", "lib/storage-queue.js", "lib/history.js", "lib/xlsx.bundle.js", "lib/zping-export.js", "content/common.js"];
  return platform === "yupao"
    ? [...shared, "content/yupao.js"]
    : [...shared, "content/boss.js"];
}

async function injectBoss(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content/inject.js"],
    world: "MAIN",
  });
}

async function sendToTab(tab, filters, type) {
  if (!ZpingCities.isAllowedHost(tab.url, filters.platform)) {
    throw new Error("只能在 Boss 或鱼泡官网页面使用本扩展");
  }
  const payload = { type, filters };
  try {
    return await chrome.tabs.sendMessage(tab.id, payload);
  } catch (error) {
    if (!ZpingCities.isAllowedHost(tab.url, filters.platform)) {
      throw new Error("只能在 Boss 或鱼泡官网页面使用本扩展");
    }
    if (filters.platform === "boss") {
      try {
        await injectBoss(tab.id);
      } catch {
        /* inject 可能已存在 */
      }
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: scriptFiles(filters.platform),
    });
    return chrome.tabs.sendMessage(tab.id, payload);
  }
}

async function activeTab(filters) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("找不到当前标签页");
  if (!/^https?:/i.test(tab.url)) throw new Error("请先打开 Boss 或鱼泡的招聘网页");
  if (filters && !ZpingCities.isAllowedHost(tab.url, filters.platform)) {
    throw new Error(`请先打开${filters.platform === "yupao" ? "鱼泡" : "Boss"}官网页面`);
  }
  return tab;
}

function scheduleSaveFilters() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ filters: readFilters() });
  }, 400);
}

async function refreshDashboard() {
  const [sessionData, boss, yupao, history] = await Promise.all([
    chrome.storage.local.get("session"),
    ZpingExport.loadLedger("boss"),
    ZpingExport.loadLedger("yupao"),
    ZpingHistory.count(),
  ]);
  const session = sessionData.session;
  const ledgerParts = [];
  if (boss.length) ledgerParts.push(`Boss ${boss.length}`);
  if (yupao.length) ledgerParts.push(`鱼泡 ${yupao.length}`);
  const ledgerText = ledgerParts.length ? `累计 ${ledgerParts.join("，")}` : "暂无 Excel 记录";
  const historyText = `去重 ${history.jobs} 职位`;
  if (session?.running) {
    const platform = session.platform === "yupao" ? "鱼泡" : "Boss";
    setStatusBar(`进行中 · ${platform} · 已投 ${session.applied || 0} · 跳过 ${session.skipped || 0} · ${ledgerText}`, "running");
    return;
  }
  setStatusBar(`${ledgerText} · ${historyText}`, "");
}

async function loadPresets() {
  const data = await chrome.storage.local.get(PRESET_KEY);
  return data[PRESET_KEY] || {};
}

async function refreshPresetSelect() {
  const presets = await loadPresets();
  const select = document.getElementById("preset-select");
  const current = select.value;
  select.innerHTML = '<option value="">-- 选择方案 --</option>';
  Object.keys(presets).sort().forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
  if (current && presets[current]) select.value = current;
}

async function startHere() {
  const filters = readFilters();
  await chrome.storage.local.set({ filters });
  const tab = await activeTab(filters);
  ensurePlatformMatch(tab.url, filters);
  if (!onListPage(tab.url, filters.platform)) {
    setMessage("请先打开对应网站的职位列表，或使用「打开搜索页并开始」。", true);
    return;
  }
  const result = await sendToTab(tab, filters, "ZPING_START");
  setMessage(result?.message || "已开始，请看页面右下角确认框。");
  if (result?.ok) {
    await refreshDashboard();
    window.close();
  }
}

async function startSearch() {
  const filters = readFilters();
  await chrome.storage.local.set({ filters, autostart: { enabled: true, filters } });
  const tab = await activeTab(filters);
  ensurePlatformMatch(tab.url, filters);
  await chrome.tabs.update(tab.id, { url: searchUrl(filters) });
  setMessage("正在打开搜索页，列表出来后会自动开始。");
}

async function stop() {
  const filters = readFilters();
  const tab = await activeTab(filters);
  ensurePlatformMatch(tab.url, filters);
  try {
    await sendToTab(tab, filters, "ZPING_STOP");
    setMessage("已停止。");
    await refreshDashboard();
  } catch (error) {
    setMessage(error.message || "停止失败", true);
  }
}

async function exportExcel() {
  const filters = readFilters();
  const platform = filters.platform === "yupao" ? "yupao" : "boss";
  const records = await ZpingExport.loadLedger(platform);
  if (!records.length) {
    setMessage("该平台尚无记录。请先完成一轮投递。", true);
    return;
  }
  const count = await ZpingExport.downloadLedger(platform, records);
  const name = ZpingExport.exportFilename(platform);
  setMessage(`已更新 ${name}，累计 ${count} 条。`);
}

async function clearHistory() {
  if (!confirm("确定清除所有去重记录？已投/已跳过的职位将不再自动过滤。")) return;
  await ZpingHistory.clear();
  setMessage("已清除去重记录。");
  await refreshDashboard();
}

async function clearLedger() {
  const filters = readFilters();
  const platform = filters.platform === "yupao" ? "yupao" : "boss";
  const name = ZpingExport.exportFilename(platform);
  if (!confirm(`确定清空 ${name} 的累计记录？此操作不可恢复。`)) return;
  await ZpingExport.clearLedger(platform);
  setMessage(`已清空 ${name} 的累计记录。`);
  await refreshDashboard();
}

fillCities();
refreshPresetSelect();

chrome.storage.local.get("filters").then(({ filters }) => {
  writeFilters({ ...DEFAULTS, ...(filters || {}) });
  refreshDashboard();
});

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (!tab?.url) return;
  const detected = ZpingCities.platformForUrl(tab.url);
  if (detected) form.platform.value = detected;
});

form.addEventListener("change", scheduleSaveFilters);
form.addEventListener("input", scheduleSaveFilters);

document.getElementById("start-here").addEventListener("click", () => {
  startHere().catch((error) => setMessage(error.message, true));
});
document.getElementById("start-search").addEventListener("click", () => {
  startSearch().catch((error) => setMessage(error.message, true));
});
document.getElementById("stop").addEventListener("click", () => {
  stop().catch((error) => setMessage(error.message, true));
});
document.getElementById("export").addEventListener("click", () => {
  exportExcel().catch((error) => setMessage(error.message, true));
});
document.getElementById("clear-history").addEventListener("click", () => {
  clearHistory().catch((error) => setMessage(error.message, true));
});
document.getElementById("clear-ledger").addEventListener("click", () => {
  clearLedger().catch((error) => setMessage(error.message, true));
});

document.getElementById("preset-select").addEventListener("change", async () => {
  const name = document.getElementById("preset-select").value;
  if (!name) return;
  const presets = await loadPresets();
  if (!presets[name]) return;
  writeFilters(presets[name]);
  await chrome.storage.local.set({ filters: presets[name] });
  setMessage(`已切换至「${name}」`);
});

document.getElementById("preset-save").addEventListener("click", async () => {
  const name = prompt("方案名称（如：成都 Python）");
  if (!name?.trim()) return;
  const presets = await loadPresets();
  presets[name.trim()] = readFilters();
  await chrome.storage.local.set({ [PRESET_KEY]: presets });
  await refreshPresetSelect();
  document.getElementById("preset-select").value = name.trim();
  setMessage(`已保存方案「${name.trim()}」`);
});

document.getElementById("preset-delete").addEventListener("click", async () => {
  const name = document.getElementById("preset-select").value;
  if (!name) {
    setMessage("请先选择要删除的方案", true);
    return;
  }
  if (!confirm(`确定删除方案「${name}」？`)) return;
  const presets = await loadPresets();
  delete presets[name];
  await chrome.storage.local.set({ [PRESET_KEY]: presets });
  await refreshPresetSelect();
  setMessage(`已删除「${name}」`);
});
