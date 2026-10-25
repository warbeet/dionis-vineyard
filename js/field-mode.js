// ============================================================================
// FIELD MODE module v0.7.12 — Быстрый полевой режим обхода
// ============================================================================

let fieldMode = {
  active: false,
  plotId: null,
  gpsPosition: null,
  currentSeedlingId: null
};

function toggleFieldMode() {
  fieldMode.active = !fieldMode.active;
  const overlay = document.getElementById('field-mode-overlay');
  
  if (fieldMode.active) {
    overlay.style.display = 'flex';
    initFieldMode();
  } else {
    overlay.style.display = 'none';
    fieldMode.currentSeedlingId = null;
  }
}

function initFieldMode() {
  // Запрос GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        fieldMode.gpsPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        console.log('GPS получен:', fieldMode.gpsPosition);
      },
      err => {
        console.warn('GPS ошибка:', err);
        toast('GPS недоступен — работаем без геолокации', 'warning');
      }
    );
  }
  
  // Заполнить список участков
  const plotSelect = document.getElementById('field-plot-select');
  if (plotSelect && data.plots.length) {
    plotSelect.innerHTML = data.plots.map(p => 
      `<option value="${p.id}">${escapeHtml(p.name)}</option>`
    ).join('');
    fieldMode.plotId = data.plots[0].id;
  }
}

function selectFieldPlot(plotId) {
  fieldMode.plotId = plotId;
  console.log('Выбран участок:', plotId);
}

function quickStatusUpdate(status) {
  if (!fieldMode.currentSeedlingId) {
    toast('Сначала выберите куст', 'error');
    return;
  }
  
  // Найти или создать seedling
  let seedling = data.seedlings.find(s => s.id === fieldMode.currentSeedlingId);
  
  if (!seedling) {
    // Создаём новый seedling из виртуального
    const plot = data.plots.find(p => p.id === fieldMode.plotId);
    if (!plot) return;
    
    seedling = {
      id: fieldMode.currentSeedlingId.replace('_v', '') + '_' + Date.now().toString(36),
      plot_id: fieldMode.plotId,
      row: 0, // будет определено при клике
      position: 0,
      status: 'normal',
      is_replanted: false,
      ai_data: null,
      inspections: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.seedlings.push(seedling);
  }
  
  // Обновить статус
  const oldStatus = seedling.status;
  seedling.status = status;
  seedling.updated_at = new Date().toISOString();
  
  // Добавить GPS если есть
  if (fieldMode.gpsPosition && !seedling.gps) {
    seedling.gps = {
      lat: fieldMode.gpsPosition.lat,
      lng: fieldMode.gpsPosition.lng,
      accuracy: fieldMode.gpsPosition.accuracy
    };
  }
  
  // Записать в историю
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
  toast(`✅ Статус обновлён: ${getStatusLabel(status)}`, 'success');
  
  // Сбросить выбор
  fieldMode.currentSeedlingId = null;
  document.querySelectorAll('.field-seedling').forEach(el => el.classList.remove('selected'));
}

function getStatusLabel(status) {
  const labels = {
    'mildew': '🟡 Милдью',
    'oidium': '⚪ Оидиум',
    'chlorosis': '🟠 Хлороз',
    'dead': '⚫ Выпад',
    'healthy': '🟢 Здоров'
  };
  return labels[status] || status;
}

function openFieldNote() {
  if (!fieldMode.currentSeedlingId) {
    toast('Сначала выберите куст', 'error');
    return;
  }
  document.getElementById('field-note-modal').style.display = 'flex';
}

function saveFieldNote() {
  const note = document.getElementById('field-note-text').value.trim();
  if (!note) return;
  
  let seedling = data.seedlings.find(s => s.id === fieldMode.currentSeedlingId);
  if (!seedling) {
    // Создаём если нужно
    quickStatusUpdate('normal');
    seedling = data.seedlings.find(s => s.id === fieldMode.currentSeedlingId);
  }
  
  if (seedling) {
    if (!seedling.inspections) seedling.inspections = [];
    const lastInspection = seedling.inspections[seedling.inspections.length - 1];
    if (lastInspection) {
      lastInspection.notes = note;
    }
    saveData();
    toast('✅ Заметка сохранена', 'success');
  }
  
  document.getElementById('field-note-modal').style.display = 'none';
  document.getElementById('field-note-text').value = '';
}

function closeFieldNote() {
  document.getElementById('field-note-modal').style.display = 'none';
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  // Создаём overlay для field mode
  const overlay = document.createElement('div');
  overlay.id = 'field-mode-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #f5f5dc; z-index: 10000; padding: 20px; overflow-y: auto;">
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 28px;">🌱 Полевой режим</h2>
          <button class="btn" onclick="toggleFieldMode()">✖ Закрыть</button>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
          <label style="font-weight: bold; display: block; margin-bottom: 8px;">Участок:</label>
          <select id="field-plot-select" onchange="selectFieldPlot(this.value)" 
                  style="width: 100%; padding: 12px; font-size: 18px; border: 2px solid #6b8e5a; border-radius: 8px;">
          </select>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Выберите статус куста:</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <button class="btn field-btn" onclick="quickStatusUpdate('mildew')" 
                    style="padding: 20px; font-size: 20px; min-height: 80px; background: #fff3cd; border: 3px solid #ffc107;">
              🟡<br>Милдью
            </button>
            <button class="btn field-btn" onclick="quickStatusUpdate('oidium')"
                    style="padding: 20px; font-size: 20px; min-height: 80px; background: #f8f9fa; border: 3px solid #dee2e6;">
              ⚪<br>Оидиум
            </button>
            <button class="btn field-btn" onclick="quickStatusUpdate('chlorosis')"
                    style="padding: 20px; font-size: 20px; min-height: 80px; background: #ffe5d0; border: 3px solid #fd7e14;">
              🟠<br>Хлороз
            </button>
            <button class="btn field-btn" onclick="quickStatusUpdate('dead')"
                    style="padding: 20px; font-size: 20px; min-height: 80px; background: #343a40; color: white; border: 3px solid #000;">
              ⚫<br>Выпад
            </button>
            <button class="btn field-btn" onclick="quickStatusUpdate('healthy')"
                    style="padding: 20px; font-size: 20px; min-height: 80px; background: #d4edda; border: 3px solid #28a745; grid-column: span 2;">
              🟢<br>Здоров
            </button>
          </div>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 12px;">
          <button class="btn" onclick="openFieldNote()" 
                  style="width: 100%; padding: 15px; font-size: 18px;">
            📝 Добавить заметку
          </button>
        </div>
      </div>
    </div>
    
    <div id="field-note-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10001; justify-content: center; align-items: center;">
      <div style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%;">
        <h3 style="margin-top: 0;">Заметка к кусту</h3>
        <textarea id="field-note-text" rows="5" style="width: 100%; padding: 12px; font-size: 16px; border: 2px solid #6b8e5a; border-radius: 8px;" 
                  placeholder="Опишите проблему, симптомы, наблюдения..."></textarea>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <button class="btn" onclick="saveFieldNote()" style="flex: 1; padding: 12px; font-size: 16px;">💾 Сохранить</button>
          <button class="btn" onclick="closeFieldNote()" style="flex: 1; padding: 12px; font-size: 16px;">Отмена</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
});
