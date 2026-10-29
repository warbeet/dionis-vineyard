// ============================================================================
// FIELD MODE module v0.8.1 — Полевой режим обхода с выбором куста
// ============================================================================
// Переделано: добавлен выбор ряда и конкретного куста через Canvas-сетку
// ============================================================================

let fieldMode = {
  active: false,
  plotId: null,
  plot: null,
  currentRow: 1,
  currentSeedlingId: null,
  selectedCell: null, // {row, position}
  gpsPosition: null,
  statusHistory: []
};

function toggleFieldMode() {
  fieldMode.active = !fieldMode.active;
  const overlay = document.getElementById('field-mode-overlay');
  
  if (fieldMode.active) {
    overlay.style.display = 'block';
    initFieldMode();
  } else {
    overlay.style.display = 'none';
    fieldMode.currentSeedlingId = null;
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
      err => {
        console.warn('GPS ошибка:', err);
        toast('GPS недоступен — работаем без геолокации', 'warning');
      }
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
    fieldMode.currentRow = 1;
    renderFieldControls();
  }
}

function selectFieldPlot(plotId) {
  fieldMode.plotId = plotId;
  fieldMode.plot = data.plots.find(p => p.id === plotId);
  fieldMode.currentRow = 1;
  fieldMode.currentSeedlingId = null;
  fieldMode.selectedCell = null;
  renderFieldControls();
}

// ===== НАВИГАЦИЯ ПО РЯДАМ =====

function goToRow(rowNumber) {
  if (!fieldMode.plot) return;
  const maxRow = fieldMode.plot.rows.length;
  if (rowNumber < 1) rowNumber = 1;
  if (rowNumber > maxRow) rowNumber = maxRow;
  fieldMode.currentRow = rowNumber;
  fieldMode.currentSeedlingId = null;
  fieldMode.selectedCell = null;
  renderFieldControls();
}

function nextRow() {
  if (!fieldMode.plot) return;
  if (fieldMode.currentRow < fieldMode.plot.rows.length) {
    goToRow(fieldMode.currentRow + 1);
  }
}

function prevRow() {
  if (fieldMode.currentRow > 1) {
    goToRow(fieldMode.currentRow - 1);
  }
}

// ===== РЕНДЕР УПРАВЛЕНИЯ =====

function renderFieldControls() {
  if (!fieldMode.plot) return;
  
  const row = fieldMode.plot.rows.find(r => r.number === fieldMode.currentRow);
  const positionsCount = row ? row.positions_count : 0;
  const totalRows = fieldMode.plot.rows.length;
  
  // Обновить UI
  const rowNumEl = document.getElementById('field-row-number');
  if (rowNumEl) rowNumEl.textContent = `${fieldMode.currentRow} / ${totalRows}`;
  
  const positionsInfoEl = document.getElementById('field-positions-info');
  if (positionsInfoEl) positionsInfoEl.textContent = `${positionsCount} кустов в ряду`;
  
  // Кнопки prev/next
  const prevBtn = document.getElementById('field-prev-row');
  const nextBtn = document.getElementById('field-next-row');
  if (prevBtn) prevBtn.disabled = fieldMode.currentRow <= 1;
  if (nextBtn) nextBtn.disabled = fieldMode.currentRow >= totalRows;
  
  // Отрисовать сетку кустов
  renderFieldSeedlingGrid(positionsCount);
  
  // Обновить информацию о выбранном кусте
  renderFieldSelectionInfo();
}

// ===== СЕТКА КУСТОВ (упрощённая, без Canvas) =====

function renderFieldSeedlingGrid(positionsCount) {
  const container = document.getElementById('field-seedlings-grid');
  if (!container) return;
  
  // Для больших рядов (>60) делаем скроллируемую сетку
  const maxVisible = Math.min(positionsCount, 80); // максимум 80 кустов в видимой области
  
  let html = '<div class="field-grid-wrapper">';
  html += '<div class="field-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 6px;">';
  
  for (let pos = 1; pos <= maxVisible; pos++) {
    const seedling = getSeedling(fieldMode.plotId, fieldMode.currentRow, pos);
    const isSelected = fieldMode.selectedCell && 
                       fieldMode.selectedCell.row === fieldMode.currentRow && 
                       fieldMode.selectedCell.position === pos;
    const status = seedling ? seedling.status : 'normal';
    
    const statusColor = getStatusColor(status);
    const selectedStyle = isSelected ? 'box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--primary); transform: scale(1.15);' : '';
    
    html += `<div class="field-seedling-cell" 
      data-row="${fieldMode.currentRow}" 
      data-position="${pos}" 
      data-status="${status}"
      onclick="selectFieldSeedling(${fieldMode.currentRow}, ${pos})"
      style="width: 44px; height: 44px; border-radius: 8px; background: ${statusColor}; 
             display: flex; align-items: center; justify-content: center; 
             font-size: 11px; font-weight: 600; color: ${isLightColor(statusColor) ? '#333' : '#fff'};
             cursor: pointer; border: 1px solid rgba(255,255,255,0.15);
             transition: all 0.15s; ${selectedStyle}">
      ${pos}
    </div>`;
  }
  
  html += '</div>';
  
  if (positionsCount > maxVisible) {
    html += `<div style="text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 8px;">
      Показаны первые ${maxVisible} из ${positionsCount} кустов
    </div>`;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

function getSeedling(plotId, row, position) {
  // Проверяем реальные seedlings (исключения)
  if (data.seedlings) {
    const real = data.seedlings.find(s => 
      s.plot_id === plotId && s.row === row && s.position === position
    );
    if (real) return real;
  }
  // Виртуальный (здоровый)
  return {
    id: `s_${plotId}_${row}_${position}_v`,
    plot_id: plotId,
    row: row,
    position: position,
    status: 'normal',
    _virtual: true
  };
}

function getStatusColor(status) {
  const colors = {
    'normal': '#6b8e5a',
    'healthy': '#4CAF50',
    'mildew': '#FFD54F',
    'oidium': '#B0BEC5',
    'chlorosis': '#FF8A65',
    'dead': '#5D4037',
    'sick': '#EF5350',
    'attention': '#FFA726'
  };
  return colors[status] || colors['normal'];
}

function isLightColor(hex) {
  // Простая проверка — для жёлтых/серых статусов нужен тёмный текст
  const lightColors = ['#FFD54F', '#B0BEC5', '#FFE082'];
  return lightColors.includes(hex);
}

// ===== ВЫБОР КУСТА =====

function selectFieldSeedling(row, position) {
  fieldMode.currentRow = row;
  fieldMode.selectedCell = { row, position };
  
  const seedling = getSeedling(fieldMode.plotId, row, position);
  fieldMode.currentSeedlingId = seedling.id;
  
  // Перерисовать сетку для подсветки
  renderFieldSeedlingGrid(fieldMode.plot.rows.find(r => r.number === row).positions_count);
  renderFieldSelectionInfo();
  
  // Вибро-отклик на мобильных
  if (navigator.vibrate) navigator.vibrate(20);
}

function renderFieldSelectionInfo() {
  const infoEl = document.getElementById('field-selection-info');
  if (!infoEl) return;
  
  if (!fieldMode.selectedCell) {
    infoEl.innerHTML = '<span style="color: var(--text-muted);">Тапните на куст, чтобы выбрать</span>';
    return;
  }
  
  const { row, position } = fieldMode.selectedCell;
  const seedling = getSeedling(fieldMode.plotId, row, position);
  const status = seedling.status;
  const statusLabel = getStatusLabel(status);
  
  infoEl.innerHTML = `
    <strong>Ряд ${row}, куст ${position}</strong>
    <span style="margin-left: 10px; padding: 2px 8px; border-radius: 4px; background: ${getStatusColor(status)}; color: ${isLightColor(getStatusColor(status)) ? '#333' : '#fff'}; font-size: 12px;">
      ${statusLabel}
    </span>
  `;
}

// ===== ПРИМЕНЕНИЕ СТАТУСА =====

function quickStatusUpdate(status) {
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
  
  const oldStatus = seedling ? seedling.status : 'normal';
  
  if (!seedling) {
    // Создаём реальную запись из виртуальной
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
  
  // Если статус не изменился — ничего не делаем
  if (seedling.status === status) {
    toast('Этот статус уже установлен', 'info');
    return;
  }
  
  // Обновить статус
  seedling.status = status;
  seedling.updated_at = new Date().toISOString();
  
  // GPS
  if (fieldMode.gpsPosition && !seedling.gps) {
    seedling.gps = { ...fieldMode.gpsPosition };
  }
  
  // История
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
  
  // Запомнить для заметки
  fieldMode.statusHistory.push({
    seedlingId: seedling.id,
    status: status,
    time: new Date().toISOString()
  });
  
  saveData();
  toast(`✅ Ряд ${row}, куст ${position}: ${getStatusLabel(status)}`, 'success');
  
  // Авто-переход на следующий куст
  const currentRowData = fieldMode.plot.rows.find(r => r.number === fieldMode.currentRow);
  if (fieldMode.selectedCell.position < currentRowData.positions_count) {
    setTimeout(() => {
      selectFieldSeedling(fieldMode.currentRow, fieldMode.selectedCell.position + 1);
    }, 200);
  } else {
    fieldMode.selectedCell = null;
    fieldMode.currentSeedlingId = null;
    renderFieldControls();
  }
}

function getStatusLabel(status) {
  const labels = {
    'normal': '🟢 Норма',
    'healthy': '🟢 Здоров',
    'mildew': '🟡 Милдью',
    'oidium': ' Оидиум',
    'chlorosis': '🟠 Хлороз',
    'dead': '⚫ Выпад',
    'sick': '🔴 Болеет',
    'attention': '🟡 Внимание'
  };
  return labels[status] || status;
}

// ===== ЗАМЕТКИ =====

function openFieldNote() {
  if (!fieldMode.selectedCell) {
    toast('Сначала выберите куст', 'error');
    return;
  }
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
      status: 'normal',
      inspections: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.seedlings.push(seedling);
  }
  
  if (!seedling.inspections) seedling.inspections = [];
  const last = seedling.inspections[seedling.inspections.length - 1];
  if (last && last.type === 'field-mode' && last.date === new Date().toISOString().slice(0, 10)) {
    last.notes = note;
  } else {
    seedling.inspections.push({
      id: 'i_' + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      type: 'field-mode',
      inspector: 'Полевой режим',
      status_before: seedling.status,
      status_after: seedling.status,
      notes: note
    });
  }
  
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
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg); z-index: 10000; overflow-y: auto;">
      <div style="max-width: 600px; margin: 0 auto; padding: 16px;">
        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="margin: 0; font-size: 22px;"> Полевой режим</h2>
          <button class="btn" onclick="toggleFieldMode()" style="padding: 8px 14px;">✖ Закрыть</button>
        </div>
        
        <!-- УЧАСТОК -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: 12px; margin-bottom: 12px; box-shadow: var(--shadow-flat);">
          <label style="font-weight: 600; display: block; margin-bottom: 6px; font-size: 13px;">Участок:</label>
          <select id="field-plot-select" onchange="selectFieldPlot(this.value)" 
                  style="width: 100%; padding: 10px; font-size: 16px; border-radius: 8px; background: var(--bg-input); color: var(--text); border: 1px solid var(--border-color, transparent);">
          </select>
        </div>
        
        <!-- НАВИГАЦИЯ ПО РЯДАМ -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: 12px; margin-bottom: 12px; box-shadow: var(--shadow-flat);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <button class="btn secondary" id="field-prev-row" onclick="prevRow()" style="padding: 8px 14px;"> Ряд</button>
            <div style="text-align: center;">
              <div id="field-row-number" style="font-size: 18px; font-weight: 700;">—</div>
              <div id="field-positions-info" style="font-size: 11px; color: var(--text-muted);">—</div>
            </div>
            <button class="btn secondary" id="field-next-row" onclick="nextRow()" style="padding: 8px 14px;">Ряд ▶</button>
          </div>
        </div>
        
        <!-- СЕТКА КУСТОВ -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: 12px; margin-bottom: 12px; box-shadow: var(--shadow-flat);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 13px;">Выберите куст:</strong>
            <div id="field-selection-info" style="font-size: 12px;"></div>
          </div>
          <div id="field-seedlings-grid"></div>
        </div>
        
        <!-- КНОПКИ СТАТУСОВ -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: 12px; margin-bottom: 12px; box-shadow: var(--shadow-flat);">
          <h3 style="margin: 0 0 10px 0; font-size: 14px;">Статус куста:</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <button class="btn field-btn" onclick="quickStatusUpdate('mildew')" 
                    style="padding: 14px; font-size: 16px; min-height: 64px; background: #FFD54F; color: #333; border: none;">
              🟡 Милдью
            </button>
            <button class="btn field-btn" onclick="quickStatusUpdate('oidium')"
                    style="padding: 14px; font-size: 16px; min-height: 64px; background: #B0BEC5; color: #333; border: none;">
              ⚪ Оидиум
            </button>
            <button class="btn field-btn" onclick="quickStatusUpdate('chlorosis')"
                    style="padding: 14px; font-size: 16px; min-height: 64px; background: #FF8A65; color: #fff; border: none;">
              🟠 Хлороз
            </button>
            <button class="btn field-btn" onclick="quickStatusUpdate('dead')"
                    style="padding: 14px; font-size: 16px; min-height: 64px; background: #5D4037; color: #fff; border: none;">
              ⚫ Выпад
            </button>
            <button class="btn field-btn" onclick="quickStatusUpdate('healthy')"
                    style="padding: 14px; font-size: 16px; min-height: 64px; background: #4CAF50; color: #fff; border: none; grid-column: span 2;">
               Здоров
            </button>
          </div>
        </div>
        
        <!-- ЗАМЕТКА -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: 12px; box-shadow: var(--shadow-flat);">
          <button class="btn primary" onclick="openFieldNote()" 
                  style="width: 100%; padding: 14px; font-size: 16px;">
            📝 Добавить заметку
          </button>
        </div>
      </div>
    </div>
    
    <!-- МОДАЛКА ЗАМЕТКИ -->
    <div id="field-note-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10001; justify-content: center; align-items: center; padding: 20px;">
      <div style="background: var(--bg-card); padding: 24px; border-radius: 12px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
        <h3 style="margin-top: 0;">📝 Заметка к кусту</h3>
        <div id="field-note-context" style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;"></div>
        <textarea id="field-note-text" rows="5" style="width: 100%; padding: 12px; font-size: 16px; border-radius: 8px; background: var(--bg-input); color: var(--text); border: 1px solid var(--border-color, transparent); box-sizing: border-box;" 
                  placeholder="Симптомы, наблюдения, рекомендации..."></textarea>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <button class="btn primary" onclick="saveFieldNote()" style="flex: 1; padding: 12px; font-size: 16px;">💾 Сохранить</button>
          <button class="btn secondary" onclick="closeFieldNote()" style="flex: 1; padding: 12px; font-size: 16px;">Отмена</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Обновляем контекст заметки при открытии
  const origOpen = openFieldNote;
  openFieldNote = function() {
    if (!fieldMode.selectedCell) {
      toast('Сначала выберите куст', 'error');
      return;
    }
    const { row, position } = fieldMode.selectedCell;
    const contextEl = document.getElementById('field-note-context');
    if (contextEl) {
      contextEl.textContent = `Ряд ${row}, куст ${position}`;
    }
    origOpen();
  };
});
