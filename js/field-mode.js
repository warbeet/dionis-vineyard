// ============================================================================
// FIELD MODE v0.8.6 — Полевой режим (горизонтальная полоса кустов в ряду)
// ============================================================================
// Один ряд на экране, кусты листаются горизонтально.
// Категории: Здоровый / Выпад / Больной / Угнетённый / Подвой
// ============================================================================

let fieldMode = {
  active: false,
  plotId: null,
  plot: null,
  currentRow: 1,
  selectedPos: null,
  gpsPosition: null
};

const FIELD_STATUSES = {
  healthy:   { label: 'Здоровый',   icon: '🟢', color: '#4CAF50' },
  dead:      { label: 'Выпад',      icon: '⚫', color: '#6D4C41' },
  sick:      { label: 'Больной',    icon: '🔴', color: '#E53935' },
  stunted:   { label: 'Угнетённый', icon: '🟡', color: '#F9A825' },
  rootstock: { label: 'Подвой',     icon: '🟣', color: '#8E24AA' }
};

function toggleFieldMode() {
  fieldMode.active = !fieldMode.active;
  const overlay = document.getElementById('field-mode-overlay');
  if (fieldMode.active) {
    overlay.classList.add('fm-visible');
    initFieldMode();
  } else {
    overlay.classList.remove('fm-visible');
    fieldMode.selectedPos = null;
  }
}

function initFieldMode() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => { fieldMode.gpsPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      err => console.warn('GPS:', err)
    );
  }
  const plotSelect = document.getElementById('field-plot-select');
  if (plotSelect && data.plots && data.plots.length) {
    plotSelect.innerHTML = data.plots.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    fieldMode.plotId = data.plots[0].id;
    fieldMode.plot = data.plots[0];
    fieldMode.currentRow = 1;
    fieldMode.selectedPos = null;
    renderFieldView();
  }
}

function selectFieldPlot(plotId) {
  fieldMode.plotId = plotId;
  fieldMode.plot = data.plots.find(p => p.id === plotId);
  fieldMode.currentRow = 1;
  fieldMode.selectedPos = null;
  renderFieldView();
}

function getSeedling(plotId, row, position) {
  if (data.seedlings) {
    const real = data.seedlings.find(s => s.plot_id === plotId && s.row === row && s.position === position);
    if (real) return real;
  }
  return { status: 'healthy', _virtual: true };
}

// ===== НАВИГАЦИЯ ПО РЯДАМ =====
function prevRow() {
  if (fieldMode.currentRow > 1) {
    fieldMode.currentRow--;
    fieldMode.selectedPos = null;
    renderFieldView();
  }
}
function nextRow() {
  if (fieldMode.plot && fieldMode.currentRow < fieldMode.plot.rows.length) {
    fieldMode.currentRow++;
    fieldMode.selectedPos = null;
    renderFieldView();
  }
}
function jumpToRow() {
  const input = document.getElementById('field-jump-row');
  if (!input) return;
  const n = parseInt(input.value);
  if (n && n >= 1 && fieldMode.plot && n <= fieldMode.plot.rows.length) {
    fieldMode.currentRow = n;
    fieldMode.selectedPos = null;
    renderFieldView();
    input.value = '';
  }
}

// ===== РЕНДЕР =====
function renderFieldView() {
  if (!fieldMode.plot) return;
  
  const plot = fieldMode.plot;
  const rows = plot.rows;
  const row = rows.find(r => r.number === fieldMode.currentRow);
  if (!row) return;
  
  const posCount = row.positions_count || 0;
  
  // Header info
  const infoEl = document.getElementById('field-plot-info');
  if (infoEl) {
    const total = rows.reduce((s, r) => s + (r.positions_count || 0), 0);
    infoEl.textContent = `${rows.length} рядов · ${total} кустов · сейчас ряд ${fieldMode.currentRow} (${posCount} кустов)`;
  }
  
  // Row number
  const rowNumEl = document.getElementById('field-row-number');
  if (rowNumEl) rowNumEl.textContent = fieldMode.currentRow;
  const rowTotalEl = document.getElementById('field-row-total');
  if (rowTotalEl) rowTotalEl.textContent = rows.length;
  
  // Buttons
  const prevBtn = document.getElementById('fm-prev-row');
  const nextBtn = document.getElementById('fm-next-row');
  if (prevBtn) prevBtn.disabled = fieldMode.currentRow <= 1;
  if (nextBtn) nextBtn.disabled = fieldMode.currentRow >= rows.length;
  
  // Seedling strip (горизонтальная прокрутка)
  const strip = document.getElementById('field-seedling-strip');
  if (strip) {
    let html = '';
    for (let p = 1; p <= posCount; p++) {
      const seedling = getSeedling(fieldMode.plotId, fieldMode.currentRow, p);
      const st = FIELD_STATUSES[seedling.status] || FIELD_STATUSES.healthy;
      const isSel = fieldMode.selectedPos === p;
      html += `<div class="fm-seedling${isSel ? ' fm-sel' : ''}" 
        data-pos="${p}" onclick="selectFieldPos(${p})"
        style="--cell-bg:${st.color}"
        title="К${p}: ${st.label}">
        <span class="fm-seedling-num">${p}</span>
      </div>`;
    }
    strip.innerHTML = html;
    
    // Прокрутить к выбранному
    if (fieldMode.selectedPos) {
      const selEl = strip.querySelector(`[data-pos="${fieldMode.selectedPos}"]`);
      if (selEl) selEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }
  
  renderFieldSelectionInfo();
}

function selectFieldPos(position) {
  fieldMode.selectedPos = position;
  renderFieldView();
  if (navigator.vibrate) navigator.vibrate(15);
}

function renderFieldSelectionInfo() {
  const el = document.getElementById('field-selection-info');
  if (!el) return;
  if (!fieldMode.selectedPos) {
    el.innerHTML = '<span class="fm-hint">Тапните на куст в полосе</span>';
    return;
  }
  const p = fieldMode.selectedPos;
  const st = FIELD_STATUSES[getSeedling(fieldMode.plotId, fieldMode.currentRow, p).status] || FIELD_STATUSES.healthy;
  el.innerHTML = `<strong>Р${fieldMode.currentRow} К${p}</strong> <span class="fm-status-badge" style="background:${st.color}">${st.label}</span>`;
}

// ===== ПРИМЕНЕНИЕ СТАТУСА =====
function applyFieldStatus(status) {
  if (!fieldMode.selectedPos) {
    toast('Сначала выберите куст', 'error');
    return;
  }
  
  const row = fieldMode.currentRow;
  const pos = fieldMode.selectedPos;
  
  let seedling = null;
  if (data.seedlings) seedling = data.seedlings.find(s => s.plot_id === fieldMode.plotId && s.row === row && s.position === pos);
  
  const oldStatus = seedling ? seedling.status : 'healthy';
  
  if (!seedling) {
    if (!data.seedlings) data.seedlings = [];
    seedling = {
      id: 's_' + fieldMode.plotId + '_' + row + '_' + pos + '_' + Date.now().toString(36),
      plot_id: fieldMode.plotId, row, position: pos,
      status: oldStatus, is_replanted: false,
      ai_data: null, inspections: [],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    data.seedlings.push(seedling);
  }
  
  if (seedling.status === status) {
    toast('Уже установлен', 'info');
    return;
  }
  
  seedling.status = status;
  seedling.updated_at = new Date().toISOString();
  if (fieldMode.gpsPosition && !seedling.gps) seedling.gps = { ...fieldMode.gpsPosition };
  if (!seedling.inspections) seedling.inspections = [];
  seedling.inspections.push({
    id: 'i_' + Date.now(), date: new Date().toISOString().slice(0, 10),
    type: 'field-mode', inspector: 'Полевой режим',
    status_before: oldStatus, status_after: status, notes: ''
  });
  
  saveData();
  toast(`Р${row} К${pos}: ${FIELD_STATUSES[status].label}`, 'success');
  
  // Авто-переход на следующий куст
  const rowData = fieldMode.plot.rows.find(r => r.number === row);
  if (rowData && pos < rowData.positions_count) {
    setTimeout(() => selectFieldPos(pos + 1), 120);
  } else {
    // Конец ряда — следующий ряд
    const rowIdx = fieldMode.plot.rows.findIndex(r => r.number === row);
    if (rowIdx >= 0 && rowIdx < fieldMode.plot.rows.length - 1) {
      fieldMode.currentRow = fieldMode.plot.rows[rowIdx + 1].number;
      fieldMode.selectedPos = 1;
      renderFieldView();
    } else {
      fieldMode.selectedPos = null;
      renderFieldView();
      toast('Обход завершён', 'success');
    }
  }
}

// ===== ЗАМЕТКИ =====
function openFieldNote() {
  if (!fieldMode.selectedPos) { toast('Выберите куст', 'error'); return; }
  const c = document.getElementById('field-note-context');
  if (c) c.textContent = `Ряд ${fieldMode.currentRow}, куст ${fieldMode.selectedPos}`;
  const m = document.getElementById('field-note-modal');
  if (m) m.classList.add('fm-modal-open');
}

function saveFieldNote() {
  const note = document.getElementById('field-note-text').value.trim();
  if (!note) return;
  const row = fieldMode.currentRow, pos = fieldMode.selectedPos;
  let seedling = null;
  if (data.seedlings) seedling = data.seedlings.find(s => s.plot_id === fieldMode.plotId && s.row === row && s.position === pos);
  if (!seedling) {
    if (!data.seedlings) data.seedlings = [];
    seedling = {
      id: 's_' + fieldMode.plotId + '_' + row + '_' + pos + '_' + Date.now().toString(36),
      plot_id: fieldMode.plotId, row, position: pos, status: 'healthy',
      inspections: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    data.seedlings.push(seedling);
  }
  if (!seedling.inspections) seedling.inspections = [];
  seedling.inspections.push({
    id: 'i_' + Date.now(), date: new Date().toISOString().slice(0, 10),
    type: 'field-mode', inspector: 'Полевой режим',
    status_before: seedling.status, status_after: seedling.status, notes: note
  });
  seedling.updated_at = new Date().toISOString();
  saveData();
  toast('Заметка сохранена', 'success');
  closeFieldNote();
}

function closeFieldNote() {
  const m = document.getElementById('field-note-modal');
  if (m) m.classList.remove('fm-modal-open');
  const t = document.getElementById('field-note-text');
  if (t) t.value = '';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.createElement('div');
  overlay.id = 'field-mode-overlay';
  overlay.innerHTML = `
    <div class="fm-shell">
      <!-- HEADER -->
      <div class="fm-header">
        <div class="fm-title-row">
          <h2 class="fm-title">🌱 Поле</h2>
          <button class="fm-close-btn" onclick="toggleFieldMode()">✖</button>
        </div>
        <select id="field-plot-select" onchange="selectFieldPlot(this.value)" class="fm-select"></select>
        <div class="fm-row-nav">
          <button class="fm-row-btn" id="fm-prev-row" onclick="prevRow()">◀</button>
          <div class="fm-row-display">
            <span class="fm-row-label-text">Ряд</span>
            <span id="field-row-number" class="fm-row-num">—</span>
            <span class="fm-row-total">/ <span id="field-row-total">—</span></span>
          </div>
          <button class="fm-row-btn" id="fm-next-row" onclick="nextRow()">▶</button>
          <input type="number" id="field-jump-row" placeholder="№" min="1" class="fm-jump-input" onkeypress="if(event.key==='Enter')jumpToRow()">
        </div>
        <div id="field-plot-info" class="fm-info">—</div>
      </div>
      
      <!-- ПОЛОСА КУСТОВ (горизонтальный скролл) -->
      <div class="fm-strip-area">
        <div class="fm-strip-label">Кусты в ряду →</div>
        <div class="fm-strip-scroll" id="field-seedling-strip"></div>
      </div>
      
      <!-- ВЫБОР + СТАТУСЫ -->
      <div class="fm-bottom-bar">
        <div id="field-selection-info" class="fm-selection-text">
          <span class="fm-hint">Тапните на куст в полосе</span>
        </div>
        <div class="fm-status-grid">
          <button class="fm-status-btn fm-healthy" onclick="applyFieldStatus('healthy')"><span class="fm-s-icon">🟢</span><span class="fm-s-label">Здоровый</span></button>
          <button class="fm-status-btn fm-dead" onclick="applyFieldStatus('dead')"><span class="fm-s-icon">⚫</span><span class="fm-s-label">Выпад</span></button>
          <button class="fm-status-btn fm-sick" onclick="applyFieldStatus('sick')"><span class="fm-s-icon">🔴</span><span class="fm-s-label">Больной</span></button>
          <button class="fm-status-btn fm-stunted" onclick="applyFieldStatus('stunted')"><span class="fm-s-icon">🟡</span><span class="fm-s-label">Угнет.</span></button>
          <button class="fm-status-btn fm-rootstock" onclick="applyFieldStatus('rootstock')"><span class="fm-s-icon">🟣</span><span class="fm-s-label">Подвой</span></button>
        </div>
        <button class="fm-note-btn" onclick="openFieldNote()">📝 Заметка</button>
      </div>
    </div>
    
    <div class="fm-note-modal" id="field-note-modal">
      <div class="fm-note-modal-content">
        <h3>📝 Заметка</h3>
        <div id="field-note-context" class="fm-note-context"></div>
        <textarea id="field-note-text" rows="4" placeholder="Симптомы, наблюдения..."></textarea>
        <div class="fm-note-actions">
          <button class="fm-save-btn" onclick="saveFieldNote()">💾 Сохранить</button>
          <button class="fm-cancel-btn" onclick="closeFieldNote()">Отмена</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
});
