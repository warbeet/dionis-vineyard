// ============================================================================
// PHOTOS module v0.7.18 — с поддержкой Яндекс.Диска
// ============================================================================

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
        const maxDim = 1280; // v0.7.18: увеличил до 1280 для лучшего качества
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = h * maxDim / w; w = maxDim; }
          else { w = w * maxDim / h; h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        // v0.7.18: сжатие 0.85 вместо 0.7
        resolve(canvas.toDataURL('image/jpeg', 0.85));
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

async function savePhotoReport() {
  if (!requirePermission('photos.create', 'Нет прав на добавление фотоотчётов')) return;
  const date = document.getElementById('photo-date').value;
  const plotId = document.getElementById('photo-plot').value;
  const note = document.getElementById('photo-note').value.trim();
  if (!date || !plotId) { toast('Укажите дату и участок', 'error'); return; }
  if (!pendingPhotos.length && !note) { toast('Добавьте фото или комментарий', 'error'); return; }

  const plot = data.plots.find(p => p.id === plotId);
  const plotName = plot ? plot.name : 'unknown';
  
  // v0.7.18: Загрузка в Яндекс.Диск если настроен
  const yandexDiskEnabled = settings.yandexDiskEnabled && settings.yandexDiskToken;
  let photosData = [];
  
  if (yandexDiskEnabled && pendingPhotos.length > 0) {
    toast('📤 Загрузка фото в Яндекс.Диск...', 'info');
    
    for (let i = 0; i < pendingPhotos.length; i++) {
      const dataUrl = pendingPhotos[i];
      
      try {
        // Конвертировать dataURL в Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        // Путь на Диске: Dionis/Фотоотчёты/2026-10/plot_name_20261025_1420_1.jpg
        const dateParts = date.split('-');
        const month = `${dateParts[0]}-${dateParts[1]}`;
        const safePlotName = plotName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
        const timeStr = new Date().toISOString().slice(11, 16).replace(':', '');
        const filePath = `Dionis/Фотоотчёты/${month}/${safePlotName}_${date.replace(/-/g, '')}_${timeStr}_${i + 1}.jpg`;
        
        // Загрузить на Диск
        const uploadResult = await YandexDisk.uploadFile(blob, filePath);
        
        if (uploadResult.success) {
          // Получить публичную ссылку
          const linkResult = await YandexDisk.getPublicLink(filePath);
          
          photosData.push({
            path: filePath,
            url: linkResult.success ? linkResult.publicUrl : null,
            local: dataUrl // fallback если не получил публичную ссылку
          });
        } else {
          console.error('Upload failed:', uploadResult.error);
          // Fallback: сохранить локально
          photosData.push({
            local: dataUrl,
            error: uploadResult.error
          });
        }
      } catch (error) {
        console.error('Photo upload error:', error);
        // Fallback: сохранить локально
        photosData.push({
          local: dataUrl,
          error: error.message
        });
      }
    }
    
    // Добавить в оффлайн-очередь если есть ошибки
    const failedUploads = photosData.filter(p => p.error);
    if (failedUploads.length > 0) {
      await addToOfflineQueue({
        date,
        plotId,
        note,
        photos: failedUploads,
        retryCount: 0
      });
    }
    
    toast(`✅ Загружено ${photosData.filter(p => !p.error).length}/${photosData.length} фото`, 'success');
  } else {
    // Старый режим: сохранение локально
    photosData = pendingPhotos.map(dataUrl => ({ local: dataUrl }));
  }

  data.photoReports.unshift({
    id: 'r_' + Date.now(),
    date, plotId, note, photos: photosData,
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
  if (!requirePermission('photos.create', 'Нет прав на удаление фотоотчётов')) return;
  if (!confirm('Удалить отчёт?')) return;
  
  const report = data.photoReports.find(r => r.id === id);
  
  // v0.7.18: Удаление с Яндекс.Диска если настроен
  if (settings.yandexDiskEnabled && settings.yandexDiskToken && report) {
    report.photos.forEach(photo => {
      if (photo.path) {
        YandexDisk.deleteFile(photo.path).catch(err => {
          console.error('Failed to delete from Yandex.Disk:', err);
        });
      }
    });
  }
  
  data.photoReports = data.photoReports.filter(r => r.id !== id);
  saveData();
  renderAll();
}

// ===== OFFLINE QUEUE (IndexedDB) =====

const DB_NAME = 'DionisOfflineQueue';
const DB_VERSION = 1;
const STORE_NAME = 'pendingUploads';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function addToOfflineQueue(item) {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    item.addedAt = new Date().toISOString();
    store.add(item);
    
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = reject;
    });
    
    console.log('Added to offline queue:', item);
  } catch (error) {
    console.error('Failed to add to offline queue:', error);
  }
}

async function processOfflineQueue() {
  if (!navigator.onLine) return;
  if (!settings.yandexDiskEnabled || !settings.yandexDiskToken) return;
  
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    await new Promise((resolve, reject) => {
      request.onsuccess = resolve;
      request.onerror = reject;
    });
    
    const pendingItems = request.result;
    
    if (pendingItems.length === 0) return;
    
    console.log(`Processing ${pendingItems.length} offline uploads...`);
    
    for (const item of pendingItems) {
      const plot = data.plots.find(p => p.id === item.plotId);
      const plotName = plot ? plot.name : 'unknown';
      
      for (const photo of item.photos) {
        if (!photo.local) continue;
        
        try {
          const response = await fetch(photo.local);
          const blob = await response.blob();
          
          const dateParts = item.date.split('-');
          const month = `${dateParts[0]}-${dateParts[1]}`;
          const safePlotName = plotName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
          const timeStr = new Date().toISOString().slice(11, 16).replace(':', '');
          const filePath = `Dionis/Фотоотчёты/${month}/${safePlotName}_${item.date.replace(/-/g, '')}_${timeStr}.jpg`;
          
          const uploadResult = await YandexDisk.uploadFile(blob, filePath);
          
          if (uploadResult.success) {
            // Обновить запись в photoReports
            const report = data.photoReports.find(r => 
              r.date === item.date && r.plotId === item.plotId && r.note === item.note
            );
            
            if (report) {
              const photoIndex = report.photos.findIndex(p => p.local === photo.local);
              if (photoIndex !== -1) {
                const linkResult = await YandexDisk.getPublicLink(filePath);
                report.photos[photoIndex] = {
                  path: filePath,
                  url: linkResult.success ? linkResult.publicUrl : null
                };
                saveData();
              }
            }
            
            // Удалить из очереди
            const deleteTransaction = db.transaction([STORE_NAME], 'readwrite');
            const deleteStore = deleteTransaction.objectStore(STORE_NAME);
            deleteStore.delete(item.id);
            
            await new Promise((resolve, reject) => {
              deleteTransaction.oncomplete = resolve;
              deleteTransaction.onerror = reject;
            });
          }
        } catch (error) {
          console.error('Failed to re-upload:', error);
        }
      }
    }
    
    if (pendingItems.length > 0) {
      toast(`✅ Оффлайн-очередь обработана: ${pendingItems.length} фото загружено`, 'success');
      renderAll();
    }
  } catch (error) {
    console.error('Failed to process offline queue:', error);
  }
}

// Проверять очередь при восстановлении связи
window.addEventListener('online', () => {
  setTimeout(processOfflineQueue, 3000);
});

// Проверять очередь при загрузке
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(processOfflineQueue, 5000);
});

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
  }
  const photosHtml = (r.photos || []).map(p => {
    const src = p.url || p.local;
    if (!src) return '<div class="photo-thumb" style="opacity:0.5;"><div style="text-align:center; font-size:11px; color:#999;">⚠️ Ошибка загрузки</div></div>';
    return `<div class="photo-thumb"><img src="${src}" loading="lazy"></div>`;
  }).join('');
  
  document.getElementById('photo-modal').innerHTML = `
    <div style="padding:20px;">
      <h3>${escapeHtml(r.note || 'Без комментария')}</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:10px; margin-top:15px;">
        ${photosHtml}
      </div>
      ${aiHtml}
      <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
        <button class="btn secondary" onclick="closeModal('photo-modal')">Закрыть</button>
        <button class="btn danger" onclick="deletePhotoReport('${r.id}'); closeModal('photo-modal')">🗑 Удалить</button>
      </div>
    </div>
  `;
  openModal('photo-modal');
}

function renderPhotos() {
  const div = document.getElementById('photos-list');
  if (!div) return;
  if (!data.photoReports || !data.photoReports.length) {
    div.innerHTML = '<div class="empty">Нет отчётов</div>';
    return;
  }
  div.innerHTML = data.photoReports.map(r => {
    const plot = data.plots.find(p => p.id === r.plotId);
    const photoCount = (r.photos || []).length;
    const yandexIcon = r.photos.some(p => p.path) ? '☁️' : '';
    return `
      <div class="card" onclick="viewPhotoReport('${r.id}')" style="cursor:pointer;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="font-weight:600; color:#4a1f3a;">📸 ${r.date}</div>
            <div style="font-size:13px; color:#8a7a6a; margin-top:4px;">📍 ${plot ? escapeHtml(plot.name) : '?'}</div>
            ${r.note ? `<div style="font-size:13px; color:#6b5a4a; margin-top:4px;">${escapeHtml(r.note)}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px; color:#8a7a6a;">${photoCount} фото ${yandexIcon}</div>
            ${r.aiAnalysis ? `<span class="badge blue">🤖 AI</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}
