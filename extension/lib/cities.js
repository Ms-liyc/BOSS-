(function (global) {
  const YUPAO_CITY = {
    全国: "a1",
    北京: "a2",
    上海: "a25",
    广州: "a76",
    深圳: "a77",
    杭州: "a383",
    成都: "a322",
    南京: "a220",
    武汉: "a180",
    西安: "a311",
    苏州: "a221",
    天津: "a27",
    重庆: "a32",
    长沙: "a197",
    郑州: "a149",
    青岛: "a284",
    厦门: "a60",
    合肥: "a3401",
    东莞: "a79",
    佛山: "a80",
  };

  function yupaoSearchUrl(city, keyword) {
    const area = YUPAO_CITY[city] || YUPAO_CITY["全国"];
    const base = `https://www.yupao.com/zhaogong/${area}/`;
    const kw = String(keyword || "").trim();
    return kw ? `${base}?keywords=${encodeURIComponent(kw)}` : base;
  }

  function yupaoCityInPath(city, pathname) {
    if (!city || city === "全国") return true;
    const code = YUPAO_CITY[city];
    if (!code) return true;
    const path = String(pathname || "");
    return path.includes(`/${code}/`) || path.includes(`/${code}c`) || path.includes(`/${code}_`);
  }

  function yupaoCityHint(city) {
    if (!city || city === "全国" || yupaoCityInPath(city, global.location?.pathname)) return "";
    return `当前不在「${city}」列表页。请点扩展里的「打开搜索页并开始」，或先在鱼泡网页顶部切换到${city}。`;
  }

  global.ZpingCities = { YUPAO_CITY, yupaoSearchUrl, yupaoCityInPath, yupaoCityHint };
})(typeof globalThis !== "undefined" ? globalThis : window);
