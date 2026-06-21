// ============================================================================
// IRRIGATION module — Умный расчёт полива на основе размера, возраста, состояния
// ============================================================================

// Базовые потребности куста в воде (литров в день) по возрасту
// Источник: усреднённые данные для умеренного климата
const BASE_WATER_NEEDS = {
  // возраст_лет: { литров_в_день_базовый, фактор_частоты_дней }
  1:  { base: 3,   freq: 3,  description: 'Молодой саженец (1 год)' },
  2:  { base: 5,   freq: 4,  description: 'Молодой куст (2 года)' },
  3:  { base: 8,   freq: 5,  description: 'Развивающийся (3 года)' },
  4:  { base: 12,  freq: 7,  description: 'Молодое плодоношение (4 года)' },
  5:  { base: 16,  freq: 7,  description: 'Полное плодоношение (5+ лет)' },
  10: { base: 22,  freq: 10, description: 'Взрослый куст (10+ лет)' },
  20: { base: 28,  freq: 14, description: 'Зрелый куст (20+ лет)' }
};

// Множители по статусу здоровья
const STATUS_WATER_MULTIPLIER = {
  planted:   { mult: 1.5, note: 'Усиленный полив для приживаемости' },
  healthy:   { mult: 1.0, note: 'Стандартная норма' },
  normal:    { mult: 1.0, note: 'Стандартная норма' },
  attention: { mult: 0.8, note: 'Сниженная норма (стресс)' },
  sick:      { mult: 0.6, note: 'Минимальный полив (риск гниения)' },
  dead:      { mult: 0,   note: 'Не поливать' },
  empty:     { mult: 0,   note: 'Пусто' },
  cascade:   { mult: 1.3, note: 'Каскад: 1.3× на позицию (несколько кустов)' }
};

// Множители по фенофазе
const PHENO_WATER_MULTIPLIER = {
  dormancy:     0,      // покой — без полива
  budbreak:     0.4,
  leaves:       0.8,
  flowering:    1.0,    // цветение — стандарт
  fruitset:     1.3,    // ягоды наливаются — пик
  'berry-growth': 1.5,  // максимум
  veraison:     1.2,
  ripening:     0.8,    // сокращаем для накопления сахара
  harvest:      0.3,    // минимум
  leaffall:     0.5     // влагозарядка
};

// Множители по почве (удерживает влагу или нет)
const SOIL_WATER_MULTIPLIER = {
  chernozem:  1.0,
  sand:       1.4,   // песок плохо держит — поливаем больше
  clay:       0.7,   // глина держит — поливаем меньше
  loam:       1.0,
  stony:      1.3,
  calcareous: 1.1,
  peat:       0.8,
  mixed:      1.0
};

// Множители по экспозиции (солнце = больше испарение)
const EXPOSURE_WATER_MULTIPLIER = {
  S:    1.2,
  SE:   1.15,
  SW:   1.15,
  E:    1.05,
  W:    1.05,
  flat: 1.0,
  N:    0.85,
  NE:   0.9,
  NW:   0.9
};

// Множители по типу полива (КПД системы)
const IRRIGATION_SYSTEM_EFFICIENCY = {
  drip:      1.0,    // капельный — 95% эффективности, считаем 1.0
  sprinkler: 1.4,    // дождевание — потери на испарение
  flood:     1.8,    // по бороздам — большие потери
  none:      0       // нет полива
};

// =========== РАСЧЁТ ПОТРЕБНОСТЕЙ ОДНОГО КУСТА ===========

function calcSeedlingWaterNeed(seedling, plot, options = {}) {
  if (!seedling || !plot) return { liters_day: 0, reason: 'нет данных' };

  // 1) Базовая норма по возрасту
  const block = plot.blocks?.find(b => b.id === seedling.block_id);
  const age = block?.planting_year ? (new Date().getFullYear() - block.planting_year) : 5;
  const ageKey = age <= 1 ? 1 : age <= 2 ? 2 : age <= 3 ? 3 : age <= 4 ? 4 : age <= 9 ? 5 : age <= 19 ? 10 : 20;
  const baseInfo = BASE_WATER_NEEDS[ageKey];
  let baseLiters = baseInfo.base;

  // 2) Множитель по статусу
  const statusMult = (STATUS_WATER_MULTIPLIER[seedling.status] || { mult: 1.0 }).mult;
  if (statusMult === 0) return { liters_day: 0, reason: STATUS_WATER_MULTIPLIER[seedling.status]?.note || '—' };

  // 3) Множитель по AI-размеру (если есть)
  let sizeMult = 1.0;
  if (seedling.ai_data) {
    const h = seedling.ai_data.height_cm;
    const shoots = seedling.ai_data.shoots_count;
    const canopy = seedling.ai_data.canopy_density;
    if (h != null) {
      // Эталон 150 см. >150 → больше, <150 → меньше
      sizeMult *= Math.max(0.5, Math.min(1.5, h / 150));
    }
    if (canopy != null) {
      // 0.6 эталон. Плотная крона — больше испарения
      sizeMult *= 1 + (canopy - 0.6) * 0.5;
    }
    if (shoots != null) {
      // Эталон 12 побегов. Больше побегов = больше потребности
      sizeMult *= Math.max(0.7, Math.min(1.4, shoots / 12));
    }
  }

  // 4) Множители по фенофазе, почве, экспозиции
  const phenoMult = PHENO_WATER_MULTIPLIER[data.currentPheno] ?? 1.0;
  const soilMult = SOIL_WATER_MULTIPLIER[plot.agronomy?.soil_type] ?? 1.0;
  const expMult = EXPOSURE_WATER_MULTIPLIER[plot.geometry?.exposure] ?? 1.0;

  // 5) ET₀ из прогноза (если есть, корректируем по фактической эвапотранспирации)
  let et0Mult = 1.0;
  if (options.useET0 && data.forecast && data.forecast.length) {
    // Средний ET₀ за следующие 7 дней vs эталон 4 мм/день
    const avgET0 = data.forecast.slice(0, 7).reduce((s, d) => s + (d.et0 || 4), 0) / Math.min(7, data.forecast.length);
    et0Mult = avgET0 / 4;
  }

  // 6) Учёт прогноза осадков — снижаем потребность
  let rainCompensation = 1.0;
  if (options.useRain && data.forecast && data.forecast.length) {
    const totalRain = data.forecast.slice(0, 3).reduce((s, d) => s + (d.rain || 0), 0);
    // 1 мм осадков ≈ 1 л/м². При плотности 0.4 м² на куст → ~0.4 л
    const rainLitersExpected = totalRain * 0.4;
    rainCompensation = Math.max(0.3, 1 - (rainLitersExpected / (baseLiters * 3)));
  }

  // Итог
  const liters = baseLiters * statusMult * sizeMult * phenoMult * soilMult * expMult * et0Mult * rainCompensation;

  // Учитываем КПД системы полива
  const efficiency = IRRIGATION_SYSTEM_EFFICIENCY[plot.agronomy?.irrigation] ?? 1.0;
  const actualLiters = liters * efficiency;

  return {
    liters_day: +actualLiters.toFixed(1),
    liters_per_event: +(actualLiters * baseInfo.freq).toFixed(1),
    frequency_days: baseInfo.freq,
    base_liters: baseLiters,
    age_years: age,
    multipliers: {
      status: +statusMult.toFixed(2),
      size: +sizeMult.toFixed(2),
      pheno: +phenoMult.toFixed(2),
      soil: +soilMult.toFixed(2),
      exposure: +expMult.toFixed(2),
      et0: +et0Mult.toFixed(2),
      rain: +rainCompensation.toFixed(2),
      efficiency: +efficiency.toFixed(2)
    },
    explanation: `${baseInfo.description}. ` +
      `Статус: ${STATUS_WATER_MULTIPLIER[seedling.status]?.note || ''}.` +
      (sizeMult !== 1 ? ` Размер ×${sizeMult.toFixed(2)}.` : '') +
      ` Фенофаза ×${phenoMult.toFixed(2)}, почва ×${soilMult.toFixed(2)}.`
  };
}

// =========== РАСЧЁТ ДЛЯ УЧАСТКА ===========

function calcPlotWaterPlan(plotId, options = {}) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return null;
  const seedlings = (data.seedlings || []).filter(s => s.plot_id === plotId);
  if (!seedlings.length) return null;

  let totalDaily = 0;
  let byStatus = {};
  const perVine = [];

  seedlings.forEach(s => {
    const calc = calcSeedlingWaterNeed(s, plot, options);
    totalDaily += calc.liters_day;
    byStatus[s.status] = (byStatus[s.status] || 0) + calc.liters_day;
    perVine.push({ id: s.id, row: s.row, position: s.position, status: s.status, liters_day: calc.liters_day });
  });

  // План на 7 дней с учётом частоты
  const weekPlan = [];
  for (let day = 0; day < 7; day++) {
    const date = new Date(Date.now() + day * 86400000).toISOString().slice(0, 10);
    let dayLiters = 0;
    let dayVines = 0;
    seedlings.forEach(s => {
      const calc = calcSeedlingWaterNeed(s, plot, options);
      if (calc.frequency_days && day % calc.frequency_days === 0 && calc.liters_day > 0) {
        dayLiters += calc.liters_per_event;
        dayVines++;
      }
    });
    weekPlan.push({ date, liters: +dayLiters.toFixed(1), vines: dayVines });
  }

  return {
    plot_id: plotId,
    plot_name: plot.name,
    total_vines: seedlings.length,
    active_vines: seedlings.filter(s => !['dead', 'empty'].includes(s.status)).length,
    total_daily_liters: +totalDaily.toFixed(1),
    total_weekly_liters: +(weekPlan.reduce((s, d) => s + d.liters, 0)).toFixed(1),
    avg_per_vine_daily: seedlings.length ? +(totalDaily / seedlings.length).toFixed(2) : 0,
    by_status: byStatus,
    week_plan: weekPlan,
    per_vine: perVine,
    area_ha: plot.area_ha,
    liters_per_ha_daily: plot.area_ha ? +(totalDaily / plot.area_ha).toFixed(0) : 0,
    cubic_meters_weekly: +(weekPlan.reduce((s, d) => s + d.liters, 0) / 1000).toFixed(2)
  };
}

// =========== UI: РЕНДЕР ПЛАНА ПОЛИВА ===========

function renderIrrigationPlan(plotId) {
  const useET0 = document.getElementById('irrig-use-et0')?.checked ?? true;
  const useRain = document.getElementById('irrig-use-rain')?.checked ?? true;
  const plan = calcPlotWaterPlan(plotId, { useET0, useRain });
  const cont = document.getElementById('irrigation-plan-' + plotId);
  if (!cont) return;
  if (!plan) {
    cont.innerHTML = '<div class="empty">Нет саженцев для расчёта</div>';
    return;
  }

  cont.innerHTML = `
    <div class="stats-grid" style="margin-bottom:16px;">
      <div class="stat-pill"><div class="num">${plan.total_daily_liters}<span style="font-size:11px;color:var(--text-soft);"> л</span></div><div class="lbl">В день</div></div>
      <div class="stat-pill"><div class="num">${plan.total_weekly_liters}<span style="font-size:11px;color:var(--text-soft);"> л</span></div><div class="lbl">Неделю</div></div>
      <div class="stat-pill"><div class="num">${plan.cubic_meters_weekly}<span style="font-size:11px;color:var(--text-soft);"> м³</span></div><div class="lbl">Объём/нед</div></div>
      <div class="stat-pill"><div class="num">${plan.avg_per_vine_daily}<span style="font-size:11px;color:var(--text-soft);"> л</span></div><div class="lbl">На куст/день</div></div>
      <div class="stat-pill"><div class="num">${plan.liters_per_ha_daily}<span style="font-size:11px;color:var(--text-soft);"> л/га</span></div><div class="lbl">На гектар</div></div>
      <div class="stat-pill"><div class="num">${plan.active_vines}<span style="font-size:11px;color:var(--text-soft);"> / ${plan.total_vines}</span></div><div class="lbl">Активных</div></div>
    </div>

    <h4 style="margin-top:14px;">📅 План на 7 дней</h4>
    <div class="forecast-grid" style="margin-top:8px;">
      ${plan.week_plan.map(d => `
        <div class="forecast-day ${d.liters === 0 ? '' : (d.liters > plan.total_daily_liters * 3 ? 'warning' : '')}">
          <div class="date">${formatDateShort(d.date)}</div>
          <div class="weather-icon-big">💧</div>
          <div class="temp">${d.liters} л</div>
          <div class="meta">${d.vines} кустов</div>
        </div>
      `).join('')}
    </div>

    <h4 style="margin-top:14px;">📊 Распределение по статусам</h4>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Статус</th><th>Расход, л/день</th><th>%</th></tr></thead>
        <tbody>
          ${Object.entries(plan.by_status).filter(([_,l]) => l > 0).sort((a,b)=>b[1]-a[1]).map(([s, l]) => `
            <tr>
              <td>${(VINE_STATUS[s] || {label: s}).label}</td>
              <td><b>${l.toFixed(1)} л</b></td>
              <td>${plan.total_daily_liters ? (l/plan.total_daily_liters*100).toFixed(1) : 0}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="alert info" style="font-size:12px; margin-top:14px;">
      💡 Расчёт учитывает: возраст кустов (${plan.per_vine[0] ? 'от блока' : '—'}), статус здоровья, фенофазу, тип почвы (${plot.agronomy?.soil_type || 'не указан'}), экспозицию склона, КПД системы полива (${plot.agronomy?.irrigation || 'не указан'})${useET0 ? ', ET₀ из прогноза' : ''}${useRain ? ', прогноз осадков' : ''}.
    </div>
  `;
}

// =========== ОТКРЫТИЕ МОДАЛКИ ПЛАНА ПОЛИВА ===========

function openIrrigationModal(plotId) {
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  document.getElementById('irrigation-modal-title').textContent = `💧 План полива — ${plot.name}`;
  document.getElementById('irrigation-content').innerHTML = `
    <div style="display:flex; gap:12px; margin-bottom:14px; flex-wrap:wrap;">
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
        <input type="checkbox" id="irrig-use-et0" checked onchange="renderIrrigationPlan('${plotId}')" style="width:auto;">
        <span style="font-size:13px;">📊 Учитывать ET₀ (испарение)</span>
      </label>
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
        <input type="checkbox" id="irrig-use-rain" checked onchange="renderIrrigationPlan('${plotId}')" style="width:auto;">
        <span style="font-size:13px;">🌧 Компенсация осадков</span>
      </label>
    </div>
    <div id="irrigation-plan-${plotId}"></div>
  `;
  openModal('irrigation-modal');
  setTimeout(() => renderIrrigationPlan(plotId), 100);
}
