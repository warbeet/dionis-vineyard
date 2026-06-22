// ============================================================================
// STORAGE module
// ============================================================================

// ===========================================================================
function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `vineyard-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      const payload = imported && imported.data ? imported.data : imported;
      if (confirm('Заменить текущие данные?')) {
        data = Object.assign(defaultData(), payload);
        saveData(); renderAll();
        toast('✅ Импортировано', 'success');
      }
    } catch(err) { toast('Ошибка: ' + err.message, 'error'); }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('УДАЛИТЬ ВСЕ данные? Это нельзя отменить!')) return;
  if (!confirm('Точно?')) return;
  data = defaultData();
  saveData();
  renderAll();
  toast('🗑 Все данные удалены', 'success');
}

// ===========================================================================
