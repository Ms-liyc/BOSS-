(function (global) {
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function clean(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function visible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 8 && rect.height > 8;
  }

  function inputHint(el) {
    return [
      el.placeholder,
      el.getAttribute("aria-label"),
      el.getAttribute("name"),
      el.id,
      el.className,
    ].filter(Boolean).join(" ");
  }

  function isSearchInput(el) {
    const hint = inputHint(el);
    if (/搜索|search|keyword|query|岗位|城市/i.test(hint)) return true;
    if (el.closest("header, nav, .header, .search-input-box, .job-search-form, [class*='search-bar'], [class*='search-input'], [class*='top-nav']")) {
      return true;
    }
    return false;
  }

  function isBossSuccessDialog(root) {
    return /已向BOSS发送消息|已向Boss发送消息|消息已发送/.test(root?.innerText || "");
  }

  function dialogRoots() {
    const selectors = [
      ".dialog-wrap",
      ".greet-boss-dialog",
      "[role='dialog']",
      "[class*='dialog' i]",
      "[class*='modal' i]",
      "[class*='popup' i]",
      "[class*='greet' i]",
      "[class*='chat-dialog' i]",
      "[class*='boss-dialog' i]",
      ".dialog-container",
      ".chat-block",
    ];
    const roots = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el.closest("#zping-host")) return;
        if (!visible(el)) return;
        if (isBossSuccessDialog(el)) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 80) return;
        roots.push(el);
      });
    });
    return roots.filter((el, index) => !roots.some((other, i) => i < index && other.contains(el)));
  }

  function scoreInput(el) {
    const hint = inputHint(el);
    let score = 0;
    if (el.tagName === "TEXTAREA") score += 4;
    if (/招呼|问候|留言|想说|默认|沟通|消息|输入|回复|自我介绍/.test(hint)) score += 6;
    if (el.closest("[role='dialog'], [class*='dialog' i], [class*='modal' i], [class*='popup' i]")) score += 8;
    const rect = el.getBoundingClientRect();
    score += Math.min(2, Math.floor(rect.width / 160));
    if (isSearchInput(el)) score -= 20;
    return score;
  }

  function findInputIn(root) {
    const scope = root || document;
    const candidates = [...scope.querySelectorAll("textarea, input[type='text'], [contenteditable='true']")].filter((el) => {
      if (el.closest("#zping-host, header, nav")) return false;
      if (el.disabled || el.readOnly) return false;
      if (!visible(el)) return false;
      if (el.type === "search" || el.type === "hidden") return false;
      if (isSearchInput(el)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 72 || rect.height < 18) return false;
      const hint = inputHint(el);
      if (/验证码|手机号|密码/.test(hint)) return false;
      if (el.tagName === "TEXTAREA") return true;
      if (/招呼|问候|留言|想说|沟通|消息|输入|回复/.test(hint)) return true;
      return scope !== document;
    });
    candidates.sort((a, b) => scoreInput(b) - scoreInput(a));
    return candidates[0] || null;
  }

  function findInput() {
    const direct = document.querySelector("#chat-input, .chat-input[contenteditable='true']");
    if (direct && visible(direct) && !isSearchInput(direct)) return direct;
    const dialogs = dialogRoots();
    for (const dialog of dialogs) {
      const input = findInputIn(dialog);
      if (input) return input;
    }
    return null;
  }

  function readValue(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return String(el.value || "");
    return String(el.textContent || el.innerText || "");
  }

  function setNativeValue(el, text) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const ownSetter = Object.getOwnPropertyDescriptor(el, "value")?.set;
    const protoSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (protoSetter && ownSetter !== protoSetter) protoSetter.call(el, text);
    else if (ownSetter) ownSetter.call(el, text);
    else el.value = text;
  }

  function setValue(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      setNativeValue(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
      return;
    }
    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      document.execCommand("insertText", false, text);
    } catch {
      el.textContent = text;
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }

  function findSendButton(nearInput) {
    const scopes = [];
    const dialog = nearInput?.closest("[role='dialog'], [class*='dialog' i], [class*='modal' i], [class*='popup' i]");
    if (dialog) scopes.push(dialog);
    dialogRoots().forEach((root) => scopes.push(root));
    scopes.push(document);

    const seen = new Set();
    for (const root of scopes) {
      if (!root || seen.has(root)) continue;
      seen.add(root);
      const hits = [...root.querySelectorAll("button, a, span, div")].filter((el) => {
        if (el.closest("#zping-host")) return false;
        const text = clean(el.innerText);
        if (!/^(发送|确定|确认发送|立即发送)$/.test(text)) return false;
        if (/取消|关闭|跳过/.test(text)) return false;
        return visible(el);
      });
      hits.sort((a, b) => a.innerText.trim().length - b.innerText.trim().length);
      if (hits[0]) return hits[0];
    }
    return null;
  }

  async function waitForInput(timeout = 6000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const input = findInput();
      if (input) return input;
      await sleep(200);
    }
    return null;
  }

  function valueMatches(input, message) {
    const current = readValue(input).trim();
    const head = message.slice(0, Math.min(12, message.length));
    return current && head && current.includes(head);
  }

  async function fillAndSend(text) {
    const message = String(text || "").trim();
    if (!message) return { filled: false, sent: false, reason: "empty" };

    const input = await waitForInput(8000);
    if (!input) return { filled: false, sent: false, reason: "no-input" };

    for (let i = 0; i < 3; i++) {
      setValue(input, message);
      await sleep(400);
      if (valueMatches(input, message)) break;
    }
    if (!valueMatches(input, message)) {
      return { filled: false, sent: false, reason: "fill-failed" };
    }

    const send = findSendButton(input);
    if (send) {
      send.click();
      await sleep(400);
      return { filled: true, sent: true, reason: "ok" };
    }
    return { filled: true, sent: false, reason: "no-send" };
  }

  global.ZpingGreeting = { fillAndSend, findInput, setValue, readValue, findSendButton, waitForInput };
})(typeof globalThis !== "undefined" ? globalThis : window);
