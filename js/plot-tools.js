// ============================================================================
// PLOT-TOOLS module — GPS-координаты кустов, маршрут робота, шаблоны, 3D-уклон
// ============================================================================

// =========== АВТО-РАСЧЁТ GPS КУСТОВ ===========
//
// На основе anchor_point + azimuth + row_spacing + vine_spacing вычисляем
// точные GPS-координаты каждого куста.

function autoCalcSeedlingGPS(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return { error: 'Участок не найден' };
  if (!plot.geometry?.anchor_point) {
    // Используем center если есть
    if (plot.center) {
      plot.geometry = plot.geometry || {};
      plot.geometry.anchor_point = plot.center;
    } else {
      return { error: 'Нет точки привязки (anchor_point) или center участка. Укажите GPS центра участка.' };
    }
  }

  const anchor = plot.geometry.anchor_point;
  const azimuthDeg = plot.geometry.azimuth_deg ?? 0;
  const azimuthRad = azimuthDeg * Math.PI / 180;
  const rowSpacing = plot.agronomy?.row_spacing_m ?? 2.5;
  const vineSpacing = plot.agronomy?.vine_spacing_m ?? 1.0;

  // Перпендикулярное направление к рядам (для расположения рядов)
  // Вдоль ряда: azimuthRad. Между рядами: azimuthRad + 90°
  const rowDir = { dx: Math.sin(azimuthRad), dy: Math.cos(azimuthRad) };
  const colDir = { dx: Math.sin(azimuthRad + Math.PI/2), dy: Math.cos(azimuthRad + Math.PI/2) };

  // 1 градус широты ≈ 111 320 м
  // 1 градус долготы ≈ 111 320 м × cos(широта)
  const latMetersPerDeg = 111320;
  const lngMetersPerDeg = 111320 * Math.cos(anchor.lat * Math.PI / 180);

  const seedlings = (data.seedlings || []).filter(s => s.plot_id === plotId);
  let updated = 0;

  // Находим индекс ряда (по номеру) — для построения сетки
  const rowsByNumber = {};
  (plot.rows || []).forEach((r, idx) => {
    rowsByNumber[String(r.number)] = idx;
  });

  seedlings.forEach(s => {
    const rowIdx = rowsByNumber[String(s.row)];
    if (rowIdx == null) return;
    // Смещение от anchor
    const rowOffsetM = rowIdx * rowSpacing;        // между рядами
    const posOffsetM = (s.position - 1) * vineSpacing;  // вдоль ряда

    // Координаты в метрах от anchor
    const dxMeters = rowDir.dx * posOffsetM + colDir.dx * rowOffsetM;
    const dyMeters = rowDir.dy * posOffsetM + colDir.dy * rowOffsetM;

    // Перевод в градусы
    const dLat = dyMeters / latMetersPerDeg;
    const dLng = dxMeters / lngMetersPerDeg;

    s.gps = {
      lat: +(anchor.lat + dLat).toFixed(6),
      lng: +(anchor.lng + dLng).toFixed(6)
    };
    updated++;
  });

  saveData();
  return { updated, total: seedlings.length };
}

function applyAutoGPSToPlot(plotId) {
  if (!confirm('Автоматически рассчитать GPS-координаты всех кустов на основе геометрии участка?\n\nИспользуется anchor_point + azimuth + spacing.')) return;
  const result = autoCalcSeedlingGPS(plotId);
  if (result.error) {
    toast('⚠️ ' + result.error, 'error');
    return;
  }
  toast(`✅ Обновлены GPS у ${result.updated}/${result.total} кустов`, 'success');
  // Перерисуем карту
  if (typeof initPlotMap === 'function') {
    setTimeout(() => initPlotMap(plotId), 200);
  }
}

// =========== МАРШРУТ РОБОТА ===========
//
// Зигзаг по межрядьям: едем вдоль ряда 1, разворачиваемся, едем вдоль ряда 2 в обратку, и т.д.

function generateRobotRoute(plotId, options = {}) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return null;
  const seedlings = (data.seedlings || []).filter(s => s.plot_id === plotId && s.gps);
  if (!seedlings.length) return null;

  // Группируем по рядам
  const byRow = {};
  seedlings.forEach(s => {
    if (!byRow[s.row]) byRow[s.row] = [];
    byRow[s.row].push(s);
  });

  // Сортируем ряды и саженцы в каждом
  const rowNumbers = Object.keys(byRow).sort((a, b) => {
    // Если ряды числовые
    const aNum = parseInt(a), bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return String(a).localeCompare(String(b));
  });

  // Зигзаг
  const route = [];
  rowNumbers.forEach((rowNum, idx) => {
    const sorted = byRow[rowNum].sort((a, b) => a.position - b.position);
    const direction = idx % 2 === 0 ? 1 : -1;
    if (direction === 1) {
      route.push(...sorted);
    } else {
      route.push(...sorted.reverse());
    }
  });

  // Рассчитаем длину
  let totalLength = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i-1].gps, b = route[i].gps;
    if (!a || !b) continue;
    const latDiff = (b.lat - a.lat) * 111320;
    const lngDiff = (b.lng - a.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);
    totalLength += Math.sqrt(latDiff*latDiff + lngDiff*lngDiff);
  }

  return {
    plot_id: plotId,
    points: route.map(s => ({ id: s.id, row: s.row, position: s.position, gps: s.gps, status: s.status })),
    total_points: route.length,
    total_length_m: +totalLength.toFixed(1),
    estimated_time_min: Math.round(totalLength / 50)  // робот 50 м/мин
  };
}


function exportRouteGPX(plotId) {
  const route = generateRobotRoute(plotId);
  if (!route || !route.points.length) {
    toast('Нет маршрута для экспорта', 'error');
    return;
  }
  const plot = data.plots.find(p => p.id === plotId);
  const now = new Date().toISOString();

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Dionis vineyard" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeHtml(plot.name)} - Маршрут робота</name>
    <time>${now}</time>
    <desc>Зигзаг-обход межрядий. ${route.total_points} точек, ${route.total_length_m} м</desc>
  </metadata>
  <trk>
    <name>${escapeHtml(plot.name)}</name>
    <trkseg>
${route.points.map(p => `      <trkpt lat="${p.gps.lat}" lon="${p.gps.lng}"><name>Р${p.row}/${p.position}</name></trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `route-${plot.name.replace(/\s+/g,'_')}-${todayStr()}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ GPX-файл экспортирован', 'success');
}

// =========== ШАБЛОНЫ УЧАСТКОВ ===========

const PLOT_TEMPLATES = [
  {
    id: 'guyot',
    name: '🍷 Гюйо (классика)',
    description: 'Классическая французская формировка. Для большинства технических сортов.',
    icon: '🍷',
    config: {
      agronomy: {
        row_spacing_m: 2.5,
        vine_spacing_m: 1.0,
        trellis_type: 'vertical',
        trellis_height_m: 1.8,
        support_type: 'concrete',
        irrigation: 'drip'
      }
    }
  },
  {
    id: 'cordon',
    name: '🌿 Кордон (Royat)',
    description: 'Постоянный многолетний рукав с шпорами. Для шампанских сортов.',
    icon: '🌿',
    config: {
      agronomy: {
        row_spacing_m: 2.0,
        vine_spacing_m: 1.0,
        trellis_type: 'vertical',
        trellis_height_m: 1.6,
        support_type: 'concrete',
        irrigation: 'drip'
      }
    }
  },
  {
    id: 'bush',
    name: '🌳 Чаша (Gobelet)',
    description: 'Штамбовая формировка без шпалеры. Для жарких регионов.',
    icon: '🌳',
    config: {
      agronomy: {
        row_spacing_m: 2.0,
        vine_spacing_m: 1.5,
        trellis_type: 'none',
        trellis_height_m: 0,
        support_type: 'none',
        irrigation: 'none'
      }
    }
  },
  {
    id: 'lyre',
    name: '🎭 Лира (Lyre)',
    description: 'V-образная двойная плоскость. Увеличивает урожайность.',
    icon: '🎭',
    config: {
      agronomy: {
        row_spacing_m: 3.0,
        vine_spacing_m: 1.2,
        trellis_type: 'lyre',
        trellis_height_m: 2.0,
        support_type: 'metal',
        irrigation: 'drip'
      }
    }
  },
  {
    id: 'pergola',
    name: '🏛 Пергола / Беседочная',
    description: 'Горизонтальная навесная. Для столовых сортов.',
    icon: '🏛',
    config: {
      agronomy: {
        row_spacing_m: 4.0,
        vine_spacing_m: 3.0,
        trellis_type: 'pergola',
        trellis_height_m: 2.5,
        support_type: 'concrete',
        irrigation: 'drip'
      }
    }
  },
  {
    id: 'young',
    name: '🌱 Молодой сад (1-3 года)',
    description: 'Подходит для нового виноградника. Капельный полив усиленный.',
    icon: '🌱',
    config: {
      agronomy: {
        row_spacing_m: 2.5,
        vine_spacing_m: 1.0,
        trellis_type: 'vertical',
        trellis_height_m: 0.5,
        support_type: 'wood',
        irrigation: 'drip'
      }
    }
  }
];

function applyTemplate(plotId, templateId) {
  const plot = data.plots.find(p => p.id === plotId);
  const tpl = PLOT_TEMPLATES.find(t => t.id === templateId);
  if (!plot || !tpl) return;
  if (!confirm(`Применить шаблон "${tpl.name}"?\n\n${tpl.description}\n\nЭто перезапишет параметры агротехники участка (расстояния, шпалеру, опоры, полив).`)) return;

  plot.agronomy = { ...(plot.agronomy || {}), ...tpl.config.agronomy };
  // Зеркалируем
  plot.row_spacing_m = plot.agronomy.row_spacing_m;
  plot.vine_spacing_m = plot.agronomy.vine_spacing_m;
  saveData();
  toast(`✅ Шаблон "${tpl.name}" применён`, 'success');
  renderAll();
}

function openTemplatesModal(plotId) {
  const cont = document.getElementById('templates-list');
  if (!cont) return;
  cont.innerHTML = PLOT_TEMPLATES.map(t => `
    <div class="card" style="margin-bottom:10px; cursor:pointer;" onclick="applyTemplate('${plotId}', '${t.id}'); closeModal('templates-modal')">
      <h4 style="font-size:14px; margin-bottom:6px;">${t.name}</h4>
      <p style="font-size:12px; color:var(--text-soft);">${t.description}</p>
      <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; font-size:11px; color:var(--text-muted);">
        <span>📐 ${t.config.agronomy.row_spacing_m}×${t.config.agronomy.vine_spacing_m} м</span>
        <span>│ ${t.config.agronomy.trellis_type}</span>
        <span>💧 ${t.config.agronomy.irrigation}</span>
      </div>
    </div>
  `).join('');
  openModal('templates-modal');
}

// =========== 3D-УКЛОН (визуальный индикатор) ===========

function renderSlope3DBadge(plot) {
  const slope = plot?.geometry?.slope_deg ?? 0;
  const exposure = plot?.geometry?.exposure ?? 'flat';
  if (slope === 0) return '<span class="badge gray">🟢 Ровный</span>';

  // Реальная площадь склона = горизонтальная / cos(slope)
  const realAreaCoef = 1 / Math.cos(slope * Math.PI / 180);
  const realArea = (plot.area_ha || 0) * realAreaCoef;
  const heightDiff = plot.area_ha
    ? Math.sqrt(plot.area_ha * 10000) * Math.tan(slope * Math.PI / 180)
    : 0;

  let color = 'green';
  if (slope > 30) color = 'red';
  else if (slope > 15) color = 'yellow';

  const expIcons = { S: '☀', SE: '🌅', SW: '🌇', E: '🌄', W: '🌆', N: '❄️', NE: 'СВ', NW: 'СЗ', flat: '🟢' };

  return `
    <span class="badge ${color}" title="Уклон: ${slope}°. Реальная площадь: ${realArea.toFixed(2)} га (×${realAreaCoef.toFixed(2)}). Перепад высот: ~${heightDiff.toFixed(0)} м">
      ⛰ ${slope}° ${expIcons[exposure] || ''}
    </span>
  `;
}

