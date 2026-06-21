// ============================================================================
// ROWS-EDITOR module — Упрощённый редактор рядов (минимальный набор полей)
// ============================================================================
//
// Минимальные поля для каждого ряда:
//  - № ряда (авто)
//  - Кол-во саженцев
//  - Откуда начало (с начала / с конца ряда)
//  - Смещение (пропустить N позиций от начала)
//
// Убрано: каскады, группы рядов, индивидуальные пропуски

// =========== ГЛАВНЫЙ РЕНДЕР ===========

function renderRowsEditorV2() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  if (typeof migratePlotGeometry === 'function') migratePlotGeometry(plot);
  if (!plot.rows) plot.rows = [];

  const cont = document.getElementById('rows-editor-v2');
  if (!cont) return;

  // Считаем общую статистику
  const totalRows = plot.rows.length;
  const totalSeedlings = plot.rows.reduce((s, r) => s + (r.positions_count || 0), 0);
  const skippedRows = plot.rows.filter(r => (r.positions_count || 0) === 0).length;

  cont.innerHTML = `
    <!-- БЛОК БЫСТРОГО СОЗДАНИЯ -->
    <div class="card" style="margin-bottom:14px; background:linear-gradient(135deg, rgba(107,142,90,0.05), transparent);">
      <h4 style="margin-bottom:10px; font-size:14px;">🪄 Массовое создание/изменение</h4>
      <p style="font-size:12px; color:var(--text-soft); margin-bottom:12px;">
        Сразу задайте параметры для всех рядов. Подходит для регулярной посадки.
      </p>
      <div class="form-grid">
        <div class="form-row">
          <label>Количество рядов</label>
          <input type="number" id="bulk-rows-count" min="1" max="500" value="${totalRows || 10}">
        </div>
        <div class="form-row">
          <label>Саженцев в каждом ряду</label>
          <input type="number" id="bulk-positions" min="0" max="500" value="50">
        </div>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label>Направление посадки</label>
          <select id="bulk-direction">
            <option value="forward">→ От начала к концу (обычно)</option>
            <option value="reverse">← От конца к началу</option>
          </select>
        </div>
        <div class="form-row">
          <label>Смещение (пропуск с начала)</label>
          <input type="number" id="bulk-offset" min="0" value="0" title="Сколько позиций пропустить с начала ряда">
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn primary small" onclick="applyBulkRowsV2()" title="Создать или пересоздать ряды">
          ✨ Применить ко всем рядам
        </button>
        <button class="btn small secondary" onclick="addOneRowV2()">+ Добавить один ряд</button>
      </div>
    </div>

    <!-- СТАТИСТИКА -->
    <div style="display:flex; gap:14px; flex-wrap:wrap; padding:10px 0; font-size:13px; color:var(--text-soft);">
      <span>📊 Всего рядов: <b>${totalRows}</b></span>
      <span>🌱 Саженцев: <b>${totalSeedlings}</b></span>
      ${skippedRows > 0 ? `<span style="color:var(--text-muted);">⚪ Пропущено рядов: <b>${skippedRows}</b></span>` : ''}
    </div>

    <!-- ТАБЛИЦА -->
    ${totalRows === 0 ? `
      <div class="empty" style="margin:20px 0;">
        Рядов пока нет.<br>
        <small>Заполните параметры выше и нажмите «✨ Применить ко всем рядам»</small>
      </div>
    ` : `
      <div class="table-wrap rows-table-wrap">
        <table class="rows-table">
          <thead>
            <tr>
              <th class="cell-num">№</th>
              <th title="0 = ряд пропущен">Саженцев</th>
              <th>Направление</th>
              <th title="Пропуск с начала">Смещение</th>
              <th class="cell-action"></th>
            </tr>
          </thead>
          <tbody>
            ${plot.rows.map((row, idx) => renderRowV2(row, idx, plot)).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// =========== ГРУППЫ РЯДОВ V2 ===========
function renderRowGroupsListV2(plot) {
  const cont = document.getElementById('row-groups-list-v2');
  if (!cont) return;
  const groups = plot.row_groups || [];
  if (!groups.length) {
    cont.innerHTML = '<p style="font-size:12px; color:var(--text-muted);">Групп нет</p>';
    return;
  }
  cont.innerHTML = groups.map((g, idx) => `
    <div style="display:flex; gap:8px; align-items:center; padding:6px 10px; background:var(--bg-elevated); border-radius:10px; margin-bottom:6px; font-size:13px;">
      <span style="width:14px; height:14px; background:${g.color || '#888'}; border-radius:50%;"></span>
      <div style="flex:1;"><b>${escapeHtml(g.name)}</b> · ${(g.row_ids || []).length} рядов</div>
      <button class="btn small danger" onclick="deleteRowGroupV2(${idx})">×</button>
    </div>
  `).join('');
}

function addRowGroupV2() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  if (!plot.row_groups) plot.row_groups = [];
  const name = document.getElementById('group-name-v2')?.value.trim();
  const color = document.getElementById('group-color-v2')?.value;
  const rowsStr = document.getElementById('group-rows-v2')?.value.trim();
  if (!name) { toast('Укажите название группы', 'error'); return; }
  const tokens = rowsStr.split(',').map(t => t.trim()).filter(Boolean);
  const rowIds = [];
  tokens.forEach(t => {
    const r = plot.rows.find(row => String(row.number) === t);
    if (r) rowIds.push(r.id);
  });
  plot.row_groups.push({
    id: 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    name, color, row_ids: rowIds
  });
  document.getElementById('group-name-v2').value = '';
  document.getElementById('group-rows-v2').value = '';
  renderRowGroupsListV2(plot);
  toast(`✅ Группа "${name}" добавлена`, 'success');
}

function deleteRowGroupV2(idx) {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot || !plot.row_groups) return;
  if (!confirm('Удалить группу?')) return;
  plot.row_groups.splice(idx, 1);
  renderRowGroupsListV2(plot);
}

function renderRowV2(row, idx, plot) {
  const isSkipped = (row.positions_count || 0) === 0;
  return `
    <tr data-row-id="${row.id}" style="${isSkipped ? 'opacity:0.45;' : ''}">
      <td class="cell-num"><b>${escapeHtml(String(row.number))}</b></td>
      <td class="cell-input">
        <input type="number" min="0" value="${row.positions_count || 0}"
          onchange="updateRowV2('${row.id}', 'positions_count', parseInt(this.value)||0)"
          class="num-input"
          title="0 = ряд полностью пропущен">
      </td>
      <td class="cell-select">
        <select onchange="updateRowV2('${row.id}', 'direction', this.value)" ${isSkipped ? 'disabled' : ''} class="dir-select">
          <option value="forward" ${(row.direction || 'forward') === 'forward' ? 'selected' : ''}>→ С нач.</option>
          <option value="reverse" ${row.direction === 'reverse' ? 'selected' : ''}>← С конца</option>
        </select>
      </td>
      <td class="cell-input">
        <input type="number" min="0" value="${row.offset || 0}"
          onchange="updateRowV2('${row.id}', 'offset', parseInt(this.value)||0)"
          class="num-input" ${isSkipped ? 'disabled' : ''}
          title="Сколько позиций пропустить с начала">
      </td>
      <td class="cell-action">
        <button class="btn small danger" onclick="deleteRowV2('${row.id}')" title="Удалить ряд">🗑</button>
      </td>
    </tr>
  `;
}

// =========== ОПЕРАЦИИ С РЯДАМИ ===========

function updateRowV2(rowId, field, value) {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  const row = plot.rows.find(r => r.id === rowId);
  if (!row) return;
  row[field] = value;
  // Особая логика для смещения: обновим start_position
  if (field === 'offset') {
    row.start_position = (value || 0) + 1;
  }
  // Пересоберём ряд (для зависимых полей)
  if (field === 'positions_count') {
    renderRowsEditorV2();
  }
}

function addOneRowV2() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  if (!plot.rows) plot.rows = [];
  const newIdx = plot.rows.length + 1;
  const naming = plot.row_naming || 'numbers';
  plot.rows.push({
    id: 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    number: (typeof formatRowNumber === 'function') ? formatRowNumber(newIdx, naming) : newIdx,
    positions_count: 50,
    start_position: 1,
    offset: 0,
    direction: 'forward',
    gaps: [],
    cascades: []
  });
  renderRowsEditorV2();
}

function deleteRowV2(rowId) {
  if (!confirm('Удалить этот ряд?')) return;
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  plot.rows = plot.rows.filter(r => r.id !== rowId);
  // Перенумерация
  const naming = plot.row_naming || 'numbers';
  plot.rows.forEach((r, idx) => {
    r.number = (typeof formatRowNumber === 'function') ? formatRowNumber(idx + 1, naming) : (idx + 1);
  });
  renderRowsEditorV2();
}

function applyBulkRowsV2() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;

  const rowsCount = parseInt(document.getElementById('bulk-rows-count').value) || 10;
  const positions = parseInt(document.getElementById('bulk-positions').value) || 50;
  const direction = document.getElementById('bulk-direction').value || 'forward';
  const offset = parseInt(document.getElementById('bulk-offset').value) || 0;
  const naming = plot.row_naming || 'numbers';

  if (plot.rows && plot.rows.length > 0) {
    if (!confirm(`Заменить ${plot.rows.length} существующих рядов на ${rowsCount} новых?`)) return;
  }

  plot.rows = [];
  for (let i = 1; i <= rowsCount; i++) {
    plot.rows.push({
      id: 'row_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
      number: (typeof formatRowNumber === 'function') ? formatRowNumber(i, naming) : i,
      positions_count: positions,
      start_position: offset + 1,
      offset: offset,
      direction: direction,
      gaps: [],
      cascades: []
    });
  }
  renderRowsEditorV2();
  toast(`✅ Создано ${rowsCount} рядов по ${positions} саженцев`, 'success');
}
