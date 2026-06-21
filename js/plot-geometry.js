// ============================================================================
// PLOT-GEOMETRY module — Расширенная геометрия участков (азимут, ряды, каскады)
// ============================================================================

// Справочники
const ORIENTATION_OPTIONS = [
  { id: 'NS',     name: 'Север — Юг (С-Ю)',      azimuth: 0,   icon: '⬆️' },
  { id: 'EW',     name: 'Восток — Запад (В-З)',  azimuth: 90,  icon: '➡️' },
  { id: 'NE_SW',  name: 'СВ — ЮЗ (45°)',          azimuth: 45,  icon: '↗️' },
  { id: 'NW_SE',  name: 'СЗ — ЮВ (135°)',         azimuth: 135, icon: '↘️' },
  { id: 'custom', name: 'Произвольный угол',      azimuth: 0,   icon: '🧭' }
];

const EXPOSURE_OPTIONS = [
  { id: 'flat', name: '🟢 Ровный участок (без уклона)' },
  { id: 'S',    name: '☀ Южный (лучший для созревания)' },
  { id: 'SE',   name: '🌅 Юго-восточный' },
  { id: 'SW',   name: '🌇 Юго-западный' },
  { id: 'E',    name: '🌄 Восточный' },
  { id: 'W',    name: '🌆 Западный' },
  { id: 'N',    name: '❄️ Северный (прохладный)' },
  { id: 'NE',   name: 'СВ' },
  { id: 'NW',   name: 'СЗ' }
];

const TRELLIS_OPTIONS = [
  { id: 'vertical', name: '│ Вертикальная одноплоскостная (VSP)' },
  { id: 'v_shape',  name: 'V-образная' },
  { id: 't_shape',  name: 'T-образная' },
  { id: 'lyre',     name: 'Лира (Lyre)' },
  { id: 'pergola',  name: 'Пергола / Беседочная' },
  { id: 'none',     name: 'Без шпалеры (штамбовая)' }
];

const SUPPORT_OPTIONS = [
  { id: 'concrete', name: '🏛 Бетонные столбы' },
  { id: 'metal',    name: '⚙️ Металлические' },
  { id: 'wood',     name: '🪵 Деревянные' },
  { id: 'mixed',    name: 'Смешанные' },
  { id: 'none',     name: 'Без опор' }
];

const SOIL_OPTIONS = [
  { id: 'chernozem',  name: '⚫ Чернозём' },
  { id: 'sand',       name: '🟡 Песок / песчаная' },
  { id: 'clay',       name: '🟤 Глина / глинистая' },
  { id: 'loam',       name: '🟫 Суглинок' },
  { id: 'stony',      name: '🪨 Каменистая' },
  { id: 'calcareous', name: '⚪ Известковая' },
  { id: 'peat',       name: '🟢 Торфяная' },
  { id: 'mixed',      name: 'Смешанная' }
];

const DRAINAGE_OPTIONS = [
  { id: 'natural',    name: '🌊 Естественный' },
  { id: 'artificial', name: '🔧 Искусственный (дрены)' },
  { id: 'none',       name: '❌ Отсутствует' }
];

const IRRIGATION_OPTIONS = [
  { id: 'drip',      name: '💧 Капельный' },
  { id: 'sprinkler', name: '🚿 Дождевание' },
  { id: 'flood',     name: '🌊 Орошение по бороздам' },
  { id: 'none',      name: '☀ Без полива (богара)' }
];

const GAP_REASONS = [
  { id: 'road',      name: '🛣 Дорога',      color: '#888' },
  { id: 'pole',      name: '⚡ Столб ЛЭП',   color: '#fa0' },
  { id: 'tree',      name: '🌳 Дерево',      color: '#363' },
  { id: 'rock',      name: '🪨 Скала/камень',color: '#777' },
  { id: 'drainage',  name: '💧 Дренаж',      color: '#08f' },
  { id: 'water',     name: '🌊 Водоём',      color: '#08f' },
  { id: 'building',  name: '🏠 Здание',      color: '#a52' },
  { id: 'planned',   name: '📋 Плановый',    color: '#666' },
  { id: 'unknown',   name: '❓ Не указано',  color: '#aaa' }
];

const CASCADE_TYPES = [
  { id: 'pair',   name: '2️⃣ Пара (Geneva)',  vines: 2 },
  { id: 'triple', name: '3️⃣ Тройка',          vines: 3 },
  { id: 'quad',   name: '4️⃣ Квадро',          vines: 4 },
  { id: 'custom', name: '🎛 Произвольный',     vines: 2 }
];

const CASCADE_LAYOUTS = [
  { id: 'geneva',   name: 'Geneva (горизонтальный)' },
  { id: 'lyre',     name: 'Lyre (V-образный)' },
  { id: 'parallel', name: 'Параллельный' },
  { id: 'fan',      name: 'Веером' }
];

// =========== УТИЛИТЫ НУМЕРАЦИИ ===========

const NUMBERING_OPTIONS = [
  { id: 'numbers',     name: '1, 2, 3...' },
  { id: 'cyrillic',    name: 'А, Б, В... (русские буквы)' },
  { id: 'latin',       name: 'A, B, C... (латинские буквы)' },
  { id: 'alpha_block', name: 'A1, A2, B1, B2 (с группами)' }
];

function formatRowNumber(index, scheme) {
  scheme = scheme || 'numbers';
  if (scheme === 'numbers') return String(index);
  if (scheme === 'cyrillic') {
    const cyr = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ'; // без Ё, Ы, Ъ, Ь, Й
    if (index <= cyr.length) return cyr[index - 1];
    const first = cyr[Math.floor((index - 1) / cyr.length) - 1];
    const second = cyr[(index - 1) % cyr.length];
    return first + second;
  }
  if (scheme === 'latin') {
    const lat = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (index <= lat.length) return lat[index - 1];
    const first = lat[Math.floor((index - 1) / lat.length) - 1];
    const second = lat[(index - 1) % lat.length];
    return first + second;
  }
  return String(index);
}

// =========== МИГРАЦИЯ СТРУКТУРЫ ===========

function migratePlotGeometry(plot) {
  if (!plot) return;
  if (plot._geometry_v3) return;

  // Создаём geometry если её нет
  if (!plot.geometry) {
    plot.geometry = {
      orientation: 'NS',
      azimuth_deg: 0,
      anchor_point: plot.center || null,
      slope_deg: 0,
      exposure: 'flat',
      polygon: plot.polygon || null
    };
  }

  // Создаём agronomy если нет
  if (!plot.agronomy) {
    plot.agronomy = {
      row_spacing_m: plot.row_spacing_m || 2.5,
      vine_spacing_m: plot.vine_spacing_m || 1.0,
      trellis_type: 'vertical',
      trellis_height_m: 1.8,
      support_type: 'concrete',
      soil_type: 'chernozem',
      drainage: 'natural',
      irrigation: 'drip'
    };
  }

  // Схема нумерации
  if (!plot.row_naming) plot.row_naming = 'numbers';

  // Группы рядов
  if (!plot.row_groups) plot.row_groups = [];

  // Обновляем ряды — добавляем недостающие поля
  if (plot.rows && plot.rows.length) {
    plot.rows.forEach((row, idx) => {
      if (!row.id) row.id = 'row_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 5);
      if (row.number == null) row.number = idx + 1;
      if (row.start_position == null) row.start_position = 1;
      if (!Array.isArray(row.gaps)) row.gaps = [];
      // Конвертация старых каскадов
      if (Array.isArray(row.cascades) && row.cascades.length && typeof row.cascades[0] === 'number') {
        row.cascades = row.cascades.map(pos => ({ position: pos, type: 'pair', vines_count: 2 }));
      }
      if (!Array.isArray(row.cascades)) row.cascades = [];
    });
  }

  plot._geometry_v3 = true;
}

// =========== ГЕНЕРАЦИЯ САЖЕНЦЕВ ИЗ РЯДОВ ===========

function regenerateSeedlingsFromRows(plot) {
  if (!plot || !plot.rows) return 0;
  if (!data.seedlings) data.seedlings = [];
  data.seedlings = data.seedlings.filter(s => s.plot_id !== plot.id);

  let created = 0;
  plot.rows.forEach(row => {
    const count = row.positions_count || 0;
    if (count === 0) return;  // ряд пропущен

    const offset = row.offset || 0;
    const direction = row.direction || 'forward';
    const startPos = (row.start_position != null) ? row.start_position : (offset + 1);

    // Generate positions array
    const positions = [];
    for (let i = 0; i < count; i++) {
      positions.push(startPos + i);
    }
    // Если direction = reverse, переворачиваем порядок (но позиции те же)
    // Реверс влияет только на порядок установки в массиве (для робота важно)
    // Но для семантики просто оставляем порядок 1,2,3 — а direction хранится в ряду для понимания

    positions.forEach(pos => {
      // Проверяем gap (если есть в середине ряда)
      const gap = (row.gaps || []).find(g => pos >= g.position && pos < g.position + g.length);
      if (gap) {
        data.seedlings.push({
          id: makeSeedlingId(plot.id, row, pos),
          plot_id: plot.id,
          block_id: null,
          row: row.number,
          position: pos,
          status: 'empty',
          gap_reason: gap.reason,
          is_replanted: false,
          ai_data: null,
          inspections: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        created++;
        return;
      }
      // Обычный куст
      data.seedlings.push({
        id: makeSeedlingId(plot.id, row, pos),
        plot_id: plot.id,
        block_id: null,
        row: row.number,
        position: pos,
        status: 'normal',
        is_replanted: false,
        ai_data: null,
        inspections: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      created++;
    });
  });

  // Привязываем к блокам по зонам
  if (plot.blocks) {
    plot.blocks.forEach(block => {
      if (!block.zone) return;
      block.zone.forEach(z => {
        data.seedlings.forEach(s => {
          if (s.plot_id !== plot.id) return;
          // z.row может быть числом или строкой (для алфавитных)
          if (String(s.row) === String(z.row) && s.position >= z.from && s.position <= z.to) {
            s.block_id = block.id;
          }
        });
      });
    });
  }

  return created;
}

function makeSeedlingId(plotId, row, pos, cascadeIdx) {
  const rid = typeof row.id === 'string' ? row.id.slice(-6) : ('r' + row.number);
  const idx = cascadeIdx != null ? '_c' + cascadeIdx : '';
  return `s_${plotId.slice(-6)}_${rid}_${pos}${idx}_${Math.random().toString(36).slice(2, 5)}`;
}

// =========== РАСЧЁТЫ ===========

function calcPlotStats(plot) {
  if (!plot || !plot.rows) return { rows: 0, total_positions: 0, gaps: 0, cascades: 0, expected_vines: 0 };
  let positions = 0, gaps = 0, cascadeVines = 0, normalVines = 0;
  plot.rows.forEach(row => {
    positions += row.positions_count;
    (row.gaps || []).forEach(g => { gaps += g.length; });
    (row.cascades || []).forEach(c => { cascadeVines += (c.vines_count || 2); });
  });
  normalVines = positions - gaps - (plot.rows.reduce((s, r) => s + (r.cascades?.length || 0), 0));
  return {
    rows: plot.rows.length,
    total_positions: positions,
    gaps: gaps,
    cascade_points: plot.rows.reduce((s, r) => s + (r.cascades?.length || 0), 0),
    cascade_vines: cascadeVines,
    expected_vines: normalVines + cascadeVines,
    total_length_m: plot.rows.reduce((s, r) => s + (r.length_m || r.positions_count * (plot.agronomy?.vine_spacing_m || 1)), 0)
  };
}

// =========== ОТКРЫТИЕ РЕДАКТОРА ГЕОМЕТРИИ ===========

let currentEditingPlotId = null;

function openGeometryEditor(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  migratePlotGeometry(plot);
  currentEditingPlotId = plotId;

  // Заполняем поля
  setVal('geo-orientation', plot.geometry.orientation);
  setVal('geo-azimuth', plot.geometry.azimuth_deg);
  setVal('geo-slope', plot.geometry.slope_deg);
  setVal('geo-exposure', plot.geometry.exposure);
  setVal('geo-row-spacing', plot.agronomy.row_spacing_m);
  setVal('geo-vine-spacing', plot.agronomy.vine_spacing_m);
  setVal('geo-trellis-type', plot.agronomy.trellis_type);
  setVal('geo-trellis-height', plot.agronomy.trellis_height_m);
  setVal('geo-support-type', plot.agronomy.support_type);
  setVal('geo-soil-type', plot.agronomy.soil_type);
  setVal('geo-drainage', plot.agronomy.drainage);
  setVal('geo-irrigation', plot.agronomy.irrigation);
  setVal('geo-row-naming', plot.row_naming || 'numbers');

  // Упрощённый редактор рядов V2
  if (typeof renderRowsEditorV2 === 'function') {
    setTimeout(renderRowsEditorV2, 100);
  }

  // Открыть модалку
  openModal('geometry-modal');
  // Переключим на 1-ю вкладку
  switchGeoTab('basic');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function switchGeoTab(tabId) {
  document.querySelectorAll('.geo-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.geo-tab-content').forEach(c => c.style.display = 'none');
  const btn = document.querySelector(`.geo-tab[data-gtab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const cont = document.getElementById(`gtab-${tabId}`);
  if (cont) cont.style.display = 'block';
}

// =========== СОХРАНЕНИЕ ===========

function saveGeometry() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  migratePlotGeometry(plot);

  // Базовые параметры
  plot.geometry.orientation = document.getElementById('geo-orientation').value;
  plot.geometry.azimuth_deg = parseFloat(document.getElementById('geo-azimuth').value) || 0;
  // Если orientation не custom — пересчитываем azimuth
  const orient = ORIENTATION_OPTIONS.find(o => o.id === plot.geometry.orientation);
  if (orient && orient.id !== 'custom') plot.geometry.azimuth_deg = orient.azimuth;

  plot.geometry.slope_deg = parseFloat(document.getElementById('geo-slope').value) || 0;
  plot.geometry.exposure = document.getElementById('geo-exposure').value;

  plot.agronomy.row_spacing_m = parseFloat(document.getElementById('geo-row-spacing').value) || 2.5;
  plot.agronomy.vine_spacing_m = parseFloat(document.getElementById('geo-vine-spacing').value) || 1.0;
  plot.agronomy.trellis_type = document.getElementById('geo-trellis-type').value;
  plot.agronomy.trellis_height_m = parseFloat(document.getElementById('geo-trellis-height').value) || 1.8;
  plot.agronomy.support_type = document.getElementById('geo-support-type').value;
  plot.agronomy.soil_type = document.getElementById('geo-soil-type').value;
  plot.agronomy.drainage = document.getElementById('geo-drainage').value;
  plot.agronomy.irrigation = document.getElementById('geo-irrigation').value;
  plot.row_naming = document.getElementById('geo-row-naming').value;

  // Зеркалируем в старые поля для обратной совместимости
  plot.row_spacing_m = plot.agronomy.row_spacing_m;
  plot.vine_spacing_m = plot.agronomy.vine_spacing_m;

  // Применяем нумерацию к рядам
  if (plot.rows) {
    plot.rows.forEach((row, idx) => {
      row.number = formatRowNumber(idx + 1, plot.row_naming);
    });
  }

  // Спросим: пересоздавать саженцы?
  const confirmRegen = confirm('Сохранить геометрию?\n\nЕсли вы изменили ряды, пропуски или каскады — нужно пересоздать реестр саженцев. ВНИМАНИЕ: ручные статусы кустов будут сброшены, но рекомендуется при больших изменениях.\n\nПересоздать саженцы из новой структуры?');
  if (confirmRegen) {
    const cnt = regenerateSeedlingsFromRows(plot);
    toast(`✅ Геометрия сохранена. Создано ${cnt} саженцев.`, 'success');
  } else {
    toast('✅ Геометрия сохранена (саженцы не пересозданы)', 'success');
  }

  saveData();
  closeModal('geometry-modal');
  renderAll();
}

// =========== РЕДАКТОР РЯДОВ: ТАБЛИЦА ===========

function renderRowsTable(plot) {
  const cont = document.getElementById('rows-table-body');
  if (!cont) return;
  const rows = plot.rows || [];
  if (!rows.length) {
    cont.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">Рядов нет. Используйте «🪄 Мастер» для создания.</td></tr>';
    return;
  }
  cont.innerHTML = rows.map((row, idx) => {
    const isSkipped = (row.positions_count || 0) === 0;
    return `
      <tr data-row-id="${row.id}" style="${isSkipped ? 'opacity:0.5; background:rgba(0,0,0,0.03);' : ''}">
        <td><b>${escapeHtml(String(row.number))}</b></td>
        <td>
          <input type="number" min="0" value="${row.positions_count || 0}"
            onchange="updateRowField('${row.id}', 'positions_count', parseInt(this.value)||0); renderRowsTable(data.plots.find(p=>p.id==='${plot.id}'))"
            style="width:75px;" title="0 = ряд пропускается полностью">
          ${isSkipped ? '<small style="color:var(--text-muted); margin-left:4px;">(пропуск)</small>' : ''}
        </td>
        <td>
          <input type="number" min="1" value="${row.start_position || 1}"
            onchange="updateRowField('${row.id}', 'start_position', parseInt(this.value)||1)"
            style="width:65px;" ${isSkipped ? 'disabled' : ''}>
        </td>
        <td>
          <input type="text" value="${escapeHtml(row.name || '')}"
            onchange="updateRowField('${row.id}', 'name', this.value)"
            placeholder="опц." style="width:110px;" ${isSkipped ? 'disabled' : ''}>
        </td>
        <td>
          <button class="btn small secondary" onclick="openGapsEditor('${row.id}')" title="Пропуски (в середине ряда)" ${isSkipped ? 'disabled' : ''}>
            🚫 ${row.gaps?.length || 0}
          </button>
          <button class="btn small secondary" onclick="openCascadesEditor('${row.id}')" title="Каскады (2-3 куста на позиции)" ${isSkipped ? 'disabled' : ''}>
            🔀 ${row.cascades?.length || 0}
          </button>
        </td>
        <td>
          <button class="btn small danger" onclick="deleteRow('${row.id}')" title="Удалить ряд полностью">🗑</button>
        </td>
      </tr>
    `;
  }).join('');
}

function updateRowField(rowId, field, value) {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  const row = plot.rows.find(r => r.id === rowId);
  if (!row) return;
  row[field] = value;
}

function addRow() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  if (!plot.rows) plot.rows = [];
  const newIdx = plot.rows.length + 1;
  plot.rows.push({
    id: 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    number: formatRowNumber(newIdx, plot.row_naming || 'numbers'),
    positions_count: 50,
    start_position: 1,
    gaps: [],
    cascades: []
  });
  renderRowsTable(plot);
  renderRowsJSON(plot);
}

function deleteRow(rowId) {
  if (!confirm('Удалить ряд?')) return;
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  plot.rows = plot.rows.filter(r => r.id !== rowId);
  // Перенумерация
  plot.rows.forEach((r, idx) => {
    r.number = formatRowNumber(idx + 1, plot.row_naming || 'numbers');
  });
  renderRowsTable(plot);
  renderRowsJSON(plot);
}

// =========== РЕДАКТОР ПРОПУСКОВ ===========

let currentGapRowId = null;
function openGapsEditor(rowId) {
  currentGapRowId = rowId;
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  const row = plot.rows.find(r => r.id === rowId);
  if (!row) return;
  document.getElementById('gaps-modal-title').textContent = `Пропуски — Ряд ${row.number}`;
  renderGapsList(row);
  openModal('gaps-modal');
}

function renderGapsList(row) {
  const cont = document.getElementById('gaps-list');
  if (!cont) return;
  cont.innerHTML = (row.gaps || []).map((g, idx) => {
    const reason = GAP_REASONS.find(r => r.id === g.reason) || GAP_REASONS[GAP_REASONS.length-1];
    return `
      <div style="display:flex; gap:8px; align-items:center; padding:8px; background:var(--bg); border-radius:12px; box-shadow: inset 1px 1px 2px var(--shadow-inset-dark); margin-bottom:8px;">
        <span style="font-size:14px;">${reason.name.split(' ')[0]}</span>
        <div style="flex:1; font-size:13px;">
          <b>Поз. ${g.position}</b> — ${g.length} ${g.length === 1 ? 'место' : 'мест'} · ${reason.name.split(' ').slice(1).join(' ')}
          ${g.notes ? `<br><small style="color:var(--text-muted);">${escapeHtml(g.notes)}</small>` : ''}
        </div>
        <button class="btn small danger" onclick="deleteGap(${idx})">×</button>
      </div>
    `;
  }).join('') || '<p style="color:var(--text-muted); font-size:13px; padding:8px;">Пропусков нет</p>';
}

function addGap() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  const row = plot.rows.find(r => r.id === currentGapRowId);
  if (!row) return;
  const position = parseInt(document.getElementById('gap-position').value);
  const length = parseInt(document.getElementById('gap-length').value) || 1;
  const reason = document.getElementById('gap-reason').value;
  const notes = document.getElementById('gap-notes').value.trim();
  if (!position) { toast('Укажите позицию', 'error'); return; }
  if (!row.gaps) row.gaps = [];
  row.gaps.push({ position, length, reason, notes });
  row.gaps.sort((a, b) => a.position - b.position);
  ['gap-position', 'gap-length', 'gap-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('gap-length').value = '1';
  renderGapsList(row);
  renderRowsTable(plot);
}

function deleteGap(idx) {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  const row = plot.rows.find(r => r.id === currentGapRowId);
  if (!row) return;
  row.gaps.splice(idx, 1);
  renderGapsList(row);
  renderRowsTable(plot);
}

// =========== РЕДАКТОР КАСКАДОВ ===========

let currentCascadeRowId = null;
function openCascadesEditor(rowId) {
  currentCascadeRowId = rowId;
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  const row = plot.rows.find(r => r.id === rowId);
  if (!row) return;
  document.getElementById('cascades-modal-title').textContent = `Каскады — Ряд ${row.number}`;
  renderCascadesList(row);
  openModal('cascades-modal');
}

function renderCascadesList(row) {
  const cont = document.getElementById('cascades-list');
  if (!cont) return;
  cont.innerHTML = (row.cascades || []).map((c, idx) => {
    const type = CASCADE_TYPES.find(t => t.id === c.type) || CASCADE_TYPES[0];
    const layout = CASCADE_LAYOUTS.find(l => l.id === c.layout);
    return `
      <div style="display:flex; gap:8px; align-items:center; padding:8px; background:var(--bg); border-radius:12px; box-shadow: inset 1px 1px 2px var(--shadow-inset-dark); margin-bottom:8px;">
        <span style="font-size:14px;">🟣</span>
        <div style="flex:1; font-size:13px;">
          <b>Поз. ${c.position}</b> — ${type.name} (${c.vines_count} кустов)
          ${layout ? ' · ' + layout.name : ''}
          ${c.notes ? `<br><small style="color:var(--text-muted);">${escapeHtml(c.notes)}</small>` : ''}
        </div>
        <button class="btn small danger" onclick="deleteCascade(${idx})">×</button>
      </div>
    `;
  }).join('') || '<p style="color:var(--text-muted); font-size:13px; padding:8px;">Каскадов нет</p>';
}

function addCascade() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  const row = plot.rows.find(r => r.id === currentCascadeRowId);
  if (!row) return;
  const position = parseInt(document.getElementById('cascade-position').value);
  const type = document.getElementById('cascade-type').value;
  const layout = document.getElementById('cascade-layout').value;
  const vines = parseInt(document.getElementById('cascade-vines').value) || (CASCADE_TYPES.find(t => t.id === type)?.vines) || 2;
  const notes = document.getElementById('cascade-notes').value.trim();
  if (!position) { toast('Укажите позицию', 'error'); return; }
  if (!row.cascades) row.cascades = [];
  row.cascades.push({ position, type, layout, vines_count: vines, notes });
  row.cascades.sort((a, b) => a.position - b.position);
  ['cascade-position', 'cascade-vines', 'cascade-notes'].forEach(id => document.getElementById(id).value = '');
  renderCascadesList(row);
  renderRowsTable(plot);
}

function deleteCascade(idx) {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  const row = plot.rows.find(r => r.id === currentCascadeRowId);
  if (!row) return;
  row.cascades.splice(idx, 1);
  renderCascadesList(row);
  renderRowsTable(plot);
}

// =========== JSON РЕДАКТОР ===========

function renderRowsJSON(plot) {
  const cont = document.getElementById('rows-json');
  if (!cont) return;
  cont.value = JSON.stringify({
    row_naming: plot.row_naming,
    rows: plot.rows,
    row_groups: plot.row_groups
  }, null, 2);
}

function importRowsJSON() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  try {
    const json = JSON.parse(document.getElementById('rows-json').value);
    if (json.row_naming) plot.row_naming = json.row_naming;
    if (json.rows) plot.rows = json.rows;
    if (json.row_groups) plot.row_groups = json.row_groups;
    renderRowsTable(plot);
    renderRowGroupsList(plot);
    toast('✅ JSON загружен', 'success');
  } catch(e) { toast('Ошибка JSON: ' + e.message, 'error'); }
}

// =========== МАСТЕР БЫСТРОГО СОЗДАНИЯ ===========

function applyWizard() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot) return;
  const rowsCount = parseInt(document.getElementById('wiz-rows').value) || 10;
  const positionsPerRow = parseInt(document.getElementById('wiz-positions').value) || 50;
  const naming = document.getElementById('geo-row-naming').value;
  if (!confirm(`Заменить текущие ${plot.rows?.length || 0} рядов на новую сетку ${rowsCount}×${positionsPerRow}?`)) return;
  plot.rows = [];
  for (let i = 1; i <= rowsCount; i++) {
    plot.rows.push({
      id: 'row_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
      number: formatRowNumber(i, naming),
      positions_count: positionsPerRow,
      start_position: 1,
      gaps: [],
      cascades: []
    });
  }
  renderRowsTable(plot);
  renderRowsJSON(plot);
  toast(`✅ Создано ${rowsCount} рядов по ${positionsPerRow} позиций`, 'success');
}

// =========== ГРУППЫ РЯДОВ ===========

function renderRowGroupsList(plot) {
  const cont = document.getElementById('row-groups-list');
  if (!cont) return;
  const groups = plot.row_groups || [];
  if (!groups.length) {
    cont.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Групп нет. Добавьте группу (например, «Верхняя терраса»).</p>';
    return;
  }
  cont.innerHTML = groups.map((g, idx) => `
    <div style="display:flex; gap:8px; align-items:center; padding:8px; background:var(--bg); border-radius:12px; box-shadow: inset 1px 1px 2px var(--shadow-inset-dark); margin-bottom:8px;">
      <span style="width:14px; height:14px; background:${g.color || '#888'}; border-radius:50%;"></span>
      <div style="flex:1;">
        <b>${escapeHtml(g.name)}</b> · ${g.row_ids.length} рядов
      </div>
      <button class="btn small danger" onclick="deleteRowGroup(${idx})">×</button>
    </div>
  `).join('');
}

function addRowGroup() {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  const name = document.getElementById('group-name').value.trim();
  const color = document.getElementById('group-color').value;
  const rowsStr = document.getElementById('group-rows').value.trim();
  if (!name) { toast('Укажите название группы', 'error'); return; }
  if (!plot.row_groups) plot.row_groups = [];
  // rowsStr формат: "1,2,3" или "А,Б,В"
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
  document.getElementById('group-name').value = '';
  document.getElementById('group-rows').value = '';
  renderRowGroupsList(plot);
}

function deleteRowGroup(idx) {
  const plot = data.plots.find(p => p.id === currentEditingPlotId);
  if (!plot.row_groups) return;
  plot.row_groups.splice(idx, 1);
  renderRowGroupsList(plot);
}

// =========== UI HELPERS ===========
function onOrientationChange() {
  const sel = document.getElementById('geo-orientation');
  const azInput = document.getElementById('geo-azimuth');
  if (!sel || !azInput) return;
  const orient = ORIENTATION_OPTIONS.find(o => o.id === sel.value);
  if (orient && orient.id !== 'custom') {
    azInput.value = orient.azimuth;
    azInput.disabled = true;
  } else {
    azInput.disabled = false;
  }
}
