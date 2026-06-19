// ============================================================================
// MAPS-YANDEX module — Интеграция с Yandex Maps API
// ============================================================================

// Дефолтный ключ (можно переопределить в Настройках)
const YANDEX_MAPS_DEFAULT_KEY = 'b5f201e4-d953-41be-b109-15a60d40836c';

// Хранилище инстансов карт по plotId
const yandexMaps = {};
let yandexApiLoaded = false;
let yandexApiLoading = null;

// =========== ЗАГРУЗКА API ===========
function getYandexApiKey() {
  return (settings && settings.yandexMapsKey) || YANDEX_MAPS_DEFAULT_KEY;
}

async function loadYandexMapsApi() {
  if (yandexApiLoaded) return true;
  if (yandexApiLoading) return yandexApiLoading;

  yandexApiLoading = new Promise((resolve, reject) => {
    // Если уже подгружен
    if (typeof window.ymaps !== 'undefined') {
      yandexApiLoaded = true;
      resolve(true);
      return;
    }

    const key = getYandexApiKey();
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU&load=Map,Placemark,Polygon,GeoObjectCollection,control.TypeSelector,control.ZoomControl,control.FullscreenControl,control.GeolocationControl,control.SearchControl`;
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => {
        yandexApiLoaded = true;
        console.log('[Dionis] Yandex Maps API загружен');
        resolve(true);
      });
    };
    script.onerror = () => {
      console.error('[Dionis] Не удалось загрузить Yandex Maps API');
      yandexApiLoading = null;
      reject(new Error('Yandex Maps load failed'));
    };
    document.head.appendChild(script);

    // Таймаут 10 сек
    setTimeout(() => {
      if (!yandexApiLoaded) {
        yandexApiLoading = null;
        reject(new Error('Yandex Maps load timeout'));
      }
    }, 10000);
  });

  return yandexApiLoading;
}

// =========== ИНИЦИАЛИЗАЦИЯ КАРТЫ УЧАСТКА ===========
async function initYandexMap(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  const containerId = 'plot-map-' + plotId;
  const container = document.getElementById(containerId);
  if (!container) return;

  // Показать индикатор загрузки
  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; gap:10px;">
      <div class="spinner" style="color:var(--primary); width:24px; height:24px;"></div>
      <p style="color:var(--text-soft); font-size:13px;">Загружаем Яндекс.Карты...</p>
    </div>
  `;

  try {
    await loadYandexMapsApi();
  } catch (e) {
    container.innerHTML = `
      <div class="empty" style="margin:0; padding:30px;">
        ⚠️ Не удалось загрузить Яндекс.Карты<br>
        <small style="color:var(--text-muted);">${escapeHtml(e.message)}</small><br>
        <button class="btn small secondary" onclick="initPlotMap('${plotId}')" style="margin-top:10px;">🔄 Попробовать снова</button>
      </div>
    `;
    return;
  }

  // Очистим предыдущую карту, если была
  if (yandexMaps[plotId]) {
    try { yandexMaps[plotId].destroy(); } catch(e) {}
    delete yandexMaps[plotId];
  }
  container.innerHTML = '';

  const center = plot.center || { lat: 45.0355, lng: 38.9753 };

  const map = new ymaps.Map(containerId, {
    center: [center.lat, center.lng],
    zoom: 17,
    controls: ['zoomControl', 'typeSelector', 'fullscreenControl', 'geolocationControl', 'searchControl']
  }, {
    suppressMapOpenBlock: true
  });

  // Выбор типа карты по умолчанию из настроек
  const provider = settings?.locale?.mapProvider || 'osm';
  if (provider === 'yandex_sat') map.setType('yandex#satellite');
  else if (provider === 'yandex_hybrid') map.setType('yandex#hybrid');
  else map.setType('yandex#map');

  // Полигон участка
  if (plot.polygon && plot.polygon.length) {
    const poly = new ymaps.Polygon([
      plot.polygon.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat || p[0], p.lng || p[1]])
    ], {
      hintContent: plot.name,
      balloonContent: `<b>${plot.name}</b><br>${(plot.area_ha || 0).toFixed(2)} га<br>${(plot.blocks || []).length} блоков`
    }, {
      fillColor: '#a3c08f',
      fillOpacity: 0.3,
      strokeColor: '#6b8e5a',
      strokeWidth: 3,
      opacity: 0.85
    });
    map.geoObjects.add(poly);
  }

  // Кусты с GPS
  const seedlings = getPlotSeedlings(plotId).filter(s => s.gps);
  if (seedlings.length) {
    const collection = new ymaps.GeoObjectCollection();
    seedlings.forEach(s => {
      const info = VINE_STATUS[s.status] || VINE_STATUS.normal;
      const block = plot.blocks?.find(b => b.id === s.block_id);
      const placemark = new ymaps.Placemark(
        [s.gps.lat, s.gps.lng],
        {
          hintContent: `Р${s.row}/${s.position} · ${info.label}`,
          balloonContent: `
            <div style="font-family:Inter,sans-serif; font-size:13px; min-width:180px;">
              <b style="font-size:14px;">Куст Р${s.row}, поз. ${s.position}</b><br>
              ${block ? '<span style="color:#6b8e5a;">' + escapeHtml(block.scion || block.name) + '</span><br>' : ''}
              <span style="display:inline-block; width:10px; height:10px; background:${info.color}; border-radius:50%; vertical-align:middle; margin-right:4px;"></span>
              ${info.label}
              ${s.ai_data ? '<br><small>🤖 H: ' + (s.ai_data.height_cm || '—') + 'см, побегов: ' + (s.ai_data.shoots_count || '—') + '</small>' : ''}
              <br><a href="javascript:openSeedlingModal('${s.id}')" style="color:#6b8e5a; font-weight:600;">Открыть карточку →</a>
            </div>
          `
        },
        {
          preset: 'islands#circleDotIcon',
          iconColor: info.color
        }
      );
      placemark.events.add('click', () => {
        // Не открываем сразу карточку, balloon позволит выбрать
      });
      collection.add(placemark);
    });
    map.geoObjects.add(collection);
  }

  // Авто-фит, если есть полигон
  if (plot.polygon && plot.polygon.length) {
    try {
      const bounds = plot.polygon.reduce((acc, p) => {
        const lat = Array.isArray(p) ? p[0] : (p.lat || p[0]);
        const lng = Array.isArray(p) ? p[1] : (p.lng || p[1]);
        return {
          minLat: Math.min(acc.minLat, lat), maxLat: Math.max(acc.maxLat, lat),
          minLng: Math.min(acc.minLng, lng), maxLng: Math.max(acc.maxLng, lng)
        };
      }, { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 });
      map.setBounds([[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]], {
        checkZoomRange: true, zoomMargin: 30
      });
    } catch(e) { console.warn('Bounds error:', e); }
  }

  yandexMaps[plotId] = map;
  console.log(`[Dionis] Яндекс.Карта для участка ${plot.name} готова`);
}

function centerYandexMapOnPlot(plotId) {
  const m = yandexMaps[plotId];
  const plot = data.plots.find(p => p.id === plotId);
  if (!m || !plot || !plot.center) return;
  m.setCenter([plot.center.lat, plot.center.lng], 17);
}

// =========== ЕДИНАЯ ТОЧКА ВХОДА ===========
// Эта функция выбирает провайдера и инициализирует карту
function initPlotMap(plotId) {
  const provider = settings?.locale?.mapProvider || 'yandex';
  if (provider === 'yandex' || provider === 'yandex_sat' || provider === 'yandex_hybrid') {
    initYandexMap(plotId);
  } else {
    // fallback на Leaflet (для OSM, 2GIS, Esri)
    if (typeof initLeafletMap === 'function') initLeafletMap(plotId);
  }
}

function centerMapOnPlot(plotId) {
  const provider = settings?.locale?.mapProvider || 'yandex';
  if ((provider.startsWith('yandex')) && yandexMaps[plotId]) {
    centerYandexMapOnPlot(plotId);
  } else if (typeof leafletMaps !== 'undefined' && leafletMaps[plotId]) {
    const m = leafletMaps[plotId];
    const plot = data.plots.find(p => p.id === plotId);
    if (m && plot && plot.center) m.setView([plot.center.lat, plot.center.lng], 17);
  }
}
