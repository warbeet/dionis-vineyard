// ============================================================================
// MAP-DRAWING module — Универсальное рисование рядов и маршрутов
// Работает и с Leaflet (Google/OSM/2GIS) и с Yandex Maps API
// ============================================================================

let _drawState = {
  active: false,
  plotId: null,
  startPoint: null,
  markers: [],       // массив layer'ов (для удаления)
  clickHandler: null
};

// =========== ОПРЕДЕЛЕНИЕ ТИПА КАРТЫ ===========
function getMapInstance(plotId) {
  // Сначала проверяем Yandex
  if (typeof yandexMaps !== 'undefined' && yandexMaps[plotId]) {
    return { type: 'yandex', map: yandexMaps[plotId] };
  }
  // Потом Leaflet
  if (typeof leafletMaps !== 'undefined' && leafletMaps[plotId]) {
    return { type: 'leaflet', map: leafletMaps[plotId] };
  }
  return null;
}

// =========== ВКЛЮЧЕНИЕ/ВЫКЛЮЧЕНИЕ РЕЖИМА РИСОВАНИЯ ===========
function toggleRowDrawingMode(plotId) {
  if (_drawState.active && _drawState.plotId === plotId) {
    stopRowDrawing();
    return;
  }
  startRowDrawing(plotId);
}

function startRowDrawing(plotId) {
  const inst = getMapInstance(plotId);
  if (!inst) {
    toast('❌ Карта ещё не загружена. Подождите...', 'error');
    return;
  }

  // Если уже был активен — остановить
  if (_drawState.active) stopRowDrawing();

  _drawState.active = true;
  _drawState.plotId = plotId;
  _drawState.startPoint = null;
  _drawState.markers = [];

  if (inst.type === 'yandex') {
    _drawState.clickHandler = function(e) {
      const coords = e.get('coords');
      handleDrawClick(plotId, coords[0], coords[1], 'yandex');
    };
    inst.map.events.add('click', _drawState.clickHandler);
    // Курсор для подсказки
    try { inst.map.cursors.push('crosshair'); } catch(e) {}
  } else if (inst.type === 'leaflet') {
    _drawState.clickHandler = function(e) {
      handleDrawClick(plotId, e.latlng.lat, e.latlng.lng, 'leaflet');
    };
    inst.map.on('click', _drawState.clickHandler);
    // Курсор
    inst.map.getContainer().style.cursor = 'crosshair';
  }

  // Обновим кнопку
  const btn = document.getElementById('draw-rows-btn');
  if (btn) {
    btn.textContent = '🛑 Стоп рисование';
    btn.classList.add('danger');
  }

  toast('✏️ Кликните 2 точки на карте: начало и конец ряда', 'success');
}

function stopRowDrawing() {
  if (!_drawState.active) return;
  const inst = getMapInstance(_drawState.plotId);
  if (inst && _drawState.clickHandler) {
    if (inst.type === 'yandex') {
      inst.map.events.remove('click', _drawState.clickHandler);
      try { inst.map.cursors.pop(); } catch(e) {}
    } else if (inst.type === 'leaflet') {
      inst.map.off('click', _drawState.clickHandler);
      inst.map.getContainer().style.cursor = '';
    }
  }
  _drawState.active = false;
  _drawState.startPoint = null;
  _drawState.clickHandler = null;
  // Кнопка
  const btn = document.getElementById('draw-rows-btn');
  if (btn) {
    btn.textContent = '✏️ Рисовать ряды';
    btn.classList.remove('danger');
  }
  toast('Режим рисования выключен', 'info');
}

// =========== ОБРАБОТЧИК КЛИКА (универсальный) ===========
function handleDrawClick(plotId, lat, lng, mapType) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  const inst = getMapInstance(plotId);
  if (!inst) return;

  if (!_drawState.startPoint) {
    // ПЕРВЫЙ КЛИК — точка А
    _drawState.startPoint = { lat, lng };
    const marker = addMarker(inst, lat, lng, 'A', '#4CAF50');
    _drawState.markers.push(marker);
    toast('📍 Точка A. Кликните вторую точку (B)', 'info');
  } else {
    // ВТОРОЙ КЛИК — точка B
    const a = _drawState.startPoint;
    const b = { lat, lng };

    // Длина в метрах
    const latDiff = (b.lat - a.lat) * 111320;
    const lngDiff = (b.lng - a.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);
    const lengthM = Math.sqrt(latDiff*latDiff + lngDiff*lngDiff);

    const vineSpacing = plot.agronomy?.vine_spacing_m ?? plot.vine_spacing_m ?? 1.0;
    const positions = Math.max(2, Math.round(lengthM / vineSpacing));

    // Создаём ряд
    if (!plot.rows) plot.rows = [];
    if (typeof migratePlotGeometry === 'function') migratePlotGeometry(plot);

    const naming = plot.row_naming || 'numbers';
    const rowIdx = plot.rows.length + 1;
    const newRow = {
      id: 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      number: typeof formatRowNumber === 'function' ? formatRowNumber(rowIdx, naming) : rowIdx,
      positions_count: positions,
      start_position: 1,
      offset: 0,
      direction: 'forward',
      start_gps: a,
      end_gps: b,
      length_m: +lengthM.toFixed(1),
      gaps: [],
      cascades: []
    };
    plot.rows.push(newRow);

    // Если это первый ряд — установим anchor_point участка как точка A
    if (plot.rows.length === 1) {
      if (!plot.geometry) plot.geometry = {};
      plot.geometry.anchor_point = a;
      // Рассчитаем азимут участка (направление ряда)
      const dx = lngDiff, dy = latDiff;
      let azimuth = Math.atan2(dx, dy) * 180 / Math.PI;
      if (azimuth < 0) azimuth += 360;
      plot.geometry.azimuth_deg = +azimuth.toFixed(0);
      plot.geometry.orientation = 'custom';
    }

    saveData();

    // Рисуем линию + конечную точку
    const line = addLine(inst, a, b, `Ряд ${newRow.number}: ${positions} саженцев, ${lengthM.toFixed(1)} м`);
    const endMark = addMarker(inst, b.lat, b.lng, 'B', '#E67E22');
    _drawState.markers.push(line, endMark);

    toast(`✅ Ряд ${newRow.number}: ${positions} саженцев, ${lengthM.toFixed(1)} м`, 'success');
    _drawState.startPoint = null;
  }
}

// =========== УНИВЕРСАЛЬНЫЕ РИСОВАЛКИ ===========
function addMarker(inst, lat, lng, caption, color) {
  if (inst.type === 'yandex' && typeof ymaps !== 'undefined') {
    const preset = caption === 'A' ? 'islands#greenDotIconWithCaption' : 'islands#redDotIconWithCaption';
    const pm = new ymaps.Placemark([lat, lng], { iconCaption: caption }, { preset });
    inst.map.geoObjects.add(pm);
    return pm;
  } else if (inst.type === 'leaflet' && typeof L !== 'undefined') {
    const icon = L.divIcon({
      className: 'draw-marker',
      html: `<div style="background:${color}; color:white; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; box-shadow:0 2px 6px rgba(0,0,0,0.3); border:2px solid white;">${caption}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    const m = L.marker([lat, lng], { icon }).addTo(inst.map);
    return m;
  }
  return null;
}

function addLine(inst, a, b, hintText) {
  if (inst.type === 'yandex' && typeof ymaps !== 'undefined') {
    const line = new ymaps.Polyline([[a.lat, a.lng], [b.lat, b.lng]], {
      hintContent: hintText
    }, {
      strokeColor: '#6b8e5a', strokeWidth: 4, opacity: 0.85
    });
    inst.map.geoObjects.add(line);
    return line;
  } else if (inst.type === 'leaflet' && typeof L !== 'undefined') {
    const line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
      color: '#6b8e5a', weight: 4, opacity: 0.85
    }).bindTooltip(hintText).addTo(inst.map);
    return line;
  }
  return null;
}

// =========== УДАЛЕНИЕ ВСЕХ НАРИСОВАННЫХ ОБЪЕКТОВ ===========
function clearDrawnRows(plotId) {
  const inst = getMapInstance(plotId);
  if (!inst) return;
  _drawState.markers.forEach(m => {
    if (!m) return;
    try {
      if (inst.type === 'yandex') inst.map.geoObjects.remove(m);
      else if (inst.type === 'leaflet') inst.map.removeLayer(m);
    } catch(e) {}
  });
  _drawState.markers = [];
  _drawState.startPoint = null;
}

// =========== УНИВЕРСАЛЬНЫЙ МАРШРУТ РОБОТА ===========
function showRobotRoute(plotId) {
  const route = generateRobotRoute(plotId);
  if (!route || !route.points.length) {
    toast('Нет кустов с GPS. Сначала: Меню → 🎯 Авто-расчёт GPS кустов', 'error');
    return;
  }
  const inst = getMapInstance(plotId);
  if (!inst) {
    toast('Карта не загружена', 'error');
    return;
  }

  // Удалим предыдущий маршрут
  if (window._robotRouteLayer) {
    try {
      if (inst.type === 'yandex') inst.map.geoObjects.remove(window._robotRouteLayer);
      else if (inst.type === 'leaflet') inst.map.removeLayer(window._robotRouteLayer);
    } catch(e) {}
    window._robotRouteLayer = null;
  }

  const coords = route.points.map(p => [p.gps.lat, p.gps.lng]);
  let line;
  if (inst.type === 'yandex' && typeof ymaps !== 'undefined') {
    line = new ymaps.Polyline(coords, {
      hintContent: `Маршрут робота: ${route.total_length_m} м, ~${route.estimated_time_min} мин`
    }, {
      strokeColor: '#d4936b', strokeWidth: 3, strokeStyle: 'dash', opacity: 0.85
    });
    inst.map.geoObjects.add(line);
  } else if (inst.type === 'leaflet' && typeof L !== 'undefined') {
    line = L.polyline(coords, {
      color: '#d4936b', weight: 3, opacity: 0.85, dashArray: '8 4'
    }).bindTooltip(`Маршрут робота: ${route.total_length_m} м, ~${route.estimated_time_min} мин`)
      .addTo(inst.map);
  }
  window._robotRouteLayer = line;

  toast(`🤖 Маршрут: ${route.total_points} точек, ${route.total_length_m} м, ~${route.estimated_time_min} мин`, 'success');
}
