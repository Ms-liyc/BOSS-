(function (global) {
  const VERSION = 1;
  const KEYS = [
    "zping_history",
    "zping_presets",
    "filters",
    "zping_xlsx_boss",
    "zping_xlsx_yupao",
  ];

  function stamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  async function collect() {
    const data = await chrome.storage.local.get(KEYS);
    return {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      app: "Zping",
      data,
    };
  }

  function download(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zping-backup-${stamp()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportBackup() {
    const payload = await collect();
    download(payload);
    const history = payload.data.zping_history;
    const boss = payload.data.zping_xlsx_boss?.records?.length || 0;
    const yupao = payload.data.zping_xlsx_yupao?.records?.length || 0;
    const jobs = history ? Object.keys(history.jobs || {}).length : 0;
    return { jobs, boss, yupao };
  }

  function mergeHistory(existing, incoming) {
    const out = {
      jobs: { ...(existing?.jobs || {}) },
      companies: { ...(existing?.companies || {}) },
    };
    const jobs = incoming?.jobs || {};
    const companies = incoming?.companies || {};
    Object.entries(jobs).forEach(([id, entry]) => {
      const prev = out.jobs[id];
      if (!prev || (entry?.time || 0) >= (prev?.time || 0)) out.jobs[id] = entry;
    });
    Object.entries(companies).forEach(([name, entry]) => {
      const prev = out.companies[name];
      if (!prev || (entry?.time || 0) >= (prev?.time || 0)) out.companies[name] = entry;
    });
    return out;
  }

  function mergeLedger(existing, incoming) {
    const map = new Map();
    const add = (row) => {
      const key = String(row?.url || "").split("?")[0] || `${row?.title}|${row?.company}|${row?.time}`;
      map.set(key, row);
    };
    (existing?.records || []).forEach(add);
    (incoming?.records || []).forEach(add);
    return { records: Array.from(map.values()), updatedAt: Date.now() };
  }

  async function importBackup(file, mode = "merge") {
    const text = await file.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("备份文件格式无效，请选择 Zping 导出的 JSON。");
    }
    if (!payload?.data || typeof payload.data !== "object") {
      throw new Error("备份文件缺少 data 字段。");
    }

    const incoming = payload.data;
    const patch = {};

    if (mode === "replace") {
      KEYS.forEach((key) => {
        if (incoming[key] !== undefined) patch[key] = incoming[key];
      });
    } else {
      const current = await chrome.storage.local.get(KEYS);
      patch.zping_history = mergeHistory(current.zping_history, incoming.zping_history);
      if (incoming.zping_presets) {
        patch.zping_presets = { ...(current.zping_presets || {}), ...(incoming.zping_presets || {}) };
      }
      if (incoming.filters) patch.filters = incoming.filters;
      if (incoming.zping_xlsx_boss) {
        patch.zping_xlsx_boss = mergeLedger(current.zping_xlsx_boss, incoming.zping_xlsx_boss);
      }
      if (incoming.zping_xlsx_yupao) {
        patch.zping_xlsx_yupao = mergeLedger(current.zping_xlsx_yupao, incoming.zping_xlsx_yupao);
      }
    }

    await chrome.storage.local.set(patch);
    const history = patch.zping_history || incoming.zping_history;
    return {
      jobs: Object.keys(history?.jobs || {}).length,
      boss: (patch.zping_xlsx_boss || incoming.zping_xlsx_boss)?.records?.length || 0,
      yupao: (patch.zping_xlsx_yupao || incoming.zping_xlsx_yupao)?.records?.length || 0,
    };
  }

  global.ZpingBackup = { exportBackup, importBackup, VERSION };
})(typeof globalThis !== "undefined" ? globalThis : window);
