// ============================================================================
// PLOTS module
// ============================================================================

// PLOTS
// ===========================================================================
// =============================================================
// PLOTS v2 — Участки, блоки, реестр саженцев, схема, карта, CSV
// =============================================================

const VINE_STATUS = {
  planted:   { color: '#7CB9E8', label: '🌱 Посажен',    desc: 'Молодой, не плодоносит' },
  healthy:   { color: '#4CAF50', label: '🟢 Здоров',     desc: 'Идеальное состояние' },
  normal:    { color: '#A3C08F', label: '🟡 Норма',      desc: 'Без проблем' },
  attention: { color: '#F39C12', label: '🟠 Внимание',   desc: 'Лёгкие признаки' },
  sick:      { color: '#E67E22', label: '🔴 Болеет',     desc: 'Активные проблемы' },
  dead:      { color: '#8B2020', label: '⚫ Погиб',      desc: 'Куст мёртв' },
  empty:     { color: '#d6dbcc', label: '⚪ Пусто',      desc: 'Пропуск' },
  cascade:   { color: '#8E44AD', label: '🟣 Каскад',     desc: 'Двойной/тройной куст' }
};

// Глобальные состояния
let currentPlotTab = {};         // plot_id → активная вкладка (blocks/schema/map/stats)
let schemaColorMode = {};        // plot_id → режим окраски (status/block/age/ai)
let bulkSelection = new Set();   // выбранные seedling.id для массовых действий
let bulkPlotId = null;
let leafletMaps = {};            // plot_id → Leaflet map instance
let isDragSelecting = false;
let dragStartCell = null;

// =========== МИГРАЦИЯ СТАРЫХ ДАННЫХ ===========
function migratePlotsV2() {
  if (!data.plots) data.plots = [];
  if (!data.seedlings) data.seedlings = [];
  let migrated = 0;
  data.plots.forEach(p => {
    if (p._v2) return; // уже мигрирован
    // Преобразуем старую плоскую модель в новую
    if (!p.blocks) p.blocks = [];
    if (!p.rows) p.rows = [];
    if (p.variety && p.blocks.length === 0) {
      const block = {
        id: 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: p.variety + (p.year ? ' (' + p.year + ')' : ''),
        color: '#6b8e5a',
        scion: p.variety || '',
        scion_clone: '',
        rootstock: p.rootstock || '',
        rootstock_clone: '',
        planting_year: p.year || null,
        planting_date: '',
        supplier: '',
        batch_number: '',
        training_system: p.form || '',
        zone: [],
        notes: ''
      };
      p.blocks.push(block);
    }
    if (!p.row_spacing_m) {
      const sp = (p.spacing || '').split(/[×x]/);
      p.row_spacing_m = parseFloat(sp[0]) || 2.5;
      p.vine_spacing_m = parseFloat(sp[1]) || 1.0;
    }
    if (!p.area_ha) p.area_ha = p.area || 0;
    if (!p.polygon) p.polygon = null;
    if (!p.center) p.center = null;
    p._v2 = true;
    migrated++;
  });
  if (migrated > 0) {
    saveData();
    console.log('Migrated plots:', migrated);
  }
}

// =========== УТИЛИТЫ ===========
function getPlotSeedlings(plotId) {
  return (data.seedlings || []).filter(s => s.plot_id === plotId);
}
function getBlockSeedlings(plotId, blockId) {
  return (data.seedlings || []).filter(s => s.plot_id === plotId && s.block_id === blockId);
}
function parseZone(str) {
  // "1:1-30, 2:1-15" → [{row:1, from:1, to:30}, {row:2, from:1, to:15}]
  if (!str) return [];
  return str.split(',').map(part => {
    const m = part.trim().match(/^(\d+):(\d+)-(\d+)$/);
    if (!m) return null;
    return { row: +m[1], from: +m[2], to: +m[3] };
  }).filter(Boolean);
}
function zoneToString(zone) {
  if (!zone || !zone.length) return '';
  return zone.map(z => `${z.row}:${z.from}-${z.to}`).join(', ');
}

// =========== PLOT MODAL ===========
function openPlotModal(id) {
  ['plot-name','plot-area','plot-row-spacing','plot-vine-spacing','plot-notes',
   'plot-lat','plot-lng','plot-polygon','plot-rows-count','plot-positions-count'].forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = '';
  });
  document.getElementById('plot-id').value = '';
  document.getElementById('plot-modal-title').textContent = 'Новый участок';
  document.getElementById('plot-row-spacing').value = '2.5';
  document.getElementById('plot-vine-spacing').value = '1.0';
  document.getElementById('plot-rows-count').value = '10';
  document.getElementById('plot-positions-count').value = '50';

  if (id) {
    const p = data.plots.find(x => x.id === id);
    if (p) {
      document.getElementById('plot-id').value = p.id;
      document.getElementById('plot-modal-title').textContent = 'Участок: ' + p.name;
      document.getElementById('plot-name').value = p.name || '';
      document.getElementById('plot-area').value = p.area_ha || p.area || '';
      document.getElementById('plot-row-spacing').value = p.row_spacing_m || 2.5;
      document.getElementById('plot-vine-spacing').value = p.vine_spacing_m || 1.0;
      document.getElementById('plot-notes').value = p.notes || '';
      if (p.center) {
        document.getElementById('plot-lat').value = p.center.lat || '';
        document.getElementById('plot-lng').value = p.center.lng || '';
      }
      if (p.polygon) document.getElementById('plot-polygon').value = JSON.stringify(p.polygon);
      if (p.rows && p.rows.length) {
        document.getElementById('plot-rows-count').value = p.rows.length;
        document.getElementById('plot-positions-count').value = p.rows[0].positions_count || 50;
      }
    }
  }
  // активируем первую под-вкладку
  document.querySelectorAll('.plot-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.plot-tab-content').forEach(c => { c.classList.remove('active'); c.style.display = 'none'; });
  document.querySelector('.plot-tab[data-ptab="basic"]').classList.add('active');
  document.getElementById('ptab-basic').style.display = 'block';
  document.getElementById('ptab-basic').classList.add('active');

  openModal('plot-modal');
}

// Sub-tabs внутри plot-modal
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('plot-tab')) {
    document.querySelectorAll('.plot-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.plot-tab-content').forEach(c => c.style.display = 'none');
    e.target.classList.add('active');
    const id = 'ptab-' + e.target.dataset.ptab;
    const c = document.getElementById(id);
    if (c) c.style.display = 'block';
  }
});

function useCurrentLocationForPlot() {
  if (!navigator.geolocation) { toast('Геолокация не поддерживается', 'error'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('plot-lat').value = pos.coords.latitude.toFixed(5);
    document.getElementById('plot-lng').value = pos.coords.longitude.toFixed(5);
    toast('✅ Координаты определены', 'success');
  }, err => toast('Ошибка GPS: ' + err.message, 'error'));
}

function savePlot() {
  if (currentRole === 'viewer' || currentRole === 'worker') { toast('Нет прав', 'error'); return; }
  const id = document.getElementById('plot-id').value || ('p_' + Date.now());
  const isNew = !document.getElementById('plot-id').value;
  const name = document.getElementById('plot-name').value.trim();
  if (!name) { toast('Укажите название', 'error'); return; }

  let plot = data.plots.find(p => p.id === id) || { id, blocks: [], rows: [], _v2: true };
  plot.name = name;
  plot.area_ha = parseFloat(document.getElementById('plot-area').value) || 0;
  plot.row_spacing_m = parseFloat(document.getElementById('plot-row-spacing').value) || 2.5;
  plot.vine_spacing_m = parseFloat(document.getElementById('plot-vine-spacing').value) || 1.0;
  plot.notes = document.getElementById('plot-notes').value.trim();

  const lat = parseFloat(document.getElementById('plot-lat').value);
  const lng = parseFloat(document.getElementById('plot-lng').value);
  if (!isNaN(lat) && !isNaN(lng)) plot.center = { lat, lng };

  const polyStr = document.getElementById('plot-polygon').value.trim();
  if (polyStr) {
    try {
      const poly = JSON.parse(polyStr);
      plot.polygon = poly;
    } catch(e) { toast('Невалидный полигон', 'error'); return; }
  }

  // Создаём сетку рядов если новый или сетка пустая
  const rowsCount = parseInt(document.getElementById('plot-rows-count').value) || 10;
  const posCount = parseInt(document.getElementById('plot-positions-count').value) || 50;
  if (isNew || plot.rows.length === 0) {
    plot.rows = [];
    for (let r = 1; r <= rowsCount; r++) {
      plot.rows.push({
        number: r,
        positions_count: posCount,
        length_m: posCount * plot.vine_spacing_m,
        gaps: [],
        cascades: []
      });
    }
  }

  if (isNew) {
    data.plots.push(plot);
    // Создадим саженцы по сетке
    if (!data.seedlings) data.seedlings = [];
    plot.rows.forEach(row => {
      for (let pos = 1; pos <= row.positions_count; pos++) {
        data.seedlings.push({
          id: `s_${plot.id}_${row.number}_${pos}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`,
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
      }
    });
    toast(`✅ Участок создан. ${rowsCount * posCount} кустов добавлено в реестр.`, 'success');
  } else {
    toast('✅ Участок обновлён', 'success');
  }

  saveData();
  closeModal('plot-modal');
  renderAll();
}

function deletePlot(id) {
  if (currentRole !== 'owner') { toast('Только владелец', 'error'); return; }
  const p = data.plots.find(x => x.id === id);
  const seedlingsCount = getPlotSeedlings(id).length;
  if (!confirm(`Удалить участок "${p ? p.name : '?'}" вместе с ${seedlingsCount} кустами и всеми блоками?`)) return;
  data.plots = data.plots.filter(x => x.id !== id);
  data.seedlings = (data.seedlings || []).filter(s => s.plot_id !== id);
  saveData(); renderAll();
}

// =========== BLOCK MODAL ===========
function openBlockModal(plotId, blockId) {
  ['block-name','block-scion','block-scion-clone','block-rootstock','block-rootstock-clone',
   'block-year','block-date','block-supplier','block-batch','block-training','block-zone','block-notes'].forEach(f => {
    document.getElementById(f).value = '';
  });
  document.getElementById('block-color').value = '#6b8e5a';
  document.getElementById('block-id').value = '';
  document.getElementById('block-plot-id').value = plotId;
  document.getElementById('block-modal-title').textContent = 'Новый блок-сорт';
  document.getElementById('block-delete-btn').style.display = 'none';

  if (blockId) {
    const plot = data.plots.find(p => p.id === plotId);
    const block = plot && plot.blocks.find(b => b.id === blockId);
    if (block) {
      document.getElementById('block-modal-title').textContent = 'Блок: ' + block.name;
      document.getElementById('block-id').value = block.id;
      document.getElementById('block-name').value = block.name || '';
      document.getElementById('block-color').value = block.color || '#6b8e5a';
      document.getElementById('block-scion').value = block.scion || '';
      document.getElementById('block-scion-clone').value = block.scion_clone || '';
      document.getElementById('block-rootstock').value = block.rootstock || '';
      document.getElementById('block-rootstock-clone').value = block.rootstock_clone || '';
      document.getElementById('block-year').value = block.planting_year || '';
      document.getElementById('block-date').value = block.planting_date || '';
      document.getElementById('block-supplier').value = block.supplier || '';
      document.getElementById('block-batch').value = block.batch_number || '';
      document.getElementById('block-training').value = block.training_system || '';
      document.getElementById('block-zone').value = zoneToString(block.zone);
      document.getElementById('block-notes').value = block.notes || '';
      document.getElementById('block-delete-btn').style.display = '';
    }
  }
  openModal('block-modal');
}

function saveBlock() {
  const plotId = document.getElementById('block-plot-id').value;
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) { toast('Участок не найден', 'error'); return; }
  if (!plot.blocks) plot.blocks = [];

  const id = document.getElementById('block-id').value || ('b_' + Date.now() + '_' + Math.random().toString(36).slice(2,6));
  const name = document.getElementById('block-name').value.trim();
  if (!name) { toast('Укажите название блока', 'error'); return; }

  const zone = parseZone(document.getElementById('block-zone').value);

  const block = {
    id, name,
    color: document.getElementById('block-color').value,
    scion: document.getElementById('block-scion').value.trim(),
    scion_clone: document.getElementById('block-scion-clone').value.trim(),
    rootstock: document.getElementById('block-rootstock').value.trim(),
    rootstock_clone: document.getElementById('block-rootstock-clone').value.trim(),
    planting_year: parseInt(document.getElementById('block-year').value) || null,
    planting_date: document.getElementById('block-date').value || '',
    supplier: document.getElementById('block-supplier').value.trim(),
    batch_number: document.getElementById('block-batch').value.trim(),
    training_system: document.getElementById('block-training').value.trim(),
    zone,
    notes: document.getElementById('block-notes').value.trim()
  };

  const idx = plot.blocks.findIndex(b => b.id === id);
  if (idx >= 0) plot.blocks[idx] = block;
  else plot.blocks.push(block);

  // Привязываем саженцы к блоку по zone
  if (zone.length && data.seedlings) {
    data.seedlings.forEach(s => {
      if (s.plot_id !== plotId) return;
      const inZone = zone.some(z => s.row === z.row && s.position >= z.from && s.position <= z.to);
      if (inZone) s.block_id = id;
    });
  }

  saveData();
  closeModal('block-modal');
  renderAll();
  toast('✅ Блок сохранён', 'success');
}

function deleteBlock() {
  const plotId = document.getElementById('block-plot-id').value;
  const id = document.getElementById('block-id').value;
  if (!id || !plotId) return;
  if (!confirm('Удалить блок? Саженцы останутся, но потеряют привязку к сорту.')) return;
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  plot.blocks = plot.blocks.filter(b => b.id !== id);
  if (data.seedlings) {
    data.seedlings.forEach(s => { if (s.block_id === id) s.block_id = null; });
  }
  saveData();
  closeModal('block-modal');
  renderAll();
}

// =========== SEEDLING MODAL (карточка куста) ===========
function openSeedlingModal(seedlingId) {
  const s = (data.seedlings || []).find(x => x.id === seedlingId);
  if (!s) return;
  const plot = data.plots.find(p => p.id === s.plot_id);
  const block = plot && plot.blocks && plot.blocks.find(b => b.id === s.block_id);
  const info = VINE_STATUS[s.status] || VINE_STATUS.normal;

  const aiHtml = s.ai_data ? `
    <h4 style="margin-top:14px;">🤖 AI-данные (последний скан: ${s.ai_data.last_scan || '—'})</h4>
    <table>
      ${s.ai_data.height_cm != null ? `<tr><td>Высота</td><td><b>${s.ai_data.height_cm} см</b></td></tr>` : ''}
      ${s.ai_data.shoots_count != null ? `<tr><td>Побегов</td><td><b>${s.ai_data.shoots_count}</b></td></tr>` : ''}
      ${s.ai_data.leaves_count_est != null ? `<tr><td>Листьев (оценка)</td><td><b>${s.ai_data.leaves_count_est}</b></td></tr>` : ''}
      ${s.ai_data.canopy_density != null ? `<tr><td>Плотность кроны</td><td><b>${(s.ai_data.canopy_density*100).toFixed(0)}%</b></td></tr>` : ''}
      ${s.ai_data.vegetation_index != null ? `<tr><td>NDVI</td><td><b>${s.ai_data.vegetation_index.toFixed(2)}</b></td></tr>` : ''}
      ${s.ai_data.clusters_count != null ? `<tr><td>Гроздей</td><td><b>${s.ai_data.clusters_count}</b></td></tr>` : ''}
      ${s.ai_data.yield_forecast_kg != null ? `<tr><td>Прогноз урожая</td><td><b>${s.ai_data.yield_forecast_kg.toFixed(2)} кг</b></td></tr>` : ''}
      ${s.ai_data.health_score != null ? `<tr><td>Здоровье</td><td><b>${s.ai_data.health_score}/100</b></td></tr>` : ''}
      ${s.ai_data.disease_signs && s.ai_data.disease_signs.length ? `<tr><td>Признаки</td><td><b>${s.ai_data.disease_signs.join(', ')}</b></td></tr>` : ''}
    </table>
  ` : '<p style="margin-top:14px; color:var(--text-muted); font-size:13px;">🤖 AI-данных нет. Будут добавлены после скана роботом.</p>';

  const historyHtml = s.inspections && s.inspections.length ? `
    <h4 style="margin-top:14px;">📔 История осмотров</h4>
    <div class="timeline">
      ${s.inspections.slice().reverse().map(i => `
        <div class="timeline-item">
          <div class="timeline-date">${i.date} · ${i.type === 'robot' ? '🤖' : i.type === 'photo' ? '📸' : '👤'} ${escapeHtml(i.inspector || '')}</div>
          <div class="timeline-title">${VINE_STATUS[i.status_before] ? VINE_STATUS[i.status_before].label : i.status_before} → ${VINE_STATUS[i.status_after] ? VINE_STATUS[i.status_after].label : i.status_after}</div>
          ${i.notes ? `<div style="font-size:13px; color:var(--text-soft);">${escapeHtml(i.notes)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  const statusOptions = Object.entries(VINE_STATUS).map(([k, v]) =>
    `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v.label}</option>`
  ).join('');

  document.getElementById('seedling-modal-title').textContent = `Куст · Ряд ${s.row}, поз. ${s.position}`;
  document.getElementById('seedling-modal-content').innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; padding:12px; background:var(--bg); border-radius:14px; box-shadow: inset 3px 3px 6px var(--shadow-inset-dark), inset -3px -3px 6px var(--shadow-inset-light); margin-bottom:14px;">
      <div style="width:50px; height:50px; border-radius:50%; background:${info.color}; box-shadow: 3px 3px 6px var(--shadow-dark);"></div>
      <div style="flex:1;">
        <div style="font-size:16px; font-weight:600;">${info.label}</div>
        <div style="font-size:12px; color:var(--text-soft);">${info.desc}</div>
      </div>
    </div>

    <table>
      <tr><td>Участок</td><td><b>${escapeHtml(plot ? plot.name : '—')}</b></td></tr>
      <tr><td>Блок-сорт</td><td><b>${block ? `<span style="display:inline-block;width:10px;height:10px;background:${block.color};border-radius:50%"></span> ${escapeHtml(block.name)}` : 'Не привязан'}</b></td></tr>
      ${block ? `<tr><td>Привой</td><td>${escapeHtml(block.scion)} ${block.scion_clone ? '(' + block.scion_clone + ')' : ''}</td></tr>` : ''}
      ${block ? `<tr><td>Подвой</td><td>${escapeHtml(block.rootstock)}</td></tr>` : ''}
      ${block && block.planting_year ? `<tr><td>Возраст</td><td><b>${new Date().getFullYear() - block.planting_year}</b> лет (посажен ${block.planting_year})</td></tr>` : ''}
      <tr><td>Подсажен?</td><td>${s.is_replanted ? '✅ Да' : 'Нет'}</td></tr>
      ${s.gps ? `<tr><td>GPS</td><td>${s.gps.lat.toFixed(5)}, ${s.gps.lng.toFixed(5)}</td></tr>` : ''}
    </table>

    ${aiHtml}
    ${historyHtml}

    <h4 style="margin-top:18px;">⚙️ Изменить статус</h4>
    <div class="form-grid">
      <div class="form-row">
        <label>Новый статус</label>
        <select id="seedling-new-status">${statusOptions}</select>
      </div>
      <div class="form-row">
        <label>Подсажен взамен?</label>
        <select id="seedling-replanted">
          <option value="false" ${!s.is_replanted ? 'selected' : ''}>Нет</option>
          <option value="true" ${s.is_replanted ? 'selected' : ''}>Да</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Комментарий (запишется в историю)</label>
      <textarea id="seedling-status-note" rows="2"></textarea>
    </div>

    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal('seedling-modal')">Закрыть</button>
      <button class="btn primary" onclick="saveSeedlingStatus('${s.id}')">💾 Сохранить</button>
    </div>
  `;
  openModal('seedling-modal');
}

function saveSeedlingStatus(seedlingId) {
  const s = data.seedlings.find(x => x.id === seedlingId);
  if (!s) return;
  const newStatus = document.getElementById('seedling-new-status').value;
  const replanted = document.getElementById('seedling-replanted').value === 'true';
  const note = document.getElementById('seedling-status-note').value.trim();
  if (s.status !== newStatus || s.is_replanted !== replanted || note) {
    if (!s.inspections) s.inspections = [];
    s.inspections.push({
      id: 'i_' + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      type: 'manual',
      inspector: currentUser ? (currentUser.displayName || currentUser.email) : 'локальный',
      status_before: s.status,
      status_after: newStatus,
      notes: note
    });
    s.status = newStatus;
    s.is_replanted = replanted;
    s.updated_at = new Date().toISOString();
    if (replanted && !s.replanted_date) s.replanted_date = new Date().toISOString().slice(0, 10);
    saveData();
  }
  closeModal('seedling-modal');
  renderAll();
  toast('✅ Статус обновлён', 'success');
}

// =========== РЕНДЕР: СПИСОК УЧАСТКОВ ===========
function renderPlots() {
  const list = document.getElementById('plots-list');
  if (!data.plots || !data.plots.length) {
    list.innerHTML = '<div class="empty">Нет участков. Создайте первый — он будет автоматически разбит на сетку рядов.</div>';
    return;
  }
  list.innerHTML = data.plots.map(p => renderPlotCard(p)).join('');
  // активируем вкладки
  data.plots.forEach(p => {
    const tab = currentPlotTab[p.id] || 'blocks';
    showPlotTab(p.id, tab);
  });
}

function renderPlotCard(p) {
  const seedlings = getPlotSeedlings(p.id);
  const totalCount = seedlings.length;
  const aliveCount = seedlings.filter(s => !['dead', 'empty'].includes(s.status)).length;
  const blocksCount = (p.blocks || []).length;

  return `
    <div class="card plot-card" style="margin-bottom:20px;">
      <div class="plot-header">
        <div>
          <h2 style="margin:0;">📍 ${escapeHtml(p.name)}</h2>
          <div class="plot-meta" style="margin-top:10px;">
            <span>📏 ${(p.area_ha || 0).toFixed(2)} га</span>
            <span>${p.polygon ? '📐 GPS' : '📋 Без GPS'}</span>
            <span>🌿 ${blocksCount} блоков</span>
            <span>🍇 ${aliveCount}/${totalCount} живых</span>
            <span>📐 ${(p.rows || []).length} рядов · ${p.row_spacing_m}×${p.vine_spacing_m} м</span>
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn small secondary" onclick="openPlotMenu(event, '${p.id}')" title="Управление">⚙️ Управление</button>
        </div>
      </div>

      <div class="tabs" style="margin-top:16px;">
        <button class="plot-subtab" data-pid="${p.id}" data-tab="blocks" onclick="showPlotTab('${p.id}', 'blocks')">🌿 Блоки</button>
        <button class="plot-subtab" data-pid="${p.id}" data-tab="schema" onclick="showPlotTab('${p.id}', 'schema')">📊 Схема</button>
        <button class="plot-subtab" data-pid="${p.id}" data-tab="map" onclick="showPlotTab('${p.id}', 'map')">🗺 Карта</button>
        <button class="plot-subtab" data-pid="${p.id}" data-tab="stats" onclick="showPlotTab('${p.id}', 'stats')">📈 Статистика</button>
      </div>

      <div class="plot-tab-pane" id="pane-blocks-${p.id}"></div>
      <div class="plot-tab-pane" id="pane-schema-${p.id}" style="display:none;"></div>
      <div class="plot-tab-pane" id="pane-map-${p.id}" style="display:none;"></div>
      <div class="plot-tab-pane" id="pane-stats-${p.id}" style="display:none;"></div>
    </div>
  `;
}

function showPlotTab(plotId, tab) {
  currentPlotTab[plotId] = tab;
  // active class на под-вкладке
  document.querySelectorAll(`.plot-subtab[data-pid="${plotId}"]`).forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  ['blocks', 'schema', 'map', 'stats'].forEach(t => {
    const pane = document.getElementById(`pane-${t}-${plotId}`);
    if (pane) pane.style.display = (t === tab) ? 'block' : 'none';
  });
  // Рендер контента активной вкладки
  if (tab === 'blocks') renderPlotBlocks(plotId);
  else if (tab === 'schema') renderPlotSchema(plotId);
  else if (tab === 'map') renderPlotMap(plotId);
  else if (tab === 'stats') renderPlotStats(plotId);
}

// =========== РЕНДЕР: БЛОКИ ===========
function renderPlotBlocks(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  const pane = document.getElementById(`pane-blocks-${plotId}`);
  if (!plot || !pane) return;
  const blocks = plot.blocks || [];
  if (!blocks.length) {
    pane.innerHTML = '<div class="empty" style="margin-top:14px;">Блоков нет. Нажмите «+ Блок», чтобы добавить сорт.</div>';
    return;
  }
  pane.innerHTML = `<div class="blocks-list" style="margin-top:14px;">
    ${blocks.map(b => {
      const seedlings = getBlockSeedlings(plotId, b.id);
      const alive = seedlings.filter(s => !['dead', 'empty'].includes(s.status)).length;
      const dead = seedlings.filter(s => s.status === 'dead').length;
      const empty = seedlings.filter(s => s.status === 'empty').length;
      return `<div class="block-card" style="border-left-color:${b.color}" onclick="openBlockModal('${plotId}','${b.id}')">
        <h4><span style="width:12px;height:12px;border-radius:50%;background:${b.color};display:inline-block"></span> ${escapeHtml(b.name)}</h4>
        <div class="field"><b>Привой:</b> ${escapeHtml(b.scion || '—')}${b.scion_clone ? ' (клон ' + escapeHtml(b.scion_clone) + ')' : ''}</div>
        <div class="field"><b>Подвой:</b> ${escapeHtml(b.rootstock || '—')}</div>
        <div class="field"><b>Посадка:</b> ${b.planting_year || '—'} ${b.supplier ? '· ' + escapeHtml(b.supplier) : ''}</div>
        ${b.batch_number ? `<div class="field"><b>Партия:</b> ${escapeHtml(b.batch_number)}</div>` : ''}
        ${b.training_system ? `<div class="field"><b>Форма:</b> ${escapeHtml(b.training_system)}</div>` : ''}
        <div class="block-stats">
          <span class="block-stat"><b>${seedlings.length}</b> кустов</span>
          <span class="block-stat" style="color:var(--st-healthy)">🟢 ${alive}</span>
          ${dead ? `<span class="block-stat" style="color:var(--st-dead)">⚫ ${dead}</span>` : ''}
          ${empty ? `<span class="block-stat" style="color:var(--text-muted)">⚪ ${empty}</span>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// =========== РЕНДЕР: СХЕМА (Canvas) ===========
function renderPlotSchema(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  const pane = document.getElementById(`pane-schema-${plotId}`);
  if (!plot || !pane) return;
  const mode = schemaColorMode[plotId] || 'status';
  const orient = (typeof schemaOrientation !== 'undefined' && schemaOrientation[plotId]) || 'h';

  pane.innerHTML = `
    <div class="schema-controls" style="margin-top:14px;">
      <select onchange="schemaColorMode['${plotId}']=this.value; renderPlotSchema('${plotId}')" style="max-width:220px;">
        <option value="status" ${mode==='status'?'selected':''}>🎨 Цвет: статус</option>
        <option value="block" ${mode==='block'?'selected':''}>🎨 Цвет: сорт</option>
        <option value="age" ${mode==='age'?'selected':''}>🎨 Цвет: возраст</option>
        <option value="ai" ${mode==='ai'?'selected':''}>🎨 Цвет: AI-здоровье</option>
      </select>
      <button class="btn small secondary" id="schema-orient-btn-${plotId}" onclick="toggleSchemaOrientation('${plotId}')" title="Изменить ориентацию схемы">
        ${orient === 'v' ? '↻ Ряды горизонтально' : '↻ Ряды вертикально'}
      </button>
      <button class="btn small" onclick="openBulkModal('${plotId}')" id="bulk-btn-${plotId}" style="display:none;">⚡ Действие (<span id="sel-count-${plotId}">0</span>)</button>
      <span style="font-size:11px; color:var(--text-soft);">💡 Клик — карточка · Shift+клик — выбрать</span>
    </div>
    <div class="schema-wrap" style="margin-top:10px;">
      <canvas id="schema-canvas-${plotId}" class="schema-canvas"></canvas>
    </div>
    <div class="schema-legend" id="schema-legend-${plotId}" style="margin-top:10px;"></div>
  `;
  drawSchemaCanvas(plotId, mode);
  renderSchemaLegend(plotId, mode);
}

function drawSchemaCanvas(plotId, mode) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  const canvas = document.getElementById('schema-canvas-' + plotId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const rows = (plot.rows || []).filter(r => (r.positions_count || 0) > 0);
  if (!rows.length) {
    canvas.width = 400; canvas.height = 80;
    ctx.fillStyle = '#8a9180'; ctx.font = '14px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Нет рядов с саженцами. Откройте ⚙️ Управление → 📐 Геометрия', 200, 40);
    return;
  }

  // Ориентация: 'h' = ряды горизонтально, 'v' = ряды вертикально
  const orient = (typeof schemaOrientation !== 'undefined' && schemaOrientation[plotId]) || 'h';
  const maxPos = Math.max(...rows.map(r => r.positions_count), 1);
  const cell = Math.max(14, Math.min(32, Math.floor(1100 / Math.max(maxPos, rows.length))));
  const padding = 36;

  // В зависимости от ориентации меняем ширину/высоту
  let cols, rowsN;
  if (orient === 'h') {
    cols = maxPos; rowsN = rows.length;  // X = позиция, Y = ряд
  } else {
    cols = rows.length; rowsN = maxPos;  // X = ряд, Y = позиция
  }
  canvas.width = padding + cols * cell + padding;
  canvas.height = padding + rowsN * cell + padding;

  // Dpr scaling
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
  canvas.width *= dpr;
  canvas.height *= dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.width / dpr, h = canvas.height / dpr;

  ctx.clearRect(0, 0, w, h);

  // Подписи осей
  ctx.fillStyle = '#8a9180';
  ctx.font = `${Math.max(9, cell * 0.34)}px Inter, sans-serif`;

  if (orient === 'h') {
    // Колонки = позиции (1, 2, 3...), строки = ряды (А, Б, В...)
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(maxPos / 20));
    for (let c1 = 1; c1 <= maxPos; c1++) {
      if (c1 % step === 0 || c1 === 1 || c1 === maxPos) {
        ctx.fillText(c1, padding + (c1 - 0.5) * cell, padding - 8);
      }
    }
    ctx.textAlign = 'right';
    rows.forEach((row, ri) => {
      ctx.fillText('Р' + row.number, padding - 6, padding + (ri + 0.5) * cell + 4);
    });
  } else {
    // Колонки = ряды (А, Б, В), строки = позиции (1, 2, 3...)
    ctx.textAlign = 'center';
    rows.forEach((row, ri) => {
      ctx.fillText('Р' + row.number, padding + (ri + 0.5) * cell, padding - 8);
    });
    ctx.textAlign = 'right';
    const step = Math.max(1, Math.floor(maxPos / 20));
    for (let p1 = 1; p1 <= maxPos; p1++) {
      if (p1 % step === 0 || p1 === 1 || p1 === maxPos) {
        ctx.fillText(p1, padding - 6, padding + (p1 - 0.5) * cell + 4);
      }
    }
  }

  // Кусты
  const seedlings = getPlotSeedlings(plotId);
  const seedMap = new Map();
  seedlings.forEach(s => seedMap.set(`${s.row}_${s.position}`, s));

  rows.forEach((row, ri) => {
    for (let pos = (row.start_position || 1); pos < (row.start_position || 1) + row.positions_count; pos++) {
      const s = seedMap.get(`${row.number}_${pos}`);
      let x, y;
      if (orient === 'h') {
        x = padding + (pos - 1) * cell;
        y = padding + ri * cell;
      } else {
        x = padding + ri * cell;
        y = padding + (pos - 1) * cell;
      }
      const cx = x + cell / 2, cy = y + cell / 2;
      const r = Math.max(4, cell * 0.36);

      let color = '#d6dbcc';
      if (s) {
        if (mode === 'status') color = (VINE_STATUS[s.status] || VINE_STATUS.normal).color;
        else if (mode === 'block') {
          const block = plot.blocks?.find(b => b.id === s.block_id);
          color = block ? block.color : '#bbb';
        } else if (mode === 'age') {
          const block = plot.blocks?.find(b => b.id === s.block_id);
          const age = block && block.planting_year ? (new Date().getFullYear() - block.planting_year) : 0;
          if (age < 3) color = '#7CB9E8';
          else if (age < 6) color = '#F39C12';
          else color = '#4CAF50';
        } else if (mode === 'ai') {
          const hs = s.ai_data && s.ai_data.health_score;
          if (hs == null) color = '#d6dbcc';
          else if (hs >= 80) color = '#4CAF50';
          else if (hs >= 60) color = '#A3C08F';
          else if (hs >= 40) color = '#F39C12';
          else if (hs >= 20) color = '#E67E22';
          else color = '#8B2020';
        }
      }

      // Подложка
      ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,135,110,0.15)'; ctx.fill();

      // Куст
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();

      // Подсаженный
      if (s && s.is_replanted) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      }
      // Каскад
      if (s && s.status === 'cascade') {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, cell * 0.36)}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText('2', cx, cy + r * 0.4);
      }
      // Выбранный
      if (s && bulkSelection.has(s.id)) {
        ctx.strokeStyle = '#6b2c4a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
  });

  // Универсальная функция: координаты клика → ряд + позиция
  function pickRowPos(mx, my) {
    let col, rowIdx;
    if (orient === 'h') {
      col = Math.floor((mx - padding) / cell) + 1;     // позиция
      rowIdx = Math.floor((my - padding) / cell);       // индекс ряда
    } else {
      rowIdx = Math.floor((mx - padding) / cell);       // индекс ряда (по X)
      col = Math.floor((my - padding) / cell) + 1;      // позиция (по Y)
    }
    if (col < 1 || rowIdx < 0 || rowIdx >= rows.length) return null;
    const r = rows[rowIdx];
    if (col > (r.start_position || 1) + r.positions_count - 1) return null;
    return { rowNum: r.number, pos: col };
  }

  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / dpr / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / dpr / rect.height);
    const hit = pickRowPos(mx, my);
    if (!hit) return;
    const s = seedMap.get(`${hit.rowNum}_${hit.pos}`);
    if (!s) return;
    if (e.shiftKey) {
      bulkPlotId = plotId;
      if (bulkSelection.has(s.id)) bulkSelection.delete(s.id);
      else bulkSelection.add(s.id);
      updateBulkUI(plotId);
      drawSchemaCanvas(plotId, mode);
    } else {
      openSeedlingModal(s.id);
    }
  };

  let lastTooltipFor = null;
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / dpr / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / dpr / rect.height);
    const hit = pickRowPos(mx, my);
    if (!hit) { hideTooltip(); return; }
    const s = seedMap.get(`${hit.rowNum}_${hit.pos}`);
    if (s && lastTooltipFor !== s.id) {
      lastTooltipFor = s.id;
      const block = plot.blocks?.find(b => b.id === s.block_id);
      const info = VINE_STATUS[s.status] || VINE_STATUS.normal;
      showTooltip(e.clientX, e.clientY, `
        <b>Р${s.row}, поз. ${s.position}</b><br>
        ${block ? escapeHtml(block.scion) : 'Без сорта'}<br>
        ${info.label}
        ${s.ai_data ? `<br>🤖 H:${s.ai_data.height_cm||'?'}см · побегов:${s.ai_data.shoots_count||'?'}` : ''}
      `);
    } else if (!s) {
      hideTooltip();
    } else {
      moveTooltip(e.clientX, e.clientY);
    }
  };
  canvas.onmouseleave = hideTooltip;
}


function renderSchemaLegend(plotId, mode) {
  const div = document.getElementById('schema-legend-' + plotId);
  if (!div) return;
  if (mode === 'status') {
    div.innerHTML = Object.entries(VINE_STATUS).map(([k, v]) =>
      `<div class="lg-item"><div class="lg-dot" style="background:${v.color}"></div>${v.label}</div>`
    ).join('');
  } else if (mode === 'block') {
    const plot = data.plots.find(p => p.id === plotId);
    div.innerHTML = (plot.blocks || []).map(b =>
      `<div class="lg-item"><div class="lg-dot" style="background:${b.color}"></div>${escapeHtml(b.name)}</div>`
    ).join('') || '<span style="color:var(--text-muted); font-size:12px;">Нет блоков</span>';
  } else if (mode === 'age') {
    div.innerHTML = `
      <div class="lg-item"><div class="lg-dot" style="background:#7CB9E8"></div>Молодой (&lt;3 лет)</div>
      <div class="lg-item"><div class="lg-dot" style="background:#F39C12"></div>3-5 лет</div>
      <div class="lg-item"><div class="lg-dot" style="background:#4CAF50"></div>Взрослый (6+)</div>
    `;
  } else if (mode === 'ai') {
    div.innerHTML = `
      <div class="lg-item"><div class="lg-dot" style="background:#4CAF50"></div>80-100 здоров</div>
      <div class="lg-item"><div class="lg-dot" style="background:#A3C08F"></div>60-79 норма</div>
      <div class="lg-item"><div class="lg-dot" style="background:#F39C12"></div>40-59 внимание</div>
      <div class="lg-item"><div class="lg-dot" style="background:#E67E22"></div>20-39 болеет</div>
      <div class="lg-item"><div class="lg-dot" style="background:#8B2020"></div>0-19 критично</div>
      <div class="lg-item"><div class="lg-dot" style="background:#d6dbcc"></div>Нет AI-данных</div>
    `;
  }
}

// =========== TOOLTIP ===========
let tooltipEl = null;
function ensureTooltip() {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'seedling-tooltip';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}
function showTooltip(x, y, html) {
  const t = ensureTooltip();
  t.innerHTML = html;
  t.style.left = (x + 14) + 'px';
  t.style.top = (y + 14) + 'px';
  t.classList.add('show');
}
function moveTooltip(x, y) {
  if (!tooltipEl) return;
  tooltipEl.style.left = (x + 14) + 'px';
  tooltipEl.style.top = (y + 14) + 'px';
}
function hideTooltip() { if (tooltipEl) tooltipEl.classList.remove('show'); }

// =========== МАССОВЫЕ ДЕЙСТВИЯ ===========
function updateBulkUI(plotId) {
  const btn = document.getElementById('bulk-btn-' + plotId);
  const cnt = document.getElementById('sel-count-' + plotId);
  if (cnt) cnt.textContent = bulkSelection.size;
  if (btn) btn.style.display = bulkSelection.size > 0 ? '' : 'none';
}
function clearBulkSelection() {
  bulkSelection.clear();
  if (bulkPlotId) {
    drawSchemaCanvas(bulkPlotId, schemaColorMode[bulkPlotId] || 'status');
    updateBulkUI(bulkPlotId);
  }
}
function openBulkModal(plotId) {
  document.getElementById('bulk-count').textContent = bulkSelection.size;
  openModal('bulk-modal');
}
function applyBulkAction() {
  const newStatus = document.getElementById('bulk-status').value;
  const reason = document.getElementById('bulk-reason').value.trim();
  const inspector = currentUser ? (currentUser.displayName || currentUser.email) : 'локальный';
  let changed = 0;
  bulkSelection.forEach(sid => {
    const s = data.seedlings.find(x => x.id === sid);
    if (!s) return;
    if (!s.inspections) s.inspections = [];
    s.inspections.push({
      id: 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
      date: new Date().toISOString().slice(0, 10),
      type: 'manual',
      inspector,
      status_before: s.status,
      status_after: newStatus,
      notes: reason
    });
    s.status = newStatus;
    s.updated_at = new Date().toISOString();
    changed++;
  });
  saveData();
  closeModal('bulk-modal');
  bulkSelection.clear();
  if (bulkPlotId) {
    drawSchemaCanvas(bulkPlotId, schemaColorMode[bulkPlotId] || 'status');
    updateBulkUI(bulkPlotId);
  }
  document.getElementById('bulk-reason').value = '';
  toast(`✅ Изменён статус ${changed} кустов`, 'success');
  renderAll();
}

// =========== КАРТА (Leaflet) ===========
function renderPlotMap(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  const pane = document.getElementById(`pane-map-${plotId}`);
  if (!plot || !pane) return;
  pane.innerHTML = `
    <div style="margin-top:14px; margin-bottom:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <button class="btn small secondary" onclick="centerMapOnPlot('${plotId}')">📍 Центрировать</button>
      <button class="btn small secondary" onclick="applyAutoGPSToPlot('${plotId}')" title="Расставить кусты по азимуту и spacing">🎯 Авто GPS кустов</button>
      <button class="btn small secondary" id="draw-rows-btn-${plotId}" onclick="toggleRowDrawingMode('${plotId}')">✏️ Рисовать ряды</button>
      <button class="btn small secondary" onclick="showRobotRoute('${plotId}')" title="Маршрут робота">🤖 Маршрут</button>
      <button class="btn small secondary" onclick="exportRouteGPX('${plotId}')" title="Экспорт GPX">⬇ GPX</button>
      <span style="font-size:11px; color:var(--text-soft);">💡 Авто-GPS использует азимут и spacing</span>
    </div>
    <div id="plot-map-${plotId}" style="height:500px; border-radius: var(--radius); box-shadow: inset 3px 3px 6px var(--shadow-inset-dark), inset -3px -3px 6px var(--shadow-inset-light);"></div>
  `;
  setTimeout(() => initPlotMap(plotId), 100);
}


// =========== ПРОВАЙДЕРЫ КАРТ ===========
function buildMapLayers() {
  const provider = (settings && settings.mapProvider) || 'osm';
  const all = {};
  let defaultLayer;

  // 1. OpenStreetMap (стандартный, бесплатно, доступен в РФ)
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  });
  all['OpenStreetMap'] = osm;

  // 2. Яндекс Карты (если настроен ключ или плагин)
  // По умолчанию используем тайлы Яндекс через прямой URL (без ключа для базовых слоёв)
  const yandexMap = L.tileLayer('https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ru_RU', {
    attribution: '© Яндекс', maxZoom: 19, subdomains: '0123'
  });
  const yandexSat = L.tileLayer('https://core-sat.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}&scale=1&lang=ru_RU', {
    attribution: '© Яндекс Спутник', maxZoom: 19, subdomains: '0123'
  });
  all['Яндекс Карты'] = yandexMap;
  all['Яндекс Спутник'] = yandexSat;

  // 3. 2ГИС (если настроен)
  const dgis = L.tileLayer('https://tile{s}.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1', {
    attribution: '© 2ГИС', maxZoom: 19, subdomains: '0123'
  });
  all['2ГИС'] = dgis;

  // 4. Спутник Esri (международный, нейтральный)
  const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri', maxZoom: 19
  });
  all['Esri Спутник'] = esriSat;

  // Выбор по умолчанию
  if (provider === 'yandex') defaultLayer = yandexMap;
  else if (provider === 'yandex_sat') defaultLayer = yandexSat;
  else if (provider === '2gis') defaultLayer = dgis;
  else if (provider === 'esri_sat') defaultLayer = esriSat;
  else defaultLayer = osm;

  return { default: defaultLayer, all };
}

function initLeafletMap(plotId) {
  if (typeof L === 'undefined') {
    document.getElementById('plot-map-' + plotId).innerHTML =
      '<div class="empty" style="margin:0; padding:30px;">⚠️ Leaflet не загружен (нужен интернет)</div>';
    return;
  }
  // Если уже инициализирован — удаляем (для перерисовки)
  if (leafletMaps[plotId]) { leafletMaps[plotId].remove(); delete leafletMaps[plotId]; }
  const plot = data.plots.find(p => p.id === plotId);
  const center = plot.center || { lat: 45.0355, lng: 38.9753 };
  const map = L.map('plot-map-' + plotId).setView([center.lat, center.lng], 17);

  // Слои карт (поддержка нескольких провайдеров)
  const layers = buildMapLayers();
  layers.default.addTo(map);
  L.control.layers(layers.all).addTo(map);

  // Полигон
  if (plot.polygon && plot.polygon.length) {
    L.polygon(plot.polygon, {
      color: '#6b8e5a', fillColor: '#a3c08f', fillOpacity: 0.25, weight: 3
    }).addTo(map).bindPopup(`<b>${plot.name}</b><br>${(plot.area_ha||0).toFixed(2)} га`);
  }

  // Кусты с GPS
  const seedlings = getPlotSeedlings(plotId).filter(s => s.gps);
  seedlings.forEach(s => {
    const color = (VINE_STATUS[s.status] || VINE_STATUS.normal).color;
    L.circleMarker([s.gps.lat, s.gps.lng], {
      radius: 4, color: '#fff', weight: 1, fillColor: color, fillOpacity: 0.9
    }).addTo(map).bindPopup(`<b>Р${s.row}/${s.position}</b><br>${VINE_STATUS[s.status].label}`)
      .on('click', () => openSeedlingModal(s.id));
  });

  leafletMaps[plotId] = map;
}


function distributeSeedlingsByGrid(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot || !plot.center) { toast('Сначала укажите координаты центра участка', 'error'); return; }
  if (!confirm('Распределить кусты по сетке (примерные GPS-координаты на основе центра и расстояний)?')) return;
  const seedlings = getPlotSeedlings(plotId);
  if (!seedlings.length) return;
  // 1° широты ≈ 111 km
  const rowM = plot.row_spacing_m || 2.5;
  const vineM = plot.vine_spacing_m || 1.0;
  const maxPos = Math.max(...plot.rows.map(r => r.positions_count));
  const cx = plot.center.lat, cy = plot.center.lng;
  // центрируем сетку
  const startLat = cx + (plot.rows.length * rowM / 2) / 111000;
  const startLng = cy - (maxPos * vineM / 2) / (111000 * Math.cos(cx * Math.PI / 180));
  seedlings.forEach(s => {
    const ri = plot.rows.findIndex(r => r.number === s.row);
    if (ri < 0) return;
    const lat = startLat - (ri * rowM) / 111000;
    const lng = startLng + ((s.position - 1) * vineM) / (111000 * Math.cos(lat * Math.PI / 180));
    s.gps = { lat, lng };
  });
  saveData();
  initPlotMap(plotId);
  toast(`✅ Распределено ${seedlings.length} кустов`, 'success');
}

// =========== СТАТИСТИКА ===========
function renderPlotStats(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  const pane = document.getElementById(`pane-stats-${plotId}`);
  if (!plot || !pane) return;
  const seedlings = getPlotSeedlings(plotId);
  const total = seedlings.length;
  if (!total) { pane.innerHTML = '<div class="empty" style="margin-top:14px;">Нет данных</div>'; return; }
  const counts = {};
  Object.keys(VINE_STATUS).forEach(k => counts[k] = 0);
  seedlings.forEach(s => counts[s.status] = (counts[s.status] || 0) + 1);
  const alive = total - counts.dead - counts.empty;
  const healthPct = ((counts.healthy + counts.normal) / total * 100).toFixed(1);
  pane.innerHTML = `
    <div class="stats-grid" style="margin-top:14px;">
      <div class="stat-pill"><div class="num">${total}</div><div class="lbl">Всего</div></div>
      <div class="stat-pill healthy"><div class="num">${alive}</div><div class="lbl">Живых</div></div>
      <div class="stat-pill"><div class="num">${healthPct}%</div><div class="lbl">Здоровых</div></div>
      <div class="stat-pill attention"><div class="num">${counts.attention + counts.sick}</div><div class="lbl">Проблем</div></div>
      <div class="stat-pill dead"><div class="num">${counts.dead}</div><div class="lbl">Погибло</div></div>
      <div class="stat-pill"><div class="num">${counts.empty}</div><div class="lbl">Пропусков</div></div>
    </div>
    <h4 style="margin-top:18px;">Распределение по статусам</h4>
    ${Object.entries(counts).map(([s, n]) => n > 0 ? `
      <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border)">
        <div style="width:18px; height:18px; border-radius:50%; background:${VINE_STATUS[s].color}"></div>
        <div style="flex:1; font-size:13px;">${VINE_STATUS[s].label}</div>
        <div style="font-weight:600;">${n}</div>
        <div style="font-size:12px; color:var(--text-soft); width:50px; text-align:right;">${(n/total*100).toFixed(1)}%</div>
      </div>
    ` : '').join('')}
  `;
}

// =========== CSV IMPORT/EXPORT ===========
function exportSeedlingsCSV() {
  if (!data.seedlings || !data.seedlings.length) { toast('Нет саженцев для экспорта', 'error'); return; }
  const headers = ['id','plot_id','plot_name','block_id','block_name','row','position','status','is_replanted','gps_lat','gps_lng','height_cm','shoots_count','clusters_count','health_score','updated_at'];
  const rows = data.seedlings.map(s => {
    const plot = data.plots.find(p => p.id === s.plot_id);
    const block = plot && plot.blocks.find(b => b.id === s.block_id);
    return [
      s.id, s.plot_id, plot ? plot.name : '', s.block_id || '', block ? block.name : '',
      s.row, s.position, s.status, s.is_replanted ? '1' : '0',
      s.gps ? s.gps.lat : '', s.gps ? s.gps.lng : '',
      s.ai_data ? (s.ai_data.height_cm ?? '') : '',
      s.ai_data ? (s.ai_data.shoots_count ?? '') : '',
      s.ai_data ? (s.ai_data.clusters_count ?? '') : '',
      s.ai_data ? (s.ai_data.health_score ?? '') : '',
      s.updated_at || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `seedlings-${todayStr()}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast('✅ CSV экспортирован', 'success');
}

function importSeedlingsCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result.replace(/^\ufeff/, '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('Пустой CSV', 'error'); return; }
      const headers = parseCSVLine(lines[0]);
      const idx = {};
      headers.forEach((h, i) => idx[h.toLowerCase()] = i);
      let updated = 0, created = 0;
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        const sid = row[idx['id']];
        const plotId = row[idx['plot_id']];
        const rowNum = parseInt(row[idx['row']]);
        const pos = parseInt(row[idx['position']]);
        const status = row[idx['status']] || 'normal';
        if (!plotId || !rowNum || !pos) continue;
        let s = data.seedlings.find(x => x.id === sid) ||
                data.seedlings.find(x => x.plot_id === plotId && x.row === rowNum && x.position === pos);
        if (!s) {
          s = { id: sid || ('s_imp_' + Date.now() + '_' + i), plot_id: plotId, row: rowNum, position: pos, inspections: [] };
          data.seedlings.push(s);
          created++;
        } else updated++;
        s.status = status;
        s.block_id = row[idx['block_id']] || s.block_id;
        s.is_replanted = row[idx['is_replanted']] === '1' || row[idx['is_replanted']] === 'true';
        const lat = parseFloat(row[idx['gps_lat']]);
        const lng = parseFloat(row[idx['gps_lng']]);
        if (!isNaN(lat) && !isNaN(lng)) s.gps = { lat, lng };
        if (!s.ai_data) s.ai_data = {};
        const h = parseFloat(row[idx['height_cm']]);
        const sh = parseInt(row[idx['shoots_count']]);
        const cl = parseInt(row[idx['clusters_count']]);
        const hs = parseFloat(row[idx['health_score']]);
        if (!isNaN(h)) s.ai_data.height_cm = h;
        if (!isNaN(sh)) s.ai_data.shoots_count = sh;
        if (!isNaN(cl)) s.ai_data.clusters_count = cl;
        if (!isNaN(hs)) s.ai_data.health_score = hs;
        if (Object.keys(s.ai_data).length === 0) s.ai_data = null;
        else s.ai_data.last_scan = new Date().toISOString().slice(0,10);
        s.updated_at = new Date().toISOString();
      }
      saveData();
      renderAll();
      toast(`✅ Импорт CSV: создано ${created}, обновлено ${updated}`, 'success');
    } catch(err) { toast('Ошибка импорта: ' + err.message, 'error'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else cur += ch;
  }
  result.push(cur);
  return result;
}

// =========== ДАШБОРД: HEATMAP МИНИ-КАРТЫ ===========
function renderDashboardPlots() {
  // Добавим виджет с миниатюрами на дашборд (если есть div для этого)
  const container = document.getElementById('dashboard-plots-mini');
  if (!container) return;
  if (!data.plots || !data.plots.length) {
    container.innerHTML = '<div class="empty" style="margin:0;">Создайте участок, чтобы увидеть мини-карту здоровья</div>';
    return;
  }
  container.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px;">
      ${data.plots.map(p => {
        const sds = getPlotSeedlings(p.id);
        const total = sds.length;
        const counts = {};
        Object.keys(VINE_STATUS).forEach(k => counts[k] = 0);
        sds.forEach(s => counts[s.status]++);
        const healthPct = total ? ((counts.healthy + counts.normal) / total * 100).toFixed(0) : 0;
        return `
          <div class="card" style="padding:14px; cursor:pointer;" onclick="showTab('plots')">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <strong>${escapeHtml(p.name)}</strong>
              <span class="badge ${healthPct > 70 ? 'green' : healthPct > 40 ? 'yellow' : 'red'}">${healthPct}% здоровых</span>
            </div>
            <canvas class="mini-heatmap" data-pid="${p.id}" style="width:100%; height:80px; display:block;"></canvas>
            <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; font-size:11px;">
              <span style="color:var(--st-healthy);">🟢 ${counts.healthy + counts.normal}</span>
              <span style="color:var(--st-attention);">🟠 ${counts.attention + counts.sick}</span>
              ${counts.dead ? `<span style="color:var(--st-dead);">⚫ ${counts.dead}</span>` : ''}
              ${counts.empty ? `<span style="color:var(--text-muted);">⚪ ${counts.empty}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  // Отрисуем мини-хитмапы
  setTimeout(() => {
    document.querySelectorAll('.mini-heatmap').forEach(canvas => {
      drawMiniHeatmap(canvas);
    });
  }, 50);
}

function drawMiniHeatmap(canvas) {
  const plotId = canvas.dataset.pid;
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const rows = plot.rows || [];
  if (!rows.length) return;
  const maxPos = Math.max(...rows.map(r => r.positions_count), 1);
  const cellW = w / maxPos;
  const cellH = h / rows.length;
  const seedlings = getPlotSeedlings(plotId);
  const map = new Map();
  seedlings.forEach(s => map.set(`${s.row}_${s.position}`, s));

  rows.forEach((row, ri) => {
    for (let pos = 1; pos <= row.positions_count; pos++) {
      const s = map.get(`${row.number}_${pos}`);
      if (!s) continue;
      const color = (VINE_STATUS[s.status] || VINE_STATUS.normal).color;
      ctx.fillStyle = color;
      ctx.fillRect(pos * cellW - cellW, ri * cellH, Math.max(1, cellW), Math.max(1, cellH));
    }
  });
}


// ===========================================================================
