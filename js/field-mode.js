// ============================================================================
// FIELD MODE module v0.8.4 — Полевой режим (таблица: ряды=колонки, кусты=строки)
// ============================================================================

let fieldMode = {
  active: false,
  plotId: null,
  plot: null,
  selectedCell: null, // {row, position}
  gpsPosition: null,
  maxVisiblePositions: 30 // ограничение для производительности
};

// ===== СТАТУСЫ КУСТА =====
const FIELD_STATUSES = {
  healthy:   { label: 'Здоровый',   icon: '', color: '#4CAF50', textColor: '#fff' },
  dead:      { label: 'Выпад',      icon: '⚫', color: '#5D4037', textColor: '#fff' },
  sick:      { label: 'Больной',    icon: '🔴', color: '#E53935', textColor: '#fff' },
  stunted:   { label: 'Угнетённый', icon: '🟡', color: '#FDD835', textColor: '#333' },
  rootstock: { label: 'Подвой',     icon: '🟣', color: '#8E24AA', textColor: '#fff' }
};

function toggleFieldMode() {
  fieldMode.active = !fieldMode.active;
  const overlay = document.getElementById('field-mode-overlay');
  
  if (fieldMode.active) {
    overlay.style.display = 'block';
    initFieldMode();
  } else {
    overlay.style.display = 'none';
    fieldMode.selectedCell = null;
  }
}

function initFieldMode() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        fieldMode.gpsPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      },
      err => console.warn('GPS ошибка:', err)
    );
  }
  
  const plotSelect = document.getElementById('field-plot-select');
  if (plotSelect && data.plots && data.plots.length) {
    plotSelect.innerHTML = data.plots.map(p => 
      `<option value="${p.id}">${escapeHtml(p.name)}</option>`
    ).join('');
    fieldMode.plotId = data.plots[0].id;
    fieldMode.plot = data.plots[0];
    fieldMode.selectedCell = null;
    renderFieldGrid();
  }
}

function selectFieldPlot(plotId) {
  fieldMode.plotId = plotId;
  fieldMode.plot = data.plots.find(p => p.id === plotId);
  fieldMode.selectedCell = null;
  renderFieldGrid();
}

// ===== ПОЛУЧИТЬ КУСТ =====
function getSeedling(plotId, row, position) {
  if (data.seedlings) {
    const real = data.seedlings.find(s => 
      s.plot_id === plotId && s.row === row && s.position === position
    );
    if (real) return real;
  }
  return {
    id: `s_${plotId}_${row}_${position}_v`,
    plot_id: plotId,
    row: row,
    position: position,
    status: 'healthy',
    _virtual: true
  };
}

// ===== РЕНДЕР СЕТКИ =====
// Ось X (колонки) = ряды
// Ось Y (строки) = позиции кустов
function renderFieldGrid() {
  if (!fieldMode.plot) return;
  
  const plot = fieldMode.plot;
  const rows = plot.rows || [];
  const totalRows = rows.length;
  const maxPositions = Math.max(...rows.map(r => r.positions_count || 0));
  const totalSeedlings = rows.reduce((sum, r) => sum + (r.positions_count || 0), 0);
  
  // Инфо
  const infoEl = document.getElementById('field-plot-info');
  if (infoEl) {
    infoEl.textContent = `${totalRows} рядов · ${totalSeedlings} кустов · макс. ${maxPositions} кустов/ряд`;
  }
  
  // Ограничение видимых позиций для производительности
  const visiblePositions = Math.min(maxPositions, fieldMode.maxVisiblePositions);
  const hasMore = maxPositions > fieldMode.maxVisiblePositions;
  
  const container = document.getElementById('field-seedlings-grid');
  if (!container) return;
  
  let html = '<div class="field-table-container">';
  html += '<table class="field-table">';
  
  // ШАПКА: первая ячейка "Куст/Ряд" + колонки рядов
  html += '<thead><tr><th class="corner-header">Куст \\ Ряд</th>';
  rows.forEach(row => {
    html += `<th class="row-header-col" title="Ряд ${row.number} (${row.positions_count} кустов)">${row.number}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  // СТРОКИ: каждая строка = позиция куста
  for (let pos = 1; pos <= visiblePositions; pos++) {
    html += `<tr class="field-row">`;
    // Первая ячейка — номер позиции
    html += `<td class="pos-header">${pos}</td>`;
    
    // Ячейки по рядам
    rows.forEach(row => {
      const rowNum = row.number;
      const posCount = row.positions_count || 0;
      
      if (pos > posCount) {
        // Пусто (ряд короче)
        html += `<td class="field-cell empty"></td>`;
      } else {
        const seedling = getSeedling(fieldMode.plotId, rowNum, pos);
        const status = FIELD_STATUSES[seedling.status] || FIELD_STATUSES.healthy;
        const isSelected = fieldMode.selectedCell && 
                          fieldMode.selectedCell.row === rowNum && 
                          fieldMode.selectedCell.position === pos;
        const selectedStyle = isSelected 
          ? 'box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--primary, #5a8fd4); transform: scale(1.25); z-index: 2;' 
          : '';
        
        html += `<td class="field-cell" 
          data-row="${rowNum}" 
          data-position="${pos}" 
          onclick="selectFieldSeedling(${rowNum}, ${pos})"
          style="background: ${status.color}; color: ${status.textColor}; cursor: pointer; ${selectedStyle}"
          title="Р${rowNum} К${pos}: ${status.label}">
        </td>`;
      }
    });
    
    html += '</tr>';
  }
  
  html += '</tbody></table></div>';
  
  if (hasMore) {
    html += `<div style="text-align: center; padding: 8px; font-size: 12px; color: var(--text-muted, #888);">
      Показаны первые ${visiblePositions} из ${maxPositions} кустов. 
      <button class="btn small" onclick="showMorePositions()" style="margin-left: 6px; padding: 4px 10px;">Показать все</button>
    </div>`;
  }
  
  container.innerHTML = html;
  renderFieldSelectionInfo();
}

function showMorePositions() {
  fieldMode.maxVisiblePositions = 999;
  renderFieldGrid();
}

// ===== ВЫБОР КУСТА =====
function selectFieldSeedling(row, position) {
  fieldMode.selectedCell = { row, position };
  renderFieldGrid();
  if (navigator.vibrate) navigator.vibrate(15);
}

function renderFieldSelectionInfo() {
  const infoEl = document.getElementById('field-selection-info');
  if (!infoEl) return;
  
  if (!fieldMode.selectedCell) {
    infoEl.innerHTML = '<span style="color: var(--text-muted, #888);">Тапните на куст, чтобы выбрать</span>';
    return;
  }
  
  const { row, position } = fieldMode.selectedCell;
  const seedling = getSeedling(fieldMode.plotId, row, position);
  const status = FIELD_STATUSES[seedling.status] || FIELD_STATUSES.healthy;
  
  infoEl.innerHTML = `
    <strong>Ряд ${row}, куст ${position}</strong>
    <span style="margin-left: 10px; padding: 2px 8px; border-radius: 4px; background: ${status.color}; color: ${status.textColor}; font-size: 12px;">
      ${status.icon} ${status.label}
    </span>
  `;
}

// ===== ПРИМЕНЕНИЕ СТАТУСА =====
function applyFieldStatus(status) {
  if (!fieldMode.selectedCell) {
    toast('Сначала выберите куст (тапните на него)', 'error');
    return;
  }
  
  const { row, position } = fieldMode.selectedCell;
  
  let seedling = null;
  if (data.seedlings) {
    seedling = data.seedlings.find(s => 
      s.plot_id === fieldMode.plotId && s.row === row && s.position === position
    );
  }
  
  const oldStatus = seedling ? seedling.status : 'healthy';
  
  if (!seedling) {
    if (!data.seedlings) data.seedlings = [];
    seedling = {
      id: 's_' + fieldMode.plotId + '_' + row + '_' + position + '_' + Date.now().toString(36),
      plot_id: fieldMode.plotId,
      row: row,
      position: position,
      status: oldStatus,
      is_replanted: false,
      ai_data: null,
      inspections: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.seedlings.push(seedling);
  }
  
  if (seedling.status === status) {
    toast('Этот статус уже установлен', 'info');
    return;
  }
  
  seedling.status = status;
  seedling.updated_at = new Date().toISOString();
  
  if (fieldMode.gpsPosition && !seedling.gps) {
    seedling.gps = { ...fieldMode.gpsPosition };
  }
  
  if (!seedling.inspections) seedling.inspections = [];
  seedling.inspections.push({
    id: 'i_' + Date.now(),
    date: new Date().toISOString().slice(0, 10),
    type: 'field-mode',
    inspector: 'Полевой режим',
    status_before: oldStatus,
    status_after: status,
    notes: ''
  });
  
  saveData();
  
  const statusInfo = FIELD_STATUSES[status];
  toast(`✅ Р${row} К${position}: ${statusInfo.icon} ${statusInfo.label}`, 'success');
  
  // Авто-переход: сначала вправо по кустам (position+1), если конец ряда — на следующий ряд
  const row_data = fieldMode.plot.rows.find(r => r.number === row);
  if (row_data && position < row_data.positions_count) {
    // Следующий куст в том же ряду
    setTimeout(() => selectFieldSeedling(row, position + 1), 150);
  } else {
    // Конец ряда — переход на следующий ряд, куст 1
    const rowIdx = fieldMode.plot.rows.findIndex(r => r.number === row);
    if (rowIdx >= 0 && rowIdx < fieldMode.plot.rows.length - 1) {
      const nextRow = fieldMode.plot.rows[rowIdx + 1];
      setTimeout(() => {
        selectFieldSeedling(nextRow.number, 1);
        scrollToRowCol(nextRow.number);
      }, 150);
    } else {
      // Последний куст последнего ряда
      fieldMode.selectedCell = null;
      renderFieldGrid();
      toast('✅ Обход завершён', 'success');
    }
  }
}

// ===== НАВИГАЦИЯ =====
function scrollToRowCol(rowNumber) {
  const table = document.querySelector('.field-table-container');
  if (!table) return;
  
  const colIdx = fieldMode.plot.rows.findIndex(r => r.number === rowNumber);
  if (colIdx < 0) return;
  
  // Прокрутить по горизонтали к нужной колонке
  const cellWidth = 34; // ширина ячейки + отступ
  const headerWidth = 50; // ширина первой колонки
  const scrollPos = headerWidth + colIdx * cellWidth - table.clientWidth / 2;
  table.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
}

function jumpToRow() {
  const input = document.getElementById('field-jump-row');
  if (!input) return;
  const rowNumber = parseInt(input.value);
  const totalRows = fieldMode.plot.rows.length;
  if (rowNumber && rowNumber >= 1 && rowNumber <= totalRows) {
    scrollToRowCol(rowNumber);
  } else {
    toast(`Ряд должен быть от 1 до ${totalRows}`, 'error');
  }
}

// ===== ЗАМЕТКИ =====
function openFieldNote() {
  if (!fieldMode.selectedCell) {
    toast('Сначала выберите куст', 'error');
    return;
  }
  const { row, position } = fieldMode.selectedCell;
  const contextEl = document.getElementById('field-note-context');
  if (contextEl) contextEl.textContent = `Ряд ${row}, куст ${position}`;
  const modal = document.getElementById('field-note-modal');
  if (modal) modal.style.display = 'flex';
}

function saveFieldNote() {
  const note = document.getElementById('field-note-text').value.trim();
  if (!note) return;
  
  const { row, position } = fieldMode.selectedCell;
  let seedling = null;
  if (data.seedlings) {
    seedling = data.seedlings.find(s => 
      s.plot_id === fieldMode.plotId && s.row === row && s.position === position
    );
  }
  
  if (!seedling) {
    if (!data.seedlings) data.seedlings = [];
    seedling = {
      id: 's_' + fieldMode.plotId + '_' + row + '_' + position + '_' + Date.now().toString(36),
      plot_id: fieldMode.plotId,
      row: row,
      position: position,
      status: 'healthy',
      inspections: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.seedlings.push(seedling);
  }
  
  if (!seedling.inspections) seedling.inspections = [];
  seedling.inspections.push({
    id: 'i_' + Date.now(),
    date: new Date().toISOString().slice(0, 10),
    type: 'field-mode',
    inspector: 'Полевой режим',
    status_before: seedling.status,
    status_after: seedling.status,
    notes: note
  });
  
  seedling.updated_at = new Date().toISOString();
  saveData();
  toast('✅ Заметка сохранена', 'success');
  const modal = document.getElementById('field-note-modal');
  if (modal) modal.style.display = 'none';
  const textarea = document.getElementById('field-note-text');
  if (textarea) textarea.value = '';
}

function closeFieldNote() {
  const modal = document.getElementById('field-note-modal');
  if (modal) modal.style.display = 'none';
}

// ===== ИНИЦИАЛИЗАЦИЯ OVERLAY =====
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.createElement('div');
  overlay.id = 'field-mode-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="fm-shell">
      <!-- HEADER -->
      <div class="fm-header">
        <div class="fm-title-row">
          <h2 class="fm-title">🌱 Полевой режим</h2>
          <button class="fm-close-btn" onclick="toggleFieldMode()">✖ Закрыть</button>
        </div>
        
        <div class="fm-controls-row">
          <select id="field-plot-select" onchange="selectFieldPlot(this.value)" class="fm-select"></select>
          <input type="number" id="field-jump-row" placeholder="Перейти к ряду" min="1" 
                 class="fm-jump-input"
                 onkeypress="if(event.key==='Enter') jumpToRow()">
          <button class="fm-jump-btn" onclick="jumpToRow()">→</button>
        </div>
        <div id="field-plot-info" class="fm-info">—</div>
      </div>
      
      <!-- ТАБЛИЦА КУСТОВ -->
      <div class="fm-grid-area">
        <div id="field-seedlings-grid"></div>
      </div>
      
      <!-- ИНФОРМАЦИЯ О ВЫБОРЕ -->
      <div class="fm-selection-panel">
        <div id="field-selection-info" class="fm-selection-text">
          <span style="color: rgba(232, 224, 208, 0.5);">Тапните на куст, чтобы выбрать</span>
        </div>
      </div>
      
      <!-- КНОПКИ СТАТУСОВ -->
      <div class="fm-status-panel">
        <div class="fm-status-grid">
          <button class="fm-status-btn fm-healthy" onclick="applyFieldStatus('healthy')">
            <span class="fm-status-icon">🟢</span>
            <span class="fm-status-label">Здоровый</span>
          </button>
          <button class="fm-status-btn fm-dead" onclick="applyFieldStatus('dead')">
            <span class="fm-status-icon">⚫</span>
            <span class="fm-status-label">Выпад</span>
          </button>
          <button class="fm-status-btn fm-sick" onclick="applyFieldStatus('sick')">
            <span class="fm-status-icon">🔴</span>
            <span class="fm-status-label">Больной</span>
          </button>
          <button class="fm-status-btn fm-stunted" onclick="applyFieldStatus('stunted')">
            <span class="fm-status-icon">🟡</span>
            <span class="fm-status-label">Угнетён.</span>
          </button>
          <button class="fm-status-btn fm-rootstock" onclick="applyFieldStatus('rootstock')">
            <span class="fm-status-icon">🟣</span>
            <span class="fm-status-label">Подвой</span>
          </button>
        </div>
        <button class="fm-note-btn" onclick="openFieldNote()">
          📝 Заметка к кусту
        </button>
      </div>
    </div>
    
    <!-- МОДАЛКА ЗАМЕТКИ -->
    <div class="fm-note-modal" id="field-note-modal">
      <div class="fm-note-modal-content">
        <h3>📝 Заметка к кусту</h3>
        <div id="field-note-context" class="fm-note-context"></div>
        <textarea id="field-note-text" rows="5" placeholder="Симптомы, наблюдения..."></textarea>
        <div class="fm-note-actions">
          <button class="fm-save-btn" onclick="saveFieldNote()">💾 Сохранить</button>
          <button class="fm-cancel-btn" onclick="closeFieldNote()">Отмена</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
});
