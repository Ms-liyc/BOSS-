/* global XLSX */
(function (global) {
  const HEADERS = [
    "招牌公司名称", "学历", "工作岗位", "工作地点", "薪资范围",
    "公司名称", "工资", "是否投递简历", "招聘详细信息",
  ];

  const COLOR = {
    greenFont: "FF15803D",
    greenFill: "FFE8F5E9",
    redFont: "FFDC2626",
    redFill: "FFFFECEC",
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

  function textCell(value) {
    return { v: String(value ?? ""), t: "s" };
  }

  function styledCell(value, kind) {
    const isGreen = kind === "green";
    return {
      v: String(value ?? ""),
      t: "s",
      s: {
        font: { bold: true, color: { rgb: isGreen ? COLOR.greenFont : COLOR.redFont } },
        fill: { patternType: "solid", fgColor: { rgb: isGreen ? COLOR.greenFill : COLOR.redFill } },
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
    if (text === "否") return styledCell(text, "red");
    return styledCell(text, "red");
  }

  function buildJobDetailText(row) {
    const lines = [
      `平台：${row.platform || ""}`,
      `工作岗位：${row.title || ""}`,
      `工作地点：${row.city || ""}`,
      `学历要求：${row.education || ""}`,
      `处理时间：${row.time || ""}`,
      `职位链接：${row.url || ""}`,
    ];
    return lines.join("\n");
  }

  function buildExportRows(data) {
    const seenCompanies = new Set();
    const rows = (data?.records || []).map((row) => [
      row.filterCompanies || "不限",
      row.filterEducation || "不限",
      row.filterKeyword || "",
      row.filterCity || "",
      row.filterSalary || "不限",
      buildCompanyCell(row.company, seenCompanies),
      row.salary || "",
      buildAppliedCell(row.result),
      buildJobDetailText(row),
    ]);
    return [HEADERS.map((h) => textCell(h)), ...rows];
  }

  function exportFilename() {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return `zping投递记录-${stamp}.xlsx`;
  }

  function downloadZpingXlsx(data) {
    if (!global.XLSX) throw new Error("Excel 导出库未加载，请重新加载扩展。");
    if (!data?.records?.length) throw new Error("没有可导出的记录。请先完成一轮投递。");

    const rows = buildExportRows(data);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 22 },
      { wch: 10 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 64 },
    ];

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "投递记录");
    XLSX.writeFile(book, exportFilename());
    return data.records.length;
  }

  global.ZpingExport = { downloadZpingXlsx, buildExportRows, buildJobDetailText };
})(typeof globalThis !== "undefined" ? globalThis : window);
