// ============================================================================
// VERTIKAL PRESET v0.7.14 — Пресет автозагрузки виноградника ООО «Вертикаль»
// ============================================================================
// Реальный виноградник: х. Виноградный, Геленджик, посадки 2024 г.
// 4 клетки, 414 рядов, 40 824 куста, схема 2.5 × 0.9 м
// ============================================================================

/**
 * Генерирует массив рядов для Клетки 1 (Сира) — 106 рядов, 8 282 куста
 */
function _vertikal_kletka1_rows() {
  const rows = [];
  let rowNum = 1;
  // Скос: ряд 1 = 37
  rows.push({ number: rowNum++, positions_count: 37 });
  // Ряды 2-4: 59 кустов
  for (let i = 0; i < 3; i++) rows.push({ number: rowNum++, positions_count: 59 });
  // Ряды 5-18: 79 кустов
  for (let i = 0; i < 14; i++) rows.push({ number: rowNum++, positions_count: 79 });
  // Ряды 19-57: 80 кустов
  for (let i = 0; i < 39; i++) rows.push({ number: rowNum++, positions_count: 80 });
  // Ряды 58-59: ступенька перехода (2 ряда)
  rows.push({ number: rowNum++, positions_count: 79 });
  rows.push({ number: rowNum++, positions_count: 79 });
  // Ряды 60-104: 80 кустов
  for (let i = 0; i < 45; i++) rows.push({ number: rowNum++, positions_count: 80 });
  // Ряды 105-106: скос торца
  rows.push({ number: rowNum++, positions_count: 59 });
  rows.push({ number: rowNum++, positions_count: 37 });
  return rows;
}

/**
 * Генерирует массив рядов для Клетки 2 (КС) — 122 ряда, 12 681 куст
 */
function _vertikal_kletka2_rows() {
  const rows = [];
  let rowNum = 1;
  // Скос: ряд 1 (31), ряд 2 (45), ряд 3 (66), ряд 4 (78)
  rows.push({ number: rowNum++, positions_count: 31 });
  rows.push({ number: rowNum++, positions_count: 45 });
  rows.push({ number: rowNum++, positions_count: 66 });
  rows.push({ number: rowNum++, positions_count: 78 });
  // Блок 169 RSB1: 29 рядов по 106
  for (let i = 0; i < 29; i++) rows.push({ number: rowNum++, positions_count: 106 });
  // Блок 338 RSB1: 35 рядов по 106
  for (let i = 0; i < 35; i++) rows.push({ number: rowNum++, positions_count: 106 });
  // Блок 338 Fercal: 41 ряд по 106
  for (let i = 0; i < 41; i++) rows.push({ number: rowNum++, positions_count: 106 });
  // Технологический разрыв: 3 ряда по 20
  for (let i = 0; i < 3; i++) rows.push({ number: rowNum++, positions_count: 20 });
  // Финальный массив: 10 рядов по 106
  for (let i = 0; i < 10; i++) rows.push({ number: rowNum++, positions_count: 106 });
  return rows;
}

/**
 * Генерирует массив рядов для Клетки 3 (Мерло + КФ) — 133 ряда
 */
function _vertikal_kletka3_rows() {
  const rows = [];
  let rowNum = 1;
  // Скос Мерло: 2×10, 2×32, 2×54, 1×76, 2×98
  for (let i = 0; i < 2; i++) rows.push({ number: rowNum++, positions_count: 10 });
  for (let i = 0; i < 2; i++) rows.push({ number: rowNum++, positions_count: 32 });
  for (let i = 0; i < 2; i++) rows.push({ number: rowNum++, positions_count: 54 });
  rows.push({ number: rowNum++, positions_count: 76 });
  for (let i = 0; i < 2; i++) rows.push({ number: rowNum++, positions_count: 98 });
  // Основной Мерло 346: 35 рядов по 111
  for (let i = 0; i < 35; i++) rows.push({ number: rowNum++, positions_count: 111 });
  // Основной Мерло 181: 35 рядов по 111
  for (let i = 0; i < 35; i++) rows.push({ number: rowNum++, positions_count: 111 });
  // Каберне Фран 685: 51 ряд по 111
  for (let i = 0; i < 51; i++) rows.push({ number: rowNum++, positions_count: 111 });
  return rows;
}

/**
 * Генерирует массив рядов для Клетки 4 (ПВ + КФ) — 53 ряда
 * Ряд 1: 65 кустов (КС остаток)
 * Ряды 2-53: 107 кустов каждый (18 ПВ + 89 КФ)
 */
function _vertikal_kletka4_rows() {
  const rows = [];
  rows.push({ number: 1, positions_count: 65 });
  for (let i = 2; i <= 53; i++) rows.push({ number: i, positions_count: 107 });
  return rows;
}

/**
 * Загружает пресет ООО «Вертикаль» в базу приложения
 */
function loadVertikalPreset() {
  if (!confirm('🍇 Загрузить демо-данные ООО «Вертикаль» (Геленджик)?\n\n4 клетки, 414 рядов, 40 824 кустов.\n\n⚠️ Существующие участки НЕ будут удалены — новые добавятся поверх.\n⚠️ Координаты виноградника будут установлены для прогноза погоды.\n\nПродолжить?')) return;
  
  toast('⏳ Загрузка пресета...', 'info');
  
  // Небольшая задержка для показа тоста
  setTimeout(() => {
    try {
      if (!data.plots) data.plots = [];
      if (!data.seedlings) data.seedlings = [];
      
      // Удаляем старые пресеты если есть (по id-паттерну)
      data.plots = data.plots.filter(p => !p.id.startsWith('plot_kletka_'));
      data.seedlings = data.seedlings.filter(s => !s.plot_id.startsWith('plot_kletka_'));
      
      // Устанавливаем координаты виноградника для прогноза погоды
      // х. Виноградный, Геленджик, Краснодарский край
      data.location = {
        lat: 44.6167,
        lon: 38.0833,
        name: 'ООО «Вертикаль», х. Виноградный, Геленджик'
      };
      console.log('[Dionis] Координаты виноградника установлены:', data.location);
      
      // Клетка 1 — Сира (северная часть виноградника)
      data.plots.push({
        id: 'plot_kletka_1_sirah',
        name: 'Клетка 1 (ЗУ2) — Сира',
        area_ha: 1.87,
        row_spacing_m: 2.5,
        vine_spacing_m: 0.9,
        center: { lat: 44.6175, lng: 38.0830 },
        notes: 'Посадка 2024 г. ЗУ2, кадастр 23:40:0301002:276. Сира клон 524 + 747 на 140R.',
        blocks: [
          { id: 'b_sirah_524', name: 'Сира клон 524 / 140R', scion: 'Сира', scion_clone: '524', rootstock: '140 R', planting_year: 2024 },
          { id: 'b_sirah_747', name: 'Сира клон 747 / 140R', scion: 'Сира', scion_clone: '747', rootstock: '140 R', planting_year: 2024 }
        ],
        rows: _vertikal_kletka1_rows(),
        created_at: new Date().toISOString()
      });
      
      // Клетка 2 — Каберне Совиньон (восточная часть)
      data.plots.push({
        id: 'plot_kletka_2_cabernet_sauvignon',
        name: 'Клетка 2 (ЗУ3) — Каберне Совиньон',
        area_ha: 2.89,
        row_spacing_m: 2.5,
        vine_spacing_m: 0.9,
        center: { lat: 44.6165, lng: 38.0845 },
        notes: 'Посадка 2024 г. ЗУ3. КС клоны 169 (RSB1) + 338 (RSB1/Fercal).',
        blocks: [
          { id: 'b_cs_169', name: 'КС 169 / RSB1', scion: 'Каберне Совиньон', scion_clone: '169', rootstock: 'RSB1', planting_year: 2024 },
          { id: 'b_cs_338_rsb1', name: 'КС 338 / RSB1', scion: 'Каберне Совиньон', scion_clone: '338', rootstock: 'RSB1', planting_year: 2024 },
          { id: 'b_cs_338_fercal', name: 'КС 338 / Fercal', scion: 'Каберне Совиньон', scion_clone: '338', rootstock: 'Fercal', planting_year: 2024 }
        ],
        rows: _vertikal_kletka2_rows(),
        created_at: new Date().toISOString()
      });
      
      // Клетка 3 — Мерло + Каберне Фран (южная часть)
      data.plots.push({
        id: 'plot_kletka_3_merlot_cf',
        name: 'Клетка 3 (ЗУ4) — Мерло + Каберне Фран',
        area_ha: 3.30,
        row_spacing_m: 2.5,
        vine_spacing_m: 0.9,
        center: { lat: 44.6155, lng: 38.0825 },
        notes: 'Посадка 2024 г. ЗУ4. Мерло клоны 346/181 (RSB1) + Каберне Фран 685 (Fercal).',
        blocks: [
          { id: 'b_merlot_346', name: 'Мерло 346 / RSB1', scion: 'Мерло', scion_clone: '346', rootstock: 'RSB1', planting_year: 2024 },
          { id: 'b_merlot_181', name: 'Мерло 181 / RSB1', scion: 'Мерло', scion_clone: '181', rootstock: 'RSB1', planting_year: 2024 },
          { id: 'b_cf_685', name: 'КФ 685 / Fercal', scion: 'Каберне Фран', scion_clone: '685', rootstock: 'Fercal', planting_year: 2024 }
        ],
        rows: _vertikal_kletka3_rows(),
        created_at: new Date().toISOString()
      });
      
      // Клетка 4 — Пти Вердо + Каберне Фран (+ КС остаток) (западная часть)
      data.plots.push({
        id: 'plot_kletka_4_pv_cf',
        name: 'Клетка 4 (ЗУ5) — Пти Вердо + Каберне Фран',
        area_ha: 1.27,
        row_spacing_m: 2.5,
        vine_spacing_m: 0.9,
        center: { lat: 44.6170, lng: 38.0815 },
        notes: 'Посадка 2024 г. ЗУ5. Верх: Пти Вердо 1058 (Fercal). Низ: КФ 678 (140R). Крайний ряд: КС 338 (Fercal) 65 кустов.',
        blocks: [
          { id: 'b_pv_1058', name: 'Пти Вердо 1058 / Fercal', scion: 'Пти Вердо', scion_clone: '1058', rootstock: 'Fercal', planting_year: 2024 },
          { id: 'b_cf_678', name: 'КФ 678 / 140R', scion: 'Каберне Фран', scion_clone: '678', rootstock: '140 R', planting_year: 2024 },
          { id: 'b_cs_remnant', name: 'КС 338 (остаток)', scion: 'Каберне Совиньон', scion_clone: '338', rootstock: 'Fercal', planting_year: 2024 }
        ],
        rows: _vertikal_kletka4_rows(),
        created_at: new Date().toISOString()
      });
      
      // Подсчёт кустов (Sparse Seedlings — виртуально, без создания объектов)
      let totalSeedlings = 0;
      data.plots.filter(p => p.id.startsWith('plot_kletka_')).forEach(p => {
        totalSeedlings += p.rows.reduce((sum, r) => sum + (r.positions_count || 0), 0);
      });
      
      saveData();
      renderAll();
      
      // Автоматически загружаем погоду после установки координат
      if (typeof fetchWeather === 'function') {
        console.log('[Dionis] Загружаем погоду для виноградника...');
        fetchWeather();
      }
      
      toast(`✅ Пресет ООО «Вертикаль» загружен: 4 клетки, ${totalSeedlings.toLocaleString('ru-RU')} кустов`, 'success');
      
    } catch (err) {
      console.error('Ошибка загрузки пресета:', err);
      toast('❌ Ошибка загрузки пресета: ' + err.message, 'error');
    }
  }, 100);
}

/**
 * Удаляет пресет (очистка данных Вертикаль)
 */
function clearVertikalPreset() {
  if (!confirm('Удалить все данные пресета ООО «Вертикаль»?\n\nБудут удалены 4 клетки и все связанные данные.\nПродолжить?')) return;
  
  data.plots = (data.plots || []).filter(p => !p.id.startsWith('plot_kletka_'));
  data.seedlings = (data.seedlings || []).filter(s => !s.plot_id.startsWith('plot_kletka_'));
  
  saveData();
  renderAll();
  toast('✅ Пресет ООО «Вертикаль» удалён', 'success');
}
