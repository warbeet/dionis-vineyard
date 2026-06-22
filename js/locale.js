// ============================================================================
// LOCALE module — Локализация RU, регионы, валюты, форматирование
// ============================================================================

// Регионы виноделия РФ (по умолчанию — Краснодарский край)
const REGIONS = [
  { id: 'krasnodar',   name: 'Краснодарский край',  lat: 45.0355, lng: 38.9753, locality: 'Краснодар' },
  { id: 'crimea',      name: 'Крым (Ялта)',         lat: 44.4952, lng: 34.1664, locality: 'Ялта' },
  { id: 'crimea_sev',  name: 'Крым (Севастополь)',  lat: 44.6166, lng: 33.5254, locality: 'Севастополь' },
  { id: 'rostov',      name: 'Ростовская область',  lat: 47.2225, lng: 39.7187, locality: 'Ростов-на-Дону' },
  { id: 'stavropol',   name: 'Ставропольский край', lat: 45.0428, lng: 41.9734, locality: 'Ставрополь' },
  { id: 'dagestan',    name: 'Дагестан (Дербент)',  lat: 42.0586, lng: 48.2980, locality: 'Дербент' },
  { id: 'kbr',         name: 'Кабардино-Балкария',  lat: 43.4845, lng: 43.6071, locality: 'Нальчик' },
  { id: 'volgograd',   name: 'Волгоградская обл.',  lat: 48.7080, lng: 44.5133, locality: 'Волгоград' },
  { id: 'astrakhan',   name: 'Астраханская обл.',   lat: 46.3497, lng: 48.0408, locality: 'Астрахань' },
  { id: 'voronezh',    name: 'Воронежская обл.',    lat: 51.6720, lng: 39.1843, locality: 'Воронеж' },
  { id: 'belgorod',    name: 'Белгородская обл.',   lat: 50.5950, lng: 36.5873, locality: 'Белгород' },
  { id: 'kaliningrad', name: 'Калининградская обл.',lat: 54.7104, lng: 20.4522, locality: 'Калининград' },
  { id: 'sevastopol_v',name: 'Севастополь · долина', lat: 44.6700, lng: 33.7300, locality: 'Балаклавская долина' },
  { id: 'custom',      name: 'Другой регион',       lat: null,     lng: null,    locality: '' }
];

// Список валют
const CURRENCIES = [
  { id: 'RUB', symbol: '₽', name: 'Российский рубль' },
  { id: 'USD', symbol: '$', name: 'Доллар США' },
  { id: 'EUR', symbol: '€', name: 'Евро' },
  { id: 'CNY', symbol: '¥', name: 'Юань' },
  { id: 'BYN', symbol: 'Br', name: 'Белорусский рубль' },
  { id: 'KZT', symbol: '₸', name: 'Казахстанский тенге' }
];

// Единицы измерения
const UNIT_SYSTEMS = {
  metric: { area: 'га', length: 'м', weight: 'кг', temp: '°C', volume: 'л' },
  imperial: { area: 'акр', length: 'фт', weight: 'фунт', temp: '°F', volume: 'гал' }
};

// =========== ТЕКУЩАЯ ЛОКАЛЬ ===========
function getLocale() {
  if (!settings.locale) {
    settings.locale = {
      lang: 'ru',
      country: 'RU',
      timezone: 'Europe/Moscow',
      currency: 'RUB',
      region: 'krasnodar',
      units: 'metric',
      dateFormat: 'DD.MM.YYYY',
      mapProvider: 'yandex'
    };
    saveSettingsLocal();
  }
  return settings.locale;
}

function getCurrencySymbol() {
  const c = CURRENCIES.find(x => x.id === getLocale().currency);
  return c ? c.symbol : '₽';
}

function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return '—';
  const sym = getCurrencySymbol();
  try {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount) + ' ' + sym;
  } catch (e) {
    return amount.toFixed(2) + ' ' + sym;
  }
}

function formatDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const tz = getLocale().timezone || 'Europe/Moscow';
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(dt);
  } catch(e) {
    return d;
  }
}

function formatDateTime(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const tz = getLocale().timezone || 'Europe/Moscow';
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(dt);
  } catch(e) {
    return d;
  }
}

// =========== ПРИМЕНЕНИЕ РЕГИОНА ===========
function applyRegion(regionId) {
  const r = REGIONS.find(x => x.id === regionId);
  if (!r) return;
  settings.locale = settings.locale || {};
  settings.locale.region = regionId;
  if (r.lat != null && r.lng != null) {
    // Если у пользователя ещё нет своих координат — применяем регион
    if (!data.location || !data.location.lat) {
      data.location = { lat: r.lat, lon: r.lng, name: r.name + ', ' + r.locality };
      saveData();
    }
  }
  saveSettingsLocal();
}

// =========== СОХРАНЕНИЕ ===========
function saveLocale() {
  if (!requirePermission('settings.edit', 'Нет прав на изменение локализации')) return;
  settings.locale = settings.locale || {};
  settings.locale.region = document.getElementById('loc-region')?.value || 'krasnodar';
  settings.locale.currency = document.getElementById('loc-currency')?.value || 'RUB';
  settings.locale.timezone = document.getElementById('loc-timezone')?.value || 'Europe/Moscow';
  settings.locale.units = document.getElementById('loc-units')?.value || 'metric';
  settings.locale.mapProvider = document.getElementById('loc-map-provider')?.value || 'yandex';
  const yKey = document.getElementById('loc-yandex-key')?.value?.trim();
  if (yKey) settings.yandexMapsKey = yKey;
  else delete settings.yandexMapsKey;
  // Применяем регион если выбран не custom
  if (settings.locale.region && settings.locale.region !== 'custom') {
    applyRegion(settings.locale.region);
  }
  saveSettingsLocal();
  toast('✅ Локализация сохранена', 'success');
}

// =========== РЕНДЕР НАСТРОЕК ===========
function renderLocaleSettings() {
  const cont = document.getElementById('locale-settings');
  if (!cont) return;
  const cur = getLocale();
  cont.innerHTML = `
    <div class="form-grid">
      <div class="form-row">
        <label>🇷🇺 Регион виноградника</label>
        <select id="loc-region">
          ${REGIONS.map(r => `<option value="${r.id}" ${cur.region === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>💰 Валюта</label>
        <select id="loc-currency">
          ${CURRENCIES.map(c => `<option value="${c.id}" ${cur.currency === c.id ? 'selected' : ''}>${c.symbol} ${c.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-row">
        <label>🕐 Часовой пояс</label>
        <select id="loc-timezone">
          <option value="Europe/Kaliningrad" ${cur.timezone === 'Europe/Kaliningrad' ? 'selected' : ''}>МСК−1 (Калининград)</option>
          <option value="Europe/Moscow" ${cur.timezone === 'Europe/Moscow' ? 'selected' : ''}>МСК (Москва)</option>
          <option value="Europe/Samara" ${cur.timezone === 'Europe/Samara' ? 'selected' : ''}>МСК+1 (Самара)</option>
          <option value="Asia/Yekaterinburg" ${cur.timezone === 'Asia/Yekaterinburg' ? 'selected' : ''}>МСК+2 (Екатеринбург)</option>
          <option value="Asia/Omsk" ${cur.timezone === 'Asia/Omsk' ? 'selected' : ''}>МСК+3 (Омск)</option>
          <option value="Asia/Krasnoyarsk" ${cur.timezone === 'Asia/Krasnoyarsk' ? 'selected' : ''}>МСК+4 (Красноярск)</option>
          <option value="Asia/Irkutsk" ${cur.timezone === 'Asia/Irkutsk' ? 'selected' : ''}>МСК+5 (Иркутск)</option>
          <option value="Asia/Yakutsk" ${cur.timezone === 'Asia/Yakutsk' ? 'selected' : ''}>МСК+6 (Якутск)</option>
          <option value="Asia/Vladivostok" ${cur.timezone === 'Asia/Vladivostok' ? 'selected' : ''}>МСК+7 (Владивосток)</option>
          <option value="Asia/Magadan" ${cur.timezone === 'Asia/Magadan' ? 'selected' : ''}>МСК+8 (Магадан)</option>
          <option value="Asia/Kamchatka" ${cur.timezone === 'Asia/Kamchatka' ? 'selected' : ''}>МСК+9 (Камчатка)</option>
        </select>
      </div>
      <div class="form-row">
        <label>📐 Единицы измерения</label>
        <select id="loc-units">
          <option value="metric" ${cur.units === 'metric' ? 'selected' : ''}>Метрическая (га, кг, м, °C)</option>
          <option value="imperial" ${cur.units === 'imperial' ? 'selected' : ''}>Имперская (акр, фунт, фт, °F)</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>🗺 Карты</label>
      <select id="loc-map-provider">
        <optgroup label="🌍 Google (рекомендую)">
          <option value="google_sat" ${cur.mapProvider === 'google_sat' ? 'selected' : ''}>🛰 Google Спутник (высокое качество)</option>
          <option value="google_hybrid" ${cur.mapProvider === 'google_hybrid' ? 'selected' : ''}>🗺 Google Гибрид (спутник + надписи)</option>
          <option value="google_map" ${cur.mapProvider === 'google_map' ? 'selected' : ''}>📍 Google Карта</option>
        </optgroup>
        <optgroup label="🇷🇺 Российские">
          <option value="yandex" ${cur.mapProvider === 'yandex' ? 'selected' : ''}>🟡 Яндекс.Карты</option>
          <option value="yandex_sat" ${cur.mapProvider === 'yandex_sat' ? 'selected' : ''}>🛰 Яндекс Спутник</option>
          <option value="yandex_hybrid" ${cur.mapProvider === 'yandex_hybrid' ? 'selected' : ''}>🗺 Яндекс Гибрид</option>
          <option value="2gis" ${cur.mapProvider === '2gis' ? 'selected' : ''}>2ГИС</option>
        </optgroup>
        <optgroup label="🌐 Открытые">
          <option value="osm" ${cur.mapProvider === 'osm' ? 'selected' : ''}>OpenStreetMap</option>
          <option value="esri_sat" ${cur.mapProvider === 'esri_sat' ? 'selected' : ''}>Esri Спутник</option>
        </optgroup>
      </select>
      <p style="font-size:11px; color:var(--text-muted); margin-top:6px;">💡 На карте справа вверху можно переключаться между Картой / Спутником / Гибридом</p>
    </div>

    <div class="form-row">
      <label>🔑 Свой API-ключ Яндекс.Карт (опционально)</label>
      <input type="text" id="loc-yandex-key" placeholder="оставьте пустым для дефолтного"
        value="${escapeHtml(settings.yandexMapsKey || '')}">
      <p style="font-size:11px; color:var(--text-muted); margin-top:6px;">
        💡 По умолчанию используется общий ключ. Для production-нагрузки получите свой: <a href="https://developer.tech.yandex.ru/services/" target="_blank">developer.tech.yandex.ru</a> (бесплатно 25 000 загрузок/день)
      </p>
    </div>

    <button class="btn primary" onclick="saveLocale()">💾 Сохранить локализацию</button>
  `;
}

// При инициализации: если локали нет — устанавливаем RU по умолчанию
(function initLocale() {
  if (!settings.locale) {
    settings.locale = {
      lang: 'ru', country: 'RU', timezone: 'Europe/Moscow',
      currency: 'RUB', region: 'krasnodar', units: 'metric',
      dateFormat: 'DD.MM.YYYY', mapProvider: 'google_sat'
    };
    saveSettingsLocal();
    // Применим регион (поставит координаты Краснодара если их нет)
    applyRegion('krasnodar');
  }
})();
