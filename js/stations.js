// ============================================================================
// STATIONS module — Метеостанции в поле (управление, данные, API endpoint)
// ============================================================================

/*
  СТРУКТУРА МЕТЕОСТАНЦИИ:

  {
    id: 'st_xxx',
    name: 'Метеостанция Север',
    model: 'Davis Vantage Pro2' | 'Sencrop X1' | 'своя',
    api_token: 'XXX',                         // для приёма данных по HTTP POST
    gps: { lat: 45.04, lng: 38.98 },
    altitude_m: 120,
    plot_id: 'p_xxx' | null,                  // привязка к участку (если есть)
    installed_date: '2026-05-15',
    sensors: ['air_temp','air_humidity','wind','pressure','rain','soil_temp','soil_moisture','leaf_wetness','solar','par','npk','uv','dew_point','no2','no'],
    status: 'online' | 'offline' | 'warning',
    last_seen: '2026-06-19T10:30:00Z',
    battery_pct: 87,
    signal: 'good' | 'weak',
    latest: {
      timestamp: '...',
      air_temp: 22.5,
      air_humidity: 65,
      wind_speed: 8.2,
      wind_direction: 180,
      wind_gusts: 12,
      pressure: 1013,
      rain_1h: 0,
      rain_24h: 2.4,
      soil_temp_10: 18.2,
      soil_temp_30: 16.8,
      soil_moisture_10: 32,
      soil_moisture_30: 45,
      leaf_wetness: 0,
      solar_radiation: 750,
      par: 1200,
      uv_index: 6,
      dew_point: 14.5,
      no2: 12,
      no: 5,
      soil_n: 25,
      soil_p: 18,
      soil_k: 120,
      ph: 6.5
    },
    history: []  // массив measurements
  }

  API ENDPOINT (когда подключим бэкенд):
  POST /api/stations/:station_id/data
  Headers: X-Station-Token: <api_token>
  Body: { measurements: [{timestamp, air_temp, ...}, ...] }
*/

// Каталог моделей метеостанций
const STATION_MODELS = [
  { id: 'davis_pro2', name: 'Davis Vantage Pro2', sensors: ['air_temp','air_humidity','wind','pressure','rain','solar','uv','soil_temp','soil_moisture'] },
  { id: 'sencrop_x1', name: 'Sencrop X1', sensors: ['air_temp','air_humidity','wind','rain','leaf_wetness'] },
  { id: 'metos_imt', name: 'Metos iMETOS', sensors: ['air_temp','air_humidity','wind','rain','solar','leaf_wetness','soil_temp','soil_moisture','npk'] },
  { id: 'pessl_imetos', name: 'Pessl iMETOS 3.3', sensors: ['air_temp','air_humidity','wind','rain','solar','soil_temp','soil_moisture','leaf_wetness','par','dew_point'] },
  { id: 'arable_mark2', name: 'Arable Mark 2', sensors: ['air_temp','air_humidity','wind','rain','solar','par','dew_point','leaf_wetness'] },
  { id: 'meteobot', name: 'Meteobot', sensors: ['air_temp','air_humidity','rain','soil_temp','soil_moisture','npk','ph'] },
  { id: 'custom', name: 'Своя сборка', sensors: [] }
];

// Каталог сенсоров с метаданными
const SENSOR_INFO = {
  air_temp:        { label: '🌡 Темп. воздуха',   unit: '°C',  icon: '🌡' },
  air_humidity:    { label: '💧 Влажн. воздуха',   unit: '%',   icon: '💧' },
  wind_speed:      { label: '🌬 Скорость ветра',  unit: 'м/с', icon: '🌬' },
  wind_direction:  { label: '🧭 Направление',     unit: '°',   icon: '🧭' },
  wind_gusts:      { label: '💨 Порывы',          unit: 'м/с', icon: '💨' },
  pressure:        { label: '📊 Давление',        unit: 'гПа', icon: '📊' },
  rain_1h:         { label: '☔ Осадки за час',    unit: 'мм',  icon: '☔' },
  rain_24h:        { label: '🌧 Осадки за сутки', unit: 'мм',  icon: '🌧' },
  soil_temp_10:    { label: '🌱 Темп. почвы 10см', unit: '°C', icon: '🌱' },
  soil_temp_30:    { label: '🌱 Темп. почвы 30см', unit: '°C', icon: '🌱' },
  soil_moisture_10:{ label: '💦 Влажн. почвы 10см',unit: '%',   icon: '💦' },
  soil_moisture_30:{ label: '💦 Влажн. почвы 30см',unit: '%',   icon: '💦' },
  leaf_wetness:    { label: '🍃 Влажн. листа',     unit: 'мин', icon: '🍃' },
  solar_radiation: { label: '☀ Солн. радиация',    unit: 'Вт/м²', icon: '☀' },
  par:             { label: '🌞 PAR',              unit: 'мкмоль/м²с', icon: '🌞' },
  uv_index:        { label: '🔆 UV индекс',        unit: '',    icon: '🔆' },
  dew_point:       { label: '💧 Точка росы',       unit: '°C',  icon: '💧' },
  no2:             { label: '☁ NO₂',              unit: 'ppb', icon: '☁' },
  no:              { label: '☁ NO',                unit: 'ppb', icon: '☁' },
  soil_n:          { label: '🟢 Азот (N)',         unit: 'мг/кг', icon: '🟢' },
  soil_p:          { label: '🟣 Фосфор (P)',       unit: 'мг/кг', icon: '🟣' },
  soil_k:          { label: '🟠 Калий (K)',        unit: 'мг/кг', icon: '🟠' },
  ph:              { label: '⚗ pH почвы',          unit: '',    icon: '⚗' }
};

// =========== СОЗДАНИЕ / РЕДАКТИРОВАНИЕ СТАНЦИИ ===========
function openStationModal(stationId) {
  if (!data.stations) data.stations = [];
  ['st-name','st-altitude','st-installed','st-lat','st-lng','st-notes'].forEach(f => {
    const el = document.getElementById(f); if (el) el.value = '';
  });
  document.getElementById('st-model').value = 'davis_pro2';
  document.getElementById('st-plot').innerHTML = '<option value="">(не привязан)</option>' +
    (data.plots || []).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  document.getElementById('st-id').value = '';
  document.getElementById('st-modal-title').textContent = 'Новая метеостанция';
  document.getElementById('st-delete-btn').style.display = 'none';

  if (stationId) {
    const s = data.stations.find(x => x.id === stationId);
    if (s) {
      document.getElementById('st-id').value = s.id;
      document.getElementById('st-modal-title').textContent = 'Станция: ' + s.name;
      document.getElementById('st-name').value = s.name || '';
      document.getElementById('st-model').value = s.model || 'davis_pro2';
      document.getElementById('st-altitude').value = s.altitude_m || '';
      document.getElementById('st-installed').value = s.installed_date || '';
      document.getElementById('st-lat').value = s.gps?.lat || '';
      document.getElementById('st-lng').value = s.gps?.lng || '';
      document.getElementById('st-plot').value = s.plot_id || '';
      document.getElementById('st-notes').value = s.notes || '';
      document.getElementById('st-delete-btn').style.display = '';
    }
  }
  renderStationSensorsChecks(stationId);
  openModal('station-modal');
}

function renderStationSensorsChecks(stationId) {
  const cont = document.getElementById('st-sensors-list');
  if (!cont) return;
  const station = data.stations.find(s => s.id === stationId);
  const enabled = station ? (station.sensors || []) : ['air_temp', 'air_humidity', 'wind_speed', 'rain_24h'];
  cont.innerHTML = Object.entries(SENSOR_INFO).map(([k, v]) => `
    <label style="display:flex; align-items:center; gap:6px; padding:6px 10px; background:var(--bg); border-radius:10px; box-shadow: inset 1px 1px 2px var(--shadow-inset-dark); font-size:12px; text-transform:none; cursor:pointer;">
      <input type="checkbox" name="st-sensor" value="${k}" ${enabled.includes(k) ? 'checked' : ''} style="width:auto;">
      <span>${v.icon} ${v.label.replace(/^[^\s]+\s/, '')}</span>
    </label>
  `).join('');
}

function saveStation() {
  if (!requirePermission('weather.edit', 'Нет прав на метеостанции')) return;
  if (!data.stations) data.stations = [];
  const id = document.getElementById('st-id').value || ('st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  const isNew = !document.getElementById('st-id').value;
  const name = document.getElementById('st-name').value.trim();
  if (!name) { toast('Укажите название', 'error'); return; }

  const sensors = Array.from(document.querySelectorAll('input[name="st-sensor"]:checked')).map(c => c.value);
  const lat = parseFloat(document.getElementById('st-lat').value);
  const lng = parseFloat(document.getElementById('st-lng').value);

  const station = {
    id, name,
    model: document.getElementById('st-model').value,
    altitude_m: parseFloat(document.getElementById('st-altitude').value) || null,
    installed_date: document.getElementById('st-installed').value || '',
    gps: (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null,
    plot_id: document.getElementById('st-plot').value || null,
    sensors,
    notes: document.getElementById('st-notes').value.trim(),
    status: 'offline',
    api_token: isNew ? generateApiToken() : (data.stations.find(s => s.id === id)?.api_token || generateApiToken()),
    last_seen: null,
    latest: null,
    history: [],
    created_at: isNew ? new Date().toISOString() : (data.stations.find(s => s.id === id)?.created_at || new Date().toISOString())
  };

  const idx = data.stations.findIndex(s => s.id === id);
  if (idx >= 0) {
    // Сохраняем history и latest
    station.history = data.stations[idx].history || [];
    station.latest = data.stations[idx].latest || null;
    station.last_seen = data.stations[idx].last_seen || null;
    station.status = data.stations[idx].status || 'offline';
    data.stations[idx] = station;
  } else {
    data.stations.push(station);
  }
  saveData();
  closeModal('station-modal');
  renderStations();
  toast('✅ Станция сохранена', 'success');
}

function deleteStation() {
  const id = document.getElementById('st-id').value;
  if (!id) return;
  if (!confirm('Удалить метеостанцию и все её данные?')) return;
  data.stations = (data.stations || []).filter(s => s.id !== id);
  saveData();
  closeModal('station-modal');
  renderStations();
  toast('Станция удалена', 'success');
}

function generateApiToken() {
  return 'st_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// =========== РЕНДЕР СПИСКА СТАНЦИЙ ===========
function renderStations() {
  const list = document.getElementById('stations-list');
  if (!list) return;
  const stations = data.stations || [];
  if (!stations.length) {
    list.innerHTML = '<div class="empty">Метеостанций нет. Нажмите «+ Метеостанция», чтобы добавить.</div>';
    return;
  }
  list.innerHTML = '<div class="stations-grid">' + stations.map(s => {
    const lastSeenAgo = s.last_seen ? Math.floor((Date.now() - new Date(s.last_seen).getTime()) / 60000) : null;
    let statusClass = 'offline', statusText = '⚫ Нет связи';
    if (s.status === 'online') { statusClass = 'online'; statusText = '🟢 Онлайн'; }
    else if (s.status === 'warning') { statusClass = 'warning'; statusText = '🟡 Предупреждение'; }
    const plot = s.plot_id ? data.plots?.find(p => p.id === s.plot_id) : null;
    const model = STATION_MODELS.find(m => m.id === s.model);

    return `
      <div class="station-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="flex:1;">
            <div class="station-name">📡 ${escapeHtml(s.name)}</div>
            <div class="station-status ${statusClass}">${statusText}${lastSeenAgo != null ? ' · ' + formatTimeAgo(lastSeenAgo) : ''}</div>
            <div class="station-meta">
              ${model ? escapeHtml(model.name) : ''}${plot ? ' · ' + escapeHtml(plot.name) : ''}${s.altitude_m ? ' · ' + s.altitude_m + 'м над УМ' : ''}
            </div>
          </div>
          <div style="display:flex; gap:4px;">
            <button class="btn small secondary" onclick="openStationModal('${s.id}')">✏️</button>
            <button class="btn small secondary" onclick="showStationToken('${s.id}')" title="API токен">🔑</button>
          </div>
        </div>
        ${renderStationReadings(s)}
        ${s.battery_pct != null ? `<div style="font-size:11px; color:var(--text-muted); margin-top:10px;">🔋 Батарея: ${s.battery_pct}%${s.signal ? ' · 📶 ' + s.signal : ''}</div>` : ''}
      </div>
    `;
  }).join('') + '</div>';
}

function renderStationReadings(station) {
  if (!station.latest) {
    return `<div class="alert info" style="margin-top:12px; font-size:12px;">📭 Нет данных. Отправьте первое измерение через API или импортируйте CSV.</div>`;
  }
  const sensors = station.sensors || [];
  const readings = sensors
    .filter(s => station.latest[s] != null)
    .slice(0, 8); // показываем до 8 главных
  if (!readings.length) {
    return `<div class="alert info" style="margin-top:12px; font-size:12px;">📭 Сенсоры есть, но данных нет.</div>`;
  }
  return `<div class="station-readings">
    ${readings.map(s => {
      const info = SENSOR_INFO[s] || { label: s, unit: '', icon: '📊' };
      const val = station.latest[s];
      const num = (typeof val === 'number') ? (Math.abs(val) < 1 ? val.toFixed(2) : val.toFixed(1)) : val;
      return `<div class="reading">
        <div class="reading-label">${info.icon} ${info.label.replace(/^[^\s]+\s/, '')}</div>
        <div class="reading-value">${num}<span class="unit">${info.unit}</span></div>
      </div>`;
    }).join('')}
  </div>`;
}

function formatTimeAgo(minutes) {
  if (minutes < 1) return 'только что';
  if (minutes < 60) return minutes + ' мин назад';
  if (minutes < 1440) return Math.floor(minutes / 60) + ' ч назад';
  return Math.floor(minutes / 1440) + ' д назад';
}

function showStationToken(stationId) {
  const s = data.stations.find(x => x.id === stationId);
  if (!s) return;
  const endpoint = `${location.origin}${location.pathname.replace('index.html', '')}api/stations/${s.id}/data`;
  const example = `POST ${endpoint}
Headers:
  X-Station-Token: ${s.api_token}
  Content-Type: application/json

Body:
{
  "measurements": [
    {
      "timestamp": "${new Date().toISOString()}",
      "air_temp": 22.5,
      "air_humidity": 65,
      "wind_speed": 8.2,
      "rain_24h": 2.4
    }
  ]
}`;
  document.getElementById('station-token-content').textContent = example;
  document.getElementById('station-token-modal-title').textContent = `API: ${s.name}`;
  openModal('station-token-modal');
}

// =========== РУЧНОЙ ВВОД ИЗМЕРЕНИЯ ===========
function openStationMeasureModal(stationId) {
  const s = data.stations.find(x => x.id === stationId);
  if (!s) return;
  const cont = document.getElementById('measure-inputs');
  cont.innerHTML = (s.sensors || []).map(sensor => {
    const info = SENSOR_INFO[sensor];
    if (!info) return '';
    const cur = s.latest?.[sensor] ?? '';
    return `<div class="form-row" style="margin-bottom:8px;">
      <label>${info.icon} ${info.label.replace(/^[^\s]+\s/, '')} (${info.unit})</label>
      <input type="number" step="0.1" name="m-${sensor}" value="${cur}">
    </div>`;
  }).join('');
  document.getElementById('m-station-id').value = stationId;
  document.getElementById('measure-modal-title').textContent = `Измерение: ${s.name}`;
  openModal('measure-modal');
}

function saveMeasurement() {
  if (!requirePermission('weather.edit', 'Нет прав на измерения')) return;
  const stationId = document.getElementById('m-station-id').value;
  const s = data.stations.find(x => x.id === stationId);
  if (!s) return;
  const measurement = { timestamp: new Date().toISOString() };
  document.querySelectorAll('input[name^="m-"]').forEach(inp => {
    const key = inp.name.slice(2);
    const val = parseFloat(inp.value);
    if (!isNaN(val)) measurement[key] = val;
  });
  s.latest = measurement;
  s.last_seen = measurement.timestamp;
  s.status = 'online';
  if (!s.history) s.history = [];
  s.history.push(measurement);
  if (s.history.length > 1000) s.history = s.history.slice(-1000); // храним последние 1000
  saveData();
  closeModal('measure-modal');
  renderStations();
  toast('✅ Измерение записано', 'success');
}

// =========== CSV ИМПОРТ ИЗМЕРЕНИЙ ===========
function importStationCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const stationId = document.getElementById('import-station-id')?.value || prompt('ID станции для импорта:');
  if (!stationId) return;
  const s = data.stations?.find(x => x.id === stationId);
  if (!s) { toast('Станция не найдена', 'error'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = e.target.result.replace(/^\ufeff/, '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        const m = {};
        headers.forEach((h, j) => {
          const v = row[j];
          if (h === 'timestamp' || h === 'date' || h === 'time') m.timestamp = v;
          else if (SENSOR_INFO[h]) {
            const n = parseFloat(v);
            if (!isNaN(n)) m[h] = n;
          }
        });
        if (!m.timestamp) m.timestamp = new Date().toISOString();
        if (!s.history) s.history = [];
        s.history.push(m);
        imported++;
      }
      // latest — самое свежее
      s.history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      if (s.history.length) {
        s.latest = s.history[s.history.length - 1];
        s.last_seen = s.latest.timestamp;
        s.status = 'online';
      }
      if (s.history.length > 1000) s.history = s.history.slice(-1000);
      saveData();
      renderStations();
      toast(`✅ Импортировано ${imported} измерений`, 'success');
    } catch(err) { toast('Ошибка: ' + err.message, 'error'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// =========== API ENDPOINT (заглушка — требует бэкенд) ===========
/*
  Для реального приёма данных от станций нужен бэкенд.
  В текущей PWA-версии можно:
  1) Импортировать CSV вручную
  2) Использовать webhook через Firebase Functions (требует настройки)
  3) Использовать промежуточный сервис (Make/Zapier/n8n) который слушает HTTP и пишет в Firestore

  Пример Firebase Cloud Function (заготовка):
  exports.stationData = functions.https.onRequest(async (req, res) => {
    const token = req.header('X-Station-Token');
    const stationId = req.path.split('/').pop();
    // Найти станцию, проверить токен, записать в Firestore
    res.json({ ok: true });
  });
*/

// Симуляция для демо
function simulateStationData() {
  if (!data.stations || !data.stations.length) {
    toast('Сначала создайте станцию', 'error'); return;
  }
  data.stations.forEach(s => {
    const m = { timestamp: new Date().toISOString() };
    (s.sensors || []).forEach(sensor => {
      const ranges = {
        air_temp: [10, 30], air_humidity: [40, 90], wind_speed: [0, 15],
        wind_direction: [0, 360], wind_gusts: [0, 25], pressure: [995, 1025],
        rain_1h: [0, 5], rain_24h: [0, 20],
        soil_temp_10: [12, 25], soil_temp_30: [10, 22],
        soil_moisture_10: [20, 80], soil_moisture_30: [25, 75],
        leaf_wetness: [0, 60], solar_radiation: [0, 1000], par: [0, 1800],
        uv_index: [0, 10], dew_point: [5, 22],
        no2: [0, 40], no: [0, 20],
        soil_n: [15, 40], soil_p: [10, 30], soil_k: [80, 200], ph: [5.5, 7.5]
      };
      const r = ranges[sensor];
      if (r) m[sensor] = +(r[0] + Math.random() * (r[1] - r[0])).toFixed(2);
    });
    s.latest = m;
    s.last_seen = m.timestamp;
    s.status = 'online';
    s.battery_pct = 70 + Math.round(Math.random() * 30);
    s.signal = 'good';
    if (!s.history) s.history = [];
    s.history.push(m);
    if (s.history.length > 1000) s.history = s.history.slice(-1000);
  });
  saveData();
  renderStations();
  toast(`✅ Сгенерированы данные для ${data.stations.length} станций (демо)`, 'success');
}
