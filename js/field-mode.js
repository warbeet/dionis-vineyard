// ============================================================================
// FIELD MODE module v0.8.3 — Полевой режим обхода (табличная сетка)
// ============================================================================
// Ориентация: ряды по горизонтали (строки), кусты по вертикали (столбцы)
// Категории: Здоровый / Выпад / Больной / Угнетённый / Подвой
// ============================================================================

let fieldMode = {
  active: false,
  plotId: null,
  plot: null,
  selectedCell: null, // {row, position}
  gpsPosition: null,
  scrollRow: 1 // для "перейти к ряду"
};

// ===== СТАТУСЫ КУСТА =====
const FIELD_STATUSES = {
  healthy:   { label: 'Здоровый',   icon: '🟢', color: '#4CAF50', textColor: '#fff' },
  dead:      { label: 'Выпад',      icon: '', color: '#5D4037', textColor: '#fff' },
  sick:      { label: 'Больной',    icon: '', color: '#E53935', textColor: '#fff' },
  stunted:   { label: 'Угнетённый', icon: '🟡', color: '#FDD835', textColor: '#333' },
  rootstock: { label: 'Подвой',     icon: '', color: '#8E24AA', textColor: '#fff' }
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
  // GPS
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
  
  // Заполнить список участков
  const plotSelect = document.getElementById('field-plot-select');
  if (plotSelect && data.plots && data.plots.length) {
    plotSelect.innerHTML = data.plots.map(p => 
      `<option value="${p.id}">${escapeHtml(p.name)}</option>`
    ).join('');
    fieldMode.plotId = data.plots[0].id;
    fieldMode.plot = data.plots[0];
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

// ===== РЕНДЕР СЕТКИ (ТАБЛИЧНЫЙ ВИД) =====
function renderFieldGrid() {
  if (!fieldMode.plot) return;
  
  const plot = fieldMode.plot;
  const rows = plot.rows || [];
  const totalRows = rows.length;
  const maxPositions = Math.max(...rows.map(r => r.positions_count || 0));
  
  // Обновить инфо
  const infoEl = document.getElementById('field-plot-info');
  if (infoEl) {
    const totalSeedlings = rows.reduce((sum, r) => sum + (r.positions_count || 0), 0);
    infoEl.textContent = `${totalRows} рядов · ${totalSeedlings} кустов · макс. ${maxPositions} кустов/ряд`;
  }
  
  // Построить таблицу
  const container = document.getElementById('field-seedlings-grid');
  if (!container) return;
  
  // Заголовок таблицы (номера кустов)
  let html = '<div class="field-table-container">';
  
  // Фиксированная колонка "Ряд" + горизонтальный скролл кустов
  html += '<table class="field-table">';
  
  // Шапка: "Ряд" + номера кустов 1..maxPositions (с шагом для больших рядов)
  const step = maxPositions > 40 ? 5 : 1;
  html += '<thead><tr><th class="row-header">Ряд</th>';
  for (let p = 1; p <= maxPositions; p += step) {
    html += `<th class="pos-header">${p}</th>`;
  }
  html += '</tr></thead><tbody>';
  
  // Тело: каждый ряд = строка
  rows.forEach(row => {
    const rowNum = row.number;
    const posCount = row.positions_count || 0;
    html += `<tr class="field-row">`;
    html += `<td class="row-header" onclick="scrollToRow(${rowNum})" style="cursor:pointer;">${rowNum}</td>`;
    
    for (let p = 1; p <= maxPositions; p += step) {
      if (p > posCount) {
        // Пустая ячейка (ряд короче)
        html += `<td class="field-cell empty"></td>`;
      } else if (step === 1) {
        // Одиночный куст
        const seedling = getSeedling(fieldMode.plotId, rowNum, p);
        const status = FIELD_STATUSES[seedling.status] || FIELD_STATUSES.healthy;
        const isSelected = fieldMode.selectedCell && 
                          fieldMode.selectedCell.row === rowNum && 
                          fieldMode.selectedCell.position === p;
        const selectedStyle = isSelected 
          ? 'box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--primary, #5a8fd4); transform: scale(1.2); z-index: 2;' 
          : '';
        
        html += `<td class="field-cell" 
          data-row="${rowNum}" 
          data-position="${p}" 
          onclick="selectFieldSeedling(${rowNum}, ${p})"
          style="background: ${status.color}; color: ${status.textColor}; cursor: pointer; ${selectedStyle}"
          title="Р${rowNum} К${p}: ${status.label}">
        </td>`;
      } else {
        // Группа кустов (step > 1) — показываем как блок
        const endP = Math.min(p + step - 1, posCount);
        const statuses = [];
        for (let gp = p; gp <= endP; gp++) {
          const s = getSeedling(fieldMode.plotId, rowNum, gp);
          statuses.push(s.status);
        }
        // Цвет — по худшему статусу
        const priority = ['dead', 'sick', 'stunted', 'rootstock', 'healthy'];
        const worstStatus = priority.find(st => statuses.includes(st)) || 'healthy';
        const status = FIELD_STATUSES[worstStatus] || FIELD_STATUSES.healthy;
        const count = statuses.filter(s => s === worstStatus).length;
        
        const isSelected = fieldMode.selectedCell && 
                          fieldMode.selectedCell.row === rowNum && 
                          fieldMode.selectedCell.position >= p && 
                          fieldMode.selectedCell.position <= endP;
        const selectedStyle = isSelected 
          ? 'box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--primary, #5a8fd4);' 
          : '';
        
        html += `<td class="field-cell group-cell" 
          data-row="${rowNum}" 
          data-position-start="${p}"
          data-position-end="${endP}"
          onclick="selectFieldSeedlingGroup(${rowNum}, ${p}, ${endP})"
          style="background: ${status.color}; color: ${status.textColor}; cursor: pointer; ${selectedStyle}"
          title="Р${rowNum} К${p}-${endP}: ${status.label} (${count}/${step})">
          <span style="font-size: 10px;">${p}-${endP}</span>
        </td>`;
      }
    }
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
  
  // Информация о выборе
  renderFieldSelectionInfo();
}

// ===== ВЫБОР КУСТА =====
function selectFieldSeedling(row, position) {
  fieldMode.selectedCell = { row, position };
  renderFieldGrid();
  if (navigator.vibrate) navigator.vibrate(15);
}

function selectFieldSeedlingGroup(row, startPos, endPos) {
  // Выбираем первый куст в группе
  fieldMode.selectedCell = { row, position: startPos };
  renderFieldGrid();
  if (navigator.vibrate) navigator.vibrate(15);
}

function renderFieldSelectionInfo() {
  const infoEl = document.getElementById('field-selection-info');
  if (!infoEl) return;
  
  if (!fieldMode.selectedCell) {
    infoEl.innerHTML = '<span style="color: var(--text-muted, #8a8a8a);">Тапните на куст, чтобы выбрать</span>';
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
  
  // Найти или создать seedling
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
  
  // Авто-переход на следующий куст в ряду
  const row_data = fieldMode.plot.rows.find(r => r.number === row);
  if (row_data && position < row_data.positions_count) {
    setTimeout(() => {
      selectFieldSeedling(row, position + 1);
    }, 150);
  } else {
    // Перейти на следующий ряд
    const rowIndex = fieldMode.plot.rows.findIndex(r => r.number === row);
    if (rowIndex >= 0 && rowIndex < fieldMode.plot.rows.length - 1) {
      const nextRow = fieldMode.plot.rows[rowIndex + 1];
      setTimeout(() => {
        selectFieldSeedling(nextRow.number, 1);
        // Прокрутить к этому ряду
        scrollToRow(nextRow.number);
      }, 200);
    } else {
      fieldMode.selectedCell = null;
      renderFieldGrid();
    }
  }
}

// ===== НАВИГАЦИЯ: ПЕРЕХОД К РЯДУ =====
function scrollToRow(rowNumber) {
  const table = document.querySelector('.field-table-container');
  if (!table) return;
  
  const rowEl = document.querySelector(`tr[data-row="${rowNumber}"]`) || 
                document.querySelector(`td[onclick*="${rowNumber}"]`);
  if (rowEl) {
    rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  //也可以通过 input
  const input = document.getElementById('field-jump-row');
  if (input) input.value = rowNumber;
}

function jumpToRow() {
  const input = document.getElementById('field-jump-row');
  if (!input) return;
  const rowNumber = parseInt(input.value);
  if (rowNumber && rowNumber >= 1 && rowNumber <= fieldMode.plot.rows.length) {
    scrollToRow(rowNumber);
  } else {
    toast(`Ряд должен быть от 1 до ${fieldMode.plot.rows.length}`, 'error');
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

// ===== СТАТИСТИКА ПО РЯДУ =====
function getRowStats(rowNumber) {
  const row = fieldMode.plot.rows.find(r => r.number === rowNumber);
  if (!row) return null;
  
  const stats = { healthy: 0, dead: 0, sick: 0, stunted: 0, rootstock: 0, total: 0 };
  for (let p = 1; p <= row.positions_count; p++) {
    const s = getSeedling(fieldMode.plotId, rowNumber, p);
    const status = s.status || 'healthy';
    if (stats[status] !== undefined) stats[status]++;
    stats.total++;
  }
  return stats;
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
        
        <!-- Выбор участка -->
        <div style="display: flex; gap: 8px; align-items: center;">
          <select id="field-plot-select" onchange="selectFieldPlot(this.value)" 
                  style="flex: 1; padding: 10px; font-size: 15px; border-radius: 8px; background: var(--bg-input, #f0f0f0); color: var(--text, #333); border: 1px solid var(--border-color, #ddd);">
          </select>
          <input type="number" id="field-jump-row" placeholder="Ряд №" min="1" 
                 style="width: 70px; padding: 10px; font-size: 14px; border-radius: 8px; background: var(--bg-input, #f0f0f0); color: var(--text, #333); border: 1px solid var(--border-color, #ddd);"
                 onkeypress="if(event.key==='Enter') jumpToRow()">
          <button class="btn" onclick="jumpToRow()" style="padding: 10px 12px; font-size: 13px;">→</button>
        </div>
        <div id="field-plot-info" style="font-size: 11px; color: var(--text-muted, #888); margin-top: 6px;">—</div>
      </div>
      
      <!-- ТАБЛИЦА КУСТОВ (скроллируемая) -->
      <div style="flex: 1; overflow: auto; padding: 8px;">
        <div id="field-seedlings-grid"></div>
      </div>
      
      <!-- ИНФОРМАЦИЯ О ВЫБОРЕ -->
      <div style="padding: 8px 16px; background: var(--bg-card, #fff); border-top: 1px solid var(--border-color, #ddd); flex-shrink: 0;">
        <div id="field-selection-info" style="font-size: 13px;"></div>
      </div>
      
      <!-- КНОПКИ СТАТУСОВ -->
      <div style="padding: 10px 16px; background: var(--bg-card, #fff); border-top: 1px solid var(--border-color, #ddd); flex-shrink: 0;">
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
          <button class="btn field-btn" onclick="applyFieldStatus('healthy')" 
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.healthy.color}; color: ${FIELD_STATUSES.healthy.textColor}; border: none; font-weight: 600;">
            ${FIELD_STATUSES.healthy.icon}<br>Здоровый
          </button>
          <button class="btn field-btn" onclick="applyFieldStatus('dead')"
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.dead.color}; color: ${FIELD_STATUSES.dead.textColor}; border: none; font-weight: 600;">
            ${FIELD_STATUSES.dead.icon}<br>Выпад
          </button>
          <button class="btn field-btn" onclick="applyFieldStatus('sick')"
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.sick.color}; color: ${FIELD_STATUSES.sick.textColor}; border: none; font-weight: 600;">
            ${FIELD_STATUSES.sick.icon}<br>Больной
          </button>
          <button class="btn field-btn" onclick="applyFieldStatus('stunted')"
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.stunted.color}; color: ${FIELD_STATUSES.stunted.textColor}; border: none; font-weight: 600;">
            ${FIELD_STATUSES.stunted.icon}<br>Угнетён.
          </button>
          <button class="btn field-btn" onclick="applyFieldStatus('rootstock')"
                  style="padding: 12px 4px; font-size: 12px; background: ${FIELD_STATUSES.rootstock.color}; color: ${FIELD_STATUSES.rootstock.textColor}; border: none; font-weight: 600;">
            ${FIELD_STATUSES.rootstock.icon}<br>Подвой
          </button>
        </div>
        <button class="btn" onclick="openFieldNote()" 
                style="width: 100%; padding: 10px; font-size: 14px; margin-top: 8px;">
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
          <button class="btn primary" onclick="saveFieldNote()" style="flex: 1; padding: 12px; font-size: 16px;">💾 Сохранить</button>
          <button class="btn secondary" onclick="closeFieldNote()" style="flex: 1; padding: 12px; font-size: 16px;">Отмена</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
});
