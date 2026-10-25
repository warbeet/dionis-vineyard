// ============================================================================
// HARVEST module v0.7.10 — Сортовой учёт урожая и партий
// ============================================================================

// HARVEST & COSTS
// ===========================================================================
function saveHarvest() {
  if (!requirePermission('harvest.edit', 'Нет прав на урожай')) return;
  
  // v0.7.10: Расширенные поля для сортового учёта
  const e = {
    id: 'h_' + Date.now(),
    date: document.getElementById('h-date').value,
    plotId: document.getElementById('h-plot').value,
    varietyId: document.getElementById('h-variety').value || null, // v0.7.10: сорт/блок
    batchNumber: document.getElementById('h-batch').value.trim() || null, // v0.7.10: номер партии
    weight: parseFloat(document.getElementById('h-weight').value) || 0,
    brix: parseFloat(document.getElementById('h-brix').value) || null,
    acid: parseFloat(document.getElementById('h-acid').value) || null,
    ph: parseFloat(document.getElementById('h-ph').value) || null,
    berryTemperature: parseFloat(document.getElementById('h-temp').value) || null, // v0.7.10: температура ягод
    containerType: document.getElementById('h-container').value, // v0.7.10: тип тары
    containerCount: parseInt(document.getElementById('h-container-count').value) || null, // v0.7.10: кол-во тары
    botrytisPercent: parseFloat(document.getElementById('h-botrytis').value) || null, // v0.7.10: % серой гнили
    healthStatus: document.getElementById('h-health').value, // v0.7.10: фитосанитарное состояние
    notes: document.getElementById('h-notes').value.trim() || null // v0.7.10: заметки
  };
  
  if (!e.date || !e.weight) { toast('Дата и вес', 'error'); return; }
  
  data.harvest.push(e); 
  saveData();
  
  // Очистка формы
  ['h-date','h-weight','h-brix','h-acid','h-ph','h-temp','h-batch','h-container-count','h-botrytis','h-notes'].forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = '';
  });
  
  renderAll();
  toast('✅ Партия урожая сохранена', 'success');
}

function saveCost() {
  if (!requirePermission('harvest.edit', 'Нет прав на затраты')) return;
  const e = {
    id: 'c_' + Date.now(),
    date: document.getElementById('c-date').value,
    cat: document.getElementById('c-cat').value,
    desc: document.getElementById('c-desc').value.trim(),
    amount: parseFloat(document.getElementById('c-amount').value) || 0
  };
  if (!e.date || !e.amount) { toast('Дата и сумма', 'error'); return; }
  data.costs.push(e); saveData();
  ['c-date','c-desc','c-amount'].forEach(f => document.getElementById(f).value = '');
  renderAll();
}

let harvestViewMode = 'plot'; // v0.7.10: 'plot' или 'variety'

function renderHarvestSummary() {
  const div = document.getElementById('harvest-summary');
  if (!data.harvest.length) { div.innerHTML = '<div class="empty" style="margin:0;">Нет данных.</div>'; return; }
  
  if (harvestViewMode === 'variety') {
    renderHarvestByVariety();
  } else {
    renderHarvestByPlot();
  }
}

function renderHarvestByPlot() {
  harvestViewMode = 'plot';
  const div = document.getElementById('harvest-summary');
  if (!data.harvest.length) { div.innerHTML = '<div class="empty" style="margin:0;">Нет данных.</div>'; return; }
  
  const byPlot = {};
  data.harvest.forEach(h => {
    if (!byPlot[h.plotId]) byPlot[h.plotId] = { weight: 0, brix: [], acid: [], ph: [], batches: 0 };
    byPlot[h.plotId].weight += h.weight;
    byPlot[h.plotId].batches++;
    if (h.brix) byPlot[h.plotId].brix.push(h.brix);
    if (h.acid) byPlot[h.plotId].acid.push(h.acid);
    if (h.ph) byPlot[h.plotId].ph.push(h.ph);
  });
  
  const avg = a => a.length ? (a.reduce((s,x)=>s+x,0)/a.length).toFixed(1) : '—';
  const total = data.harvest.reduce((s,h)=>s+h.weight,0);
  const totalBatches = data.harvest.length;
  
  div.innerHTML = `<p style="font-size:14px; color:#6b5a4a; margin-bottom:10px;">
    Всего: <b style="color:#4a1f3a; font-size:20px;">${total.toFixed(1)} кг</b> 
    (${totalBatches} партий)
  </p>
  <table><thead><tr><th>Участок</th><th>Вес</th><th>Партий</th><th>Brix</th><th>Кисл.</th><th>pH</th></tr></thead>
  <tbody>${Object.entries(byPlot).map(([pid, v]) => {
    const plot = data.plots.find(p => p.id === pid);
    return `<tr><td>${escapeHtml(plot ? plot.name : '—')}</td><td>${v.weight.toFixed(1)} кг</td>
      <td>${v.batches}</td><td>${avg(v.brix)}°</td><td>${avg(v.acid)}</td><td>${avg(v.ph)}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function renderHarvestByVariety() {
  harvestViewMode = 'variety';
  const div = document.getElementById('harvest-summary');
  if (!data.harvest.length) { div.innerHTML = '<div class="empty" style="margin:0;">Нет данных.</div>'; return; }
  
  // Группировка по сортам/блокам
  const byVariety = {};
  data.harvest.forEach(h => {
    const varietyKey = h.varietyId || 'unknown';
    if (!byVariety[varietyKey]) {
      byVariety[varietyKey] = { 
        name: getVarietyName(h.varietyId, h.plotId), 
        weight: 0, 
        brix: [], 
        acid: [], 
        ph: [], 
        temp: [],
        botrytis: [],
        batches: 0 
      };
    }
    byVariety[varietyKey].weight += h.weight;
    byVariety[varietyKey].batches++;
    if (h.brix) byVariety[varietyKey].brix.push(h.brix);
    if (h.acid) byVariety[varietyKey].acid.push(h.acid);
    if (h.ph) byVariety[varietyKey].ph.push(h.ph);
    if (h.berryTemperature) byVariety[varietyKey].temp.push(h.berryTemperature);
    if (h.botrytisPercent != null) byVariety[varietyKey].botrytis.push(h.botrytisPercent);
  });
  
  const avg = a => a.length ? (a.reduce((s,x)=>s+x,0)/a.length).toFixed(1) : '—';
  const total = data.harvest.reduce((s,h)=>s+h.weight,0);
  
  div.innerHTML = `<p style="font-size:14px; color:#6b5a4a; margin-bottom:10px;">
    Всего: <b style="color:#4a1f3a; font-size:20px;">${total.toFixed(1)} кг</b>
  </p>
  <table><thead><tr><th>Сорт / Блок</th><th>Вес</th><th>Партий</th><th>Brix</th><th>Кисл.</th><th>pH</th><th>Темп.</th><th>Брак</th></tr></thead>
  <tbody>${Object.entries(byVariety).sort((a,b)=>b[1].weight-a[1].weight).map(([vid, v]) => {
    return `<tr><td>${escapeHtml(v.name)}</td><td>${v.weight.toFixed(1)} кг</td>
      <td>${v.batches}</td><td>${avg(v.brix)}°</td><td>${avg(v.acid)}</td><td>${avg(v.ph)}</td>
      <td>${avg(v.temp)}°C</td><td>${avg(v.botrytis)}%</td></tr>`;
  }).join('')}</tbody></table>`;
}

function getVarietyName(varietyId, plotId) {
  if (!varietyId) return 'Без сорта';
  
  // Пытаемся найти блок по varietyId
  const plot = data.plots.find(p => p.id === plotId);
  if (plot && plot.blocks) {
    const block = plot.blocks.find(b => b.id === varietyId);
    if (block) {
      return `${block.scion || block.name} (кл. ${block.scion_clone || '—'})`;
    }
  }
  
  return varietyId;
}

function exportHarvestCSV() {
  if (!requirePermission('data.export', 'Нет прав на экспорт данных')) return;
  if (!data.harvest.length) { toast('Нет данных для экспорта', 'error'); return; }
  
  const headers = [
    'Дата', 'Участок', 'Сорт/Блок', '№ партии', 'Вес (кг)', 
    'Brix (°)', 'Кислотн. (г/л)', 'pH', 'Температура ягод (°C)',
    'Тара', 'Кол-во тары', 'Брак (%)', 'Фитосанитарное состояние', 'Заметки'
  ];
  
  const rows = data.harvest.map(h => {
    const plot = data.plots.find(p => p.id === h.plotId);
    const variety = getVarietyName(h.varietyId, h.plotId);
    return [
      h.date || '',
      plot ? plot.name : '—',
      variety,
      h.batchNumber || '',
      h.weight || '',
      h.brix || '',
      h.acid || '',
      h.ph || '',
      h.berryTemperature || '',
      h.containerType || '',
      h.containerCount || '',
      h.botrytisPercent || '',
      h.healthStatus || '',
      (h.notes || '').replace(/"/g, '""')
    ].map(v => `"${v}"`).join(',');
  });
  
  const csv = headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `harvest_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ Экспорт завершён', 'success');
}

// v0.7.10: Заполнение выпадающего списка сортов/блоков при выборе участка
function populateHarvestVarietySelect() {
  const plotSelect = document.getElementById('h-plot');
  const varietySelect = document.getElementById('h-variety');
  if (!plotSelect || !varietySelect) return;
  
  const plotId = plotSelect.value;
  const plot = data.plots.find(p => p.id === plotId);
  
  if (!plot || !plot.blocks || !plot.blocks.length) {
    varietySelect.innerHTML = '<option value="">— нет блоков —</option>';
    varietySelect.disabled = true;
    return;
  }
  
  varietySelect.disabled = false;
  varietySelect.innerHTML = '<option value="">— выберите блок —</option>' + 
    plot.blocks.map(b => {
      const label = b.scion 
        ? `${b.scion} (кл. ${b.scion_clone || '—'}, ${b.rootstock || '—'})`
        : b.name;
      return `<option value="${b.id}">${escapeHtml(label)}</option>`;
    }).join('');
}

// Слушатель изменения участка
document.addEventListener('change', e => {
  if (e.target && e.target.id === 'h-plot') {
    populateHarvestVarietySelect();
  }
});

function renderCostsSummary() {
  const div = document.getElementById('costs-summary');
  if (!data.costs.length) { div.innerHTML = '<div class="empty" style="margin:0;">Нет данных.</div>'; return; }
  const byCat = {};
  data.costs.forEach(c => byCat[c.cat] = (byCat[c.cat] || 0) + c.amount);
  const total = data.costs.reduce((s,c)=>s+c.amount,0);
  div.innerHTML = `<p style="font-size:14px; color:#6b5a4a; margin-bottom:10px;">Итого: <b style="color:#4a1f3a; font-size:20px;">${total.toFixed(2)}</b></p>
    <table><thead><tr><th>Категория</th><th>Сумма</th><th>%</th></tr></thead>
    <tbody>${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c,a]) =>
      `<tr><td>${escapeHtml(c)}</td><td>${a.toFixed(2)}</td><td>${(a/total*100).toFixed(1)}%</td></tr>`
    ).join('')}</tbody></table>`;
}

// ===========================================================================
