// ============================================================================
// TREATMENTS module
// ============================================================================

// DISEASES & TREATMENTS
// ===========================================================================
function saveDisease() {
  const e = {
    id: 'd_' + Date.now(), kind: 'disease',
    date: document.getElementById('dis-date').value,
    plotId: document.getElementById('dis-plot').value,
    type: document.getElementById('dis-type').value,
    severity: document.getElementById('dis-severity').value,
    note: document.getElementById('dis-note').value.trim()
  };
  if (!e.date) { toast('Укажите дату', 'error'); return; }
  data.diseases.push(e); saveData();
  ['dis-date','dis-note'].forEach(f => document.getElementById(f).value = '');
  renderAll();
}

function saveTreatment() {
  const e = {
    id: 't_' + Date.now(), kind: 'treatment',
    date: document.getElementById('tr-date').value,
    plotId: document.getElementById('tr-plot').value,
    product: document.getElementById('tr-product').value.trim(),
    dose: document.getElementById('tr-dose').value.trim(),
    volume: parseFloat(document.getElementById('tr-volume').value) || null,
    pause: parseInt(document.getElementById('tr-pause').value) || null,
    note: document.getElementById('tr-note').value.trim()
  };
  if (!e.date || !e.product) { toast('Укажите дату и препарат', 'error'); return; }
  data.treatments.push(e); saveData();
  ['tr-date','tr-product','tr-dose','tr-volume','tr-pause','tr-note'].forEach(f => document.getElementById(f).value = '');
  renderAll();
}

function deleteItem(arr, id) {
  if (!confirm('Удалить?')) return;
  data[arr] = data[arr].filter(x => x.id !== id);
  saveData(); renderAll();
}

function renderTreatments() {
  const list = document.getElementById('treatments-list');
  const all = [...data.diseases.map(d => ({...d, _src: 'diseases'})), ...data.treatments.map(t => ({...t, _src: 'treatments'}))]
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!all.length) { list.innerHTML = '<div class="empty" style="margin:0;">Нет записей.</div>'; return; }
  const sevBadge = { low: '<span class="badge green">Низкая</span>', med: '<span class="badge yellow">Средняя</span>', high: '<span class="badge red">Высокая</span>' };
  list.innerHTML = `<table>
    <thead><tr><th>Дата</th><th>Тип</th><th>Участок</th><th>Описание</th><th>Доза/степень</th><th></th></tr></thead>
    <tbody>${all.map(x => {
      const plot = data.plots.find(p => p.id === x.plotId);
      if (x.kind === 'disease') {
        return `<tr><td>${x.date}</td><td><span class="badge red">⚠️</span></td>
          <td>${escapeHtml(plot ? plot.name : '—')}</td>
          <td>${escapeHtml(x.type)}<br><small style="color:#8a7a6a;">${escapeHtml(x.note || '')}</small></td>
          <td>${sevBadge[x.severity] || '—'}</td>
          <td><button class="btn small danger" onclick="deleteItem('diseases','${x.id}')">🗑</button></td></tr>`;
      } else {
        return `<tr><td>${x.date}</td><td><span class="badge green">💊</span></td>
          <td>${escapeHtml(plot ? plot.name : '—')}</td>
          <td>${escapeHtml(x.product)}<br><small style="color:#8a7a6a;">${escapeHtml(x.note || '')}</small></td>
          <td>${escapeHtml(x.dose || '')} ${x.volume ? '· ' + x.volume + ' л' : ''} ${x.pause ? '· ⏳ ' + x.pause + ' дн' : ''}</td>
          <td><button class="btn small danger" onclick="deleteItem('treatments','${x.id}')">🗑</button></td></tr>`;
      }
    }).join('')}</tbody></table>`;
}

// ===========================================================================
