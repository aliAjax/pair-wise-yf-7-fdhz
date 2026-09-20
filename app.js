const storageKey = "zfl16-movable-type-workshop";

const starterInventory = [
  { id: crypto.randomUUID(), char: "山", style: "宋体旧字", size: 30, quantity: 4, wear: "微磨" },
  { id: crypto.randomUUID(), char: "月", style: "宋体旧字", size: 30, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "风", style: "楷体木刻", size: 28, quantity: 2, wear: "微磨" },
  { id: crypto.randomUUID(), char: "花", style: "楷体木刻", size: 28, quantity: 2, wear: "新" },
  { id: crypto.randomUUID(), char: "茶", style: "黑体铅字", size: 24, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "雨", style: "仿宋细字", size: 22, quantity: 4, wear: "新" }
];

const defaultState = {
  inventory: starterInventory,
  selectedTypeId: starterInventory[0].id,
  placements: [],
  drafts: [],
  proofs: [],
  proofVersion: 0,
  settings: {
    paperSize: "postcard",
    flowMode: "horizontal",
    gridGap: 8,
    workTitle: "晚风小笺"
  }
};

let state = loadState();

// 校对模式会话数据（仅存于内存，未提交不落盘）：pending 待登记，registered 已登记错字格
let proofMode = false;
let proofSession = { pending: [], registered: [] };

const els = {
  paperSize: document.querySelector("#paperSize"),
  flowMode: document.querySelector("#flowMode"),
  gridGap: document.querySelector("#gridGap"),
  workTitle: document.querySelector("#workTitle"),
  stage: document.querySelector("#stage"),
  typeList: document.querySelector("#typeList"),
  typeForm: document.querySelector("#typeForm"),
  charInput: document.querySelector("#charInput"),
  styleInput: document.querySelector("#styleInput"),
  sizeInput: document.querySelector("#sizeInput"),
  quantityInput: document.querySelector("#quantityInput"),
  wearInput: document.querySelector("#wearInput"),
  inventorySearch: document.querySelector("#inventorySearch"),
  styleFilter: document.querySelector("#styleFilter"),
  selectedTypeLabel: document.querySelector("#selectedTypeLabel"),
  shortageBadge: document.querySelector("#shortageBadge"),
  usageList: document.querySelector("#usageList"),
  draftList: document.querySelector("#draftList"),
  placedCount: document.querySelector("#placedCount"),
  inventoryCount: document.querySelector("#inventoryCount"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBoardBtn: document.querySelector("#clearBoardBtn"),
  proofBar: document.querySelector("#proofBar"),
  proofreaderInput: document.querySelector("#proofreaderInput"),
  proofNoteInput: document.querySelector("#proofNoteInput"),
  pendingCells: document.querySelector("#pendingCells"),
  registeredCells: document.querySelector("#registeredCells"),
  proofReasons: document.querySelector("#proofReasons"),
  registerAllBtn: document.querySelector("#registerAllBtn"),
  submitProofBtn: document.querySelector("#submitProofBtn"),
  cancelProofBtn: document.querySelector("#cancelProofBtn"),
  proofVersion: document.querySelector("#proofVersion"),
  proofStatusBadge: document.querySelector("#proofStatusBadge"),
  proofGateBtn: document.querySelector("#proofGateBtn"),
  proofHint: document.querySelector("#proofHint"),
  occupiedHints: document.querySelector("#occupiedHints"),
  proofList: document.querySelector("#proofList")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      proofs: Array.isArray(parsed.proofs) ? parsed.proofs : [],
      proofVersion: Number(parsed.proofVersion) || 0,
      settings: { ...defaultState.settings, ...parsed.settings }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

// 其他标签页写入 localStorage 时同步本页（校次列表、占用提示等随之刷新）
window.addEventListener("storage", (event) => {
  if (event.key !== storageKey || !event.newValue) return;
  try {
    const parsed = JSON.parse(event.newValue);
    state = {
      ...structuredClone(defaultState),
      ...parsed,
      proofs: Array.isArray(parsed.proofs) ? parsed.proofs : [],
      proofVersion: Number(parsed.proofVersion) || 0,
      settings: { ...defaultState.settings, ...parsed.settings }
    };
    proofMode = false;
    proofSession = { pending: [], registered: [] };
    renderAll();
  } catch {
    // 数据损坏时保留当前内存状态
  }
});

function getGrid() {
  const size = state.settings.paperSize;
  if (size === "bookmark") return { cols: 7, rows: 18 };
  if (size === "square") return { cols: 12, rows: 12 };
  return { cols: 16, rows: 10 };
}

function placementKey(row, col) {
  return `${row}:${col}`;
}

function getSelectedType() {
  return state.inventory.find((item) => item.id === state.selectedTypeId) || null;
}

function getUsage() {
  return state.placements.reduce((acc, placement) => {
    acc[placement.typeId] = (acc[placement.typeId] || 0) + 1;
    return acc;
  }, {});
}

function renderSettings() {
  els.paperSize.value = state.settings.paperSize;
  els.flowMode.value = state.settings.flowMode;
  els.gridGap.value = state.settings.gridGap;
  els.workTitle.value = state.settings.workTitle;
}

function renderStyleFilter() {
  const current = els.styleFilter.value || "all";
  const styles = [...new Set(state.inventory.map((item) => item.style))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  els.styleFilter.innerHTML = `<option value="all">全部风格</option>${styles
    .map((style) => `<option value="${escapeHtml(style)}">${escapeHtml(style)}</option>`)
    .join("")}`;
  els.styleFilter.value = styles.includes(current) ? current : "all";
}

function renderInventory() {
  const keyword = els.inventorySearch.value.trim();
  const style = els.styleFilter.value;
  const usage = getUsage();
  const items = state.inventory.filter((item) => {
    const matchesKeyword = !keyword || `${item.char}${item.style}${item.wear}`.includes(keyword);
    const matchesStyle = style === "all" || item.style === style;
    return matchesKeyword && matchesStyle;
  });

  els.inventoryCount.textContent = `${state.inventory.length}枚字模`;
  els.typeList.innerHTML = items
    .map((item) => {
      const used = usage[item.id] || 0;
      const selected = item.id === state.selectedTypeId ? "selected" : "";
      return `
        <article class="type-card ${selected}" draggable="true" data-type-id="${item.id}">
          <div class="glyph" style="font-size:${Math.min(item.size, 36)}px">${escapeHtml(item.char)}</div>
          <div class="type-meta">
            <strong>${escapeHtml(item.char)} · ${escapeHtml(item.style)}</strong>
            <span>${item.size}px · ${escapeHtml(item.wear)} · 已用${used}/${item.quantity}</span>
          </div>
          <div class="type-ops">
            <button class="mini-btn" title="减少字模数量" data-qty-delta="${item.id}:-1" type="button">−</button>
            <button class="mini-btn" title="增加字模数量" data-qty-delta="${item.id}:1" type="button">＋</button>
            <button class="mini-btn" title="删除字模" data-delete-type="${item.id}" type="button">×</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function cellLabel(row, col) {
  return `第${row + 1}行第${col + 1}列`;
}

function renderStage() {
  const { cols, rows } = getGrid();
  const map = new Map(state.placements.map((item) => [placementKey(item.row, item.col), item]));
  els.stage.className = `stage ${state.settings.paperSize}`;
  els.stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${state.settings.gridGap}px`;
  const pendingKeys = new Set(proofSession.pending);
  const registeredKeys = new Set(proofSession.registered);
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = placementKey(row, col);
      const placement = map.get(key);
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = state.settings.flowMode === "vertical" ? "vertical" : "";
      const flags = [];
      if (proofMode) flags.push(type ? "proof-target" : "proof-empty");
      if (proofMode && pendingKeys.has(key)) flags.push("pending-flag");
      if (proofMode && registeredKeys.has(key)) flags.push("registered-flag");
      const mark =
        proofMode && (pendingKeys.has(key) || registeredKeys.has(key))
          ? `<span class="cell-mark">${registeredKeys.has(key) ? "错" : "待"}</span>`
          : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical} ${flags.join(" ")}" data-row="${row}" data-col="${col}" type="button" aria-label="${cellLabel(row, col)}">
          ${mark}${type ? escapeHtml(type.char) : ""}
        </button>
      `);
    }
  }
  els.stage.innerHTML = cells.join("");
}

function renderUsage() {
  const usage = getUsage();
  const entries = state.inventory.filter((item) => usage[item.id]);
  els.placedCount.textContent = `${state.placements.length}个落字`;

  const shortages = entries.filter((item) => usage[item.id] > item.quantity);
  els.shortageBadge.textContent = shortages.length ? `${shortages.length}处超量` : "数量充足";
  els.shortageBadge.className = `badge ${shortages.length ? "warn" : "ok"}`;

  const selectedType = getSelectedType();
  els.selectedTypeLabel.textContent = selectedType ? `当前：${selectedType.char} · ${selectedType.style}` : "未选择字模";

  els.usageList.innerHTML =
    entries
      .map((item) => {
        const used = usage[item.id];
        const warn = used > item.quantity ? "warn" : "";
        return `
          <div class="usage-item ${warn}">
            <strong>${escapeHtml(item.char)} ${escapeHtml(item.style)}</strong>
            <span>${used}/${item.quantity}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">还没有落字。</p>`;
}

function renderDrafts() {
  els.draftList.innerHTML =
    state.drafts
      .map(
        (draft) => `
          <article class="draft-item">
            <strong>${escapeHtml(draft.title)}</strong>
            <span>${draft.placements.length}个落字 · ${new Date(draft.savedAt).toLocaleString("zh-CN")}</span>
            <div class="draft-actions">
              <button type="button" data-load-draft="${draft.id}">载入</button>
              <button type="button" data-delete-draft="${draft.id}">删除</button>
            </div>
          </article>
        `
      )
      .join("") || `<p class="empty">还没有保存草稿。</p>`;
}

function renderAll() {
  saveState();
  renderSettings();
  renderStyleFilter();
  renderInventory();
  renderStage();
  renderUsage();
  renderDrafts();
  renderProofPanel();
  renderProofSession();
}

function getVersionProofs(version = state.proofVersion) {
  return state.proofs.filter((proof) => proof.version === version);
}

function getLatestProof() {
  const current = getVersionProofs();
  return current.length ? current[current.length - 1] : null;
}

// 统计同一格连续返修（错字登记）次数；一旦该格未出现在最新一次返修记录中即断档
function getReworkStreaks() {
  const streaks = {};
  getVersionProofs().forEach((proof) => {
    if (proof.result !== "rework") {
      Object.keys(streaks).forEach((key) => {
        streaks[key] = 0;
      });
      return;
    }
    const cells = new Set(proof.cells.map((cell) => cell.key));
    Object.keys(streaks).forEach((key) => {
      if (!cells.has(key)) streaks[key] = 0;
    });
    proof.cells.forEach((cell) => {
      streaks[cell.key] = (streaks[cell.key] || 0) + 1;
    });
  });
  return streaks;
}

function getProofStatus() {
  if (!state.proofs.length || state.proofVersion === 0) return "idle";
  const latest = getLatestProof();
  if (!latest) return "stale";
  return latest.result === "rework" ? "rework" : "passed";
}

// 任一落字或字模数量改动：已有校样立即恢复待校，生成新版本，旧版本只读
function touchLayout() {
  if (state.proofs.length) state.proofVersion += 1;
}

function snapshotCell(key) {
  const [row, col] = key.split(":").map(Number);
  const placement = state.placements.find((item) => item.row === row && item.col === col);
  const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
  return {
    key,
    row,
    col,
    char: type ? type.char : "空",
    style: type ? type.style : ""
  };
}

function renderProofSession() {
  els.proofBar.hidden = !proofMode;
  const chip = (cell, registered) => `
    <div class="proof-chip ${registered ? "registered" : ""}">
      <span>${cellLabel(cell.row, cell.col)} · ${escapeHtml(cell.char || "空")}</span>
      <span class="proof-chip-actions">
        ${
          registered
            ? `<button type="button" data-cell-action="unregister:${cell.key}">撤回登记</button>`
            : `<button type="button" data-cell-action="register:${cell.key}">登记</button>`
        }
        <button type="button" data-cell-action="remove:${cell.key}">移除</button>
      </span>
    </div>
  `;
  const pendingSnapshots = proofSession.pending.map(snapshotCell);
  const registeredSnapshots = proofSession.registered.map(snapshotCell);
  els.pendingCells.innerHTML = pendingSnapshots.map((cell) => chip(cell, false)).join("") || `<p class="empty">点击版面格标为待登记。</p>`;
  els.registeredCells.innerHTML = registeredSnapshots.map((cell) => chip(cell, true)).join("") || `<p class="empty">还没有已登记错字格。</p>`;
}

function showProofReasons(reasons) {
  if (!reasons.length) {
    els.proofReasons.hidden = true;
    els.proofReasons.textContent = "";
    return;
  }
  els.proofReasons.hidden = false;
  els.proofReasons.textContent = reasons.map((reason) => `· ${reason}`).join("\n");
}

function renderProofPanel() {
  const status = getProofStatus();
  const versionText = state.proofVersion > 0 ? `v${state.proofVersion}` : "未送校";
  els.proofVersion.textContent = versionText;

  const badgeMap = {
    idle: ["idle", "尚未送校"],
    rework: ["rework", "返修中 · 待校"],
    passed: ["passed", "校对通过"],
    stale: ["stale", "旧版只读"]
  };
  const [badgeClass, badgeText] = badgeMap[status];
  els.proofStatusBadge.className = `badge ${badgeClass}`;
  els.proofStatusBadge.textContent = badgeText;

  const latest = getLatestProof();
  if (status === "rework" && latest) {
    els.proofGateBtn.textContent = "返修后送校";
    els.proofHint.textContent = `上次校对人：${latest.proofreader}。返修后再次送校；同一格连续返修两次后，必须更换校对人才能通过。`;
  } else if (status === "passed" && latest) {
    els.proofGateBtn.textContent = "再次送校";
    els.proofHint.textContent = `v${state.proofVersion} 已由 ${latest.proofreader} 校对通过。改动任一落字或字模数量会自动生成新版本并恢复待校。`;
  } else if (status === "stale") {
    els.proofGateBtn.textContent = "当前版本送校";
    els.proofHint.textContent = "版面已改动，旧版本校样只读。对当前版面送校将生成新版本。";
  } else {
    els.proofGateBtn.textContent = "首次送校";
    els.proofHint.textContent = "草稿与版面落字定稿后，在此登记校对人、错字格与返修说明。";
  }
  els.proofGateBtn.disabled = proofMode;

  renderOccupiedHints();
  renderProofList();
}

function renderOccupiedHints() {
  const streaks = getReworkStreaks();
  const latest = getLatestProof();
  const cells = latest && latest.result === "rework" ? latest.cells : [];
  const hints = cells.map((cell) => {
    const streak = streaks[cell.key] || 0;
    const blocked = streak >= 2;
    return `
      <div class="occupied-hint">
        <span>${cellLabel(cell.row, cell.col)} · “${escapeHtml(cell.char)}” 待返修</span>
        <span class="streak">${blocked ? `已连续返修${streak}次，须换人校对` : `返修${streak}次`}</span>
      </div>
    `;
  });
  els.occupiedHints.innerHTML = hints.join("");
}

function renderProofList() {
  if (!state.proofs.length) {
    els.proofList.innerHTML = `<p class="empty">还没有校次记录。</p>`;
    return;
  }
  const currentVersion = state.proofVersion;
  els.proofList.innerHTML = [...state.proofs]
    .reverse()
    .map((proof, reverseIndex) => {
      const ordinal = state.proofs.length - reverseIndex;
      const locked = proof.version < currentVersion;
      const tagClass = locked ? "locked" : proof.result;
      const tagText = locked ? "旧版只读" : proof.result === "rework" ? "返修" : "通过";
      return `
        <article class="proof-item ${locked ? "locked" : ""}">
          <div class="proof-item-head">
            <strong>第${ordinal}校 · v${proof.version}</strong>
            <span class="tag ${tagClass}">${tagText}</span>
          </div>
          <div class="proof-meta">校对人：${escapeHtml(proof.proofreader)} · ${new Date(proof.submittedAt).toLocaleString("zh-CN")}</div>
          ${proof.note ? `<div>返修说明：${escapeHtml(proof.note)}</div>` : `<div class="proof-meta">无返修说明（直接通过）</div>`}
          <details>
            <summary>${proof.cells.length ? `${proof.cells.length}个错字格` : "无错字格"}</summary>
            ${
              proof.cells.length
                ? proof.cells.map((cell) => `<div>${cellLabel(cell.row, cell.col)} · “${escapeHtml(cell.char)}”</div>`).join("")
                : ""
            }
          </details>
        </article>
      `;
    })
    .join("");
}

function placeType(row, col, typeId = state.selectedTypeId) {
  if (proofMode) return; // 校对模式下版面锁定，改动需先取消校对
  if (!typeId) return;
  const existingIndex = state.placements.findIndex((item) => item.row === row && item.col === col);
  if (existingIndex >= 0) {
    if (state.placements[existingIndex].typeId === typeId) {
      state.placements.splice(existingIndex, 1);
    } else {
      state.placements[existingIndex].typeId = typeId;
    }
  } else {
    state.placements.push({ row, col, typeId });
  }
  touchLayout();
  renderAll();
}

function addType(event) {
  event.preventDefault();
  const item = {
    id: crypto.randomUUID(),
    char: els.charInput.value.trim(),
    style: els.styleInput.value.trim(),
    size: Number(els.sizeInput.value),
    quantity: Number(els.quantityInput.value),
    wear: els.wearInput.value
  };
  if (!item.char || !item.style) return;
  state.inventory.unshift(item);
  state.selectedTypeId = item.id;
  els.typeForm.reset();
  els.sizeInput.value = 24;
  els.quantityInput.value = 3;
  touchLayout();
  renderAll();
}

function saveDraft() {
  const title = state.settings.workTitle.trim() || "未命名作品";
  state.drafts.unshift({
    id: crypto.randomUUID(),
    title,
    settings: structuredClone(state.settings),
    placements: structuredClone(state.placements),
    savedAt: new Date().toISOString()
  });
  state.drafts = state.drafts.slice(0, 8);
  renderAll();
}

function exportPreview() {
  const { cols, rows } = getGrid();
  const cell = state.settings.paperSize === "bookmark" ? 44 : 56;
  const gap = state.settings.gridGap;
  const margin = 48;
  const width = cols * cell + (cols - 1) * gap + margin * 2;
  const height = rows * cell + (rows - 1) * gap + margin * 2 + 70;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2f2921";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.fillStyle = "#22201c";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(state.settings.workTitle || "未命名作品", margin, 50);
  ctx.font = "bold 30px serif";
  state.placements.forEach((placement) => {
    const type = state.inventory.find((item) => item.id === placement.typeId);
    if (!type) return;
    const x = margin + placement.col * (cell + gap);
    const y = margin + 45 + placement.row * (cell + gap);
    ctx.fillStyle = "#2f2921";
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = "#fff5df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.min(type.size + 8, 42)}px serif`;
    ctx.fillText(type.char, x + cell / 2, y + cell / 2);
  });
  const link = document.createElement("a");
  link.download = `${state.settings.workTitle || "movable-type"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function startProofSession() {
  if (proofMode) return;
  proofMode = true;
  const latest = getLatestProof();
  proofSession = {
    // 返修中再次送校：带入上次已登记错字格，便于追踪同一格的连续返修
    pending: [],
    registered: latest && latest.result === "rework" ? latest.cells.map((cell) => cell.key) : []
  };
  els.proofreaderInput.value = "";
  els.proofNoteInput.value = "";
  showProofReasons([]);
  renderAll();
}

function endProofSession() {
  proofMode = false;
  proofSession = { pending: [], registered: [] };
  showProofReasons([]);
  renderAll();
}

function toggleProofCell(row, col) {
  const key = placementKey(row, col);
  const occupied = state.placements.some((item) => item.row === row && item.col === col);
  // 未登记错字格：点在空（未落字）格上无法登记，提交时会以“存在未登记错字格”拒绝
  if (!occupied) {
    showProofReasons([`${cellLabel(row, col)}是空格，错字格只能登记在已落字的位置上。`]);
    return;
  }
  const { pending, registered } = proofSession;
  const pendingIndex = pending.indexOf(key);
  const registeredIndex = registered.indexOf(key);
  if (pendingIndex >= 0) {
    pending.splice(pendingIndex, 1);
  } else if (registeredIndex >= 0) {
    registered.splice(registeredIndex, 1);
  } else {
    pending.push(key);
  }
  showProofReasons([]);
  renderAll();
}

function moveCell(key, from, to) {
  const index = proofSession[from].indexOf(key);
  if (index < 0) return;
  proofSession[from].splice(index, 1);
  if (to !== "removed" && !proofSession[to].includes(key)) proofSession[to].push(key);
  renderAll();
}

function submitProof() {
  const proofreader = els.proofreaderInput.value.trim();
  const note = els.proofNoteInput.value.trim();
  const reasons = [];

  // 闸门一：仍有超量字模，整次拒绝，草稿与原版面不变
  const usage = getUsage();
  const shortages = state.inventory.filter((item) => (usage[item.id] || 0) > item.quantity);
  shortages.forEach((item) => {
    reasons.push(`字模“${item.char} ${item.style}”用量 ${usage[item.id]} 超过存量 ${item.quantity}。`);
  });

  // 闸门二：空作品名
  if (!state.settings.workTitle.trim()) {
    reasons.push("作品名为空，请先在顶部填写作品名。");
  }

  // 闸门三：未登记错字格（标了但没登记）
  if (proofSession.pending.length) {
    const labels = proofSession.pending.map((key) => {
      const [row, col] = key.split(":").map(Number);
      return cellLabel(row, col);
    });
    reasons.push(`存在未登记错字格：${labels.join("、")}。请登记后再提交。`);
  }

  // 校对人必填
  if (!proofreader) reasons.push("请登记校对人姓名。");

  const hasCells = proofSession.registered.length > 0;
  // 有错字格即返修，返修说明必填
  if (hasCells && !note) reasons.push("有错字格时必须填写返修说明。");

  // 无错字格 = 申请通过；同一格连续返修两次后必须更换校对人
  const streaks = getReworkStreaks();
  const latest = getLatestProof();
  if (!hasCells && latest && latest.result === "rework") {
    const doubleReworkCells = latest.cells.filter((cell) => (streaks[cell.key] || 0) >= 2);
    if (doubleReworkCells.length && proofreader === latest.proofreader) {
      const labels = doubleReworkCells.map((cell) => cellLabel(cell.row, cell.col));
      reasons.push(`${labels.join("、")}已连续返修两次，必须更换校对人才能再次通过（上次校对人：${latest.proofreader}）。`);
    }
  }

  if (reasons.length) {
    // 整次拒绝：不写入校次、不升版本、草稿与原版面不变
    showProofReasons(reasons);
    return;
  }

  const isFirstProof = state.proofs.length === 0;
  const version = isFirstProof ? 1 : state.proofVersion;
  state.proofs.push({
    id: crypto.randomUUID(),
    version,
    proofreader,
    note,
    result: hasCells ? "rework" : "passed",
    cells: proofSession.registered.map(snapshotCell),
    title: state.settings.workTitle.trim(),
    placements: structuredClone(state.placements),
    settings: structuredClone(state.settings),
    submittedAt: new Date().toISOString()
  });
  state.proofVersion = version;
  endProofSession();
}

els.proofGateBtn.addEventListener("click", startProofSession);
els.cancelProofBtn.addEventListener("click", endProofSession);
els.submitProofBtn.addEventListener("click", submitProof);
els.registerAllBtn.addEventListener("click", () => {
  proofSession.pending.forEach((key) => {
    if (!proofSession.registered.includes(key)) proofSession.registered.push(key);
  });
  proofSession.pending = [];
  renderAll();
});

els.pendingCells.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cell-action]");
  if (!button) return;
  const [action, key] = button.dataset.cellAction.split(":");
  if (action === "register") moveCell(key, "pending", "registered");
  if (action === "remove") moveCell(key, "pending", "removed");
});

els.registeredCells.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cell-action]");
  if (!button) return;
  const [action, key] = button.dataset.cellAction.split(":");
  if (action === "unregister") moveCell(key, "registered", "pending");
  if (action === "remove") moveCell(key, "registered", "removed");
});

els.paperSize.addEventListener("change", () => {
  if (proofMode) {
    els.paperSize.value = state.settings.paperSize; // 校对会话中锁定会裁落字的设置
    return;
  }
  state.settings.paperSize = els.paperSize.value;
  const { cols, rows } = getGrid();
  const before = state.placements.length;
  state.placements = state.placements.filter((item) => item.row < rows && item.col < cols);
  if (state.placements.length !== before) touchLayout(); // 换纸裁掉了越界落字
  renderAll();
});

els.flowMode.addEventListener("change", () => {
  state.settings.flowMode = els.flowMode.value;
  renderAll();
});

els.gridGap.addEventListener("input", () => {
  state.settings.gridGap = Number(els.gridGap.value);
  renderAll();
});

els.workTitle.addEventListener("input", () => {
  state.settings.workTitle = els.workTitle.value;
  saveState();
});

els.typeForm.addEventListener("submit", (event) => {
  if (proofMode) {
    event.preventDefault();
    return;
  }
  addType(event);
});
els.inventorySearch.addEventListener("input", renderInventory);
els.styleFilter.addEventListener("change", renderInventory);
els.saveDraftBtn.addEventListener("click", saveDraft);
els.exportBtn.addEventListener("click", exportPreview);
els.clearBoardBtn.addEventListener("click", () => {
  if (proofMode) return;
  if (!state.placements.length) return;
  state.placements = [];
  touchLayout();
  renderAll();
});

els.typeList.addEventListener("click", (event) => {
  const qtyButton = event.target.closest("[data-qty-delta]");
  if (qtyButton) {
    if (proofMode) return;
    const [typeId, delta] = qtyButton.dataset.qtyDelta.split(":");
    const item = state.inventory.find((entry) => entry.id === typeId);
    if (!item) return;
    item.quantity = Math.min(99, Math.max(1, item.quantity + Number(delta)));
    touchLayout(); // 字模数量改动也让已有校样失效
    renderAll();
    return;
  }
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    if (proofMode) return;
    const typeId = deleteButton.dataset.deleteType;
    state.inventory = state.inventory.filter((item) => item.id !== typeId);
    state.placements = state.placements.filter((item) => item.typeId !== typeId);
    if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
    touchLayout(); // 删字模相当于数量归零，且可能移除落字
    renderAll();
    return;
  }
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  state.selectedTypeId = card.dataset.typeId;
  renderAll();
});

els.typeList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.typeId);
});

els.stage.addEventListener("dragover", (event) => {
  if (event.target.closest(".cell")) event.preventDefault();
});

els.stage.addEventListener("drop", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  event.preventDefault();
  placeType(Number(cell.dataset.row), Number(cell.dataset.col), event.dataTransfer.getData("text/plain"));
});

els.stage.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (proofMode) {
    toggleProofCell(row, col);
    return;
  }
  placeType(row, col);
});

els.draftList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-draft]");
  const deleteButton = event.target.closest("[data-delete-draft]");
  if (loadButton) {
    if (proofMode) return;
    const draft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (!draft) return;
    state.settings = structuredClone(draft.settings);
    state.placements = structuredClone(draft.placements);
    touchLayout(); // 载入草稿替换了版面，校样恢复待校并升版本
    renderAll();
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

renderAll();
