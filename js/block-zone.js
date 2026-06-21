// ============================================================================
// BLOCK-ZONE module — Редактор зоны блока (С ряда X по ряд Y + исключения)
// ============================================================================

// Структура zone:
// [
//   { row: 'А', from: 1, to: 50 },     // полный ряд (главная зона)
//   { row: 'Б', from: 1, to: 50 },
//   { row: 'В', from: 1, to: 50 },
//   { row: 'Г', from: 5, to: 20 }      // исключение (частичный ряд)
// ]
//
// В новом UI:
// - block-row-from / block-row-to → главная зона (диапазон полных рядов)
// - block-exceptions-list → массив исключений {row, from, to}

let currentBlockExceptions = [];  // временное хранилище исключений при редактировании

function populateRowSelectors(plot) {
  if (!plot || !plot.rows) return;
  // Список доступных рядов (исключая пропущенные)
  const validRows = plot.rows.filter(r => (r.positions_count || 0) > 0);

  // Сортируем по номеру (с учётом строковых номеров А, Б, В)
  validRows.sort((a, b) => {
    const aNum = parseInt(a.number);
    const bNum = parseInt(b.number);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return String(a.number).localeCompare(String(b.number));
  });

  const options = '<option value="">— не выбрано —</option>' +
    validRows.map(r => `<option value="${escapeHtml(String(r.number))}">${escapeHtml(String(r.number))} (${r.positions_count} саж.)</option>`).join('');

  ['block-row-from', 'block-row-to', 'exc-row'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = options;
      if (cur) sel.value = cur;
    }
  });
}

// =========== ПАРСИНГ СТАРОЙ ЗОНЫ В НОВЫЙ ФОРМАТ ===========
function zoneToNewFormat(zone, plot) {
  // Из массива zone [{row, from, to}] определяем:
  // - rangeFrom, rangeTo — главный диапазон (рядов где from=1 и to=positions_count)
  // - exceptions — частичные ряды
  if (!zone || !zone.length || !plot || !plot.rows) {
    return { rangeFrom: '', rangeTo: '', exceptions: [] };
  }

  const fullRows = [];
  const exceptions = [];

  zone.forEach(z => {
    const row = plot.rows.find(r => String(r.number) === String(z.row));
    if (!row) return;
    const isFull = z.from === (row.start_position || 1) && z.to === (row.start_position || 1) + row.positions_count - 1;
    if (isFull) {
      fullRows.push(String(z.row));
    } else {
      exceptions.push({ row: String(z.row), from: z.from, to: z.to });
    }
  });

  // Если fullRows идут подряд — главный диапазон
  let rangeFrom = '', rangeTo = '';
  if (fullRows.length) {
    rangeFrom = fullRows[0];
    rangeTo = fullRows[fullRows.length - 1];
  }

  return { rangeFrom, rangeTo, exceptions };
}

// =========== СОБРАТЬ ZONE ИЗ UI ===========
function buildZoneFromUI(plot) {
  if (!plot) return [];
  const rangeFrom = document.getElementById('block-row-from')?.value || '';
  const rangeTo = document.getElementById('block-row-to')?.value || '';
  const zone = [];

  // 1. Главный диапазон → все ряды от rangeFrom до rangeTo
  if (rangeFrom && rangeTo) {
    const validRows = plot.rows.filter(r => (r.positions_count || 0) > 0);
    validRows.sort((a, b) => {
      const aNum = parseInt(a.number); const bNum = parseInt(b.number);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return String(a.number).localeCompare(String(b.number));
    });
    let inRange = false;
    for (const r of validRows) {
      if (String(r.number) === rangeFrom) inRange = true;
      if (inRange) {
        zone.push({
          row: r.number,
          from: r.start_position || 1,
          to: (r.start_position || 1) + r.positions_count - 1
        });
      }
      if (String(r.number) === rangeTo) inRange = false;
    }
  }

  // 2. Исключения (могут быть из рядов вне главного диапазона или дополнять его)
  currentBlockExceptions.forEach(exc => {
    // Если этот ряд уже в zone — заменим его (исключение перезаписывает полный ряд)
    const idx = zone.findIndex(z => String(z.row) === String(exc.row));
    if (idx >= 0) {
      zone[idx] = { row: exc.row, from: exc.from, to: exc.to };
    } else {
      zone.push({ row: exc.row, from: exc.from, to: exc.to });
    }
  });

  return zone;
}

// =========== РЕНДЕР ИСКЛЮЧЕНИЙ ===========
function renderBlockExceptions() {
  const cont = document.getElementById('block-exceptions-list');
  if (!cont) return;
  if (!currentBlockExceptions.length) {
    cont.innerHTML = '<p style="font-size:12px; color:var(--text-muted); padding:6px 0;">Исключений нет</p>';
    return;
  }
  cont.innerHTML = currentBlockExceptions.map((exc, idx) => `
    <div style="display:flex; gap:8px; align-items:center; padding:6px 10px; background:var(--bg-elevated); border-radius:10px; margin-bottom:6px; font-size:13px;">
      <span>🔀</span>
      <div style="flex:1;"><b>Ряд ${escapeHtml(String(exc.row))}</b>: с позиции ${exc.from} по ${exc.to} (${exc.to - exc.from + 1} саж.)</div>
      <button class="btn small danger" onclick="removeBlockException(${idx})" style="padding:4px 10px;">×</button>
    </div>
  `).join('');
}

function addBlockException() {
  const row = document.getElementById('exc-row')?.value;
  const from = parseInt(document.getElementById('exc-from')?.value);
  const to = parseInt(document.getElementById('exc-to')?.value);
  if (!row || isNaN(from) || isNaN(to)) {
    toast('Укажите ряд и обе позиции', 'error');
    return;
  }
  if (from > to) {
    toast('Позиция "С" должна быть меньше "По"', 'error');
    return;
  }
  // Проверим что ряд существует
  const plot = data.plots.find(p => p.id === document.getElementById('block-plot-id')?.value);
  if (plot) {
    const r = plot.rows.find(x => String(x.number) === String(row));
    if (r) {
      const maxPos = (r.start_position || 1) + r.positions_count - 1;
      if (to > maxPos) {
        toast(`В ряду ${row} максимум ${maxPos} позиций`, 'error');
        return;
      }
    }
  }

  currentBlockExceptions.push({ row, from, to });
  renderBlockExceptions();
  // Очистим поля кроме номера ряда
  document.getElementById('exc-from').value = '';
  document.getElementById('exc-to').value = '';
  toast('Исключение добавлено', 'success');
}

function removeBlockException(idx) {
  currentBlockExceptions.splice(idx, 1);
  renderBlockExceptions();
}

// =========== ИНТЕГРАЦИЯ С openBlockModal ===========
function initBlockZoneUI(plot, block) {
  // Заполнить селекторы рядов
  populateRowSelectors(plot);

  // Очистить исключения
  currentBlockExceptions = [];

  if (block && block.zone) {
    const parsed = zoneToNewFormat(block.zone, plot);
    setTimeout(() => {
      const from = document.getElementById('block-row-from');
      const to = document.getElementById('block-row-to');
      if (from && parsed.rangeFrom) from.value = parsed.rangeFrom;
      if (to && parsed.rangeTo) to.value = parsed.rangeTo;
      currentBlockExceptions = parsed.exceptions || [];
      renderBlockExceptions();
    }, 50);
  } else {
    renderBlockExceptions();
  }
}
