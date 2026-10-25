/**
 * Sparse Seedlings Storage v0.7.9.1
 * 
 * Разреженное хранение кустов: храним только исключения (больные, выпавшие, пересаженные).
 * Здоровые кусты генерируются виртуально на лету из параметров рядов.
 * 
 * Экономия localStorage: с 8-10 МБ (40k кустов) до 50-200 КБ.
 */

/**
 * Генерирует виртуальный куст на лету
 * @param {string} plotId - ID участка
 * @param {number} rowNumber - номер ряда
 * @param {number} position - позиция в ряду
 * @returns {Object} Виртуальный seedling object
 */
function getVirtualSeedling(plotId, rowNumber, position) {
  const plot = (data.plots || []).find(p => p.id === plotId);
  if (!plot) return null;
  
  const row = (plot.rows || []).find(r => r.number === rowNumber);
  if (!row) return null;
  
  return {
    id: `s_${plotId}_${rowNumber}_${position}_virtual`,
    plot_id: plotId,
    block_id: plot.block_id || null,
    row: rowNumber,
    position: position,
    status: 'normal',
    is_replanted: false,
    ai_data: null,
    inspections: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _virtual: true // маркер что это виртуальный куст
  };
}

/**
 * Возвращает реальный seedling из data.seedlings или null если его нет
 */
function getRealSeedling(plotId, rowNumber, position) {
  if (!data.seedlings || !Array.isArray(data.seedlings)) return null;
  return data.seedlings.find(s => 
    s.plot_id === plotId && 
    s.row === rowNumber && 
    s.position === position &&
    !s._virtual
  ) || null;
}

/**
 * Возвращает seedling (реальный или виртуальный)
 * Приоритет: реальный > виртуальный
 */
function getSeedling(plotId, rowNumber, position) {
  const real = getRealSeedling(plotId, rowNumber, position);
  if (real) return real;
  return getVirtualSeedling(plotId, rowNumber, position);
}

/**
 * Сохраняет изменения в seedling (только если есть отличия от виртуального)
 */
function saveSeedlingChanges(seedlingId, changes) {
  if (!data.seedlings) data.seedlings = [];
  
  const existing = data.seedlings.find(s => s.id === seedlingId && !s._virtual);
  
  if (existing) {
    // Обновляем существующий
    Object.assign(existing, changes, { updated_at: new Date().toISOString() });
  } else {
    // Создаём новый (только если есть изменения)
    const seedling = {
      id: seedlingId,
      ...changes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.seedlings.push(seedling);
  }
}

/**
 * Мигрирует старые данные (все кусты) в разреженную модель
 * Оставляет только кусты с изменениями (status !== 'normal' или is_replanted === true)
 */
function migrateToSparseSeedlings() {
  if (!data.seedlings || !Array.isArray(data.seedlings)) return { migrated: 0, removed: 0 };
  
  const originalCount = data.seedlings.length;
  const sparse = [];
  
  data.seedlings.forEach(s => {
    // Оставляем только если есть изменения
    if (s.status !== 'normal' || s.is_replanted === true || 
        (s.inspections && s.inspections.length > 0) ||
        (s.ai_data && Object.keys(s.ai_data).length > 0)) {
      sparse.push(s);
    }
  });
  
  data.seedlings = sparse;
  
  return {
    migrated: sparse.length,
    removed: originalCount - sparse.length
  };
}

/**
 * Подсчитывает статистику по кустам участка
 */
function getPlotSeedlingsStats(plotId) {
  const plot = (data.plots || []).find(p => p.id === plotId);
  if (!plot) return null;
  
  // Общее количество кустов (виртуальное)
  let total = 0;
  plot.rows.forEach(row => {
    total += row.positions_count || 0;
  });
  
  // Реальные кусты с изменениями
  const real = (data.seedlings || []).filter(s => s.plot_id === plotId && !s._virtual);
  
  // Статистика по статусам
  const byStatus = {
    normal: total - real.filter(s => s.status !== 'normal').length,
    dead: 0,
    diseased: 0,
    replanted: 0
  };
  
  real.forEach(s => {
    if (s.status === 'dead') byStatus.dead++;
    else if (s.status === 'diseased') byStatus.diseased++;
    if (s.is_replanted) byStatus.replanted++;
  });
  
  return {
    total,
    real: real.length,
    virtual: total - real.length,
    byStatus
  };
}

/**
 * Проверяет нужно ли мигрировать на sparse model
 */
function needsMigration() {
  if (!data.seedlings || !Array.isArray(data.seedlings)) return false;
  
  // Если кустов больше 1000 и большинство со status='normal' — нужна миграция
  if (data.seedlings.length > 1000) {
    const normalCount = data.seedlings.filter(s => s.status === 'normal').length;
    return normalCount / data.seedlings.length > 0.9; // больше 90% нормальных
  }
  
  return false;
}
