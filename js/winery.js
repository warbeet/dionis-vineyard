// ============================================================================
// WINERY module v0.7.16 — Брожение, выдержка, эталонный купаж
// ============================================================================
// Модуль первичного виноделия для ООО «Вертикаль»
// Партии сусла, дневник брожения, бочковой парк, купажный калькулятор
// ============================================================================

// Эталонный купаж № 1 (пропорции из утверждённого рецепта)
const BENCHMARK_BLEND = {
  'Мерло': 20.55,
  'Сира': 20.37,
  'Каберне Фран': 22.87,
  'Каберне Совиньон': 31.19,
  'Пти Вердо': 5.02
};

// Статусы партии брожения
const FERMENTATION_STATUSES = {
  active: { label: '🫧 Активное брожение', color: '#4CAF50' },
  pressed: { label: '🍷 Прессование', color: '#FF9800' },
  mlf: { label: '🧪 ЯМБ (яблочно-молочная ферментация)', color: '#9C27B0' },
  aging: { label: '🪵 Выдержка', color: '#795548' },
  completed: { label: '✅ Завершено', color: '#607D8B' }
};

function renderWinery() {
  const container = document.getElementById('winery-container');
  if (!container) return;
  
  if (!data.winery) data.winery = { batches: [], blendLog: [] };
  
  const batches = data.winery.batches || [];
  
  let html = `
    <div style="margin-bottom: 15px;">
      <button class="btn primary" onclick="openNewFermentationBatch()">➕ Новая партия брожения</button>
      <button class="btn secondary" onclick="openBlendCalculator()">⚖️ Купажный калькулятор</button>
    </div>
  `;
  
  if (!batches.length) {
    html += '<div class="empty">Нет партий брожения. Создайте первую из данных урожая.</div>';
  } else {
    html += batches.map(b => renderFermentationBatchCard(b)).join('');
  }
  
  container.innerHTML = html;
}

function renderFermentationBatchCard(batch) {
  const status = FERMENTATION_STATUSES[batch.status] || FERMENTATION_STATUSES.active;
  const logs = batch.fermentationLog || [];
  const lastLog = logs[logs.length - 1];
  
  // Предупреждения по температуре
  let warnings = '';
  if (lastLog) {
    if (lastLog.tempC > 30) {
      warnings += `<div style="background:#ffebee; color:#c62828; padding:8px; border-radius:6px; margin-top:8px;">⚠️ КРИТИЧНО: Температура ${lastLog.tempC}°C! Риск гибели дрожжей и потери ароматики. Охладите ёмкость!</div>`;
    } else if (lastLog.tempC < 18) {
      warnings += `<div style="background:#fff3e0; color:#e65100; padding:8px; border-radius:6px; margin-top:8px;">⚠️ Температура ${lastLog.tempC}°C — брожение может остановиться. Проверьте обогрев.</div>`;
    }
  }
  
  const allocation = batch.agingAllocation || null;
  const allocHtml = allocation ? `
    <div style="background:#f1f8e9; padding:10px; border-radius:8px; margin-top:8px; font-size:13px;">
      <strong>🪵 Выдержка:</strong> ${allocation.steelVolumeL} л сталь + ${allocation.barrelVolumeL} л дуб (${allocation.barrelCount500L} бочек × 500 л, ${allocation.barrelType})
    </div>
  ` : '';
  
  return `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-weight:600; color:#4a1f3a; font-size:16px;">${escapeHtml(batch.tankNumber)}</div>
          <div style="font-size:13px; color:#8a7a6a; margin-top:4px;">
            ${escapeHtml(batch.variety)} · ${batch.grapeWeightKg.toLocaleString('ru-RU')} кг винограда · ${batch.crushDate}
          </div>
          <div style="margin-top:6px;">
            <span class="badge" style="background:${status.color}; color:white;">${status.label}</span>
            ${lastLog ? `<span style="margin-left:8px; font-size:12px; color:#666;">Последний замер: ${lastLog.date}, ${lastLog.tempC}°C, Brix ${lastLog.brix}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:4px;">
          <button class="btn small secondary" onclick="openFermentationLog('${batch.id}')">📝 Замер</button>
          <button class="btn small secondary" onclick="openBatchDetails('${batch.id}')">📋 Детали</button>
          <button class="btn small danger" onclick="deleteBatch('${batch.id}')">🗑</button>
        </div>
      </div>
      ${warnings}
      ${allocHtml}
    </div>
  `;
}

function openNewFermentationBatch() {
  // Собираем доступные партии урожая
  const harvestOptions = (data.harvest || []).map(h => {
    const plot = data.plots.find(p => p.id === h.plotId);
    const variety = h.varietyId ? getVarietyName(h.varietyId, h.plotId) : 'Без сорта';
    return `<option value="${h.id}">${h.date} — ${escapeHtml(variety)} — ${h.weight} кг (${plot ? escapeHtml(plot.name) : '?'})</option>`;
  }).join('');
  
  const modal = document.getElementById('fermentation-modal');
  if (modal) modal.remove();
  
  const modalHtml = `
    <div class="modal-bg" id="fermentation-modal" onclick="if(event.target===this) closeModal('fermentation-modal')">
      <div class="modal wide">
        <div class="modal-header">
          <h3>🫧 Новая партия брожения</h3>
          <button class="modal-close" onclick="closeModal('fermentation-modal')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>Партия урожая</label>
            <select id="ferm-harvest-id" onchange="fillFromHarvest()">
              <option value="">— выбрать из записей урожая —</option>
              ${harvestOptions}
              <option value="manual">Ввести вручную</option>
            </select>
          </div>
          <div class="form-grid">
            <div class="form-row"><label>Сорт</label><input type="text" id="ferm-variety" placeholder="Мерло"></div>
            <div class="form-row"><label>Ёмкость</label><input type="text" id="ferm-tank" placeholder="Емкость № 1 (сталь 10 000 л)"></div>
          </div>
          <div class="form-grid">
            <div class="form-row"><label>Дата дробления</label><input type="date" id="ferm-crush-date" value="${todayStr()}"></div>
            <div class="form-row"><label>Вес винограда (кг)</label><input type="number" id="ferm-weight" step="1" placeholder="8230"></div>
          </div>
          <div class="form-grid">
            <div class="form-row"><label>Начальный Brix</label><input type="number" id="ferm-brix" step="0.1" placeholder="23.5"></div>
            <div class="form-row"><label>Начальный pH</label><input type="number" id="ferm-ph" step="0.01" placeholder="3.45"></div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeModal('fermentation-modal')">Отмена</button>
          <button class="btn primary" onclick="saveFermentationBatch()">💾 Создать партию</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  openModal('fermentation-modal');
}

function fillFromHarvest() {
  const harvestId = document.getElementById('ferm-harvest-id').value;
  if (!harvestId || harvestId === 'manual') return;
  
  const harvest = data.harvest.find(h => h.id === harvestId);
  if (!harvest) return;
  
  document.getElementById('ferm-variety').value = getVarietyName(harvest.varietyId, harvest.plotId);
  document.getElementById('ferm-weight').value = harvest.weight;
  document.getElementById('ferm-crush-date').value = harvest.date;
  if (harvest.brix) document.getElementById('ferm-brix').value = harvest.brix;
  if (harvest.ph) document.getElementById('ferm-ph').value = harvest.ph;
}

function saveFermentationBatch() {
  const variety = document.getElementById('ferm-variety').value.trim();
  const tank = document.getElementById('ferm-tank').value.trim();
  const crushDate = document.getElementById('ferm-crush-date').value;
  const weight = parseFloat(document.getElementById('ferm-weight').value) || 0;
  const brix = parseFloat(document.getElementById('ferm-brix').value) || null;
  const ph = parseFloat(document.getElementById('ferm-ph').value) || null;
  
  if (!variety || !tank || !crushDate || !weight) {
    toast('Заполните обязательные поля', 'error');
    return;
  }
  
  if (!data.winery) data.winery = { batches: [], blendLog: [] };
  
  const harvestId = document.getElementById('ferm-harvest-id').value;
  
  const batch = {
    id: 'ferm_' + Date.now(),
    harvestIds: harvestId && harvestId !== 'manual' ? [harvestId] : [],
    variety,
    tankNumber: tank,
    crushDate,
    grapeWeightKg: weight,
    mustVolumeL: Math.round(weight * 0.65), // ~650 л/т выход сусла
    initialBrix: brix,
    initialPh: ph,
    status: 'active',
    fermentationLog: [],
    agingAllocation: null
  };
  
  data.winery.batches.push(batch);
  saveData();
  closeModal('fermentation-modal');
  renderWinery();
  toast('✅ Партия брожения создана', 'success');
}

function openFermentationLog(batchId) {
  const batch = (data.winery?.batches || []).find(b => b.id === batchId);
  if (!batch) return;
  
  const modal = document.getElementById('ferm-log-modal');
  if (modal) modal.remove();
  
  const logsHtml = (batch.fermentationLog || []).map(l => `
    <tr>
      <td>${l.date}</td>
      <td>${l.tempC}°C</td>
      <td>${l.density || '—'}</td>
      <td>${l.brix || '—'}</td>
      <td style="font-size:12px;">${escapeHtml(l.note || '')}</td>
    </tr>
  `).join('');
  
  const modalHtml = `
    <div class="modal-bg" id="ferm-log-modal" onclick="if(event.target===this) closeModal('ferm-log-modal')">
      <div class="modal wide">
        <div class="modal-header">
          <h3>📝 Дневник брожения: ${escapeHtml(batch.tankNumber)}</h3>
          <button class="modal-close" onclick="closeModal('ferm-log-modal')">×</button>
        </div>
        <div class="modal-body">
          <div style="max-height:200px; overflow-y:auto; margin-bottom:15px;">
            <table style="width:100%; font-size:13px;">
              <thead><tr><th>Дата</th><th>t°C</th><th>Плотность</th><th>Brix</th><th>Заметка</th></tr></thead>
              <tbody>${logsHtml || '<tr><td colspan="5" style="text-align:center; color:#999;">Нет записей</td></tr>'}</tbody>
            </table>
          </div>
          <h4>Новый замер</h4>
          <div class="form-grid">
            <div class="form-row"><label>Дата</label><input type="date" id="log-date" value="${todayStr()}"></div>
            <div class="form-row"><label>Температура (°C)</label><input type="number" id="log-temp" step="0.1" placeholder="24.5"></div>
          </div>
          <div class="form-grid">
            <div class="form-row"><label>Плотность</label><input type="number" id="log-density" step="0.001" placeholder="1.060"></div>
            <div class="form-row"><label>Brix</label><input type="number" id="log-brix" step="0.1" placeholder="15.0"></div>
          </div>
          <div class="form-row"><label>Операция / Заметка</label>
            <select id="log-operation">
              <option value="">— операция —</option>
              <option value="Ремонтаж">Ремонтаж (перемешивание)</option>
              <option value="Пижаж">Пижаж (продавливание шапки)</option>
              <option value="Заданы ЧКД">Заданы ЧКД (дрожжи)</option>
              <option value="Снято с мезги">Снято с мезги / прессование</option>
              <option value="ЯМБ начата">ЯМБ начата</option>
              <option value="ЯМБ завершена">ЯМБ завершена</option>
              <option value="Перевод в дуб">Перевод в дубовые бочки</option>
              <option value="Другое">Другое</option>
            </select>
          </div>
          <div class="form-row"><label>Дополнительно</label><input type="text" id="log-note" placeholder="Дополнительные заметки"></div>
          
          <div style="margin-top:15px;">
            <label>Статус партии</label>
            <select id="log-status">
              ${Object.entries(FERMENTATION_STATUSES).map(([k, v]) => 
                `<option value="${k}" ${batch.status === k ? 'selected' : ''}>${v.label}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeModal('ferm-log-modal')">Отмена</button>
          <button class="btn primary" onclick="saveFermentationLog('${batchId}')">💾 Сохранить замер</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  openModal('ferm-log-modal');
}

function saveFermentationLog(batchId) {
  const batch = (data.winery?.batches || []).find(b => b.id === batchId);
  if (!batch) return;
  
  const date = document.getElementById('log-date').value;
  const tempC = parseFloat(document.getElementById('log-temp').value);
  const density = parseFloat(document.getElementById('log-density').value) || null;
  const brix = parseFloat(document.getElementById('log-brix').value) || null;
  const operation = document.getElementById('log-operation').value;
  const note = document.getElementById('log-note').value.trim();
  const newStatus = document.getElementById('log-status').value;
  
  if (!date || tempC == null) {
    toast('Заполните дату и температуру', 'error');
    return;
  }
  
  if (!batch.fermentationLog) batch.fermentationLog = [];
  
  let fullNote = note;
  if (operation) fullNote = (fullNote ? operation + '. ' + fullNote : operation);
  
  batch.fermentationLog.push({
    date,
    tempC,
    density,
    brix,
    note: fullNote
  });
  
  batch.status = newStatus;
  
  // Автоматический расчёт распределения на выдержку при переходе в aging
  if (newStatus === 'aging' && !batch.agingAllocation) {
    const mustVol = batch.mustVolumeL || Math.round(batch.grapeWeightKg * 0.65);
    const steelVol = Math.round(mustVol * 0.5);
    const barrelVol = Math.round(mustVol * 0.5);
    const barrelCount = Math.ceil(barrelVol / 500);
    
    batch.agingAllocation = {
      steelVolumeL: steelVol,
      barrelVolumeL: barrelVol,
      barrelCount500L: barrelCount,
      barrelType: '75% новые / 25% б/у'
    };
  }
  
  saveData();
  closeModal('ferm-log-modal');
  renderWinery();
  toast('✅ Замер сохранён', 'success');
}

function openBatchDetails(batchId) {
  const batch = (data.winery?.batches || []).find(b => b.id === batchId);
  if (!batch) return;
  
  const modal = document.getElementById('batch-details-modal');
  if (modal) modal.remove();
  
  const logsHtml = (batch.fermentationLog || []).map(l => `
    <tr>
      <td>${l.date}</td>
      <td>${l.tempC}°C</td>
      <td>${l.density || '—'}</td>
      <td>${l.brix || '—'}</td>
      <td style="font-size:12px;">${escapeHtml(l.note || '')}</td>
    </tr>
  `).join('');
  
  const alloc = batch.agingAllocation;
  const allocHtml = alloc ? `
    <div style="background:#f1f8e9; padding:15px; border-radius:8px; margin-top:15px;">
      <h4>🪵 Распределение на выдержку</h4>
      <p>Сталь: <strong>${alloc.steelVolumeL} л</strong></p>
      <p>Дуб: <strong>${alloc.barrelVolumeL} л</strong> (${alloc.barrelCount500L} бочек × 500 л, ${alloc.barrelType})</p>
    </div>
  ` : '';
  
  const modalHtml = `
    <div class="modal-bg" id="batch-details-modal" onclick="if(event.target===this) closeModal('batch-details-modal')">
      <div class="modal wide">
        <div class="modal-header">
          <h3>📋 Детали партии: ${escapeHtml(batch.tankNumber)}</h3>
          <button class="modal-close" onclick="closeModal('batch-details-modal')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div><strong>Сорт:</strong> ${escapeHtml(batch.variety)}</div>
            <div><strong>Дата дробления:</strong> ${batch.crushDate}</div>
            <div><strong>Вес винограда:</strong> ${batch.grapeWeightKg.toLocaleString('ru-RU')} кг</div>
            <div><strong>Объём сусла:</strong> ~${batch.mustVolumeL.toLocaleString('ru-RU')} л</div>
            <div><strong>Начальный Brix:</strong> ${batch.initialBrix || '—'}</div>
            <div><strong>Начальный pH:</strong> ${batch.initialPh || '—'}</div>
          </div>
          
          ${allocHtml}
          
          <h4 style="margin-top:15px;">📈 Дневник брожения (${batch.fermentationLog.length} записей)</h4>
          <div style="max-height:300px; overflow-y:auto;">
            <table style="width:100%; font-size:13px;">
              <thead><tr><th>Дата</th><th>t°C</th><th>Плотность</th><th>Brix</th><th>Заметка</th></tr></thead>
              <tbody>${logsHtml || '<tr><td colspan="5" style="text-align:center; color:#999;">Нет записей</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeModal('batch-details-modal')">Закрыть</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  openModal('batch-details-modal');
}

function deleteBatch(batchId) {
  if (!confirm('Удалить партию брожения? Это действие необратимо.')) return;
  data.winery.batches = (data.winery.batches || []).filter(b => b.id !== batchId);
  saveData();
  renderWinery();
  toast('🗑 Партия удалена', 'success');
}

// ===== КУПАЖНЫЙ КАЛЬКУЛЯТОР =====

function openBlendCalculator() {
  const modal = document.getElementById('blend-calc-modal');
  if (modal) modal.remove();
  
  // Доступные сорта из партий брожения
  const availableVarieties = [...new Set((data.winery?.batches || []).map(b => b.variety))];
  
  const modalHtml = `
    <div class="modal-bg" id="blend-calc-modal" onclick="if(event.target===this) closeModal('blend-calc-modal')">
      <div class="modal wide">
        <div class="modal-header">
          <h3>⚖️ Эталонный купаж № 1</h3>
          <button class="modal-close" onclick="closeModal('blend-calc-modal')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>Целевой объём купажной партии (л)</label>
            <input type="number" id="blend-target-volume" value="500" step="50" min="50" oninput="recalculateBlend()">
          </div>
          
          <div id="blend-proportions" style="margin-top:15px;"></div>
          
          <div style="background:#e8f5e9; padding:15px; border-radius:8px; margin-top:15px;">
            <strong>📖 Рецепт эталонного купажа № 1:</strong>
            <ul style="margin:8px 0 0 0; font-size:13px; line-height:1.8;">
              <li>Мерло — 20,55%</li>
              <li>Сира — 20,37%</li>
              <li>Каберне Фран — 22,87%</li>
              <li>Каберне Совиньон — 31,19%</li>
              <li>Пти Вердо — 5,02%</li>
            </ul>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeModal('blend-calc-modal')">Закрыть</button>
          <button class="btn primary" onclick="saveBlendAsBatch()">💾 Сохранить как партию купажа</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  openModal('blend-calc-modal');
  recalculateBlend();
}

function recalculateBlend() {
  const targetVolume = parseFloat(document.getElementById('blend-target-volume').value) || 500;
  const container = document.getElementById('blend-proportions');
  
  const rows = Object.entries(BENCHMARK_BLEND).map(([variety, percent]) => {
    const volume = (targetVolume * percent / 100).toFixed(2);
    return `
      <tr>
        <td><strong>${variety}</strong></td>
        <td>${percent}%</td>
        <td><strong>${volume} л</strong></td>
      </tr>
    `;
  }).join('');
  
  container.innerHTML = `
    <table style="width:100%;">
      <thead>
        <tr><th>Сорт</th><th>Доля</th><th>Объём</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="font-weight:bold; background:#f5f5f5;">
          <td>ИТОГО</td>
          <td>100%</td>
          <td>${targetVolume} л</td>
        </tr>
      </tfoot>
    </table>
  `;
}

function saveBlendAsBatch() {
  const targetVolume = parseFloat(document.getElementById('blend-target-volume').value) || 500;
  
  if (!data.winery) data.winery = { batches: [], blendLog: [] };
  
  const blendEntry = {
    id: 'blend_' + Date.now(),
    date: todayStr(),
    targetVolume,
    proportions: { ...BENCHMARK_BLEND },
    volumes: {}
  };
  
  Object.entries(BENCHMARK_BLEND).forEach(([variety, percent]) => {
    blendEntry.volumes[variety] = (targetVolume * percent / 100).toFixed(2);
  });
  
  data.winery.blendLog.push(blendEntry);
  saveData();
  
  toast(`✅ Купаж сохранён: ${targetVolume} л (${Object.keys(BENCHMARK_BLEND).length} сортов)`, 'success');
  closeModal('blend-calc-modal');
}
