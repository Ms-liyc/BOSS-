/* global XLSX, chrome */
(function (global) {
  const HEADERS = [
    "筛选条件", "公司名称", "工作岗位", "工作地点", "学历要求", "工资",
    "职位标签", "是否投递", "处理时间", "职位链接", "JD详情",
  ];

  const LEDGER_KEYS = {
    boss: "zping_xlsx_boss",
    yupao: "zping_xlsx_yupao",
  };

  const FILENAMES = {
    boss: "BOSS直聘列表.xlsx",
    yupao: "鱼泡网列表.xlsx",
  };

  const MAX_LEDGER = 3000;
  const MAX_DETAIL_STORE = 8000;
  const queue = global.ZpingStorageQueue?.enqueue || ((task) => task());

  const COLOR = {
    greenFont: "FF15803D",
    greenFill: "FFE8F5E9",
    redFont: "FFDC2626",
    redFill: "FFFFECEC",
    orangeFont: "FFC2410C",
    orangeFill: "FFFFF7ED",
  };

  function formatAppliedStatus(result) {
    if (result === "已投递") return "是";
    if (result === "已沟通过") return "已沟通过";
    if (result === "投递失败") return "投递失败";
    return "否";
  }

  function normalizeCompany(name) {
    return String(name || "")
      .replace(/（第一次）|（重复）|\(第一次\)|\(重复\)/g, "")
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();
  }

  function platformKey(platform) {
    const value = String(platform || "").toLowerCase();
    if (value === "yupao" || value.includes("鱼泡")) return "yupao";
    return "boss";
  }

  function exportFilename(platform) {
    return FILENAMES[platformKey(platform)] || FILENAMES.boss;
  }

  function recordKey(row) {
    const url = String(row?.url || "").split("?")[0].trim();
    if (url) return url;
    return `${row?.title || ""}|${row?.company || ""}|${row?.time || ""}`;
  }

  function mergeRecords(existing, incoming) {
    const map = new Map();
    (existing || []).forEach((row) => map.set(recordKey(row), row));
    (incoming || []).forEach((row) => map.set(recordKey(row), row));
    return Array.from(map.values());
  }

  function isEncryptedBossSalary(text) {
    const value = String(text ?? "");
    if (/[\uE000-\uF8FF]/.test(value)) return true;
    if (/[kK千]|万|元/.test(value) && !/\d/.test(value)) return true;
    return false;
  }

  function sanitizeSalary(value) {
    const text = String(value ?? "").trim();
    if (!text || isEncryptedBossSalary(text)) return "面议";
    return text;
  }

  function sanitizeExcelValue(value) {
    const text = String(value ?? "");
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
  }

  function textCell(value) {
    return { v: sanitizeExcelValue(value), t: "s" };
  }

  function styledCell(value, kind) {
    const palette = {
      green: [COLOR.greenFont, COLOR.greenFill],
      red: [COLOR.redFont, COLOR.redFill],
      orange: [COLOR.orangeFont, COLOR.orangeFill],
    };
    const [font, fill] = palette[kind] || palette.red;
    return {
      v: sanitizeExcelValue(value),
      t: "s",
      s: {
        font: { bold: true, color: { rgb: font } },
        fill: { patternType: "solid", fgColor: { rgb: fill } },
      },
    };
  }

  function buildCompanyCell(company, seenCompanies) {
    const raw = String(company || "").trim();
    const key = normalizeCompany(raw) || "__unknown__";
    const duplicate = seenCompanies.has(key);
    seenCompanies.add(key);
    const label = raw || "未识别";
    const text = duplicate ? `${label}（重复）` : `${label}（第一次）`;
    return styledCell(text, duplicate ? "red" : "green");
  }

  function buildAppliedCell(result) {
    const text = formatAppliedStatus(result);
    if (text === "是") return styledCell(text, "green");
    if (text === "已沟通过") return styledCell(text, "orange");
    if (text === "否") return styledCell(text, "red");
    return styledCell(text, "red");
  }

  function parseRecordTime(text) {
    const value = Date.parse(String(text || "").replace(/-/g, "/"));
    return Number.isFinite(value) ? value : 0;
  }

  function sortRecordsByTime(records) {
    return [...(records || [])].sort((a, b) => parseRecordTime(a.time) - parseRecordTime(b.time));
  }

  function buildFilterSummary(row) {
    const parts = [];
    if (row.filterCity) parts.push(row.filterCity);
    if (row.filterKeyword) parts.push(row.filterKeyword);
    if (row.filterEducation && row.filterEducation !== "不限") parts.push(row.filterEducation);
    if (row.filterSalary && row.filterSalary !== "不限") parts.push(row.filterSalary);
    if (row.filterCompanies) parts.push(`公司:${row.filterCompanies}`);
    if (row.filterExclude) parts.push(`排除公司:${row.filterExclude}`);
    if (row.filterExcludeTitle) parts.push(`排除岗位:${row.filterExcludeTitle}`);
    if (row.filterRequiredTags) parts.push(`标签:${row.filterRequiredTags}`);
    if (row.filterSkipNegotiable) parts.push(row.filterSkipNegotiable);
    return parts.join(" · ") || "不限";
  }

  function buildJobDetailText(row) {
    return row.detail ? String(row.detail) : "";
  }

  function buildExportRows(data) {
    const seenCompanies = new Set();
    const rows = (data?.records || []).map((row) => [
      buildFilterSummary(row),
      buildCompanyCell(row.company, seenCompanies),
      row.title || "",
      row.city || "",
      row.education || "不限",
      sanitizeSalary(row.salary),
      row.tags || "",
      buildAppliedCell(row.result),
      row.time || "",
      row.url || "",
      buildJobDetailText(row),
    ]);
    return [HEADERS.map((h) => textCell(h)), ...rows];
  }

  async function clearLedger(platform) {
    const key = platformKey(platform);
    await chrome.storage.local.remove(LEDGER_KEYS[key]);
  }

  function writeWorkbook(records, platform) {
    if (!global.XLSX) throw new Error("Excel 导出库未加载，请重新加载扩展。");
    if (!records?.length) throw new Error("没有可导出的记录。请先完成一轮投递。");

    const rows = buildExportRows({ records: sortRecordsByTime(records) });
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 36 },
      { wch: 28 },
      { wch: 20 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 24 },
      { wch: 12 },
      { wch: 18 },
      { wch: 42 },
      { wch: 64 },
    ];

    const book = XLSX.utils.book_new();
    const sheetName = platformKey(platform) === "yupao" ? "鱼泡网列表" : "BOSS直聘列表";
    XLSX.utils.book_append_sheet(book, sheet, sheetName);
    XLSX.writeFile(book, exportFilename(platform));
    return records.length;
  }

  async function loadLedger(platform) {
    const key = platformKey(platform);
    const storageKey = LEDGER_KEYS[key];
    const data = await chrome.storage.local.get(storageKey);
    return data[storageKey]?.records || [];
  }

  function trimRecords(records) {
    const trimmed = (records || []).map((row) => ({
      ...row,
      detail: row.detail ? String(row.detail).slice(0, MAX_DETAIL_STORE) : row.detail,
    }));
    if (trimmed.length <= MAX_LEDGER) return trimmed;
    return sortRecordsByTime(trimmed).slice(-MAX_LEDGER);
  }

  async function saveLedger(platform, records) {
    const key = platformKey(platform);
    const safe = trimRecords(records);
    await chrome.storage.local.set({
      [LEDGER_KEYS[key]]: {
        records: safe,
        updatedAt: Date.now(),
      },
    });
    return safe;
  }

  async function appendToLedger(platform, records) {
    if (!records?.length) return await loadLedger(platform);
    return queue(async () => {
      const merged = mergeRecords(await loadLedger(platform), records);
      return saveLedger(platform, merged);
    });
  }

  async function downloadLedger(platform, records) {
    const list = records || await loadLedger(platform);
    return writeWorkbook(list, platform);
  }

  async function appendAndDownload(platform, records) {
    const merged = await appendToLedger(platform, records);
    return writeWorkbook(merged, platform);
  }

  /** @deprecated 兼容旧调用，优先写入对应平台累计表再导出 */
  async function downloadZpingXlsx(data) {
    const platform = data?.platform || data?.records?.[0]?.platform || "boss";
    const records = data?.records || [];
    if (!records.length) throw new Error("没有可导出的记录。请先完成一轮投递。");
    return appendAndDownload(platform, records);
  }

  global.ZpingExport = {
    downloadZpingXlsx,
    downloadLedger,
    appendToLedger,
    appendAndDownload,
    clearLedger,
    loadLedger,
    mergeRecords,
    sortRecordsByTime,
    buildExportRows,
    buildFilterSummary,
    buildJobDetailText,
    exportFilename,
    platformKey,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
