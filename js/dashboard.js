// ============================================================================
// DASHBOARD module — Компактный summary, виджеты
// ============================================================================

function updateDashboard() {
  // Summary strip — компактные числа
  const plotsCount = (data.plots || []).length;
  const totalArea = (data.plots || []).reduce((s, p) => s + (p.area_ha || p.area || 0), 0);
  const photosCount = (data.photoReports || []).length;
  const tasksActive = (data.tasks || []).filter(t => !t.done).length;
  const seedlingsCount = (data.seedlings || []).length;
  const blocksCount = (data.plots || []).reduce((s, p) => s + (p.blocks?.length || 0), 0);
  const stationsCount = (data.stations || []).length;
  const stationsOnline = (data.stations || []).filter(s => s.status === 'online').length;

  setStat('sum-plots', plotsCount);
  setStat('sum-area', totalArea.toFixed(2));
  setStat('sum-photos', photosCount);
  setStat('sum-tasks', tasksActive);
  setStat('sum-seedlings', seedlingsCount);
  setStat('sum-blocks', blocksCount);
  setStat('sum-stations', stationsCount ? `${stationsOnline}/${stationsCount}` : '0');

  // Phenophase
  const phase = PHENO_STAGES.find(s => s.id === data.currentPheno);
  const badge = document.getElementById('pheno-badge');
  const desc = document.getElementById('pheno-desc');
  if (phase && badge && desc) {
    badge.textContent = phase.name;
    desc.textContent = phase.desc + (data.phenoDate ? ` · с ${data.phenoDate}` : '');
  }

  // Risks
  const risksDiv = document.getElementById('active-risks');
  if (risksDiv) {
    const risks = (data.recommendations || []).filter(r => r.priority === 'high');
    risksDiv.innerHTML = risks.length
      ? risks.map(r => `<p style="font-size:13px; padding:6px 0;">🔴 ${escapeHtml(r.title)}</p>`).join('')
      : '<p style="color:var(--success); font-size:13px;">✅ Активных рисков нет.</p>';
  }

  // Recent events
  const eventsDiv = document.getElementById('recent-events');
  if (eventsDiv) {
    const events = [];
    (data.photoReports || []).slice(0, 3).forEach(r => events.push({ date: r.date, title: '📸 Фотоотчёт', desc: (data.plots.find(p=>p.id===r.plotId)||{}).name || '' }));
    (data.journal || []).slice(0, 3).forEach(j => events.push({ date: j.date, title: '📔 ' + j.type, desc: j.desc }));
    (data.diseases || []).slice(-3).forEach(d => events.push({ date: d.date, title: '⚠️ ' + d.type, desc: d.note }));
    (data.treatments || []).slice(-3).forEach(t => events.push({ date: t.date, title: '💊 ' + t.product, desc: t.note }));
    events.sort((a,b) => b.date.localeCompare(a.date));
    eventsDiv.innerHTML = events.length
      ? events.slice(0, 8).map(e => `<div class="timeline-item">
          <div class="timeline-date">${e.date}</div>
          <div class="timeline-title">${escapeHtml(e.title)}</div>
          ${e.desc ? `<div style="font-size:13px; color:var(--text-soft);">${escapeHtml(e.desc)}</div>` : ''}
        </div>`).join('')
      : '<p style="color:var(--text-muted); font-size:13px; padding:14px;">События появятся по мере добавления данных.</p>';
  }

  // GDD
  const gddEl = document.getElementById('gdd-sum');
  if (gddEl) gddEl.textContent = calcGDD().toFixed(0);

  renderTodayWeather();
}

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
