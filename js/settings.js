// ============================================================================
// SETTINGS module
// ============================================================================

function saveAPIKeys() {
  if (!requirePermission('settings.edit', 'Нет прав на изменение настроек')) return;
  settings.openrouterKey = document.getElementById('openrouter-key').value.trim();
  settings.openrouterModel = document.getElementById('openrouter-model').value;
  saveSettingsLocal();
  toast('✅ Ключи сохранены', 'success');
}

async function testAIConnection() {
  if (!settings.openrouterKey) { toast('Введите ключ OpenRouter', 'error'); return; }
  toast('Проверяем...');
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': 'Bearer ' + settings.openrouterKey }
    });
    if (r.ok) toast('✅ Подключение работает', 'success');
    else toast('Ошибка: ' + r.status, 'error');
  } catch(e) { toast('Ошибка сети: ' + e.message, 'error'); }
}

// ===========================================================================
// AI ANALYSIS
// ===========================================================================
