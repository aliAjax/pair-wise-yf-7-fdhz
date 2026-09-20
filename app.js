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
  activeProofId: null,
  settings: {
    paperSize: "postcard",
    flowMode: "horizontal",
    gridGap: 8,
    workTitle: "晚风小笺"
  }
};

const roundNames = ["初校", "二校", "三校", "四校", "五校", "六校", "七校", "八校", "九校", "十校"];

let state = loadState();

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
  sendProofBtn: document.querySelector("#sendProofBtn"),
  proofList: document.querySelector("#proofList"),
  proofModal: document.querySelector("#proofModal"),
  proofModalTitle: document.querySelector("#proofModalTitle"),
  proofModalClose: document.querySelector("#proofModalClose"),
  proofModalBanner: document.querySelector("#proofModalBanner"),
  proofForm: document.querySelector("#proofForm"),
  proofReader: document.querySelector("#proofReader"),
  proofNote: document.querySelector("#proofNote"),
  proofGrid: document.querySelector("#proofGrid"),
  errorRows: document.querySelector("#errorRows"),
  proofProblems: document.querySelector("#proofProblems"),
  proofSubmitBtn: document.querySelector("#proofSubmitBtn"),
  proofHint: document.querySelector("#proofHint")
};

// modalCtx: { mode: "register" | "view", proofId, version, errors: {"row:col": "正字"} }
let modalCtx = null;

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      proofs: Array.isArray(parsed.proofs) ? parsed.proofs : [],
      settings: { ...defaultState.settings, ...parsed.settings }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getGrid(size = state.settings.paperSize) {
  if (size === "bookmark") return { cols: 7, rows: 18 };
  if (size === "square") return { cols: 12, rows: 12 };
  return { cols: 16, rows: 10 };
}

function placementKey(row, col) {
  return `${row}:${col}`;
}

function parseCellKey(key) {
  const [row, col] = key.split(":").map(Number);
  return { row, col };
}

function cellLabel(row, col) {
  return `第${row + 1}行第${col + 1}列`;
}

function roundLabel(round) {
  return roundNames[round - 1] || `${round}校`;
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

function getShortages() {
  const usage = getUsage();
  return state.inventory.filter((item) => usage[item.id] > item.quantity);
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
            <span class="qty-stepper">
              <button type="button" title="减少数量" data-qty-type="${item.id}" data-delta="-1">−</button>
              ${item.size}px · ${escapeHtml(item.wear)} · 已用${used}/${item.quantity}
              <button type="button" title="增加数量" data-qty-type="${item.id}" data-delta="1">＋</button>
            </span>
          </div>
          <button class="mini-btn" title="删除字模" data-delete-type="${item.id}" type="button">×</button>
        </article>
      `;
    })
    .join("");
}

function activeProof() {
  return state.proofs.find((proof) => proof.id === state.activeProofId) || null;
}

function latestRound(proof) {
  return proof.rounds.length ? proof.rounds[proof.rounds.length - 1] : null;
}

// 待校校样最近一次登记的错字格 -> 正字，用作版面占用提示
function pendingErrorMap(proof) {
  if (!proof || proof.status !== "pending") return {};
  const round = latestRound(proof);
  return round && !round.approved ? round.errors : {};
}

function renderStage() {
  const { cols, rows } = getGrid();
  const map = new Map(state.placements.map((item) => [placementKey(item.row, item.col), item]));
  const errorMap = pendingErrorMap(activeProof());
  els.stage.className = `stage ${state.settings.paperSize}`;
  els.stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${state.settings.gridGap}px`;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = placementKey(row, col);
      const placement = map.get(key);
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = state.settings.flowMode === "vertical" ? "vertical" : "";
      const correct = errorMap[key];
      const errMark = correct
        ? `<span class="err-mark" title="错字格 ${cellLabel(row, col)}，应为「${escapeHtml(correct)}」">误</span>`
        : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical}" data-row="${row}" data-col="${col}" type="button" aria-label="第${row + 1}行第${col + 1}列">
          ${type ? escapeHtml(type.char) : ""}${errMark}
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

  const shortages = getShortages();
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

function renderRound(proof, round) {
  const versionChip = `<span class="proof-chip" data-proof-view="${proof.id}:${round.version}">V${round.version}</span>`;
  if (round.approved) {
    return `
      <div class="round-item approve">
        <div class="round-line">
          <span>${roundLabel(round.round)} · ${escapeHtml(round.reader)} · 通过付印 ${versionChip}</span>
        </div>
        ${round.note ? `<div class="round-note">${escapeHtml(round.note)}</div>` : ""}
      </div>
    `;
  }
  const tags = Object.keys(round.errors)
    .map((key) => {
      const { row, col } = parseCellKey(key);
      return `<span class="error-cell-tag">${cellLabel(row, col)} 应为「${escapeHtml(round.errors[key])}」</span>`;
    })
    .join("");
  return `
    <div class="round-item">
      <div class="round-line">
        <strong>${roundLabel(round.round)} · ${escapeHtml(round.reader)} · 返修</strong>
        ${versionChip}
      </div>
      <div class="error-cell-tags">${tags}</div>
      <div class="round-note">${escapeHtml(round.note)}</div>
    </div>
  `;
}

function renderProofCard(proof, isActive) {
  const statusTag =
    proof.status === "approved"
      ? `<span class="proof-tag approved">已通过</span>`
      : `<span class="proof-tag pending">待校</span>`;
  const rounds = proof.rounds.map((round) => renderRound(proof, round)).join("");
  const actions = isActive
    ? `
      <div class="proof-actions">
        <button type="button" data-proof-register="${proof.id}">登记下一校次</button>
        <button type="button" data-proof-delete="${proof.id}">作废</button>
      </div>`
    : `
      <div class="proof-actions">
        <button type="button" data-proof-load="${proof.id}">载入版面</button>
        <button type="button" data-proof-delete="${proof.id}">删除</button>
      </div>`;
  return `
    <article class="proof-card ${isActive ? "" : "archived"}">
      <div class="proof-card-head">
        <strong>《${escapeHtml(proof.title)}》</strong>
        ${statusTag}
      </div>
      <div class="proof-meta">
        ${proof.rounds.length}个校次 · 更新于 ${new Date(proof.updatedAt).toLocaleString("zh-CN")}
      </div>
      <span class="proof-chip" data-proof-view="${proof.id}:${proof.currentVersion}">查看当前版 V${proof.currentVersion}</span>
      <div class="rounds">${rounds || `<span class="proof-meta">尚未登记校次。</span>`}</div>
      ${actions}
    </article>
  `;
}

function renderProofs() {
  if (!state.proofs.length) {
    els.proofList.innerHTML = `<p class="empty">还没有送校的校样。</p>`;
    return;
  }
  const active = activeProof();
  const others = state.proofs.filter((proof) => proof !== active);
  els.proofList.innerHTML = [active, ...others].filter(Boolean).map((proof) => renderProofCard(proof, proof === active)).join("");
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
  renderProofs();
  renderDrafts();
}

// ---------- 付印校次 ----------

function liveSignature() {
  const placements = state.placements
    .map((item) => `${item.row}:${item.col}:${item.typeId}`)
    .sort()
    .join("|");
  const quantities = state.inventory
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join("|");
  return `${placements}##${quantities}`;
}

function makeSnapshot(reason) {
  return {
    reason,
    createdAt: new Date().toISOString(),
    settings: structuredClone(state.settings),
    placements: structuredClone(state.placements),
    inventory: structuredClone(state.inventory),
    signature: liveSignature()
  };
}

function createProof() {
  return {
    id: crypto.randomUUID(),
    title: state.settings.workTitle.trim() || "未命名作品",
    currentVersion: 1,
    status: "pending",
    versions: [{ version: 1, ...makeSnapshot("首次送校") }],
    rounds: [],
    cellStreaks: {},
    lastProofreader: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 落字或字模数量改动：已通过/待校校样立刻恢复待校，并生成只读新版本
function bumpActiveProof(reason) {
  const proof = activeProof();
  if (!proof) return;
  proof.status = "pending";
  const signature = liveSignature();
  const last = proof.versions[proof.versions.length - 1];
  if (!last || last.signature !== signature) {
    proof.currentVersion += 1;
    proof.versions.push({ version: proof.currentVersion, ...makeSnapshot(reason) });
  }
  proof.updatedAt = new Date().toISOString();
}

function validateProofData(proof, data) {
  const problems = [];
  if (!data.reader) problems.push("未登记校对人，整次送校拒绝。");
  if (!state.settings.workTitle.trim()) problems.push("作品名为空，不能送校付印。");

  const shortages = getShortages();
  if (shortages.length) {
    const names = shortages.map((item) => `${item.char}（需${getUsage()[item.id]}／存${item.quantity}）`).join("、");
    problems.push(`仍有超量字模：${names}，整次送校拒绝。`);
  }

  const errorKeys = Object.keys(data.errors);
  errorKeys.forEach((key) => {
    if (!data.errors[key].trim()) {
      const { row, col } = parseCellKey(key);
      problems.push(`${cellLabel(row, col)}标记为错字格但未登记正字。`);
    }
  });

  if (errorKeys.length && !data.note.trim()) {
    problems.push("登记了错字格但返修说明为空，请填写返修说明。");
  }

  const willApprove = errorKeys.length === 0;
  if (willApprove && proof) {
    const blocked = Object.entries(proof.cellStreaks)
      .filter(([, streak]) => streak >= 2)
      .map(([key]) => {
        const { row, col } = parseCellKey(key);
        return cellLabel(row, col);
      });
    if (blocked.length && proof.lastProofreader && data.reader === proof.lastProofreader) {
      problems.push(`${blocked.join("、")}已连续返修两次，必须更换校对人才能再次通过（上次校对人：${proof.lastProofreader}）。`);
    }
  }
  return problems;
}

function submitProof() {
  if (!modalCtx || modalCtx.mode !== "register") return;
  const reader = els.proofReader.value.trim();
  const note = els.proofNote.value.trim();
  const errors = {};
  Object.entries(modalCtx.errors).forEach(([key, value]) => {
    if (value.trim()) errors[key] = value.trim();
  });

  let proof = activeProof();
  const problems = validateProofData(proof, { reader, note, errors });
  if (problems.length) {
    renderProofProblems(problems);
    return;
  }

  if (!proof) {
    proof = createProof();
    state.proofs.unshift(proof);
    state.activeProofId = proof.id;
  } else {
    // 提交时若版面相对上一版本已有改动，先固化新版本
    const signature = liveSignature();
    const last = proof.versions[proof.versions.length - 1];
    if (!last || last.signature !== signature) {
      proof.currentVersion += 1;
      proof.versions.push({ version: proof.currentVersion, ...makeSnapshot("送校前版面改动") });
    }
  }

  const approved = Object.keys(errors).length === 0;
  const round = {
    round: proof.rounds.length + 1,
    reader,
    note,
    errors: approved ? {} : structuredClone(errors),
    approved,
    version: proof.currentVersion,
    at: new Date().toISOString()
  };
  proof.rounds.push(round);
  proof.lastProofreader = reader;

  if (approved) {
    proof.status = "approved";
    proof.cellStreaks = {};
  } else {
    proof.status = "pending";
    const nextStreaks = {};
    Object.keys(errors).forEach((key) => {
      nextStreaks[key] = (proof.cellStreaks[key] || 0) + 1;
    });
    proof.cellStreaks = nextStreaks;
  }
  proof.updatedAt = new Date().toISOString();

  closeProofModal();
  renderAll();
}

function snapshotForView(proof, version) {
  const snap = proof.versions.find((item) => item.version === version) || proof.versions[proof.versions.length - 1];
  return snap || null;
}

function openRegisterModal(proof) {
  modalCtx = { mode: "register", proofId: proof ? proof.id : null, version: proof ? proof.currentVersion : null, errors: {} };
  els.proofModalTitle.textContent = proof
    ? `送校登记 · 第${proof.rounds.length + 1}校次 · V${proof.currentVersion}`
    : "首次送校登记";
  els.proofModalBanner.hidden = true;
  els.proofForm.inert = false;
  els.proofModal.classList.remove("view");
  els.proofSubmitBtn.hidden = false;
  els.proofReader.value = "";
  els.proofNote.value = "";
  els.proofHint.textContent = "存在超量字模、空作品名或错字格未登记时，整次拒绝且版面不变。";
  els.proofModal.hidden = false;
  renderProofModal();
}

function openViewModal(proofId, version) {
  const proof = state.proofs.find((item) => item.id === proofId);
  if (!proof) return;
  const snap = snapshotForView(proof, version);
  if (!snap) return;
  modalCtx = { mode: "view", proofId, version: snap.version, errors: {} };
  els.proofModalTitle.textContent = `《${proof.title}》V${snap.version} 校样`;
  els.proofModalBanner.hidden = false;
  els.proofModalBanner.className = "modal-banner readonly";
  els.proofModalBanner.textContent = `只读历史版本（${snap.reason} · ${new Date(snap.createdAt).toLocaleString("zh-CN")}），旧版本不可改动。`;
  els.proofForm.inert = true;
  els.proofModal.classList.add("view");
  els.proofSubmitBtn.hidden = true;
  els.proofProblems.hidden = true;
  els.proofHint.textContent = "";
  els.proofModal.hidden = false;
  renderProofModal();
}

function closeProofModal() {
  els.proofModal.hidden = true;
  els.proofForm.inert = false;
  els.proofModal.classList.remove("view");
  modalCtx = null;
}

function renderProofProblems(problems) {
  if (!problems.length) {
    els.proofProblems.hidden = true;
    els.proofProblems.innerHTML = "";
    els.proofSubmitBtn.disabled = false;
    els.proofSubmitBtn.title = "";
    return;
  }
  els.proofProblems.hidden = false;
  els.proofProblems.innerHTML = problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join("");
  els.proofSubmitBtn.disabled = true;
  els.proofSubmitBtn.title = "闸门未通过，整次送校拒绝";
}

function renderProofModal() {
  if (!modalCtx) return;
  const proof = modalCtx.proofId ? state.proofs.find((item) => item.id === modalCtx.proofId) : activeProof();

  let settings;
  let placements;
  let inventory;
  let marks = {};

  if (modalCtx.mode === "view") {
    const viewProof = state.proofs.find((item) => item.id === modalCtx.proofId);
    const snap = snapshotForView(viewProof, modalCtx.version);
    settings = snap.settings;
    placements = snap.placements;
    inventory = snap.inventory;
    viewProof.rounds
      .filter((round) => round.version === snap.version)
      .forEach((round) => {
        marks = { ...marks, ...round.errors };
      });
  } else {
    settings = state.settings;
    placements = state.placements;
    inventory = state.inventory;
    marks = modalCtx.errors;
  }

  const { cols, rows } = getGrid(settings.paperSize);
  const map = new Map(placements.map((item) => [placementKey(item.row, item.col), item]));
  els.proofGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.proofGrid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = placementKey(row, col);
      const placement = map.get(key);
      const type = placement ? inventory.find((item) => item.id === placement.typeId) : null;
      const marked = marks[key] !== undefined;
      const mark = marked ? `<span class="err-mark">误</span>` : "";
      cells.push(`
        <button type="button" class="proof-cell ${marked ? "marked" : ""}" data-proof-cell="${key}" title="${cellLabel(row, col)}">
          ${type ? escapeHtml(type.char) : ""}${mark}
        </button>
      `);
    }
  }
  els.proofGrid.innerHTML = cells.join("");

  if (modalCtx.mode === "register") {
    els.errorRows.innerHTML = Object.keys(modalCtx.errors)
      .map((key) => {
        const { row, col } = parseCellKey(key);
        return `
          <div class="error-row">
            <label>${cellLabel(row, col)}</label>
            <input type="text" maxlength="2" placeholder="登记正字" data-error-key="${key}" value="${escapeHtml(modalCtx.errors[key])}" />
          </div>
        `;
      })
      .join("");

    const problems = validateProofData(proof, {
      reader: els.proofReader.value.trim(),
      note: els.proofNote.value.trim(),
      errors: modalCtx.errors
    });
    renderProofProblems(problems);
  } else {
    els.errorRows.innerHTML = Object.keys(marks)
      .map((key) => {
        const { row, col } = parseCellKey(key);
        return `
          <div class="error-row">
            <label>${cellLabel(row, col)}</label>
            <input type="text" value="应为「${escapeHtml(marks[key])}」" disabled />
          </div>
        `;
      })
      .join("");
  }
}

// ---------- 版面与字模操作 ----------

function placeType(row, col, typeId = state.selectedTypeId) {
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
  bumpActiveProof("落字调整");
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

// ---------- 事件 ----------

els.paperSize.addEventListener("change", () => {
  state.settings.paperSize = els.paperSize.value;
  const { cols, rows } = getGrid();
  state.placements = state.placements.filter((item) => item.row < rows && item.col < cols);
  bumpActiveProof("纸张调整");
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

els.typeForm.addEventListener("submit", addType);
els.inventorySearch.addEventListener("input", renderInventory);
els.styleFilter.addEventListener("change", renderInventory);
els.saveDraftBtn.addEventListener("click", saveDraft);
els.exportBtn.addEventListener("click", exportPreview);
els.clearBoardBtn.addEventListener("click", () => {
  state.placements = [];
  bumpActiveProof("清空版面");
  renderAll();
});

els.typeList.addEventListener("click", (event) => {
  const qtyButton = event.target.closest("[data-qty-type]");
  if (qtyButton) {
    const item = state.inventory.find((entry) => entry.id === qtyButton.dataset.qtyType);
    if (!item) return;
    item.quantity = Math.min(99, Math.max(1, item.quantity + Number(qtyButton.dataset.delta)));
    bumpActiveProof("字模数量调整");
    renderAll();
    return;
  }
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    const typeId = deleteButton.dataset.deleteType;
    state.inventory = state.inventory.filter((item) => item.id !== typeId);
    state.placements = state.placements.filter((item) => item.typeId !== typeId);
    if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
    bumpActiveProof("字模调整");
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
  placeType(Number(cell.dataset.row), Number(cell.dataset.col));
});

els.draftList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-draft]");
  const deleteButton = event.target.closest("[data-delete-draft]");
  if (loadButton) {
    const draft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (!draft) return;
    state.settings = structuredClone(draft.settings);
    state.placements = structuredClone(draft.placements);
    bumpActiveProof("载入草稿");
    renderAll();
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

// 校次面板
els.sendProofBtn.addEventListener("click", () => openRegisterModal(activeProof()));
els.proofModalClose.addEventListener("click", closeProofModal);
els.proofModal.addEventListener("click", (event) => {
  if (event.target === els.proofModal) closeProofModal();
});
els.proofForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitProof();
});
els.proofReader.addEventListener("input", renderProofModal);
els.proofNote.addEventListener("input", renderProofModal);

els.proofGrid.addEventListener("click", (event) => {
  if (!modalCtx || modalCtx.mode !== "register") return;
  const cell = event.target.closest("[data-proof-cell]");
  if (!cell) return;
  const key = cell.dataset.proofCell;
  if (key in modalCtx.errors) delete modalCtx.errors[key];
  else modalCtx.errors[key] = "";
  renderProofModal();
});

els.errorRows.addEventListener("input", (event) => {
  if (!modalCtx || modalCtx.mode !== "register") return;
  const input = event.target.closest("[data-error-key]");
  if (!input) return;
  modalCtx.errors[input.dataset.errorKey] = input.value;
  const problems = validateProofData(activeProof(), {
    reader: els.proofReader.value.trim(),
    note: els.proofNote.value.trim(),
    errors: modalCtx.errors
  });
  renderProofProblems(problems);
});

els.proofList.addEventListener("click", (event) => {
  const registerButton = event.target.closest("[data-proof-register]");
  const deleteButton = event.target.closest("[data-proof-delete]");
  const loadButton = event.target.closest("[data-proof-load]");
  const viewButton = event.target.closest("[data-proof-view]");

  if (registerButton) {
    const proof = state.proofs.find((item) => item.id === registerButton.dataset.proofRegister);
    if (proof && proof === activeProof()) openRegisterModal(proof);
    return;
  }
  if (deleteButton) {
    state.proofs = state.proofs.filter((item) => item.id !== deleteButton.dataset.proofDelete);
    if (state.activeProofId === deleteButton.dataset.proofDelete) state.activeProofId = null;
    renderAll();
    return;
  }
  if (loadButton) {
    const proof = state.proofs.find((item) => item.id === loadButton.dataset.proofLoad);
    if (!proof) return;
    const snap = proof.versions[proof.versions.length - 1];
    state.settings = structuredClone(snap.settings);
    state.placements = structuredClone(snap.placements);
    snap.inventory.forEach((snapped) => {
      const existing = state.inventory.find((item) => item.id === snapped.id);
      if (existing) {
        existing.quantity = snapped.quantity;
      } else {
        state.inventory.push(structuredClone(snapped));
      }
    });
    state.activeProofId = proof.id;
    renderAll();
    return;
  }
  if (viewButton) {
    const [proofId, version] = viewButton.dataset.proofView.split(":");
    openViewModal(proofId, Number(version));
  }
});

// 跨标签页浏览器数据同步
window.addEventListener("storage", (event) => {
  if (event.key !== storageKey) return;
  state = loadState();
  closeProofModal();
  renderAll();
});

renderAll();
