// ============================================================================
// JOURNAL module
// ============================================================================

// JOURNAL
// ===========================================================================
function openJournalModal(id) {
  ['j-date','j-worker','j-hours','j-cost','j-desc'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('journal-id').value = '';
  document.getElementById('j-date').value = todayStr();
  if (id) {
    const j = data.journal.find(x => x.id === id);
    if (j) {
      document.getElementById('journal-id').value = j.id;
      ['date','type','plot','worker','hours','cost','desc'].forEach(k => {
        const el = document.getElementById('j-' + (k === 'plot' ? 'plot' : k));
        if (el) el.value = (k === 'plot' ? j.plotId : j[k]) || '';
      });
    }
  }
  openModal('journal-modal');
}

function saveJournal() {
  if (!requirePermission('journal.edit', 'Нет прав на ведение журнала')) return;
  const id = document.getElementById('journal-id').value || ('j_' + Date.now());
  const entry = {
    id,
    date: document.getElementById('j-date').value,
    type: document.getElementById('j-type').value,
    plotId: document.getElementById('j-plot').value,
    worker: document.getElementById('j-worker').value.trim(),
    hours: parseFloat(document.getElementById('j-hours').value) || 0,
    cost: parseFloat(document.getElementById('j-cost').value) || 0,
    desc: document.getElementById('j-desc').value.trim()
  };
  if (!entry.date) { toast('Укажите дату', 'error'); return; }
  const idx = data.journal.findIndex(j => j.id === id);
  if (idx >= 0) data.journal[idx] = entry; else data.journal.push(entry);
  data.journal.sort((a, b) => b.date.localeCompare(a.date));
  saveData();
  closeModal('journal-modal');
  renderAll();
}

function deleteJournal(id) {
  if (!requirePermission('journal.edit', 'Нет прав на удаление записей журнала')) return;
  if (!confirm('Удалить?')) return;
  data.journal = data.journal.filter(j => j.id !== id);
  saveData();
  renderAll();
}

function renderJournal() {
  const list = document.getElementById('journal-list');
  const filter = document.getElementById('journal-filter').value;
  let entries = data.journal;
  if (filter) entries = entries.filter(j => j.type === filter);
  if (!entries.length) { list.innerHTML = '<div class="empty">Нет записей.</div>'; return; }
  list.innerHTML = `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th>Дата</th><th>Тип</th><th>Участок</th><th>Описание</th><th>Часы</th><th>$</th><th></th></tr></thead>
    <tbody>${entries.map(j => {
      const plot = data.plots.find(p => p.id === j.plotId);
      return `<tr>
        <td>${j.date}</td><td><span class="badge blue">${j.type}</span></td>
        <td>${escapeHtml(plot ? plot.name : '—')}</td><td>${escapeHtml(j.desc || '')}</td>
        <td>${j.hours || '—'}</td><td>${j.cost ? j.cost.toFixed(2) : '—'}</td>
        <td><button class="btn small secondary" onclick="openJournalModal('${j.id}')">✏️</button>
            <button class="btn small danger" onclick="deleteJournal('${j.id}')">🗑</button></td>
      </tr>`;
    }).join('')}</tbody></table></div></div>`;
}

// ===========================================================================
