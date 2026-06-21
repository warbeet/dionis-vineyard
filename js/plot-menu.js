// ============================================================================
// PLOT-MENU module — Единое выпадающее меню "Управление" для участка
// ============================================================================

// Текущий участок в контексте меню
let currentMenuPlotId = null;

// Структура меню — иерархия разделов
const PLOT_MENU_STRUCTURE = [
  { divider: '⚙️ Основное' },
  { id: 'edit',      icon: '✏️',  label: 'Название и описание', action: 'openPlotModal' },
  { id: 'geometry',  icon: '📐',  label: 'Геометрия и агротехника', action: 'openGeometryEditor' },
  { id: 'template',  icon: '📋',  label: 'Применить шаблон', action: 'openTemplatesModal' },

  { divider: '🌿 Сорта и блоки' },
  { id: 'varieties', icon: '🍇',  label: 'Управление сортами', action: 'openVarietiesManager' },

  { divider: '💧 Расчёты' },
  { id: 'irrig',     icon: '💧',  label: 'План полива', action: 'openIrrigationModal' },

  { divider: '🗺 Карта и навигация' },
  { id: 'gps',       icon: '🎯',  label: 'Авто-расчёт GPS кустов', action: 'applyAutoGPSToPlot' },
  { id: 'draw',      icon: '✏️',  label: 'Рисовать ряды на карте', action: 'startDrawingRowsMode' },
  { id: 'route',     icon: '🤖',  label: 'Показать маршрут робота', action: 'showRobotRouteSmart' },
  { id: 'gpx',       icon: '⬇',  label: 'Скачать маршрут (GPX)', action: 'exportRouteGPX' },

  { divider: '⚠️ Опасная зона' },
  { id: 'delete',    icon: '🗑',  label: 'Удалить участок', action: 'deletePlot', danger: true }
];

function openPlotMenu(event, plotId) {
  event.stopPropagation();
  currentMenuPlotId = plotId;

  // Удалим прошлое меню если открыто
  closePlotMenu();

  const menu = document.createElement('div');
  menu.id = 'plot-menu-dropdown';
  menu.className = 'plot-menu-dropdown';
  menu.innerHTML = PLOT_MENU_STRUCTURE.map(item => {
    if (item.divider) {
      return `<div class="menu-divider">${escapeHtml(item.divider)}</div>`;
    }
    return `<button class="menu-item ${item.danger ? 'danger' : ''}" onclick="handleMenuClick('${item.action}', '${plotId}')">
      <span class="menu-icon">${item.icon}</span>
      <span class="menu-label">${escapeHtml(item.label)}</span>
    </button>`;
  }).join('');

  document.body.appendChild(menu);

  // Позиционируем под кнопкой
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  const menuW = 280;
  let left = rect.right - menuW;
  if (left < 8) left = 8;
  if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
  menu.style.left = left + 'px';
  menu.style.top = (rect.bottom + 6 + window.scrollY) + 'px';

  // Закрытие при клике вне меню
  setTimeout(() => {
    document.addEventListener('click', closePlotMenuOnOutsideClick);
  }, 50);
}

function closePlotMenuOnOutsideClick(e) {
  const menu = document.getElementById('plot-menu-dropdown');
  if (menu && !menu.contains(e.target)) {
    closePlotMenu();
  }
}

function closePlotMenu() {
  const m = document.getElementById('plot-menu-dropdown');
  if (m) m.remove();
  document.removeEventListener('click', closePlotMenuOnOutsideClick);
}

function handleMenuClick(actionName, plotId) {
  closePlotMenu();
  const fn = window[actionName];
  if (typeof fn === 'function') {
    fn(plotId);
  } else {
    console.error('Action not found:', actionName);
    toast('Действие не найдено: ' + actionName, 'error');
  }
}

// =========== ИСПРАВЛЕНИЯ КАРТЫ ===========
// «Откройте карту сначала» — теперь меню сам переключит на вкладку карты,
// инициализирует её и подождёт

async function ensureMapOpened(plotId) {
  // 1. Переключаемся на вкладку карты
  if (typeof showPlotTab === 'function') {
    showPlotTab(plotId, 'map');
  }

  // 2. Прокрутим к карте для удобства
  await new Promise(r => setTimeout(r, 300));
  const containerId = 'plot-map-' + plotId;
  let mapEl = document.getElementById(containerId);
  if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // 3. Если карта еще не инициализирована - запустим
  if (typeof yandexMaps !== 'undefined' && !yandexMaps[plotId]) {
    if (typeof initPlotMap === 'function') {
      initPlotMap(plotId);
    }
  }

  // 4. Ждём пока карта реально готова (до 15 секунд для медленных соединений)
  return new Promise((resolve) => {
    let tries = 0;
    const maxTries = 75;  // 15 секунд при шаге 200мс
    const check = setInterval(() => {
      tries++;
      const hasMap = (typeof yandexMaps !== 'undefined' && yandexMaps[plotId]) ||
                     (typeof leafletMaps !== 'undefined' && leafletMaps[plotId]);
      if (hasMap) {
        clearInterval(check);
        // Ещё чуть подождём чтобы тайлы догрузились
        setTimeout(() => resolve(true), 300);
      } else if (tries > maxTries) {
        clearInterval(check);
        console.warn('[Dionis] Map init timeout for plot', plotId);
        resolve(false);
      }
    }, 200);
  });
}

// Обёртки для функций которым нужна открытая карта
async function startDrawingRowsMode(plotId) {
  toast('🗺 Открываю карту (это займёт несколько секунд)...', 'info');
  const ok = await ensureMapOpened(plotId);
  if (!ok) {
    toast('❌ Карта не загрузилась. Перейдите на вкладку 🗺 Карта вручную и попробуйте ещё раз.', 'error');
    return;
  }
  // Запускаем режим рисования
  if (typeof toggleRowDrawingMode === 'function') {
    toggleRowDrawingMode(plotId);
    toast('✏️ Кликните на карте 2 точки — начало и конец ряда', 'success');
  } else {
    toast('Функция рисования недоступна', 'error');
  }
}

async function showRobotRouteSmart(plotId) {
  toast('🤖 Открываю карту и рассчитываю маршрут...', 'info');
  const ok = await ensureMapOpened(plotId);
  if (!ok) {
    toast('❌ Карта не загрузилась. Перейдите на вкладку 🗺 Карта вручную.', 'error');
    return;
  }
  if (typeof showRobotRoute === 'function') {
    showRobotRoute(plotId);
  } else {
    toast('Функция маршрута недоступна', 'error');
  }
}

// =========== МЕНЕДЖЕР СОРТОВ (упрощённый интерфейс блоков) ===========
//
// Блоки больше не редактируются вручную — их создание автоматическое.
// Здесь только: добавить сорт, назначить ряды этому сорту.

function openVarietiesManager(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  if (typeof migratePlotGeometry === 'function') migratePlotGeometry(plot);
  if (!plot.blocks) plot.blocks = [];

  currentEditingPlotId = plotId;
  document.getElementById('varieties-modal-title').textContent = `🍇 Сорта — ${plot.name}`;
  renderVarietiesList(plot);
  openModal('varieties-modal');
}

function renderVarietiesList(plot) {
  const list = document.getElementById('varieties-list');
  if (!list) return;

  if (!plot.blocks?.length) {
    list.innerHTML = '<div class="empty">Сортов пока нет. Добавьте первый ниже ↓</div>';
    return;
  }

  list.innerHTML = plot.blocks.map(b => {
    const seedlings = getBlockSeedlings(plot.id, b.id);
    const rowsList = (b.zone || []).map(z => `${z.row}:${z.from}-${z.to}`).join(', ') || 'не привязан к рядам';
    return `
      <div class="card" style="margin-bottom:10px; padding:14px; border-left:4px solid ${b.color};">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div style="flex:1; min-width:0;">
            <h4 style="font-size:14px; margin-bottom:6px; display:flex; align-items:center; gap:8px;">
              <span style="width:14px; height:14px; border-radius:50%; background:${b.color}; flex-shrink:0;"></span>
              ${escapeHtml(b.name)}
            </h4>
            <div style="font-size:12px; color:var(--text-soft); line-height:1.6;">
              🍇 <b>Привой:</b> ${escapeHtml(b.scion || '—')} ${b.scion_clone ? '(' + escapeHtml(b.scion_clone) + ')' : ''}<br>
              🌱 <b>Подвой:</b> ${escapeHtml(b.rootstock || '—')}<br>
              📅 <b>Посадка:</b> ${b.planting_year || '—'}<br>
              📐 <b>Ряды:</b> ${escapeHtml(rowsList)} · <b>${seedlings.length}</b> кустов
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <button class="btn small secondary" onclick="editVariety('${plot.id}', '${b.id}')">✏️</button>
            <button class="btn small danger" onclick="deleteVariety('${plot.id}', '${b.id}')">🗑</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function editVariety(plotId, blockId) {
  // Используем существующий редактор блока, но переименуем UI
  const titleEl = document.getElementById('block-modal-title');
  if (titleEl) {
    setTimeout(() => {
      // Слегка изменим заголовок чтобы не путать пользователя
      titleEl.textContent = '🍇 Сорт — редактирование';
    }, 100);
  }
  openBlockModal(plotId, blockId);
}

function deleteVariety(plotId, blockId) {
  if (!confirm('Удалить сорт? Кусты останутся, но потеряют привязку к сорту.')) return;
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  plot.blocks = plot.blocks.filter(b => b.id !== blockId);
  if (data.seedlings) {
    data.seedlings.forEach(s => {
      if (s.block_id === blockId) s.block_id = null;
    });
  }
  saveData();
  renderVarietiesList(plot);
  renderAll();
  toast('Сорт удалён', 'success');
}

function addVariety(plotId) {
  // Открываем стандартный редактор блока
  openBlockModal(plotId);
  // После сохранения список обновится через renderAll
}

// =========== ПЕРЕКЛЮЧАТЕЛЬ ОРИЕНТАЦИИ СХЕМЫ ===========
// Для каждого участка храним: 'h' = ряды горизонтальные (по умолчанию), 'v' = вертикальные

let schemaOrientation = {}; // plotId → 'h' | 'v'

function toggleSchemaOrientation(plotId) {
  schemaOrientation[plotId] = (schemaOrientation[plotId] || 'h') === 'h' ? 'v' : 'h';
  // Сохраняем в localStorage
  try { localStorage.setItem('schemaOrientation', JSON.stringify(schemaOrientation)); } catch(e){}
  if (typeof drawSchemaCanvas === 'function') {
    drawSchemaCanvas(plotId, schemaColorMode[plotId] || 'status');
  }
  const btn = document.getElementById('schema-orient-btn-' + plotId);
  if (btn) {
    btn.textContent = (schemaOrientation[plotId] === 'v') ? '↻ Ряды горизонтально' : '↻ Ряды вертикально';
  }
}

// Загружаем сохранённую ориентацию
(function loadSchemaOrientation() {
  try {
    const saved = localStorage.getItem('schemaOrientation');
    if (saved) schemaOrientation = JSON.parse(saved);
  } catch(e) {}
})();
