(() => {
  const STORAGE_KEY = "rfb-extension-history-v1";
  const ATTACHED_ATTR = "data-rfb-attached";
  const MAX_HISTORY = 50;

  const hostConfigs = [
    {
      host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
      selectors: ['[data-message-author-role="assistant"]']
    },
    {
      host: /(^|\.)claude\.ai$/,
      selectors: [".font-claude-message", '[data-testid="message-content"]']
    },
    {
      host: /(^|\.)gemini\.google\.com$/,
      selectors: ["model-response", "[data-response-index]", ".model-response-text"]
    },
    {
      host: /(^|\.)copilot\.microsoft\.com$/,
      selectors: ["cib-message[type='chat']", "[data-content='ai-message']", ".ac-textBlock"]
    },
    {
      host: /^127\.0\.0\.1$|^localhost$/,
      selectors: ['[data-message-author-role="assistant"]']
    }
  ];

  const state = {
    prompt: "",
    answer: "",
    splitMode: "paragraph",
    segments: []
  };

  let panel;
  let toast;

  function uid() {
    return Math.random().toString(36).slice(2, 9);
  }

  function currentConfig() {
    return hostConfigs.find((config) => config.host.test(location.hostname));
  }

  function showToast(message) {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "rfb-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.documentElement.append(toast);
    }
    toast.textContent = message;
    toast.classList.add("rfb-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("rfb-visible");
    }, 1800);
  }

  function closestMessageBlock(node) {
    return (
      node.closest("article") ||
      node.closest("[data-testid*='message']") ||
      node.closest("[data-response-index]") ||
      node.closest("model-response") ||
      node
    );
  }

  function isUsableMessage(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const text = cleanText(node.innerText || node.textContent || "");
    if (text.length < 40) return false;
    if (node.querySelector(".rfb-host-button")) return false;
    return true;
  }

  function findAssistantNodes() {
    const config = currentConfig();
    if (!config) return [];
    const nodes = new Set();
    config.selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const block = closestMessageBlock(node);
        if (isUsableMessage(block)) nodes.add(block);
      });
    });
    return [...nodes].slice(-40);
  }

  function cleanText(text) {
    return String(text || "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .trim();
  }

  function extractMessageText(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(".rfb-host-button, .rfb-panel, .rfb-floating-button").forEach((item) => {
      item.remove();
    });
    const blocks = [...clone.querySelectorAll("p, li, pre, blockquote")].map((item) =>
      cleanText(item.innerText || item.textContent || "")
    ).filter(Boolean);
    if (blocks.length > 1) return blocks.join("\n\n");
    return cleanText(clone.innerText || clone.textContent || "");
  }

  function extractPromptNear(messageNode) {
    const userNodes = [...document.querySelectorAll('[data-message-author-role="user"]')];
    if (!userNodes.length) return "";
    const before = userNodes.filter((node) => {
      return node.compareDocumentPosition(messageNode) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    const last = before.at(-1);
    return last ? cleanText(last.innerText || last.textContent || "") : "";
  }

  function createSegment(text = "") {
    return {
      id: uid(),
      text,
      rating: "unrated",
      note: ""
    };
  }

  function splitText(text, mode) {
    const cleaned = cleanText(text);
    if (!cleaned) return [];
    if (mode === "sentence") {
      return (
        cleaned.match(/[^。！？!?.\n]+[。！？!?.]?/g) || [cleaned]
      )
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return cleaned
      .split(/\n\s*\n/g)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function labelForRating(rating) {
    return {
      good: "好",
      ok: "一般",
      bad: "不好",
      unrated: "未标记"
    }[rating] || "未标记";
  }

  function counts() {
    return state.segments.reduce(
      (acc, segment) => {
        acc.total += 1;
        acc[segment.rating] = (acc[segment.rating] || 0) + 1;
        if (segment.rating !== "unrated") acc.rated += 1;
        return acc;
      },
      { total: 0, rated: 0, good: 0, ok: 0, bad: 0, unrated: 0 }
    );
  }

  function buildRevisionPrompt() {
    const c = counts();
    const segmentText = state.segments
      .map((segment, index) => {
        return [
          `片段 ${index + 1}`,
          `标记：${labelForRating(segment.rating)}`,
          `用户意见：${segment.note.trim() || "无额外说明"}`,
          "原文：",
          segment.text.trim() || "(空片段)"
        ].join("\n");
      })
      .join("\n\n---\n\n");

    return [
      "你正在根据逐段反馈修改上一条 AI 回答。",
      "",
      "用户原始问题：",
      state.prompt.trim() || "(未能自动识别，可结合上下文判断)",
      "",
      "总体反馈统计：",
      `共 ${c.total} 个片段，${c.good} 个好，${c.ok} 个一般，${c.bad} 个不好，${c.unrated} 个未标记。`,
      "",
      "改写规则：",
      "1. 保留标记为“好”的核心表达，只做必要压缩和衔接。",
      "2. 标记为“一般”的片段需要补充遗漏、消除含糊、增强结构。",
      "3. 标记为“不好”的片段不要沿用原逻辑，应重新判断并重写。",
      "",
      "逐段反馈：",
      segmentText || "(还没有片段)",
      "",
      "输出要求：",
      "1. 直接给出改写后的完整回答。",
      "2. 不要解释你如何处理标记。",
      "3. 修复“不好”片段中的问题，同时保留“好”片段的有效信息。",
      "4. 回答要比原文更清楚、更准确、更贴合用户问题。"
    ].join("\n");
  }

  function buildPayload() {
    return {
      schema: "ai_response_segment_feedback.extension.v1",
      url: location.href,
      created_at: new Date().toISOString(),
      prompt: state.prompt,
      source_answer: state.answer,
      split_mode: state.splitMode,
      summary: counts(),
      segments: state.segments.map((segment, index) => ({
        index: index + 1,
        text: segment.text,
        rating: segment.rating,
        label: labelForRating(segment.rating),
        note: segment.note
      })),
      revision_prompt: buildRevisionPrompt()
    };
  }

  function createPanel() {
    if (panel) return panel;
    panel = document.createElement("section");
    panel.className = "rfb-panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "AI Response Feedback Lab");
    panel.innerHTML = `
      <div class="rfb-head">
        <div>
          <h2 class="rfb-title">标记 AI 回答</h2>
          <p class="rfb-subtitle">逐段评价，然后复制改写提示词。</p>
        </div>
        <button class="rfb-close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="rfb-body">
        <div class="rfb-stats">
          <div class="rfb-stat"><span>片段</span><strong data-stat="total">0</strong></div>
          <div class="rfb-stat"><span>已标记</span><strong data-stat="rated">0</strong></div>
          <div class="rfb-stat"><span>需重写</span><strong data-stat="bad">0</strong></div>
        </div>
        <div class="rfb-section">
          <h3>原回答</h3>
          <textarea data-field="answer"></textarea>
          <div class="rfb-row" style="margin-top:8px">
            <select data-field="splitMode" aria-label="拆分方式">
              <option value="paragraph">按段落拆分</option>
              <option value="sentence">按句子拆分</option>
            </select>
            <button data-action="split" class="rfb-primary" type="button">重新拆分</button>
          </div>
        </div>
        <div class="rfb-section">
          <h3>逐段标记</h3>
          <div class="rfb-segments" data-region="segments"></div>
        </div>
        <div class="rfb-section">
          <h3>改写提示词</h3>
          <textarea class="rfb-output" data-field="output" readonly></textarea>
        </div>
      </div>
      <div class="rfb-foot">
        <button data-action="copy" class="rfb-primary" type="button">复制提示词</button>
        <button data-action="save" type="button">保存反馈</button>
        <button data-action="json" type="button">复制 JSON</button>
      </div>
    `;
    document.documentElement.append(panel);
    panel.querySelector(".rfb-close").addEventListener("click", () => {
      panel.hidden = true;
    });
    panel.querySelector('[data-action="split"]').addEventListener("click", () => {
      state.answer = panel.querySelector('[data-field="answer"]').value;
      state.splitMode = panel.querySelector('[data-field="splitMode"]').value;
      state.segments = splitText(state.answer, state.splitMode).map(createSegment);
      renderPanel();
      showToast(`已拆分为 ${state.segments.length} 个片段`);
    });
    panel.querySelector('[data-action="copy"]').addEventListener("click", () => {
      copyText(buildRevisionPrompt(), "已复制改写提示词");
    });
    panel.querySelector('[data-action="json"]').addEventListener("click", () => {
      copyText(JSON.stringify(buildPayload(), null, 2), "已复制 JSON");
    });
    panel.querySelector('[data-action="save"]').addEventListener("click", saveFeedback);
    return panel;
  }

  function renderPanel() {
    const root = createPanel();
    const c = counts();
    root.querySelector('[data-stat="total"]').textContent = String(c.total);
    root.querySelector('[data-stat="rated"]').textContent = String(c.rated);
    root.querySelector('[data-stat="bad"]').textContent = String(c.bad);
    root.querySelector('[data-field="answer"]').value = state.answer;
    root.querySelector('[data-field="splitMode"]').value = state.splitMode;
    root.querySelector('[data-field="output"]').value = buildRevisionPrompt();

    const list = root.querySelector('[data-region="segments"]');
    list.innerHTML = "";
    state.segments.forEach((segment, index) => {
      const item = document.createElement("article");
      item.className = "rfb-segment";
      item.dataset.rating = segment.rating;
      item.innerHTML = `
        <div class="rfb-segment-head">
          <div class="rfb-index">${index + 1}</div>
          <div class="rfb-rating" role="group" aria-label="片段 ${index + 1} 评分">
            <button type="button" data-rate="good">好</button>
            <button type="button" data-rate="ok">一般</button>
            <button type="button" data-rate="bad">不好</button>
            <button type="button" data-rate="unrated">未标记</button>
          </div>
        </div>
        <div class="rfb-segment-body">
          <label class="rfb-label" for="rfb-segment-${segment.id}">片段原文</label>
          <textarea id="rfb-segment-${segment.id}" data-kind="text"></textarea>
          <label class="rfb-label" for="rfb-note-${segment.id}">修改意见</label>
          <textarea id="rfb-note-${segment.id}" data-kind="note" placeholder="例如：这一段判断太绝对，需要说明限制条件。"></textarea>
        </div>
      `;
      item.querySelectorAll("[data-rate]").forEach((button) => {
        const rate = button.dataset.rate;
        button.setAttribute("aria-pressed", String(segment.rating === rate));
        button.addEventListener("click", () => {
          segment.rating = rate;
          renderPanel();
        });
      });
      const text = item.querySelector('[data-kind="text"]');
      const note = item.querySelector('[data-kind="note"]');
      text.value = segment.text;
      note.value = segment.note;
      text.addEventListener("input", () => {
        segment.text = text.value;
        root.querySelector('[data-field="output"]').value = buildRevisionPrompt();
      });
      note.addEventListener("input", () => {
        segment.note = note.value;
        root.querySelector('[data-field="output"]').value = buildRevisionPrompt();
      });
      list.append(item);
    });
  }

  function openFeedback(answer, prompt = "") {
    state.prompt = prompt;
    state.answer = cleanText(answer);
    state.splitMode = "paragraph";
    state.segments = splitText(state.answer, state.splitMode).map(createSegment);
    createPanel().hidden = false;
    renderPanel();
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = text;
      document.body.append(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
      showToast(message);
    }
  }

  function saveFeedback() {
    const payload = buildPayload();
    if (!globalThis.chrome?.storage?.local) {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      localStorage.setItem(STORAGE_KEY, JSON.stringify([payload, ...history].slice(0, MAX_HISTORY)));
      showToast("已保存到本机历史");
      return;
    }
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, (result) => {
      const history = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
      chrome.storage.local.set({
        [STORAGE_KEY]: [payload, ...history].slice(0, MAX_HISTORY)
      });
      showToast("已保存到插件本机历史");
    });
  }

  function attachButtons() {
    findAssistantNodes().forEach((node) => {
      if (node.getAttribute(ATTACHED_ATTR) === "true") return;
      node.setAttribute(ATTACHED_ATTR, "true");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rfb-host-button";
      button.textContent = "标记回答";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openFeedback(extractMessageText(node), extractPromptNear(node));
      });
      node.append(button);
    });
  }

  function createFloatingButton() {
    if (document.querySelector(".rfb-floating-button")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rfb-floating-button";
    button.textContent = "RF 标记";
    button.title = "标记选中的 AI 回答";
    button.addEventListener("click", () => {
      const selected = cleanText(String(window.getSelection()));
      if (selected) {
        openFeedback(selected, "");
        return;
      }
      const nodes = findAssistantNodes();
      if (nodes.length) {
        const last = nodes.at(-1);
        openFeedback(extractMessageText(last), extractPromptNear(last));
        return;
      }
      showToast("没有找到 AI 回答。请先选中一段回答再点 RF 标记。");
    });
    document.documentElement.append(button);
  }

  function boot() {
    createPanel();
    createFloatingButton();
    attachButtons();
    const observer = new MutationObserver(() => {
      window.clearTimeout(boot.timer);
      boot.timer = window.setTimeout(attachButtons, 400);
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
