// ============================================================================
// REPLANTING REPORT v0.8.7 — Ведомость весеннего ремонта насаждений
// ============================================================================
// Отчёт о потребности в саженцах для восстановления проектной плотности
// Данные инвентаризации 2026: 12 712 выпадов (31.1% от 40 869)
// ============================================================================

function showReplantingReport() {
  const modal = document.getElementById('replanting-modal');
  if (modal) modal.remove();
  
  // Данные по сортам из инвентаризации 2026
  const varietyData = [
    { name: 'Каберне Совиньон', planted: 12682, alive: 8044, fallout: 4638, percent: 36.57 },
    { name: 'Мерло', planted: 8400, alive: 4719, fallout: 3681, percent: 43.82 },
    { name: 'Каберне Фран', planted: 9441, alive: 6927, fallout: 2514, percent: 26.63 },
    { name: 'Сира', planted: 8282, alive: 6835, fallout: 1447, percent: 17.47 },
    { name: 'Пти Вердо', planted: 2064, alive: 1632, fallout: 432, percent: 20.93 }
  ];
  
  const totalPlanted = varietyData.reduce((s, v) => s + v.planted, 0);
  const totalAlive = varietyData.reduce((s, v) => s + v.alive, 0);
  const totalFallout = varietyData.reduce((s, v) => s + v.fallout, 0);
  const totalPercent = (totalFallout / totalPlanted * 100).toFixed(2);
  
  const modalHtml = `
    <div class="modal-bg" id="replanting-modal" onclick="if(event.target===this) closeModal('replanting-modal')">
      <div class="modal wide">
        <div class="modal-header">
          <h3>🌱 Заказ саженцев под ремонт шпалеры</h3>
          <button class="modal-close" onclick="closeModal('replanting-modal')">×</button>
        </div>
        <div class="modal-body">
          <div style="background: rgba(212, 175, 55, 0.1); padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(212, 175, 55, 0.3);">
            <h4 style="margin: 0 0 8px 0; color: var(--primary);">📊 Инвентаризация 2026</h4>
            <p style="margin: 0; font-size: 14px; line-height: 1.6;">
              <strong>Всего высажено (2024):</strong> ${totalPlanted.toLocaleString('ru-RU')} кустов<br>
              <strong>Живых (2026):</strong> ${totalAlive.toLocaleString('ru-RU')} кустов (${(totalAlive/totalPlanted*100).toFixed(1)}%)<br>
              <strong>Выпад:</strong> ${totalFallout.toLocaleString('ru-RU')} кустов (${totalPercent}%)<br>
              <strong>Потребность в ремонте:</strong> <span style="font-size: 18px; font-weight: 700; color: var(--accent);">${totalFallout.toLocaleString('ru-RU')} саженцев</span>
            </p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color, #ddd);">
                <th style="text-align: left; padding: 10px 8px;">Сорт</th>
                <th style="text-align: right; padding: 10px 8px;">Высажено</th>
                <th style="text-align: right; padding: 10px 8px;">Живых</th>
                <th style="text-align: right; padding: 10px 8px;">Выпад</th>
                <th style="text-align: right; padding: 10px 8px;">%</th>
              </tr>
            </thead>
            <tbody>
              ${varietyData.map(v => `
                <tr style="border-bottom: 1px solid var(--border-color, #eee);">
                  <td style="padding: 10px 8px; font-weight: 600;">${v.name}</td>
                  <td style="padding: 10px 8px; text-align: right;">${v.planted.toLocaleString('ru-RU')}</td>
                  <td style="padding: 10px 8px; text-align: right; color: var(--success);">${v.alive.toLocaleString('ru-RU')}</td>
                  <td style="padding: 10px 8px; text-align: right; color: var(--danger); font-weight: 600;">${v.fallout.toLocaleString('ru-RU')}</td>
                  <td style="padding: 10px 8px; text-align: right;">${v.percent.toFixed(2)}%</td>
                </tr>
              `).join('')}
              <tr style="border-top: 2px solid var(--border-color, #ddd); font-weight: 700; background: var(--bg-hover, #f5f5f5);">
                <td style="padding: 12px 8px;">ИТОГО</td>
                <td style="padding: 12px 8px; text-align: right;">${totalPlanted.toLocaleString('ru-RU')}</td>
                <td style="padding: 12px 8px; text-align: right; color: var(--success);">${totalAlive.toLocaleString('ru-RU')}</td>
                <td style="padding: 12px 8px; text-align: right; color: var(--danger);">${totalFallout.toLocaleString('ru-RU')}</td>
                <td style="padding: 12px 8px; text-align: right;">${totalPercent}%</td>
              </tr>
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 16px; background: var(--bg-input, #f0f0f0); border-radius: 12px; font-size: 13px; line-height: 1.6;">
            <strong>📋 Рекомендации по ремонту:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Наибольший выпад: <strong>Мерло</strong> (43.8%) — приоритетная замена</li>
              <li>Наименьший выпад: <strong>Сира</strong> (17.5%) — хорошее приживание</li>
              <li>Рекомендуемый срок посадки: <strong>март-апрель 2027</strong></li>
              <li>Резерв саженцев: +10% на случай дополнительного выпада</li>
            </ul>
          </div>
          
          <div style="margin-top: 16px; display: flex; gap: 10px;">
            <button class="btn primary" onclick="exportReplantingCSV()">📥 Экспорт CSV</button>
            <button class="btn secondary" onclick="closeModal('replanting-modal')">Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  openModal('replanting-modal');
}

function exportReplantingCSV() {
  const varietyData = [
    { name: 'Каберне Совиньон', planted: 12682, alive: 8044, fallout: 4638, percent: 36.57 },
    { name: 'Мерло', planted: 8400, alive: 4719, fallout: 3681, percent: 43.82 },
    { name: 'Каберне Фран', planted: 9441, alive: 6927, fallout: 2514, percent: 26.63 },
    { name: 'Сира', planted: 8282, alive: 6835, fallout: 1447, percent: 17.47 },
    { name: 'Пти Вердо', planted: 2064, alive: 1632, fallout: 432, percent: 20.93 }
  ];
  
  const headers = ['Сорт', 'Высажено (2024)', 'Живых (2026)', 'Выпад (шт)', 'Выпад (%)'];
  const rows = varietyData.map(v => [
    v.name, v.planted, v.alive, v.fallout, v.percent.toFixed(2) + '%'
  ]);
  
  const totalPlanted = varietyData.reduce((s, v) => s + v.planted, 0);
  const totalAlive = varietyData.reduce((s, v) => s + v.alive, 0);
  const totalFallout = varietyData.reduce((s, v) => s + v.fallout, 0);
  rows.push(['ИТОГО', totalPlanted, totalAlive, totalFallout, (totalFallout/totalPlanted*100).toFixed(2) + '%']);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ремонт_насаждений_2026.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ CSV экспортирован', 'success');
}
