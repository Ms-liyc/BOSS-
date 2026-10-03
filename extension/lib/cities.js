(function (global) {
  const CITIES = [
    "全国", "北京", "上海", "广州", "深圳", "杭州", "成都", "南京", "武汉",
    "西安", "苏州", "天津", "重庆", "长沙", "郑州", "青岛", "厦门", "合肥",
    "东莞", "佛山",
  ];

  const EDU_LEVELS = ["初中", "中专", "中技", "高中", "大专", "本科", "硕士", "博士"];

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

  function bossSearchUrl(city, keyword) {
    const code = BOSS_CITY[city] || BOSS_CITY["北京"];
    const query = encodeURIComponent(String(keyword || "").trim());
    return `https://www.zhipin.com/web/geek/job?query=${query}&city=${code}`;
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

  function isAllowedHost(url, platform) {
    try {
      const host = new URL(url).hostname;
      if (platform === "yupao") return /(^|\.)yupao\.com$/i.test(host);
      return /(^|\.)zhipin\.com$/i.test(host);
    } catch {
      return false;
    }
  }

  function platformForUrl(url) {
    if (/yupao\.com/i.test(String(url || ""))) return "yupao";
    if (/zhipin\.com/i.test(String(url || ""))) return "boss";
    return null;
  }

  function isListPage(url, platform) {
    const value = String(url || "");
    if (platform === "yupao") {
      return /yupao\.com\/zhaogong\/a\d+/i.test(value) && !/\/zhaogong\/\d+\.html/i.test(value);
    }
    return /zhipin\.com/i.test(value) && /\/web\/geek\/job|\/geek\/jobs/i.test(value);
  }

  function isLoginPage(url, platform) {
    const value = String(url || "");
    if (platform === "yupao") {
      return /\/login|\/signin|passport|\/user\/login/i.test(value);
    }
    return /\/login|\/web\/user|passport/i.test(value);
  }

  global.ZpingCities = {
    CITIES,
    EDU_LEVELS,
    BOSS_CITY,
    YUPAO_CITY,
    yupaoSearchUrl,
    bossSearchUrl,
    yupaoCityInPath,
    yupaoCityHint,
    isAllowedHost,
    platformForUrl,
    isListPage,
    isLoginPage,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
