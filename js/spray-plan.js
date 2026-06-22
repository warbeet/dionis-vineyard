// ============================================================================
// SPRAY-PLAN module — План опрыскивания с баковыми смесями
// ============================================================================

// =========== СПРАВОЧНИКИ ===========

const PRODUCT_CATEGORIES = [
  { id: 'fungicide', name: '🍄 Фунгицид', color: '#6B8E5A' },
  { id: 'insecticide', name: '🐛 Инсектицид', color: '#D4936B' },
  { id: 'acaricide', name: '🕷 Акарицид', color: '#8E5A6B' },
  { id: 'herbicide', name: '🌾 Гербицид', color: '#A36B5A' },
  { id: 'fertilizer', name: '🌱 Удобрение (некорневое)', color: '#5A8E6B' },
  { id: 'stimulator', name: '⚡ Стимулятор роста', color: '#5A8E8E' },
  { id: 'adjuvant', name: '💧 Прилипатель/ПАВ', color: '#8A9180' }
];

// Порядок добавления в бак (стандарт для виноделия):
const TANK_ORDER = [
  { order: 1, type: 'WP', name: 'СП (смачивающиеся порошки)', desc: 'Полностью растворить' },
  { order: 2, type: 'WG/WDG', name: 'ВДГ (водно-диспергируемые гранулы)' },
  { order: 3, type: 'SC', name: 'КС (концентраты суспензий)' },
  { order: 4, type: 'OD', name: 'МД (масляные дисперсии)' },
  { order: 5, type: 'EC/EW', name: 'КЭ/ВЭ (концентраты эмульсий)' },
  { order: 6, type: 'SL', name: 'ВРК (водорастворимые концентраты)' },
  { order: 7, type: 'FERTILIZER', name: 'Удобрения и микроэлементы' },
  { order: 8, type: 'ADJUVANT', name: 'Прилипатели и ПАВ (последними)' }
];

// База популярных препаратов для виноделия в РФ
const PRODUCT_CATALOG = [
  // Фунгициды
  { name: 'Ридомил Голд МЦ', category: 'fungicide', form: 'WG/WDG', dose_min: 25, dose_max: 30, dose_unit: 'г/10л', waiting_days: 30, target: 'милдью' },
  { name: 'Топаз', category: 'fungicide', form: 'EC/EW', dose_min: 2, dose_max: 3, dose_unit: 'мл/10л', waiting_days: 20, target: 'оидиум' },
  { name: 'Хорус', category: 'fungicide', form: 'WG/WDG', dose_min: 6, dose_max: 7, dose_unit: 'г/10л', waiting_days: 30, target: 'серая гниль' },
  { name: 'Свитч', category: 'fungicide', form: 'WG/WDG', dose_min: 8, dose_max: 10, dose_unit: 'г/10л', waiting_days: 21, target: 'серая гниль' },
  { name: 'Скор', category: 'fungicide', form: 'EC/EW', dose_min: 2, dose_max: 3, dose_unit: 'мл/10л', waiting_days: 21, target: 'оидиум' },
  { name: 'Бордоская смесь 1%', category: 'fungicide', form: 'SC', dose_min: 100, dose_max: 100, dose_unit: 'г/10л', waiting_days: 14, target: 'милдью' },
  { name: 'Тиовит Джет', category: 'fungicide', form: 'WG/WDG', dose_min: 30, dose_max: 80, dose_unit: 'г/10л', waiting_days: 1, target: 'оидиум' },
  // Инсектициды
  { name: 'Актеллик', category: 'insecticide', form: 'EC/EW', dose_min: 8, dose_max: 12, dose_unit: 'мл/10л', waiting_days: 20, target: 'клещ, тля' },
  { name: 'Конфидор Экстра', category: 'insecticide', form: 'WG/WDG', dose_min: 1, dose_max: 2, dose_unit: 'г/10л', waiting_days: 30, target: 'листовёртка' },
  { name: 'Вертимек', category: 'acaricide', form: 'EC/EW', dose_min: 8, dose_max: 10, dose_unit: 'мл/10л', waiting_days: 28, target: 'клещ' },
  // Удобрения
  { name: 'Кристалон жёлтый', category: 'fertilizer', form: 'FERTILIZER', dose_min: 20, dose_max: 30, dose_unit: 'г/10л', waiting_days: 0, target: 'NPK 13-40-13' },
  { name: 'Мегафол', category: 'stimulator', form: 'SL', dose_min: 20, dose_max: 30, dose_unit: 'мл/10л', waiting_days: 0, target: 'аминокислоты' },
  // ПАВ
  { name: 'Сильвет Голд', category: 'adjuvant', form: 'ADJUVANT', dose_min: 4, dose_max: 8, dose_unit: 'мл/10л', waiting_days: 0, target: 'прилипатель' }
];

// Несовместимые комбинации (упрощённо)
const INCOMPATIBLE_PAIRS = [
  { a: 'медь', b: 'сера', reason: '⚠️ Медь + сера = ожоги листьев' },
  { a: 'медь', b: 'масло', reason: '⚠️ Медь + масляные препараты — фитотоксичность' },
  { a: 'Бордоская', b: 'Топаз', reason: '⚠️ Щелочная среда снижает эффективность Топаза' }
];

// =========== ОТКРЫТИЕ ПЛАНОВ ===========

let currentSprayPlan = null;       // редактируемый план
let currentSprayView = 'table';    // 'table' | 'kanban' | 'calendar'

function normalizeProduct(p) {
  if (!p) return null;
  return {
    name: p.name || '',
    category: p.category || 'fungicide',
    form: p.form || 'EC/EW',
    dose_min: p.dose_min || 0,
    dose_max: p.dose_max || 0,
    dose_unit: p.dose_unit || 'мл/10л',
    waiting_days: p.waiting_days || 0,
    target: p.target || '',
    active_ingredient: p.active_ingredient || '',
    concentration: p.concentration || '',
    manufacturer: p.manufacturer || '',
    mechanism: p.mechanism || '',
    hazard_class: p.hazard_class || '',
    reg_number: p.reg_number || '',
    registration_until: p.registration_until || '',
    storage_life: p.storage_life || '',
    rainfastness: p.rainfastness || '',
    phytotoxicity: p.phytotoxicity || '',
    resistance_notes: p.resistance_notes || '',
    precautions: p.precautions || '',
    crops_regulations: p.crops_regulations || '',
    source_urls: p.source_urls || '',
    instruction_url: p.instruction_url || '',
    notes: p.notes || '',
    tank_mix_notes: p.tank_mix_notes || '',
    usage_recommendations: Array.isArray(p.usage_recommendations) ? p.usage_recommendations : [],
    risks: Array.isArray(p.risks) ? p.risks : [],
    search_links: Array.isArray(p.search_links) ? p.search_links : [],
    verify_required: p.verify_required !== false,
    confidence: p.confidence || '',
    ai_model: p.ai_model || '',
    ai_updated_at: p.ai_updated_at || '',
    ...p
  };
}

function ensureSprayData() {
  if (!data.spray_plans) data.spray_plans = [];
  if (!data.products_catalog) {
    // Копируем дефолтный каталог и нормализуем
    data.products_catalog = JSON.parse(JSON.stringify(PRODUCT_CATALOG)).map(normalizeProduct);
  } else {
    // При открытии старых данных дополняем новые поля
    data.products_catalog = data.products_catalog.map(normalizeProduct);
  }
}

function renderSprayPlans() {
  ensureSprayData();
  const cont = document.getElementById('spray-plans-content');
  if (!cont) return;

  if (currentSprayView === 'table') renderSprayTable(cont);
  else if (currentSprayView === 'kanban') renderSprayKanban(cont);
  else if (currentSprayView === 'calendar') renderSprayCalendar(cont);
}

function switchSprayView(view) {
  currentSprayView = view;
  document.querySelectorAll('.spray-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  renderSprayPlans();
}

// =========== ТАБЛИЧНЫЙ ВИД ===========

function renderSprayTable(cont) {
  const plans = (data.spray_plans || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!plans.length) {
    cont.innerHTML = '<div class="empty">Планов опрыскивания нет. Создайте первый ↑</div>';
    return;
  }
  const statusBadge = { planned: 'blue', today: 'yellow', done: 'green', cancelled: 'gray' };
  const statusLabel = { planned: '📅 Запланировано', today: '🔔 Сегодня', done: '✅ Выполнено', cancelled: '🚫 Отменено' };

  cont.innerHTML = `
    <div class="table-wrap">
      <table class="spray-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Зоны</th>
            <th>Препараты</th>
            <th>Бак</th>
            <th>Срок жизни</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${plans.map(p => `
            <tr onclick="openSprayPlanModal('${p.id}')" style="cursor:pointer;">
              <td><b>${escapeHtml(p.date || '—')}</b></td>
              <td>${escapeHtml(formatZones(p.zones))}</td>
              <td>${(p.products || []).map(pr => '<span class="badge purple">' + escapeHtml(pr.name) + '</span>').join(' ') || '—'}</td>
              <td>${p.tank_volume_l || '—'} л</td>
              <td>${calcMixLifetime(p)} ч</td>
              <td><span class="badge ${statusBadge[p.status] || 'gray'}">${statusLabel[p.status] || p.status}</span></td>
              <td><button class="btn small danger" onclick="event.stopPropagation(); deleteSprayPlan('${p.id}')">🗑</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function formatZones(zones) {
  if (!zones || !zones.plot_ids?.length) return 'Все участки';
  const parts = [];
  zones.plot_ids.forEach(pid => {
    const plot = data.plots?.find(p => p.id === pid);
    if (plot) parts.push(plot.name);
  });
  if (zones.scions?.length) parts.push('Сорта: ' + zones.scions.join(', '));
  return parts.join(' · ') || '—';
}

function calcMixLifetime(plan) {
  // Срок жизни смеси: зависит от состава
  // Эмульсии 2-4 ч, СП до 8 ч, удобрения 24+
  const hasEC = (plan.products || []).some(p => {
    const cat = data.products_catalog?.find(c => c.name === p.name);
    return cat?.form === 'EC/EW';
  });
  if (hasEC) return 2;
  return plan.mix_lifetime_hours || 4;
}

// =========== КАНБАН ===========

function renderSprayKanban(cont) {
  const plans = data.spray_plans || [];
  const columns = [
    { id: 'planned', name: '📅 Запланировано', color: 'blue' },
    { id: 'today', name: '🔔 Сегодня', color: 'yellow' },
    { id: 'done', name: '✅ Выполнено', color: 'green' },
    { id: 'cancelled', name: '🚫 Отменено', color: 'gray' }
  ];

  cont.innerHTML = `
    <div class="kanban-board">
      ${columns.map(col => {
        const colPlans = plans.filter(p => (p.status || 'planned') === col.id);
        return `
          <div class="kanban-column">
            <div class="kanban-header">
              <span class="badge ${col.color}">${col.name}</span>
              <span class="kanban-count">${colPlans.length}</span>
            </div>
            <div class="kanban-cards">
              ${colPlans.map(p => `
                <div class="kanban-card" onclick="openSprayPlanModal('${p.id}')">
                  <div class="kanban-card-date">${escapeHtml(p.date || '—')}</div>
                  <div class="kanban-card-zones">${escapeHtml(formatZones(p.zones))}</div>
                  <div class="kanban-card-products">${(p.products || []).slice(0, 3).map(pr => '🧪 ' + escapeHtml(pr.name)).join(', ')}${(p.products || []).length > 3 ? '...' : ''}</div>
                </div>
              `).join('') || '<div class="kanban-empty">—</div>'}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// =========== КАЛЕНДАРЬ ===========

function renderSprayCalendar(cont) {
  const plans = data.spray_plans || [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // понедельник = 0

  const monthName = today.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  const plansByDate = {};
  plans.forEach(p => {
    if (!p.date) return;
    if (!plansByDate[p.date]) plansByDate[p.date] = [];
    plansByDate[p.date].push(p);
  });

  let html = `
    <div class="spray-calendar">
      <h4 style="text-transform:capitalize; margin-bottom:12px;">${monthName}</h4>
      <div class="cal-grid">
        <div class="cal-day-name">Пн</div>
        <div class="cal-day-name">Вт</div>
        <div class="cal-day-name">Ср</div>
        <div class="cal-day-name">Чт</div>
        <div class="cal-day-name">Пт</div>
        <div class="cal-day-name">Сб</div>
        <div class="cal-day-name">Вс</div>
  `;

  for (let i = 0; i < startWeekday; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayPlans = plansByDate[dateStr] || [];
    const isToday = day === today.getDate();
    html += `
      <div class="cal-day ${isToday ? 'today' : ''} ${dayPlans.length ? 'has-plans' : ''}">
        <div class="cal-day-num">${day}</div>
        ${dayPlans.slice(0, 2).map(p => `
          <div class="cal-plan" onclick="openSprayPlanModal('${p.id}')" title="${escapeHtml((p.products || []).map(x => x.name).join(', '))}">
            🧪 ${(p.products || []).length} преп.
          </div>
        `).join('')}
        ${dayPlans.length > 2 ? `<div class="cal-more">+${dayPlans.length - 2}</div>` : ''}
      </div>
    `;
  }

  html += '</div></div>';
  cont.innerHTML = html;
}

// =========== СОЗДАНИЕ / РЕДАКТИРОВАНИЕ ПЛАНА ===========

function openSprayPlanModal(planId) {
  ensureSprayData();
  let plan;
  if (planId) {
    plan = data.spray_plans.find(p => p.id === planId);
    if (!plan) return;
  } else {
    plan = {
      id: 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: todayStr(),
      status: 'planned',
      zones: { plot_ids: [], scions: [], age_min: null, age_max: null, statuses: [] },
      products: [],
      tank_volume_l: 1000,
      mix_lifetime_hours: 4,
      notes: '',
      created_at: new Date().toISOString()
    };
  }
  currentSprayPlan = plan;
  renderSprayPlanForm();
  openModal('spray-plan-modal');
}

function renderSprayPlanForm() {
  const plan = currentSprayPlan;
  if (!plan) return;
  const cont = document.getElementById('spray-plan-form');
  if (!cont) return;

  // Зоны: дерево чекбоксов по участкам + сортам
  const plotsTree = (data.plots || []).map(p => {
    const checked = plan.zones.plot_ids?.includes(p.id);
    const blocks = p.blocks || [];
    return `
      <div class="zone-tree-plot">
        <label class="zone-tree-label">
          <input type="checkbox" data-zone-plot="${p.id}" ${checked ? 'checked' : ''}>
          <b>📍 ${escapeHtml(p.name)}</b> <span style="color:var(--text-muted); font-size:12px;">(${p.area_ha || 0} га)</span>
        </label>
        ${blocks.length ? `
          <div class="zone-tree-blocks">
            ${blocks.map(b => `
              <label class="zone-tree-label">
                <input type="checkbox" data-zone-block="${b.id}" ${plan.zones.block_ids?.includes(b.id) ? 'checked' : ''}>
                <span style="display:inline-block;width:10px;height:10px;background:${b.color};border-radius:50%;"></span>
                🍇 ${escapeHtml(b.scion || b.name)}
              </label>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('') || '<p style="color:var(--text-muted); font-size:13px;">Сначала создайте участки</p>';

  cont.innerHTML = `
    <div class="modal-tabs">
      <button class="modal-tab spray-tab active" data-stab="basic" onclick="switchSprayTab('basic')">📅 Основное</button>
      <button class="modal-tab spray-tab" data-stab="zones" onclick="switchSprayTab('zones')">🗺 Зоны</button>
      <button class="modal-tab spray-tab" data-stab="products" onclick="switchSprayTab('products')">🧪 Препараты</button>
      <button class="modal-tab spray-tab" data-stab="tank" onclick="switchSprayTab('tank')">🪣 Бак</button>
    </div>

    <!-- ОСНОВНОЕ -->
    <div class="spray-tab-content" id="stab-basic">
      <div class="form-grid">
        <div class="form-row">
          <label>📅 Дата опрыскивания</label>
          <input type="date" id="sp-date" value="${plan.date || ''}">
        </div>
        <div class="form-row">
          <label>Статус</label>
          <select id="sp-status">
            <option value="planned" ${plan.status === 'planned' ? 'selected' : ''}>📅 Запланировано</option>
            <option value="today" ${plan.status === 'today' ? 'selected' : ''}>🔔 Сегодня</option>
            <option value="done" ${plan.status === 'done' ? 'selected' : ''}>✅ Выполнено</option>
            <option value="cancelled" ${plan.status === 'cancelled' ? 'selected' : ''}>🚫 Отменено</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <label>📝 Описание состояния кустов / цель опрыскивания</label>
        <textarea id="sp-notes" rows="3" placeholder="Например: профилактика милдью после дождей, нижние листья с пятнами">${escapeHtml(plan.notes || '')}</textarea>
      </div>

      <div id="weather-check-result"></div>
      <button class="btn small secondary" onclick="checkSprayWeather()">🌦 Проверить погоду на эту дату</button>

      <div id="pheno-check-result" style="margin-top:10px;"></div>
    </div>

    <!-- ЗОНЫ -->
    <div class="spray-tab-content" id="stab-zones" style="display:none;">
      <p style="font-size:12px; color:var(--text-soft); margin-bottom:10px;">
        Отметьте участки и/или сорта для опрыскивания. Можно добавить фильтры ниже.
      </p>
      <div class="zone-tree">${plotsTree}</div>

      <h4 style="margin-top:14px; font-size:12px; color:var(--text-soft); text-transform:uppercase;">Дополнительные фильтры</h4>
      <div class="form-grid">
        <div class="form-row">
          <label>Возраст кустов от</label>
          <input type="number" id="sp-age-min" min="0" value="${plan.zones.age_min || ''}" placeholder="0">
        </div>
        <div class="form-row">
          <label>Возраст кустов до</label>
          <input type="number" id="sp-age-max" min="0" value="${plan.zones.age_max || ''}" placeholder="50">
        </div>
      </div>
      <div class="form-row">
        <label>Статусы кустов</label>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${['healthy', 'normal', 'attention', 'sick'].map(s => `
            <label style="display:flex; align-items:center; gap:4px; font-size:13px; cursor:pointer;">
              <input type="checkbox" data-sp-status="${s}" ${(plan.zones.statuses || []).includes(s) ? 'checked' : ''} style="width:auto;">
              ${VINE_STATUS?.[s]?.label || s}
            </label>
          `).join('')}
        </div>
      </div>

      <div id="zone-affected-count" style="margin-top:14px; padding:10px; background:var(--bg-elevated); border-radius:10px; font-size:13px;">
        <button class="btn small secondary" onclick="recalcAffectedSeedlings()">🔄 Рассчитать кол-во кустов</button>
      </div>
    </div>

    <!-- ПРЕПАРАТЫ -->
    <div class="spray-tab-content" id="stab-products" style="display:none;">
      <div id="sp-products-list"></div>
      <button class="btn primary" onclick="openProductPicker()">+ Добавить препарат</button>

      <div id="sp-compatibility-warnings" style="margin-top:10px;"></div>
    </div>

    <!-- БАК -->
    <div class="spray-tab-content" id="stab-tank" style="display:none;">
      <div class="form-grid">
        <div class="form-row">
          <label>🪣 Объём бочки/бака, л</label>
          <input type="number" id="sp-tank-volume" min="10" value="${plan.tank_volume_l || 1000}">
        </div>
        <div class="form-row">
          <label>⏱ Срок жизни смеси, часов</label>
          <input type="number" id="sp-mix-lifetime" min="1" max="48" value="${plan.mix_lifetime_hours || 4}">
        </div>
      </div>

      <h4 style="margin-top:14px;">📋 Последовательность смешивания</h4>
      <div class="toolbar" style="margin-bottom:10px;">
        <button class="btn small accent" id="tank-ai-btn" onclick="analyzeTankMixWithAI()">🤖 Проверить смесь AI</button>
      </div>
      <div id="sp-tank-order"></div>

      <div class="alert info" style="font-size:12px; margin-top:14px;">
        💡 <b>Правило бака:</b> сначала наполняем половину водой, потом добавляем по очереди: СП → ВДГ → КС → МД → КЭ → ВРК → удобрения → ПАВ. Между добавлениями — перемешиваем.
      </div>
    </div>
  `;

  // Перерисуем зависимые блоки
  renderSprayProductsList();
  renderTankOrder();
  recalcAffectedSeedlings();
}

function switchSprayTab(tab) {
  document.querySelectorAll('.spray-tab').forEach(b => b.classList.toggle('active', b.dataset.stab === tab));
  document.querySelectorAll('.spray-tab-content').forEach(c => c.style.display = 'none');
  const el = document.getElementById('stab-' + tab);
  if (el) el.style.display = 'block';
}

// =========== ПРЕПАРАТЫ ===========

function renderSprayProductsList() {
  const cont = document.getElementById('sp-products-list');
  if (!cont) return;
  const plan = currentSprayPlan;
  if (!plan.products?.length) {
    cont.innerHTML = '<p style="color:var(--text-muted); font-size:13px; padding:10px;">Препаратов нет</p>';
    return;
  }
  cont.innerHTML = plan.products.map((p, idx) => {
    const cat = data.products_catalog?.find(c => c.name === p.name);
    const totalDose = ((p.dose || 0) * (plan.tank_volume_l || 1000) / 10).toFixed(1);
    const instructionLink = cat?.instruction_url
      ? `<a href="${escapeHtml(cat.instruction_url)}" target="_blank" rel="noopener" class="btn small secondary" style="margin-left:4px;">📄 Инструкция</a>`
      : '';
    return `
      <div class="spray-product-card">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span style="font-weight:600;">${idx + 1}.</span>
          <span style="flex:1; min-width:120px;"><b>${escapeHtml(p.name)}</b></span>
          ${cat ? '<span class="badge purple">' + escapeHtml(cat.form) + '</span>' : ''}
          ${cat ? '<span class="badge gray">' + (cat.waiting_days || 0) + ' дн.</span>' : ''}
          ${instructionLink}
          <button class="btn small" onclick="openProductEditModal('${escapeHtml(p.name).replace(/'/g, '&apos;')}')">✏️</button>
          <button class="btn small danger" onclick="removeSprayProduct(${idx})">🗑</button>
        </div>
        <div style="font-size:12px; color:var(--text-soft); margin-top:4px;">
          ${cat?.active_ingredient ? '🧪 ДВ: ' + escapeHtml(cat.active_ingredient) + ' · ' : ''}
          ${cat?.concentration ? escapeHtml(cat.concentration) + ' · ' : ''}
          ${cat?.reg_number ? 'Рег.№ ' + escapeHtml(cat.reg_number) : ''}
        </div>
        <div class="form-grid" style="margin-top:8px;">
          <div class="form-row" style="margin-bottom:0;">
            <label>Доза, ${cat?.dose_unit || 'мл/10л'}</label>
            <input type="number" step="0.1" value="${p.dose || ''}" onchange="updateSprayProduct(${idx}, 'dose', parseFloat(this.value))">
          </div>
          <div class="form-row" style="margin-bottom:0;">
            <label>Всего на бак</label>
            <input type="text" value="${totalDose}" readonly style="background:var(--bg-elevated);">
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Проверка совместимости
  checkCompatibility();
}

function openProductPicker() {
  const cont = document.getElementById('product-picker-content');
  if (!cont) return;
  cont.innerHTML = `
    <input type="text" id="product-search" placeholder="Поиск препарата..." oninput="filterProducts(this.value)" style="margin-bottom:12px;">
    <div id="product-picker-list" style="max-height:50vh; overflow-y:auto;">
      ${renderProductPickerList('')}
    </div>
    <button class="btn small secondary" onclick="openProductEditModal()" style="margin-top:10px;">+ Новый препарат</button>
  `;
  // true = не закрываем план опрыскивания, picker открывается поверх
  openModal('product-picker-modal', true);
}

function filterProducts(query) {
  const list = document.getElementById('product-picker-list');
  if (list) list.innerHTML = renderProductPickerList(query.toLowerCase());
}

function renderProductPickerList(query) {
  ensureSprayData();
  const catalog = data.products_catalog || PRODUCT_CATALOG;
  const q = query.toLowerCase();
  const filtered = catalog.filter(p =>
    !q ||
    (p.name || '').toLowerCase().includes(q) ||
    (p.target || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q) ||
    (p.active_ingredient || '').toLowerCase().includes(q)
  );
  if (!filtered.length) return '<p style="color:var(--text-muted); font-size:13px; padding:10px;">Ничего не найдено</p>';
  return filtered.map(p => {
    const cat = PRODUCT_CATEGORIES.find(c => c.id === p.category);
    const instructionLink = p.instruction_url
      ? `<a href="${escapeHtml(p.instruction_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="btn small secondary" style="margin-left:6px;">📄 Инструкция</a>`
      : '';
    return `
      <div class="product-picker-item" onclick="selectProduct('${escapeHtml(p.name).replace(/'/g, '&apos;')}')">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <b>${escapeHtml(p.name)}</b>
          <span class="badge purple">${escapeHtml(cat?.name || '')}</span>
          <span class="badge gray">${escapeHtml(p.form)}</span>
          <button class="btn small" onclick="event.stopPropagation(); openProductEditModal('${escapeHtml(p.name).replace(/'/g, '&apos;')}')" style="margin-left:auto;">✏️</button>
          ${instructionLink}
        </div>
        <div style="font-size:12px; color:var(--text-soft); margin-top:4px;">
          🎯 ${escapeHtml(p.target || '—')} · 💧 ${p.dose_min || 0}-${p.dose_max || 0} ${p.dose_unit || 'мл/10л'} · ⏳ ${p.waiting_days || 0} дн.
          ${p.active_ingredient ? '<br><b>ДВ:</b> ' + escapeHtml(p.active_ingredient) : ''}
          ${p.reg_number ? ' · <b>Рег.№:</b> ' + escapeHtml(p.reg_number) : ''}
        </div>
      </div>
    `;
  }).join('');
}

function selectProduct(name) {
  const cat = (data.products_catalog || PRODUCT_CATALOG).find(c => c.name === name);
  if (!cat) return;
  if (!currentSprayPlan.products) currentSprayPlan.products = [];
  currentSprayPlan.products.push({
    name: cat.name,
    dose: cat.dose_min,
    order: currentSprayPlan.products.length + 1
  });
  closeModal('product-picker-modal');
  renderSprayProductsList();
  renderTankOrder();
}

function removeSprayProduct(idx) {
  currentSprayPlan.products.splice(idx, 1);
  renderSprayProductsList();
  renderTankOrder();
}

function updateSprayProduct(idx, field, value) {
  if (!currentSprayPlan.products[idx]) return;
  currentSprayPlan.products[idx][field] = value;
  renderSprayProductsList();
}

function addCustomProduct() {
  // Устаревший prompt-вариант заменён на полноценную карточку
  openProductEditModal();
}

// =========== КАРТОЧКА ПРЕПАРАТА ===========

let currentProductEdit = null; // объект препарата, который редактируем

function openProductEditModal(productName) {
  ensureSprayData();
  const catalog = data.products_catalog || [];
  let p = null;
  if (productName) {
    p = catalog.find(item => item.name === productName) || null;
  }
  if (!p) {
    // Создаём новый пустой шаблон
    p = {
      name: '',
      category: 'fungicide',
      form: 'EC/EW',
      dose_min: '',
      dose_max: '',
      dose_unit: 'мл/10л',
      waiting_days: '',
      target: '',
      active_ingredient: '',
      concentration: '',
      hazard_class: '',
      reg_number: '',
      instruction_url: '',
      notes: ''
    };
  }
  currentProductEdit = normalizeProduct(p);
  renderProductEditForm();
  openModal('product-edit-modal', true); // поверх picker или плана
}

function renderProductEditForm() {
  const cont = document.getElementById('product-edit-form');
  if (!cont || !currentProductEdit) return;
  const p = currentProductEdit;
  const filled = new Set(p.ai_filled_fields || []);
  const mark = key => filled.has(key) ? '<span class="ai-field-check" title="Заполнено AI">✓ AI</span>' : '';
  const rowCls = key => filled.has(key) ? 'form-row ai-filled-field' : 'form-row';

  const catOptions = PRODUCT_CATEGORIES.map(c =>
    `<option value="${c.id}" ${p.category === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');
  const formOptions = TANK_ORDER.map(o =>
    `<option value="${o.type}" ${p.form === o.type ? 'selected' : ''}>${o.order}. ${o.name}</option>`
  ).join('');

  cont.innerHTML = `
    <div class="ai-product-flow">
      <div class="toolbar" style="margin-bottom:10px;">
        <button type="button" class="btn small accent" id="pe-ai-find-btn" onclick="findProductWithAI()">🤖 1. Найти препарат</button>
        <button type="button" class="btn small secondary" onclick="searchProductInstruction()">🔎 2. Найти инструкцию</button>
        <button type="button" class="btn small primary" id="pe-ai-from-instruction-btn" onclick="fillProductFromInstructionAI()">📄 3. Заполнить из инструкции</button>
      </div>
      <div class="alert info" style="font-size:12px; margin-bottom:12px;">
        Правильный порядок: введите название → AI найдёт возможные препараты → подтвердите «Это он» → вставьте ссылку/текст инструкции → AI заполнит поля. Поля, заполненные AI, подсвечиваются и получают ✓ AI.
      </div>
      <div id="pe-candidates"></div>
    </div>

    <div class="${rowCls('name')}">
      <label>Название препарата ${mark('name')}</label>
      <input type="text" id="pe-name" value="${escapeHtml(p.name || '')}" placeholder="Например: Ридомил Голд МЦ">
    </div>
    <div class="form-grid">
      <div class="${rowCls('category')}">
        <label>Категория ${mark('category')}</label>
        <select id="pe-category">${catOptions}</select>
      </div>
      <div class="${rowCls('form')}">
        <label>Форма препарата (порядок в баке) ${mark('form')}</label>
        <select id="pe-form">${formOptions}</select>
      </div>
    </div>
    <div class="form-grid">
      <div class="${rowCls('active_ingredient')}">
        <label>Действующее вещество ${mark('active_ingredient')}</label>
        <input type="text" id="pe-active" value="${escapeHtml(p.active_ingredient || '')}" placeholder="Металаксил + манкоцеб">
      </div>
      <div class="${rowCls('concentration')}">
        <label>Концентрация ДВ ${mark('concentration')}</label>
        <input type="text" id="pe-concentration" value="${escapeHtml(p.concentration || '')}" placeholder="5% + 64%">
      </div>
    </div>
    <div class="form-grid">
      <div class="${rowCls('manufacturer')}">
        <label>Производитель ${mark('manufacturer')}</label>
        <input type="text" id="pe-manufacturer" value="${escapeHtml(p.manufacturer || '')}" placeholder="BASF, Syngenta, Avgust...">
      </div>
      <div class="${rowCls('mechanism')}">
        <label>Механизм действия ${mark('mechanism')}</label>
        <input type="text" id="pe-mechanism" value="${escapeHtml(p.mechanism || '')}" placeholder="системный, трансламинарный, контактный...">
      </div>
    </div>
    <div class="form-grid">
      <div class="${rowCls('hazard_class')}">
        <label>Класс опасности ${mark('hazard_class')}</label>
        <input type="text" id="pe-hazard" value="${escapeHtml(p.hazard_class || '')}" placeholder="3 (умеренно опасное)">
      </div>
      <div class="${rowCls('reg_number')}">
        <label>№ регистрации ${mark('reg_number')}</label>
        <input type="text" id="pe-reg" value="${escapeHtml(p.reg_number || '')}" placeholder="АС-1234567-8-9">
      </div>
    </div>
    <div class="form-grid">
      <div class="${rowCls('registration_until')}">
        <label>Регистрация действует до ${mark('registration_until')}</label>
        <input type="text" id="pe-registration-until" value="${escapeHtml(p.registration_until || '')}" placeholder="23.05.2027">
      </div>
      <div class="${rowCls('storage_life')}">
        <label>Срок хранения ${mark('storage_life')}</label>
        <input type="text" id="pe-storage-life" value="${escapeHtml(p.storage_life || '')}" placeholder="3 года">
      </div>
    </div>
    <div class="form-grid">
      <div class="${rowCls('dose_min')}">
        <label>Доза от ${mark('dose_min')}</label>
        <input type="number" step="0.1" id="pe-dose-min" value="${p.dose_min || ''}" placeholder="0">
      </div>
      <div class="${rowCls('dose_max')}">
        <label>Доза до ${mark('dose_max')}</label>
        <input type="number" step="0.1" id="pe-dose-max" value="${p.dose_max || ''}" placeholder="0">
      </div>
      <div class="${rowCls('dose_unit')}">
        <label>Единица ${mark('dose_unit')}</label>
        <input type="text" id="pe-dose-unit" value="${escapeHtml(p.dose_unit || 'мл/10л')}">
      </div>
      <div class="${rowCls('waiting_days')}">
        <label>Срок ожидания, дней ${mark('waiting_days')}</label>
        <input type="number" id="pe-waiting" value="${p.waiting_days || ''}">
      </div>
    </div>
    <div class="${rowCls('target')}">
      <label>Цель / воздействие ${mark('target')}</label>
      <input type="text" id="pe-target" value="${escapeHtml(p.target || '')}" placeholder="Милдью, оидиум, клещ...">
    </div>
    <div class="${rowCls('crops_regulations')}">
      <label>Регламент по культурам ${mark('crops_regulations')}</label>
      <textarea id="pe-crops-regulations" rows="3" placeholder="Виноград — оидиум — 0,15–0,2 л/га — 60 дней; картофель — ...">${escapeHtml(p.crops_regulations || '')}</textarea>
    </div>
    <div class="${rowCls('instruction_url')}">
      <label>🔗 Основная ссылка на инструкцию ${mark('instruction_url')}</label>
      <input type="url" id="pe-instruction" value="${escapeHtml(p.instruction_url || '')}" placeholder="https://...">
    </div>
    <div class="${rowCls('source_urls')}">
      <label>🔗 Дополнительные источники ${mark('source_urls')}</label>
      <textarea id="pe-source-urls" rows="2" placeholder="Вставьте ссылки на источники — по одной в строке: BASF, Госреестр, AgroXXI...">${escapeHtml(p.source_urls || '')}</textarea>
    </div>
    <div class="form-row">
      <label>📄 Текст инструкции / этикетки / нескольких источников</label>
      <div class="toolbar" style="margin-bottom:8px;">
        <button type="button" class="btn small secondary" onclick="document.getElementById('pe-instruction-file').click()">📎 Загрузить PDF/TXT</button>
        <span id="pe-file-status" style="font-size:12px; color:var(--text-muted);">PDF.js извлечёт текст из инструкции; TXT/CSV читаются напрямую.</span>
      </div>
      <input type="file" id="pe-instruction-file" accept=".pdf,.txt,.csv,.md,text/plain,application/pdf" style="display:none" onchange="importProductInstructionFile(event)">
      <textarea id="pe-instruction-text" rows="4" placeholder="Вставьте сюда текст инструкции, регламент применения или фрагмент PDF/этикетки. Тогда AI заполнит карточку именно из инструкции.">${escapeHtml(p.instruction_text || '')}</textarea>
    </div>
    <div class="${rowCls('notes')}">
      <label>Краткое описание / заметки ${mark('notes')}</label>
      <textarea id="pe-notes" rows="2" placeholder="Краткое описание препарата, особенности применения, хранения, совместимости">${escapeHtml(p.notes || '')}</textarea>
    </div>
    <div class="${rowCls('tank_mix_notes')}">
      <label>🪣 Баковая смесь / совместимость ${mark('tank_mix_notes')}</label>
      <textarea id="pe-tank-notes" rows="2" placeholder="Порядок внесения, pH воды, ограничения совместимости">${escapeHtml(p.tank_mix_notes || '')}</textarea>
    </div>
    <div class="form-grid">
      <div class="${rowCls('rainfastness')}">
        <label>Дождестойкость ${mark('rainfastness')}</label>
        <input type="text" id="pe-rainfastness" value="${escapeHtml(p.rainfastness || '')}" placeholder="устойчив к осадкам / через X часов">
      </div>
      <div class="${rowCls('phytotoxicity')}">
        <label>Фитотоксичность ${mark('phytotoxicity')}</label>
        <input type="text" id="pe-phytotoxicity" value="${escapeHtml(p.phytotoxicity || '')}" placeholder="не фитотоксичен при соблюдении регламента">
      </div>
    </div>
    <div class="${rowCls('resistance_notes')}">
      <label>Резистентность ${mark('resistance_notes')}</label>
      <textarea id="pe-resistance" rows="2" placeholder="Не более 2 последовательных обработок одним классом ДВ...">${escapeHtml(p.resistance_notes || '')}</textarea>
    </div>
    <div class="${rowCls('precautions')}">
      <label>Меры предосторожности ${mark('precautions')}</label>
      <textarea id="pe-precautions" rows="2" placeholder="СИЗ, водоохранные зоны, токсичность, ограничения...">${escapeHtml(p.precautions || '')}</textarea>
    </div>
    <div id="pe-ai-info" style="font-size:12px; color:var(--text-muted);">
      ${p.ai_updated_at ? `🤖 AI: ${escapeHtml(p.ai_model || '')} · ${new Date(p.ai_updated_at).toLocaleString('ru-RU')} · уверенность: ${escapeHtml(p.confidence || '—')}` : ''}
      ${p.verify_required ? '<div class="alert warning" style="font-size:12px; margin-top:8px;">⚠️ Проверьте данные по официальной инструкции перед применением.</div>' : ''}
      ${p.search_links?.length ? `<div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">${p.search_links.map(l => `<a class="btn small secondary" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.title)}</a>`).join('')}</div>` : ''}
      ${p.usage_recommendations?.length ? `<div style="margin-top:8px;"><b>Рекомендации:</b><ul>${p.usage_recommendations.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : ''}
      ${p.risks?.length ? `<div style="margin-top:8px;"><b>Риски:</b><ul>${p.risks.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : ''}
    </div>
  `;
}

async function findProductWithAI() {
  if (!requirePermission('spray.edit', 'Нет прав на AI-поиск препарата')) return;
  const name = document.getElementById('pe-name')?.value?.trim() || currentProductEdit?.name || '';
  if (!name) { toast('Введите название или часть названия препарата', 'error'); return; }
  if (!settings.openrouterKey) { toast('Настройте OpenRouter API', 'error'); showTab('settings'); return; }
  const btn = document.getElementById('pe-ai-find-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> AI ищет...'; }
  const res = await findProductCandidatesAI(name);
  if (btn) { btn.disabled = false; btn.innerHTML = '🤖 1. Найти препарат'; }
  if (!res.success) { toast('AI-поиск не удался: ' + res.error, 'error'); return; }
  currentProductEdit.search_links = res.search_links || buildOfficialSearchLinks(name);
  currentProductEdit.ai_candidates = res.candidates || [];
  renderProductCandidates();
}

function renderProductCandidates() {
  const cont = document.getElementById('pe-candidates');
  if (!cont || !currentProductEdit) return;
  const candidates = currentProductEdit.ai_candidates || [];
  if (!candidates.length) {
    cont.innerHTML = '<div class="alert warning" style="font-size:12px;">AI не нашёл уверенных вариантов. Уточните название или используйте поиск инструкции.</div>';
    return;
  }
  cont.innerHTML = `
    <div class="product-candidates">
      <h4 style="margin:8px 0; font-size:13px;">Подтвердите препарат:</h4>
      ${candidates.map((c, idx) => `
        <div class="product-candidate-card">
          <div style="flex:1; min-width:180px;">
            <b>${escapeHtml(c.name || '')}</b>
            <div style="font-size:12px; color:var(--text-soft); margin-top:3px;">
              ${escapeHtml(c.short_description || '')}<br>
              ${c.active_ingredient ? 'ДВ: ' + escapeHtml(c.active_ingredient) + ' · ' : ''}${c.manufacturer ? 'Производитель: ' + escapeHtml(c.manufacturer) + ' · ' : ''}уверенность: ${escapeHtml(c.confidence || '—')}
            </div>
          </div>
          <button class="btn small primary" onclick="selectProductCandidate(${idx})">✅ Это он</button>
        </div>
      `).join('')}
    </div>
  `;
}

function selectProductCandidate(idx) {
  const c = currentProductEdit?.ai_candidates?.[idx];
  if (!c) return;
  const filled = new Set(currentProductEdit.ai_filled_fields || []);
  ['name','category','active_ingredient','notes'].forEach(k => filled.add(k));
  currentProductEdit = normalizeProduct({
    ...currentProductEdit,
    name: c.name || currentProductEdit.name,
    category: c.category || currentProductEdit.category,
    active_ingredient: c.active_ingredient || currentProductEdit.active_ingredient,
    notes: c.short_description || currentProductEdit.notes,
    search_links: currentProductEdit.search_links?.length ? currentProductEdit.search_links : buildOfficialSearchLinks(c.name || currentProductEdit.name),
    confidence: c.confidence || currentProductEdit.confidence || 'medium',
    ai_filled_fields: Array.from(filled),
    ai_updated_at: new Date().toISOString()
  });
  renderProductEditForm();
  toast('✅ Препарат подтверждён. Теперь найдите/вставьте инструкцию.', 'success');
}

function searchProductInstruction() {
  const name = document.getElementById('pe-name')?.value?.trim() || currentProductEdit?.name || '';
  if (!name) {
    toast('Сначала введите название препарата', 'warning');
    return;
  }
  const links = buildOfficialSearchLinks(name);
  currentProductEdit.search_links = links;
  const query = `инструкция препарат ${name}`;
  const url = `https://yandex.ru/search/?text=${encodeURIComponent(query)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  renderProductEditForm();
}

async function fillProductFromInstructionAI() {
  if (!requirePermission('spray.edit', 'Нет прав на AI-карточку препарата')) return;
  const name = document.getElementById('pe-name')?.value?.trim() || currentProductEdit?.name || '';
  const instructionUrl = document.getElementById('pe-instruction')?.value?.trim() || '';
  const sourceUrls = document.getElementById('pe-source-urls')?.value?.trim() || '';
  const instructionText = document.getElementById('pe-instruction-text')?.value?.trim() || '';
  if (!name) { toast('Сначала подтвердите или введите название препарата', 'error'); return; }
  if (!settings.openrouterKey) { toast('Настройте OpenRouter API', 'error'); showTab('settings'); return; }
  if (!instructionText && !instructionUrl) {
    toast('Вставьте ссылку на инструкцию или текст инструкции/этикетки', 'warning');
    return;
  }
  const btn = document.getElementById('pe-ai-from-instruction-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> AI читает...'; }

  let res;
  if (instructionText) {
    const system = `Ты агрономический парсер инструкции препарата. Заполняешь карточку строго по предоставленному тексту инструкции. Если данных нет — оставь пусто/0. Ответ строго JSON.`;
    const prompt = `Название препарата: ${name}
Основная ссылка на инструкцию: ${instructionUrl || 'не указана'}
Дополнительные источники:
${sourceUrls || 'не указаны'}

ТЕКСТ ИНСТРУКЦИИ/ЭТИКЕТКИ/НЕСКОЛЬКИХ ИСТОЧНИКОВ:
${instructionText.slice(0, 16000)}

Заполни JSON:
{
 "name":"", "category":"fungicide|insecticide|acaricide|herbicide|fertilizer|stimulator|adjuvant",
 "form":"WP|WG/WDG|SC|OD|EC/EW|SL|FERTILIZER|ADJUVANT",
 "active_ingredient":"", "concentration":"", "manufacturer":"", "mechanism":"", "target":"", "dose_min":0, "dose_max":0, "dose_unit":"",
 "waiting_days":0, "hazard_class":"", "reg_number":"", "registration_until":"", "storage_life":"",
 "crops_regulations":"регламент по культурам, нормам, срокам ожидания", "notes":"краткое описание препарата", "tank_mix_notes":"",
 "rainfastness":"", "phytotoxicity":"", "resistance_notes":"", "precautions":"",
 "usage_recommendations":["..."], "risks":["..."], "confidence":"high|medium|low"
}`;
    res = await openRouterJSONTask({ system, prompt, max_tokens: 2000, temperature: 0.1 });
    if (res.success) res.product = res.json;
  } else {
    // fallback: без текста инструкции AI создаёт только черновик по названию + ссылке
    res = await enrichProductWithAI(name, { instructionUrl });
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '📄 3. Заполнить из инструкции'; }
  if (!res.success || !res.product) { toast('AI не смог заполнить из инструкции: ' + (res.error || 'нет JSON'), 'error'); return; }

  const product = res.product;
  const fields = ['name','category','form','active_ingredient','concentration','manufacturer','mechanism','target','dose_min','dose_max','dose_unit','waiting_days','hazard_class','reg_number','registration_until','storage_life','crops_regulations','notes','tank_mix_notes','rainfastness','phytotoxicity','resistance_notes','precautions'];
  const filled = new Set(currentProductEdit.ai_filled_fields || []);
  fields.forEach(k => {
    const v = product[k];
    if (v !== undefined && v !== null && String(v) !== '' && String(v) !== '0') filled.add(k);
  });
  currentProductEdit = normalizeProduct({
    ...currentProductEdit,
    ...product,
    name: product.name || name,
    instruction_url: instructionUrl || product.instruction_url || currentProductEdit.instruction_url,
    source_urls: sourceUrls || currentProductEdit.source_urls || '',
    instruction_text: instructionText,
    search_links: currentProductEdit.search_links?.length ? currentProductEdit.search_links : buildOfficialSearchLinks(name),
    verify_required: true,
    ai_filled_fields: Array.from(filled),
    ai_model: res.model || product.ai_model || getOpenRouterTextModel(),
    ai_updated_at: new Date().toISOString()
  });
  renderProductEditForm();
  toast('✅ Карточка заполнена из инструкции. Поля AI подсвечены.', 'success');
}

// Backward compatibility: старая кнопка теперь запускает правильный этап 3
async function fillProductWithAI() {
  return fillProductFromInstructionAI();
}

function saveProductCatalog() {
  if (!requirePermission('spray.edit', 'Нет прав на редактирование каталога препаратов')) return;
  if (!currentProductEdit) return;
  const name = document.getElementById('pe-name')?.value?.trim();
  if (!name) {
    toast('Укажите название препарата', 'error');
    return;
  }

  const updated = {
    name,
    category: document.getElementById('pe-category')?.value || 'fungicide',
    form: document.getElementById('pe-form')?.value || 'EC/EW',
    dose_min: parseFloat(document.getElementById('pe-dose-min')?.value) || 0,
    dose_max: parseFloat(document.getElementById('pe-dose-max')?.value) || 0,
    dose_unit: document.getElementById('pe-dose-unit')?.value?.trim() || 'мл/10л',
    waiting_days: parseInt(document.getElementById('pe-waiting')?.value) || 0,
    target: document.getElementById('pe-target')?.value?.trim() || '',
    active_ingredient: document.getElementById('pe-active')?.value?.trim() || '',
    concentration: document.getElementById('pe-concentration')?.value?.trim() || '',
    manufacturer: document.getElementById('pe-manufacturer')?.value?.trim() || '',
    mechanism: document.getElementById('pe-mechanism')?.value?.trim() || '',
    hazard_class: document.getElementById('pe-hazard')?.value?.trim() || '',
    reg_number: document.getElementById('pe-reg')?.value?.trim() || '',
    registration_until: document.getElementById('pe-registration-until')?.value?.trim() || '',
    storage_life: document.getElementById('pe-storage-life')?.value?.trim() || '',
    crops_regulations: document.getElementById('pe-crops-regulations')?.value?.trim() || '',
    source_urls: document.getElementById('pe-source-urls')?.value?.trim() || '',
    instruction_url: document.getElementById('pe-instruction')?.value?.trim() || '',
    instruction_text: document.getElementById('pe-instruction-text')?.value?.trim() || currentProductEdit.instruction_text || '',
    notes: document.getElementById('pe-notes')?.value?.trim() || '',
    tank_mix_notes: document.getElementById('pe-tank-notes')?.value?.trim() || currentProductEdit.tank_mix_notes || '',
    rainfastness: document.getElementById('pe-rainfastness')?.value?.trim() || '',
    phytotoxicity: document.getElementById('pe-phytotoxicity')?.value?.trim() || '',
    resistance_notes: document.getElementById('pe-resistance')?.value?.trim() || '',
    precautions: document.getElementById('pe-precautions')?.value?.trim() || '',
    usage_recommendations: currentProductEdit.usage_recommendations || [],
    risks: currentProductEdit.risks || [],
    search_links: currentProductEdit.search_links || [],
    verify_required: currentProductEdit.verify_required !== false,
    confidence: currentProductEdit.confidence || '',
    ai_model: currentProductEdit.ai_model || '',
    ai_updated_at: currentProductEdit.ai_updated_at || '',
    ai_filled_fields: currentProductEdit.ai_filled_fields || []
  };

  ensureSprayData();
  const catalog = data.products_catalog;
  const originalName = currentProductEdit.name;

  // Если редактируем существующий — обновляем по старому имени
  if (originalName) {
    const idx = catalog.findIndex(p => p.name === originalName);
    if (idx >= 0) {
      catalog[idx] = normalizeProduct(updated);
    } else {
      catalog.push(normalizeProduct(updated));
    }
  } else {
    // Новый препарат
    const idx = catalog.findIndex(p => p.name === name);
    if (idx >= 0) {
      // Если препарат с таким именем уже есть — обновляем его
      catalog[idx] = normalizeProduct(updated);
    } else {
      catalog.push(normalizeProduct(updated));
    }
  }

  saveData();
  currentProductEdit = null;
  closeModal('product-edit-modal');

  // Обновляем picker, если он открыт
  const searchValue = document.getElementById('product-search')?.value || '';
  filterProducts(searchValue);
  // Обновляем список препаратов в плане, если мы редактировали из плана
  if (typeof renderSprayProductsList === 'function') renderSprayProductsList();
  if (typeof renderTankOrder === 'function') renderTankOrder();
  if (typeof renderProductsDirectory === 'function') renderProductsDirectory();

  toast('✅ Препарат сохранён в базу', 'success');
}

// =========== ТАНК-ОРДЕР ===========

function renderTankOrder() {
  const cont = document.getElementById('sp-tank-order');
  if (!cont) return;
  const products = currentSprayPlan?.products || [];
  if (!products.length) {
    cont.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Сначала добавьте препараты</p>';
    return;
  }
  // Сортируем по форме согласно TANK_ORDER
  const sorted = [...products].map(p => {
    const cat = data.products_catalog?.find(c => c.name === p.name);
    const orderInfo = TANK_ORDER.find(o => o.type === cat?.form);
    return { ...p, form: cat?.form || '?', order: orderInfo?.order || 99, orderName: orderInfo?.name || '' };
  }).sort((a, b) => a.order - b.order);

  const ai = currentSprayPlan?.ai_mix_analysis;
  const aiBadge = ai ? (ai.verdict === 'danger' ? 'red' : ai.verdict === 'caution' ? 'yellow' : 'green') : '';
  cont.innerHTML = `
    ${ai ? `
      <div class="alert ${ai.verdict === 'danger' ? 'danger' : ai.verdict === 'caution' ? 'warning' : 'success'}" style="font-size:13px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:6px;">
          <b>🤖 AI-проверка смеси</b>
          <span class="badge ${aiBadge}">${escapeHtml(ai.verdict || '—')}</span>
          <span style="font-size:11px; color:var(--text-muted);">${ai.updated_at ? new Date(ai.updated_at).toLocaleString('ru-RU') : ''}</span>
        </div>
        <div>${escapeHtml(ai.summary || '')}</div>
        ${ai.warnings?.length ? `<div style="margin-top:8px;"><b>Предупреждения:</b><ul>${ai.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>` : ''}
        ${ai.recommendations?.length ? `<div style="margin-top:8px;"><b>Рекомендации:</b><ul>${ai.recommendations.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>` : ''}
        ${ai.water_ph ? `<div style="margin-top:8px;"><b>pH воды:</b> ${escapeHtml(ai.water_ph)}</div>` : ''}
        ${ai.official_check ? `<div style="margin-top:8px;"><b>Проверить:</b> ${escapeHtml(ai.official_check)}</div>` : ''}
      </div>
    ` : ''}
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${sorted.map((p, idx) => `
        <div style="display:flex; gap:10px; align-items:center; padding:10px 14px; background:var(--bg-elevated); border-radius:12px;">
          <div style="width:28px; height:28px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700;">${idx + 1}</div>
          <div style="flex:1;">
            <b>${escapeHtml(p.name)}</b>
            <div style="font-size:11px; color:var(--text-soft);">${escapeHtml(p.orderName || '')} · доза ${p.dose}</div>
          </div>
          <span class="badge gray">${escapeHtml(p.form)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// =========== ПРОВЕРКА СОВМЕСТИМОСТИ ===========

function checkCompatibility() {
  const cont = document.getElementById('sp-compatibility-warnings');
  if (!cont || !currentSprayPlan?.products) return;
  const warnings = [];
  const names = currentSprayPlan.products.map(p => p.name.toLowerCase());
  INCOMPATIBLE_PAIRS.forEach(pair => {
    const hasA = names.some(n => n.includes(pair.a));
    const hasB = names.some(n => n.includes(pair.b));
    if (hasA && hasB) warnings.push(pair.reason);
  });
  if (warnings.length) {
    cont.innerHTML = warnings.map(w => `<div class="alert warning" style="font-size:12px;">${escapeHtml(w)}</div>`).join('');
  } else {
    cont.innerHTML = currentSprayPlan.products.length >= 2
      ? '<div class="alert success" style="font-size:12px;">✅ Препараты совместимы</div>'
      : '';
  }
}

// =========== ПРОВЕРКА ПОГОДЫ ===========

function checkSprayWeather() {
  const date = document.getElementById('sp-date')?.value;
  const cont = document.getElementById('weather-check-result');
  if (!cont) return;
  if (!date) { cont.innerHTML = '<div class="alert warning" style="font-size:12px;">Сначала укажите дату</div>'; return; }

  const forecast = data.forecast?.find(d => d.date === date);
  if (!forecast) {
    cont.innerHTML = '<div class="alert info" style="font-size:12px;">📅 Прогноза на эту дату нет. Загрузите погоду в разделе 🌦 Погода</div>';
    return;
  }

  const warnings = [];
  if (forecast.rain > 2) warnings.push('🌧 Дождь ' + forecast.rain.toFixed(1) + ' мм — препарат смоется');
  if (forecast.wind > 15) warnings.push('🌬 Ветер ' + Math.round(forecast.wind) + ' км/ч — снос капель');
  if (forecast.tmax > 28) warnings.push('🔥 Жара ' + Math.round(forecast.tmax) + '°C — лучше утром или вечером');
  if (forecast.tmin < 5) warnings.push('❄️ Холодно ' + Math.round(forecast.tmin) + '°C — эффективность ниже');

  if (warnings.length) {
    cont.innerHTML = '<div class="alert warning" style="font-size:12px;">' + warnings.map(w => '• ' + w).join('<br>') + '</div>';
  } else {
    cont.innerHTML = '<div class="alert success" style="font-size:12px;">✅ Погода благоприятна: T ' + Math.round(forecast.tmin) + '°-' + Math.round(forecast.tmax) + '°, ветер ' + Math.round(forecast.wind) + ' км/ч, осадки ' + forecast.rain.toFixed(1) + ' мм</div>';
  }
}

// =========== РАСЧЁТ ПОРАЖЁННЫХ КУСТОВ ===========

function recalcAffectedSeedlings() {
  if (!currentSprayPlan) return;
  // Соберём данные из UI
  const plotIds = Array.from(document.querySelectorAll('input[data-zone-plot]:checked')).map(i => i.dataset.zonePlot);
  const blockIds = Array.from(document.querySelectorAll('input[data-zone-block]:checked')).map(i => i.dataset.zoneBlock);
  const statuses = Array.from(document.querySelectorAll('input[data-sp-status]:checked')).map(i => i.dataset.spStatus);
  const ageMin = parseInt(document.getElementById('sp-age-min')?.value) || null;
  const ageMax = parseInt(document.getElementById('sp-age-max')?.value) || null;

  // Сохраняем в plan
  currentSprayPlan.zones = { plot_ids: plotIds, block_ids: blockIds, statuses, age_min: ageMin, age_max: ageMax };

  // Считаем кусты
  let count = 0;
  (data.seedlings || []).forEach(s => {
    if (plotIds.length && !plotIds.includes(s.plot_id)) return;
    if (blockIds.length && !blockIds.includes(s.block_id)) return;
    if (statuses.length && !statuses.includes(s.status)) return;
    if (ageMin != null || ageMax != null) {
      const plot = data.plots?.find(p => p.id === s.plot_id);
      const block = plot?.blocks?.find(b => b.id === s.block_id);
      const age = block?.planting_year ? new Date().getFullYear() - block.planting_year : 0;
      if (ageMin != null && age < ageMin) return;
      if (ageMax != null && age > ageMax) return;
    }
    count++;
  });

  const cont = document.getElementById('zone-affected-count');
  if (cont) {
    cont.innerHTML = `
      <button class="btn small secondary" onclick="recalcAffectedSeedlings()">🔄 Пересчитать</button>
      <b style="margin-left:10px;">🍇 Будет опрыскано: ${count} кустов</b>
    `;
  }
}

// Слушатели изменений в зонах
document.addEventListener('change', e => {
  if (e.target && (
    e.target.dataset.zonePlot != null ||
    e.target.dataset.zoneBlock != null ||
    e.target.dataset.spStatus != null ||
    e.target.id === 'sp-age-min' ||
    e.target.id === 'sp-age-max'
  )) {
    recalcAffectedSeedlings();
  }
});

// =========== СОХРАНЕНИЕ ===========

function saveSprayPlan() {
  if (!requirePermission('spray.edit', 'Нет прав на план опрыскивания')) return;
  ensureSprayData();
  const plan = currentSprayPlan;
  if (!plan) return;

  plan.date = document.getElementById('sp-date')?.value;
  plan.status = document.getElementById('sp-status')?.value || 'planned';
  plan.notes = document.getElementById('sp-notes')?.value?.trim() || '';
  plan.tank_volume_l = parseFloat(document.getElementById('sp-tank-volume')?.value) || 1000;
  plan.mix_lifetime_hours = parseFloat(document.getElementById('sp-mix-lifetime')?.value) || 4;
  plan.updated_at = new Date().toISOString();

  recalcAffectedSeedlings(); // обновит zones

  const idx = data.spray_plans.findIndex(p => p.id === plan.id);
  if (idx >= 0) data.spray_plans[idx] = plan;
  else data.spray_plans.push(plan);

  saveData();
  closeModal('spray-plan-modal');
  renderSprayPlans();
  toast('✅ План опрыскивания сохранён', 'success');
}

function deleteSprayPlan(id) {
  if (!requirePermission('spray.edit', 'Нет прав на удаление планов опрыскивания')) return;
  if (!confirm('Удалить план опрыскивания?')) return;
  data.spray_plans = (data.spray_plans || []).filter(p => p.id !== id);
  saveData();
  renderSprayPlans();
}

// =========== ИМПОРТ/ЭКСПОРТ CSV ===========

function exportSprayCSV() {
  if (!requirePermission('data.export', 'Нет прав на экспорт данных')) return;
  ensureSprayData();
  const rows = [['Дата', 'Статус', 'Зоны', 'Препараты', 'Объём бака (л)', 'Срок жизни (ч)', 'Заметки']];
  (data.spray_plans || []).forEach(p => {
    const products = (p.products || []).map(pr => `${pr.name} (${pr.dose})`).join('; ');
    rows.push([
      p.date || '',
      p.status || 'planned',
      formatZones(p.zones),
      products,
      p.tank_volume_l || '',
      p.mix_lifetime_hours || '',
      (p.notes || '').replace(/\n/g, ' ')
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spray-plans-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ CSV экспортирован', 'success');
}

function importSprayCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const text = ev.target.result.replace(/^\ufeff/, '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      ensureSprayData();
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (!row[0]) continue;
        const productsStr = row[3] || '';
        const products = productsStr.split(';').map(s => {
          const m = s.trim().match(/^(.+?)\s*\(([0-9.]+)\)$/);
          return m ? { name: m[1].trim(), dose: parseFloat(m[2]) } : { name: s.trim(), dose: 0 };
        }).filter(p => p.name);
        data.spray_plans.push({
          id: 'sp_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
          date: row[0],
          status: row[1] || 'planned',
          zones: { plot_ids: [], block_ids: [] },  // импорт зон по тексту сложен — оставим пусто
          products,
          tank_volume_l: parseFloat(row[4]) || 1000,
          mix_lifetime_hours: parseFloat(row[5]) || 4,
          notes: row[6] || '',
          created_at: new Date().toISOString()
        });
        imported++;
      }
      saveData();
      renderSprayPlans();
      toast(`✅ Импортировано ${imported} планов из CSV`, 'success');
    } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// =========== ДИРЕКТОРИЯ ПРЕПАРАТОВ ===========
function renderProductsDirectory() {
  ensureSprayData();
  const cont = document.getElementById('products-directory');
  if (!cont) return;
  const q = (document.getElementById('products-dir-search')?.value || '').toLowerCase().trim();
  const catalog = (data.products_catalog || []).filter(p => {
    if (!q) return true;
    return [p.name, p.active_ingredient, p.target, p.category, p.notes].some(x => String(x || '').toLowerCase().includes(q));
  }).sort((a,b) => (a.name || '').localeCompare(b.name || '', 'ru'));
  if (!catalog.length) {
    cont.innerHTML = '<div class="empty">Препараты не найдены.</div>';
    return;
  }
  cont.innerHTML = `
    <div class="product-dir-grid">
      ${catalog.map(p => `
        <div class="product-dir-card">
          <div style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap;">
            <h4 style="margin:0; flex:1; min-width:170px;">${escapeHtml(p.name)}</h4>
            <span class="badge purple">${escapeHtml(p.form || '')}</span>
            ${p.verify_required ? '<span class="badge yellow">проверить</span>' : '<span class="badge green">проверено</span>'}
          </div>
          <div style="font-size:12px; color:var(--text-soft); margin-top:8px; line-height:1.55;">
            ${p.active_ingredient ? `<b>ДВ:</b> ${escapeHtml(p.active_ingredient)}${p.concentration ? ' · ' + escapeHtml(p.concentration) : ''}<br>` : ''}
            ${p.target ? `<b>Цель:</b> ${escapeHtml(p.target)}<br>` : ''}
            <b>Доза:</b> ${escapeHtml(String(p.dose_min || 0))}-${escapeHtml(String(p.dose_max || 0))} ${escapeHtml(p.dose_unit || '')} · <b>ожидание:</b> ${Number(p.waiting_days || 0)} дн.
          </div>
          ${p.instruction_url ? `<a href="${escapeHtml(p.instruction_url)}" target="_blank" rel="noopener" style="display:inline-block; margin-top:8px; font-size:12px;">📄 Инструкция</a>` : ''}
          <div class="toolbar" style="margin-top:10px;">
            <button class="btn small" onclick="openProductEditModal('${escapeHtml(p.name).replace(/'/g, '&apos;')}')">✏️ Редактировать</button>
            <button class="btn small accent" onclick="openProductEditModal('${escapeHtml(p.name).replace(/'/g, '&apos;')}'); setTimeout(()=>fillProductWithAI(), 100)">🤖 AI</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// =========== AI-ПРОВЕРКА БАКОВОЙ СМЕСИ ===========
async function analyzeTankMixWithAI() {
  if (!requirePermission('spray.edit', 'Нет прав на AI-проверку баковой смеси')) return;
  if (!settings.openrouterKey) { toast('Настройте OpenRouter API', 'error'); showTab('settings'); return; }
  const plan = currentSprayPlan;
  if (!plan || !plan.products || plan.products.length < 2) {
    toast('Добавьте минимум 2 препарата для проверки смеси', 'warning');
    return;
  }
  // Подтянем текущий объём из UI
  plan.tank_volume_l = parseFloat(document.getElementById('sp-tank-volume')?.value) || plan.tank_volume_l || 1000;
  plan.mix_lifetime_hours = parseFloat(document.getElementById('sp-mix-lifetime')?.value) || plan.mix_lifetime_hours || 4;
  const products = plan.products.map(p => {
    const cat = (data.products_catalog || PRODUCT_CATALOG).find(c => c.name === p.name) || {};
    return { ...cat, selected_dose: p.dose };
  });
  const btn = document.getElementById('tank-ai-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> AI проверяет...'; }
  const system = `Ты агроном по защите винограда. Проверяешь баковую смесь на совместимость, порядок внесения и риски. Не выдумывай официальные факты; если не уверен — требуй jar-test и проверку инструкций. Ответ строго JSON.`;
  const prompt = `Проверь баковую смесь для виноградника.

План:
${JSON.stringify({ date: plan.date, tank_volume_l: plan.tank_volume_l, mix_lifetime_hours: plan.mix_lifetime_hours, notes: plan.notes, products }, null, 2)}

Верни JSON:
{
  "verdict": "ok|caution|danger",
  "summary": "короткий вывод",
  "mix_order": [{"step":1,"product":"","action":"как добавить"}],
  "warnings": ["..."],
  "recommendations": ["..."],
  "jar_test_required": true,
  "recommended_lifetime_hours": 0,
  "water_ph": "рекомендация по pH",
  "official_check": "что проверить в инструкциях"
}`;
  const res = await openRouterJSONTask({ system, prompt, max_tokens: 1800, temperature: 0.2 });
  if (btn) { btn.disabled = false; btn.innerHTML = '🤖 Проверить смесь AI'; }
  if (!res.success || !res.json) { toast('AI-проверка не удалась: ' + (res.error || 'нет JSON'), 'error'); return; }
  plan.ai_mix_analysis = { ...res.json, model: res.model, updated_at: new Date().toISOString() };
  if (res.json.recommended_lifetime_hours) {
    plan.mix_lifetime_hours = Number(res.json.recommended_lifetime_hours) || plan.mix_lifetime_hours;
    const lt = document.getElementById('sp-mix-lifetime');
    if (lt) lt.value = plan.mix_lifetime_hours;
  }
  renderTankOrder();
  toast('✅ AI-проверка баковой смеси готова', 'success');
}

// =========== ИМПОРТ ТЕКСТА ИНСТРУКЦИИ ИЗ PDF/TXT ===========
async function importProductInstructionFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const status = document.getElementById('pe-file-status');
  const textArea = document.getElementById('pe-instruction-text');
  try {
    if (status) status.innerHTML = '<span class="spinner"></span> Читаю файл...';
    let text = '';
    const name = (file.name || '').toLowerCase();

    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      text = await extractTextFromPDFFile(file);
    } else {
      text = await readTextFile(file);
    }

    text = normalizeInstructionText(text);
    if (!text.trim()) throw new Error('Не удалось извлечь текст из файла');

    if (textArea) {
      const existing = textArea.value.trim();
      textArea.value = existing ? (existing + '\n\n--- импорт из файла: ' + file.name + ' ---\n' + text) : text;
    }
    if (currentProductEdit) {
      currentProductEdit.instruction_file_name = file.name;
      currentProductEdit.instruction_text = textArea ? textArea.value : text;
    }
    if (status) status.textContent = `✅ Импортировано: ${file.name} · ${text.length.toLocaleString('ru-RU')} знаков`;
    toast('✅ Текст инструкции загружен. Теперь нажмите «Заполнить из инструкции».', 'success');
  } catch(e) {
    console.error('[Product instruction import]', e);
    if (status) status.textContent = 'Ошибка импорта: ' + e.message;
    toast('Ошибка импорта инструкции: ' + e.message, 'error');
  } finally {
    event.target.value = '';
  }
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Ошибка чтения файла'));
    reader.readAsText(file, 'utf-8');
  });
}

async function extractTextFromPDFFile(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js не загрузился. Проверьте интернет или вставьте текст инструкции вручную.');
  }
  // Worker с CDN; если не задавать, pdf.js часто ругается в браузере.
  if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const maxPages = Math.min(pdf.numPages, 40); // защита от огромных PDF
  const pages = [];
  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str || '').join(' ');
    pages.push(`\n--- страница ${pageNo} ---\n${pageText}`);
  }
  if (pdf.numPages > maxPages) {
    pages.push(`\n--- импорт остановлен: прочитано ${maxPages} из ${pdf.numPages} страниц ---`);
  }
  return pages.join('\n');
}

function normalizeInstructionText(text) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
