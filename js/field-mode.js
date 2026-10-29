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
  
  // Авто-переход: сначала вниз по кустам (в следующий ряд), потом вправо
  const rowIdx = fieldMode.plot.rows.findIndex(r => r.number === row);
  if (rowIdx >= 0 && rowIdx < fieldMode.plot.rows.length - 1) {
    const nextRow = fieldMode.plot.rows[rowIdx + 1];
    if (position <= nextRow.positions_count) {
      setTimeout(() => {
        selectFieldSeedling(nextRow.number, position);
        scrollToRow(nextRow.number);
      }, 150);
      return;
    }
  }
  
  // Если конец — переход на следующий куст в том же ряду
  const row_data = fieldMode.plot.rows.find(r => r.number === row);
  if (row_data && position < row_data.positions_count) {
    setTimeout(() => selectFieldSeedling(row, position + 1), 150);
  } else {
    fieldMode.selectedCell = null;
    renderFieldGrid();
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
  document.getElementById('field-note-modal').style.display = 'flex';
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
  document.getElementById('field-note-modal').style.display = 'none';
  document.getElementById('field-note-text').value = '';
}

function closeFieldNote() {
  document.getElementById('field-note-modal').style.display = 'none';
}

// ===== ИНИЦИАЛИЗАЦИЯ OVERLAY =====
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.createElement('div');
  overlay.id = 'field-mode-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg, #e8ebe2); z-index: 10000; display: flex; flex-direction: column; overflow: hidden;">
      <!-- HEADER -->
      <div style="padding: 12px 16px; background: var(--bg-card, #fff); box-shadow: 0 2px 8px rgba(0,0,0,0.1); flex-shrink: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 20px;">🌱 Полевой режим</h2>
          <button class="btn" onclick="toggleFieldMode()" style="padding: 6px 12px; font-size: 14px;">✖ Закрыть</button>
        </div>
        
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <select id="field-plot-select" onchange="selectFieldPlot(this.value)" 
                  style="flex: 1; min-width: 150px; padding: 10px; font-size: 15px; border-radius: 8px; background: var(--bg-input, #f0f0f0); color: var(--text, #333); border: 1px solid var(--border-color, #ddd);">
          </select>
          <input type="number" id="field-jump-row" placeholder="Перейти к ряду" min="1" 
                 style="width: 140px; padding: 10px; font-size: 14px; border-radius: 8px; background: var(--bg-input, #f0f0f0); color: var(--text, #333); border: 1px solid var(--border-color, #ddd);"
                 onkeypress="if(event.key==='Enter') jumpToRow()">
          <button class="btn" onclick="jumpToRow()" style="padding: 10px 12px; font-size: 13px;">→</button>
        </div>
        <div id="field-plot-info" style="font-size: 11px; color: var(--text-muted, #888); margin-top: 6px;">—</div>
      </div>
      
      <!-- ТАБЛИЦА -->
      <div style="flex: 1; overflow: auto; padding: 4px;">
        <div id="field-seedlings-grid"></div>
      </div>
      
      <!-- ИНФОРМАЦИЯ О ВЫБОРЕ -->
      <div style="padding: 8px 16px; background: var(--bg-card, #fff); border-top: 1px solid var(--border-color, #ddd); flex-shrink: 0;">
        <div id="field-selection-info" style="font-size: 13px;"></div>
      </div>
      
      <!-- КНОПКИ СТАТУСОВ -->
      <div style="padding: 10px 16px; background: var(--bg-card, #fff); border-top: 1px solid var(--border-color, #ddd); flex-shrink: 0;">
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
          <button onclick="applyFieldStatus('healthy')" 
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.healthy.color}; color: ${FIELD_STATUSES.healthy.textColor}; border: none; font-weight: 600; border-radius: 8px; cursor: pointer;">
            ${FIELD_STATUSES.healthy.icon}<br>Здоровый
          </button>
          <button onclick="applyFieldStatus('dead')"
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.dead.color}; color: ${FIELD_STATUSES.dead.textColor}; border: none; font-weight: 600; border-radius: 8px; cursor: pointer;">
            ${FIELD_STATUSES.dead.icon}<br>Выпад
          </button>
          <button onclick="applyFieldStatus('sick')"
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.sick.color}; color: ${FIELD_STATUSES.sick.textColor}; border: none; font-weight: 600; border-radius: 8px; cursor: pointer;">
            ${FIELD_STATUSES.sick.icon}<br>Больной
          </button>
          <button onclick="applyFieldStatus('stunted')"
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.stunted.color}; color: ${FIELD_STATUSES.stunted.textColor}; border: none; font-weight: 600; border-radius: 8px; cursor: pointer;">
            ${FIELD_STATUSES.stunted.icon}<br>Угнетён.
          </button>
          <button onclick="applyFieldStatus('rootstock')"
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.rootstock.color}; color: ${FIELD_STATUSES.rootstock.textColor}; border: none; font-weight: 600; border-radius: 8px; cursor: pointer;">
            ${FIELD_STATUSES.rootstock.icon}<br>Подвой
          </button>
        </div>
        <button onclick="openFieldNote()" 
                style="width: 100%; padding: 10px; font-size: 14px; margin-top: 8px; background: var(--bg-input, #f0f0f0); color: var(--text, #333); border: 1px solid var(--border-color, #ddd); border-radius: 8px; cursor: pointer; font-weight: 600;">
          📝 Заметка к кусту
        </button>
      </div>
    </div>
    
    <!-- МОДАЛКА ЗАМЕТКИ -->
    <div id="field-note-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10001; justify-content: center; align-items: center; padding: 20px;">
      <div style="background: var(--bg-card, #fff); padding: 24px; border-radius: 12px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
        <h3 style="margin-top: 0;">📝 Заметка к кусту</h3>
        <div id="field-note-context" style="font-size: 13px; color: var(--text-muted, #888); margin-bottom: 12px;"></div>
        <textarea id="field-note-text" rows="5" style="width: 100%; padding: 12px; font-size: 16px; border-radius: 8px; background: var(--bg-input, #f0f0f0); color: var(--text, #333); border: 1px solid var(--border-color, #ddd); box-sizing: border-box;" 
                  placeholder="Симптомы, наблюдения..."></textarea>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <button onclick="saveFieldNote()" style="flex: 1; padding: 12px; font-size: 16px; background: var(--primary, #6b8e5a); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">💾 Сохранить</button>
          <button onclick="closeFieldNote()" style="flex: 1; padding: 12px; font-size: 16px; background: var(--bg-input, #f0f0f0); color: var(--text, #333); border: 1px solid var(--border-color, #ddd); border-radius: 8px; cursor: pointer; font-weight: 600;">Отмена</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
});
