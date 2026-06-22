// ============================================================================
// WEATHER module — Погода, прогноз, метеостанции, источники данных
// ============================================================================

// =========== ИСТОЧНИКИ ПОГОДЫ ===========
const WEATHER_SOURCES = {
  openmeteo: { id: 'openmeteo', name: 'Open-Meteo', icon: '🌤', free: true, needsKey: false },
  yandex:    { id: 'yandex', name: 'Яндекс Погода', icon: '🟡', free: false, needsKey: true },
  station:   { id: 'station', name: 'Метеостанция', icon: '📡', free: true, needsKey: false }
};

function saveLocation() {
  if (!requirePermission('weather.edit', 'Нет прав на настройки погоды')) return;
  data.location = {
    lat: parseFloat(document.getElementById('loc-lat').value),
    lon: parseFloat(document.getElementById('loc-lon').value),
    name: document.getElementById('loc-name').value.trim()
  };
  saveData();
  toast('✅ Координаты сохранены', 'success');
  fetchWeather();
}

function useGeoLocation() {
  if (!navigator.geolocation) { toast('Геолокация не поддерживается', 'error'); return; }
  toast('Определяем местоположение...');
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('loc-lat').value = pos.coords.latitude.toFixed(4);
    document.getElementById('loc-lon').value = pos.coords.longitude.toFixed(4);
    toast('✅ Координаты определены', 'success');
  }, err => toast('Ошибка геолокации: ' + err.message, 'error'));
}

// =========== OPEN-METEO PRO (расширенные параметры) ===========
async function fetchWeather() {
  if (!data.location || !data.location.lat || !data.location.lon) {
    toast('Сначала укажите координаты', 'error'); return;
  }
  toast('Загружаем прогноз Open-Meteo...');
  try {
    // Расширенный набор параметров для агро
    const params = new URLSearchParams({
      latitude: data.location.lat,
      longitude: data.location.lon,
      daily: [
        'weather_code',
        'temperature_2m_max', 'temperature_2m_min',
        'apparent_temperature_max', 'apparent_temperature_min',
        'precipitation_sum', 'rain_sum', 'showers_sum',
        'precipitation_hours', 'precipitation_probability_max',
        'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
        'relative_humidity_2m_mean',
        'uv_index_max',
        'sunrise', 'sunset', 'daylight_duration', 'sunshine_duration',
        'shortwave_radiation_sum', 'et0_fao_evapotranspiration'
      ].join(','),
      current: [
        'temperature_2m', 'apparent_temperature',
        'relative_humidity_2m', 'precipitation', 'rain',
        'weather_code', 'cloud_cover', 'pressure_msl', 'surface_pressure',
        'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
        'is_day'
      ].join(','),
      hourly: [
        'temperature_2m', 'relative_humidity_2m', 'precipitation_probability',
        'precipitation', 'soil_temperature_0cm', 'soil_temperature_6cm',
        'soil_moisture_0_to_1cm', 'soil_moisture_1_to_3cm'
      ].join(','),
      timezone: 'auto',
      forecast_days: 7,
      past_days: 1
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const r = await fetch(url);
    const json = await r.json();

    data.forecast = (json.daily.time || []).map((date, i) => ({
      date,
      tmin: json.daily.temperature_2m_min[i],
      tmax: json.daily.temperature_2m_max[i],
      apparent_min: json.daily.apparent_temperature_min[i],
      apparent_max: json.daily.apparent_temperature_max[i],
      rain: json.daily.precipitation_sum[i],
      rain_probability: json.daily.precipitation_probability_max[i],
      precipitation_hours: json.daily.precipitation_hours[i],
      wind: json.daily.wind_speed_10m_max[i],
      wind_gusts: json.daily.wind_gusts_10m_max[i],
      wind_direction: json.daily.wind_direction_10m_dominant[i],
      hum: json.daily.relative_humidity_2m_mean[i],
      uv: json.daily.uv_index_max[i],
      sunrise: json.daily.sunrise[i],
      sunset: json.daily.sunset[i],
      daylight_h: json.daily.daylight_duration[i] / 3600,
      sunshine_h: json.daily.sunshine_duration[i] / 3600,
      radiation: json.daily.shortwave_radiation_sum[i],
      et0: json.daily.et0_fao_evapotranspiration[i],
      code: json.daily.weather_code[i],
      source: 'openmeteo'
    }));

    data.currentWeather = {
      ...json.current,
      source: 'openmeteo',
      updated_at: new Date().toISOString()
    };

    // Усреднение почвенной влажности из часовых
    if (json.hourly && json.hourly.soil_moisture_0_to_1cm) {
      const sm = json.hourly.soil_moisture_0_to_1cm.filter(v => v != null).slice(0, 24);
      if (sm.length) {
        data.currentWeather.soil_moisture_avg = sm.reduce((a, b) => a + b, 0) / sm.length;
      }
      const st = json.hourly.soil_temperature_0cm.filter(v => v != null).slice(0, 24);
      if (st.length) {
        data.currentWeather.soil_temp_avg = st.reduce((a, b) => a + b, 0) / st.length;
      }
    }

    saveData();
    renderForecast();
    renderTodayWeather();
    toast('✅ Прогноз загружен (Open-Meteo Pro)', 'success');
  } catch(e) { toast('Ошибка загрузки погоды: ' + e.message, 'error'); }
}

// =========== ЯНДЕКС ПОГОДА (заглушка для будущего) ===========
async function fetchYandexWeather() {
  if (!settings.yandexWeatherKey) {
    toast('Не настроен ключ Яндекс Погоды. Откройте Настройки', 'warning');
    return;
  }
  // TODO: после получения ключа Яндекса
  // const url = `https://api.weather.yandex.ru/v2/forecast?lat=${data.location.lat}&lon=${data.location.lon}&extra=true`;
  // const r = await fetch(url, { headers: { 'X-Yandex-Weather-Key': settings.yandexWeatherKey } });
  toast('Яндекс Погода: API будет подключен после получения ключа', 'info');
}

function weatherIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫';
  if (code <= 67) return '🌧';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧';
  if (code <= 86) return '🌨';
  if (code <= 99) return '⛈';
  return '🌤';
}

function windDirection(deg) {
  if (deg == null) return '';
  const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  return dirs[Math.round(deg / 45) % 8];
}

function renderForecast() {
  const div = document.getElementById('weather-forecast');
  const alerts = document.getElementById('weather-alerts');
  if (!div) return;
  if (!data.forecast || !data.forecast.length) {
    div.innerHTML = '<p style="color:var(--text-soft); font-size:13px; padding:14px;">Нет данных. Нажмите «Загрузить погоду».</p>';
    if (alerts) alerts.innerHTML = '';
    return;
  }
  div.innerHTML = data.forecast.map(d => {
    const isWarn = d.tmin < 2 || d.tmax > 35 || d.rain > 20 || (d.wind_gusts || d.wind) > 50;
    return `<div class="forecast-day ${isWarn ? 'warning' : ''}" title="${d.date}">
      <div class="date">${formatDateShort(d.date)}</div>
      <div class="weather-icon-big">${weatherIcon(d.code)}</div>
      <div class="temp">${Math.round(d.tmax)}° / ${Math.round(d.tmin)}°</div>
      <div class="meta">💧 ${d.rain.toFixed(1)} мм${d.rain_probability ? ' (' + d.rain_probability + '%)' : ''}</div>
      <div class="meta">🌬 ${Math.round(d.wind)} км/ч ${windDirection(d.wind_direction)}</div>
      ${d.uv ? `<div class="meta">☀ UV ${Math.round(d.uv)}</div>` : ''}
      ${d.et0 ? `<div class="meta">🌱 ET₀ ${d.et0.toFixed(1)} мм</div>` : ''}
    </div>`;
  }).join('');

  if (!alerts) return;
  const warnings = [];
  data.forecast.forEach(d => {
    if (d.tmin < 0) warnings.push(`🥶 Заморозок ${d.date}: ${d.tmin.toFixed(1)}°C`);
    else if (d.tmin < 2) warnings.push(`❄️ Низкая температура ${d.date}: ${d.tmin.toFixed(1)}°C`);
    if (d.tmax > 35) warnings.push(`🔥 Жара ${d.date}: ${d.tmax.toFixed(1)}°C`);
    if (d.rain > 20) warnings.push(`🌧 Сильный дождь ${d.date}: ${d.rain.toFixed(1)} мм — риск грибковых`);
    if ((d.wind_gusts || d.wind) > 50) warnings.push(`💨 Сильный ветер ${d.date}: ${(d.wind_gusts || d.wind).toFixed(0)} км/ч`);
  });
  if (warnings.length) {
    alerts.innerHTML = '<div class="alert warning">' + warnings.map(w => '<div>' + w + '</div>').join('') + '</div>';
  } else {
    alerts.innerHTML = '<div class="alert success">✅ Критичных погодных рисков на ближайшие 7 дней не обнаружено.</div>';
  }
}

function renderTodayWeather() {
  const div = document.getElementById('today-weather');
  if (!div) return;
  if (!data.currentWeather) {
    div.innerHTML = '<p style="color:var(--text-soft); font-size:13px;">Не загружено.</p>';
    return;
  }
  const w = data.currentWeather;
  div.innerHTML = `
    <div class="big-icon">${weatherIcon(w.weather_code)}</div>
    <div>
      <div style="font-size:28px; font-weight:700; color:var(--text);">${Math.round(w.temperature_2m)}°C</div>
      <div style="font-size:12px; color:var(--text-soft);">
        ощущается ${Math.round(w.apparent_temperature)}° ·
        💧 ${w.relative_humidity_2m}% ·
        🌬 ${Math.round(w.wind_speed_10m)} км/ч ${windDirection(w.wind_direction_10m)}
        ${w.precipitation > 0 ? '· 🌧 ' + w.precipitation + ' мм' : ''}
      </div>
      ${w.soil_temp_avg != null ? `<div style="font-size:11px; color:var(--text-muted); margin-top:3px;">🌱 Почва: ${w.soil_temp_avg.toFixed(1)}°C${w.soil_moisture_avg != null ? ', влажность ' + (w.soil_moisture_avg*100).toFixed(0) + '%' : ''}</div>` : ''}
      <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${escapeHtml(data.location.name || `${data.location.lat}, ${data.location.lon}`)}</div>
    </div>
  `;
}

// =========== РУЧНОЙ ВВОД ПОГОДЫ ===========
function saveWeather() {
  if (!requirePermission('weather.edit', 'Нет прав на метеожурнал')) return;
  const entry = {
    id: 'w_' + Date.now(),
    date: document.getElementById('w-date').value,
    tmin: parseFloat(document.getElementById('w-tmin').value),
    tmax: parseFloat(document.getElementById('w-tmax').value),
    rain: parseFloat(document.getElementById('w-rain').value) || 0,
    hum: parseInt(document.getElementById('w-hum').value),
    note: document.getElementById('w-note').value.trim()
  };
  if (!entry.date) { toast('Укажите дату', 'error'); return; }
  data.weather.push(entry);
  data.weather.sort((a, b) => b.date.localeCompare(a.date));
  saveData();
  ['w-date','w-tmin','w-tmax','w-rain','w-hum','w-note'].forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });
  renderAll();
}

function renderWeatherList() {
  const list = document.getElementById('weather-list');
  if (!list) return;
  if (!data.weather.length) { list.innerHTML = '<div class="empty" style="margin:0;">Нет данных.</div>'; return; }
  list.innerHTML = `
    <table>
      <thead><tr><th>Дата</th><th>T мин</th><th>T макс</th><th>Осадки</th><th>Влажн.</th><th>Заметка</th></tr></thead>
      <tbody>
        ${data.weather.slice(0, 30).map(w => `<tr>
          <td>${w.date}</td><td>${w.tmin ?? '—'}°</td><td>${w.tmax ?? '—'}°</td>
          <td>${w.rain ? w.rain + ' мм' : '—'}</td><td>${w.hum ?? '—'}%</td>
          <td>${escapeHtml(w.note || '')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

// =========== ФЕНОФАЗЫ ===========
function renderPhenoStages() {
  const cont = document.getElementById('pheno-stages');
  if (!cont) return;
  cont.innerHTML = PHENO_STAGES.map(s =>
    `<span class="pheno-stage ${data.currentPheno === s.id ? 'active' : ''}" onclick="selectPheno('${s.id}')">${s.name}</span>`
  ).join('');
}

function selectPheno(id) { data.currentPheno = id; renderPhenoStages(); }
function savePheno() {
  if (!requirePermission('weather.edit', 'Нет прав на фенофазы')) return;
  data.phenoDate = document.getElementById('pheno-date').value || todayStr();
  saveData();
  renderAll();
  toast('✅ Фенофаза сохранена', 'success');
}

function calcGDD() {
  if (!data.weather.length && !data.forecast.length) return 0;
  const year = new Date().getFullYear();
  let sum = 0;
  data.weather.filter(w => w.date.startsWith(year)).forEach(w => {
    if (w.tmin != null && w.tmax != null) sum += Math.max(0, (w.tmin + w.tmax)/2 - 10);
  });
  return sum;
}
