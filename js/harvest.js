// ============================================================================
// HARVEST module
// ============================================================================

// HARVEST & COSTS
// ===========================================================================
function saveHarvest() {
  if (!requirePermission('harvest.edit', 'Нет прав на урожай')) return;
  const e = {
    id: 'h_' + Date.now(),
    date: document.getElementById('h-date').value,
    plotId: document.getElementById('h-plot').value,
    weight: parseFloat(document.getElementById('h-weight').value) || 0,
    brix: parseFloat(document.getElementById('h-brix').value) || null,
    acid: parseFloat(document.getElementById('h-acid').value) || null,
    ph: parseFloat(document.getElementById('h-ph').value) || null
  };
  if (!e.date || !e.weight) { toast('Дата и вес', 'error'); return; }
  data.harvest.push(e); saveData();
  ['h-date','h-weight','h-brix','h-acid','h-ph'].forEach(f => document.getElementById(f).value = '');
  renderAll();
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

function renderHarvestSummary() {
  const div = document.getElementById('harvest-summary');
  if (!data.harvest.length) { div.innerHTML = '<div class="empty" style="margin:0;">Нет данных.</div>'; return; }
  const byPlot = {};
  data.harvest.forEach(h => {
    if (!byPlot[h.plotId]) byPlot[h.plotId] = { weight: 0, brix: [], acid: [], ph: [] };
    byPlot[h.plotId].weight += h.weight;
    if (h.brix) byPlot[h.plotId].brix.push(h.brix);
    if (h.acid) byPlot[h.plotId].acid.push(h.acid);
    if (h.ph) byPlot[h.plotId].ph.push(h.ph);
  });
  const avg = a => a.length ? (a.reduce((s,x)=>s+x,0)/a.length).toFixed(1) : '—';
  const total = data.harvest.reduce((s,h)=>s+h.weight,0);
  div.innerHTML = `<p style="font-size:14px; color:#6b5a4a; margin-bottom:10px;">Всего: <b style="color:#4a1f3a; font-size:20px;">${total.toFixed(1)} кг</b></p>
    <table><thead><tr><th>Участок</th><th>Вес</th><th>Brix</th><th>Кисл.</th><th>pH</th></tr></thead>
    <tbody>${Object.entries(byPlot).map(([pid, v]) => {
      const plot = data.plots.find(p => p.id === pid);
      return `<tr><td>${escapeHtml(plot ? plot.name : '—')}</td><td>${v.weight.toFixed(1)} кг</td>
        <td>${avg(v.brix)}°</td><td>${avg(v.acid)}</td><td>${avg(v.ph)}</td></tr>`;
    }).join('')}</tbody></table>`;
}

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
