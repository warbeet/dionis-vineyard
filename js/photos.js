// ============================================================================
// PHOTOS module
// ============================================================================

// PHOTOS
// ===========================================================================
// Делегируем событие на body, чтобы работало даже если #photo-files
// добавится позже (через динамическую загрузку секций)
document.addEventListener('change', async (e) => {
  if (e.target && e.target.id === 'photo-files') {
    const files = Array.from(e.target.files);
    for (const f of files) {
      const compressed = await compressImage(f);
      pendingPhotos.push(compressed);
    }
    renderPhotoPreview();
  }
});

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1024;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = h * maxDim / w; w = maxDim; }
          else { w = w * maxDim / h; h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview() {
  document.getElementById('photo-preview').innerHTML = pendingPhotos.map((p, i) => `
    <div class="photo-thumb"><img src="${p}"><button class="remove" onclick="removePending(${i})">×</button></div>
  `).join('');
}

function removePending(i) { pendingPhotos.splice(i, 1); renderPhotoPreview(); }

function savePhotoReport() {
  const date = document.getElementById('photo-date').value;
  const plotId = document.getElementById('photo-plot').value;
  const note = document.getElementById('photo-note').value.trim();
  if (!date || !plotId) { toast('Укажите дату и участок', 'error'); return; }
  if (!pendingPhotos.length && !note) { toast('Добавьте фото или комментарий', 'error'); return; }

  data.photoReports.unshift({
    id: 'r_' + Date.now(),
    date, plotId, note, photos: [...pendingPhotos],
    createdAt: new Date().toISOString()
  });
  saveData();
  pendingPhotos = [];
  document.getElementById('photo-files').value = '';
  document.getElementById('photo-note').value = '';
  renderPhotoPreview();
  generateRecommendations();
  renderAll();
  toast('✅ Отчёт сохранён', 'success');
}

function deletePhotoReport(id) {
  if (!confirm('Удалить отчёт?')) return;
  data.photoReports = data.photoReports.filter(r => r.id !== id);
  saveData();
  renderAll();
}

function viewPhotoReport(id) {
  const r = data.photoReports.find(x => x.id === id);
  if (!r) return;
  const plot = data.plots.find(p => p.id === r.plotId);
  document.getElementById('photo-modal-title').textContent = `Отчёт ${r.date} — ${plot ? plot.name : '?'}`;
  document.getElementById('photo-modal').dataset.reportId = id;
  let aiHtml = '';
  if (r.aiAnalysis) {
    const a = r.aiAnalysis;
    const statusBadge = { healthy: '<span class="badge green">✅ Здоров</span>', attention: '<span class="badge yellow">⚠️ Требует внимания</span>', critical: '<span class="badge red">🚨 Критично</span>' };
    aiHtml = `
      <div class="ai-recommendation">
        <h4>🤖 AI-анализ ${statusBadge[a.overall_status] || ''}</h4>
        ${a.observation ? `<p style="margin-bottom:8px;"><b>Наблюдение:</b> ${escapeHtml(a.observation)}</p>` : ''}
        ${a.issues && a.issues.length ? `<div style="margin-bottom:8px;"><b>Проблемы:</b><ul style="margin-left:20px;">${a.issues.map(i => `<li>${escapeHtml(i.name)} (${i.severity}) — ${escapeHtml(i.evidence || '')}</li>`).join('')}</ul></div>` : ''}
        ${a.recommendations && a.recommendations.length ? `<div><b>Рекомендации:</b><ul style="margin-left:20px;">${a.recommendations.map(rec => `<li><b>${escapeHtml(rec.title || '')}:</b> ${escapeHtml(rec.text || '')}</li>`).join('')}</ul></div>` : ''}
        <div class="ai-source">Модель: ${escapeHtml(r.aiModel || 'неизвестно')}</div>
      </div>
    `;
  } else if (r.aiError) {
    aiHtml = `<div class="alert danger">AI-ошибка: ${escapeHtml(r.aiError)}</div>`;
  }
  document.getElementById('photo-modal-content').innerHTML = `
    ${r.note ? `<p style="background:#faf8f3; padding:12px; border-radius:8px; margin-bottom:12px;">${escapeHtml(r.note)}</p>` : ''}
    <div class="photo-grid">${r.photos.map(p => `<div class="photo-thumb"><img src="${p}"></div>`).join('')}</div>
    ${aiHtml}
  `;
  openModal('photo-modal');
}

function renderPhotoReports() {
  const list = document.getElementById('photo-reports-list');
  if (!data.photoReports.length) { list.innerHTML = '<div class="empty">Пока нет отчётов.</div>'; return; }
  list.innerHTML = data.photoReports.map(r => {
    const plot = data.plots.find(p => p.id === r.plotId);
    const aiBadge = r.aiAnalysis ? '<span class="badge green">🤖 AI</span>' : '';
    return `<div class="card" style="margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">
        <div>
          <strong>${r.date}</strong> · ${escapeHtml(plot ? plot.name : 'участок удалён')}
          <span class="badge blue" style="margin-left:6px;">${r.photos.length} фото</span>
          ${aiBadge}
        </div>
        <div style="display:flex; gap:4px;">
          <button class="btn small" onclick="viewPhotoReport('${r.id}')">👁</button>
          <button class="btn small danger" onclick="deletePhotoReport('${r.id}')">🗑</button>
        </div>
      </div>
      ${r.note ? `<p style="margin-top:6px; font-size:13px; color:#6b5a4a;">${escapeHtml(r.note.substring(0,150))}${r.note.length > 150 ? '...' : ''}</p>` : ''}
    </div>`;
  }).join('');
}

// ===========================================================================
