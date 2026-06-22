// ============================================================================
// REPORTS module
// ============================================================================

// PDF REPORTS
// ===========================================================================
function setupPDF(doc, title) {
  // Поддержка кириллицы — используем встроенный шрифт + fallback
  // jsPDF по умолчанию latin1, для кириллицы лучше встроить шрифт
  // Используем helvetica + кириллицу через base64 encoding
  doc.setFont('helvetica');
  doc.setFontSize(18);
  doc.setTextColor(74, 31, 58);
  doc.text(title, 14, 20);
  doc.setDrawColor(139, 58, 92);
  doc.setLineWidth(0.5);
  doc.line(14, 24, 196, 24);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Сформировано: ${new Date().toLocaleString('ru-RU')}`, 14, 30);
  return 36;
}

// Загружаем шрифт с кириллицей при первом использовании
let cyrillicFontLoaded = false;
async function loadCyrillicFont(doc) {
  if (cyrillicFontLoaded) return;
  try {
    // Roboto Regular с кириллицей
    const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/robotocondensed/RobotoCondensed-Regular.ttf';
    const r = await fetch(fontUrl);
    const buf = await r.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    doc.addFileToVFS('Roboto.ttf', base64);
    doc.addFont('Roboto.ttf', 'Roboto', 'normal');
    cyrillicFontLoaded = true;
  } catch(e) { console.warn('Font load failed', e); }
}

async function generateWeeklyPDF() {
  if (!requirePermission('reports.export', 'Нет прав на экспорт отчётов')) return;
  const from = document.getElementById('rep-week-from').value || new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const to = document.getElementById('rep-week-to').value || todayStr();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  await loadCyrillicFont(doc);
  if (cyrillicFontLoaded) doc.setFont('Roboto');

  let y = setupPDF(doc, `Еженедельный отчёт ${from} — ${to}`);
  if (cyrillicFontLoaded) doc.setFont('Roboto');

  // Общая статистика
  doc.setFontSize(11); doc.setTextColor(60, 60, 60);
  doc.text(`Участков: ${data.plots.length}`, 14, y); y += 6;
  doc.text(`Площадь: ${data.plots.reduce((s,p)=>s+(p.area||0),0).toFixed(2)} га`, 14, y); y += 6;
  const phase = PHENO_STAGES.find(s => s.id === data.currentPheno);
  doc.text(`Фенофаза: ${phase ? phase.name : 'не указана'}`, 14, y); y += 10;

  // Фотоотчёты
  const reports = data.photoReports.filter(r => r.date >= from && r.date <= to);
  if (reports.length) {
    doc.setFontSize(13); doc.setTextColor(74, 31, 58);
    doc.text(`📸 Фотоотчёты (${reports.length})`, 14, y); y += 7;
    doc.autoTable({
      startY: y, styles: { font: cyrillicFontLoaded ? 'Roboto' : 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [139, 58, 92] },
      head: [['Дата', 'Участок', 'Фото', 'Заметки']],
      body: reports.map(r => {
        const plot = data.plots.find(p => p.id === r.plotId);
        return [r.date, plot ? plot.name : '—', r.photos.length, (r.note || '').slice(0, 80)];
      })
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Журнал работ
  const journal = data.journal.filter(j => j.date >= from && j.date <= to);
  if (journal.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13); doc.setTextColor(74, 31, 58);
    doc.text(`📔 Журнал работ (${journal.length})`, 14, y); y += 7;
    doc.autoTable({
      startY: y, styles: { font: cyrillicFontLoaded ? 'Roboto' : 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [139, 58, 92] },
      head: [['Дата', 'Тип', 'Участок', 'Описание', 'Часы']],
      body: journal.map(j => {
        const plot = data.plots.find(p => p.id === j.plotId);
        return [j.date, j.type, plot ? plot.name : '—', (j.desc||'').slice(0,60), j.hours || '—'];
      })
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Обработки
  const treatments = data.treatments.filter(t => t.date >= from && t.date <= to);
  if (treatments.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13); doc.setTextColor(74, 31, 58);
    doc.text(`💊 Обработки (${treatments.length})`, 14, y); y += 7;
    doc.autoTable({
      startY: y, styles: { font: cyrillicFontLoaded ? 'Roboto' : 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [139, 58, 92] },
      head: [['Дата', 'Участок', 'Препарат', 'Доза', 'Срок ожид.']],
      body: treatments.map(t => {
        const plot = data.plots.find(p => p.id === t.plotId);
        return [t.date, plot ? plot.name : '—', t.product, t.dose || '—', t.pause ? t.pause + ' дн' : '—'];
      })
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Рекомендации
  if (data.recommendations.length) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13); doc.setTextColor(74, 31, 58);
    doc.text(`🤖 Активные рекомендации`, 14, y); y += 7;
    doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    data.recommendations.slice(0, 10).forEach(r => {
      if (y > 270) { doc.addPage(); y = 20; }
      const prio = r.priority === 'high' ? '[!]' : r.priority === 'med' ? '[*]' : '[i]';
      doc.setFontSize(10); doc.setTextColor(74, 31, 58);
      doc.text(`${prio} ${r.title}`, 14, y); y += 5;
      doc.setFontSize(9); doc.setTextColor(80, 80, 80);
      const lines = doc.splitTextToSize(r.text, 180);
      doc.text(lines, 14, y); y += lines.length * 4 + 4;
    });
  }

  doc.save(`vineyard-weekly-${from}-to-${to}.pdf`);
  toast('✅ PDF сформирован', 'success');
}

async function generatePlotPDF() {
  if (!requirePermission('reports.export', 'Нет прав на экспорт отчётов')) return;
  const plotId = document.getElementById('rep-plot').value;
  if (!plotId) { toast('Выберите участок', 'error'); return; }
  const plot = data.plots.find(p => p.id === plotId);
  if (!plot) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  await loadCyrillicFont(doc);
  if (cyrillicFontLoaded) doc.setFont('Roboto');

  let y = setupPDF(doc, `Отчёт по участку: ${plot.name}`);
  if (cyrillicFontLoaded) doc.setFont('Roboto');
  doc.setFontSize(11); doc.setTextColor(60, 60, 60);
  doc.text(`Сорт: ${plot.variety}`, 14, y); y += 6;
  doc.text(`Площадь: ${plot.area} га, Год посадки: ${plot.year || '—'}`, 14, y); y += 6;
  doc.text(`Подвой: ${plot.rootstock || '—'}, Формировка: ${plot.form || '—'}`, 14, y); y += 6;
  doc.text(`Кустов: ${plot.vines || '—'}, Схема: ${plot.spacing || '—'}`, 14, y); y += 10;

  const journal = data.journal.filter(j => j.plotId === plotId);
  if (journal.length) {
    doc.setFontSize(13); doc.setTextColor(74, 31, 58);
    doc.text(`📔 История работ (${journal.length})`, 14, y); y += 7;
    doc.autoTable({
      startY: y, styles: { font: cyrillicFontLoaded ? 'Roboto' : 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [139, 58, 92] },
      head: [['Дата', 'Тип', 'Описание']],
      body: journal.map(j => [j.date, j.type, (j.desc||'').slice(0,80)])
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  const treatments = data.treatments.filter(t => t.plotId === plotId);
  if (treatments.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13); doc.setTextColor(74, 31, 58);
    doc.text(`💊 Обработки (${treatments.length})`, 14, y); y += 7;
    doc.autoTable({
      startY: y, styles: { font: cyrillicFontLoaded ? 'Roboto' : 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [139, 58, 92] },
      head: [['Дата', 'Препарат', 'Доза', 'Срок ожид.']],
      body: treatments.map(t => [t.date, t.product, t.dose || '—', t.pause ? t.pause + ' дн' : '—'])
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  const harvest = data.harvest.filter(h => h.plotId === plotId);
  if (harvest.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13); doc.setTextColor(74, 31, 58);
    const total = harvest.reduce((s,h) => s + h.weight, 0);
    doc.text(`🍷 Урожай: ${total.toFixed(1)} кг`, 14, y); y += 7;
    doc.autoTable({
      startY: y, styles: { font: cyrillicFontLoaded ? 'Roboto' : 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [139, 58, 92] },
      head: [['Дата', 'Вес, кг', 'Brix', 'Кислотн.', 'pH']],
      body: harvest.map(h => [h.date, h.weight, h.brix || '—', h.acid || '—', h.ph || '—'])
    });
  }

  doc.save(`vineyard-plot-${plot.name}.pdf`);
  toast('✅ PDF сформирован', 'success');
}

async function generateSeasonPDF() {
  if (!requirePermission('reports.export', 'Нет прав на экспорт отчётов')) return;
  const year = document.getElementById('rep-season-year').value || new Date().getFullYear();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  await loadCyrillicFont(doc);
  if (cyrillicFontLoaded) doc.setFont('Roboto');

  let y = setupPDF(doc, `Сезонный отчёт ${year}`);
  if (cyrillicFontLoaded) doc.setFont('Roboto');

  const harvest = data.harvest.filter(h => h.date.startsWith(year));
  const costs = data.costs.filter(c => c.date.startsWith(year));
  const treatments = data.treatments.filter(t => t.date.startsWith(year));

  doc.setFontSize(11); doc.setTextColor(60, 60, 60);
  const totalH = harvest.reduce((s,h)=>s+h.weight, 0);
  const totalC = costs.reduce((s,c)=>s+c.amount, 0);
  const totalArea = data.plots.reduce((s,p)=>s+(p.area||0), 0);
  doc.text(`Общая площадь: ${totalArea.toFixed(2)} га`, 14, y); y += 6;
  doc.text(`Общий урожай: ${totalH.toFixed(1)} кг`, 14, y); y += 6;
  if (totalArea > 0) doc.text(`Урожайность: ${(totalH/totalArea).toFixed(1)} кг/га`, 14, y), y += 6;
  doc.text(`Общие затраты: ${totalC.toFixed(2)}`, 14, y); y += 6;
  doc.text(`Обработок: ${treatments.length}`, 14, y); y += 10;

  if (harvest.length) {
    doc.setFontSize(13); doc.setTextColor(74, 31, 58);
    doc.text(`🍷 Урожай по участкам`, 14, y); y += 7;
    const byPlot = {};
    harvest.forEach(h => { byPlot[h.plotId] = (byPlot[h.plotId] || 0) + h.weight; });
    doc.autoTable({
      startY: y, styles: { font: cyrillicFontLoaded ? 'Roboto' : 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [139, 58, 92] },
      head: [['Участок', 'Вес, кг', 'Площадь, га', 'Урожайность, кг/га']],
      body: Object.entries(byPlot).map(([pid, w]) => {
        const plot = data.plots.find(p => p.id === pid);
        const yield_ = plot && plot.area ? (w/plot.area).toFixed(1) : '—';
        return [plot ? plot.name : '—', w.toFixed(1), plot?.area || '—', yield_];
      })
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (costs.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13); doc.setTextColor(74, 31, 58);
    doc.text(`💰 Затраты по категориям`, 14, y); y += 7;
    const byCat = {};
    costs.forEach(c => byCat[c.cat] = (byCat[c.cat] || 0) + c.amount);
    doc.autoTable({
      startY: y, styles: { font: cyrillicFontLoaded ? 'Roboto' : 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [139, 58, 92] },
      head: [['Категория', 'Сумма', '%']],
      body: Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c, a]) =>
        [c, a.toFixed(2), (a/totalC*100).toFixed(1) + '%'])
    });
  }

  doc.save(`vineyard-season-${year}.pdf`);
  toast('✅ PDF сформирован', 'success');
}

async function generateTreatmentsPDF() {
  if (!requirePermission('reports.export', 'Нет прав на экспорт отчётов')) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  await loadCyrillicFont(doc);
  if (cyrillicFontLoaded) doc.setFont('Roboto');

  let y = setupPDF(doc, 'Журнал обработок');
  if (cyrillicFontLoaded) doc.setFont('Roboto');

  if (!data.treatments.length) {
    doc.setFontSize(11);
    doc.text('Нет записей.', 14, y);
  } else {
    doc.autoTable({
      startY: y, styles: { font: cyrillicFontLoaded ? 'Roboto' : 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [139, 58, 92] },
      head: [['Дата', 'Участок', 'Препарат', 'Дозировка', 'Объём, л', 'Срок ожид.', 'Заметка']],
      body: data.treatments.sort((a,b)=>b.date.localeCompare(a.date)).map(t => {
        const plot = data.plots.find(p => p.id === t.plotId);
        return [t.date, plot ? plot.name : '—', t.product, t.dose || '—', t.volume || '—',
                t.pause ? t.pause + ' дн' : '—', (t.note || '').slice(0, 40)];
      })
    });
  }
  doc.save(`vineyard-treatments.pdf`);
  toast('✅ PDF сформирован', 'success');
}

// ===========================================================================
