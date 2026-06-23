// ============================================================================
// SETTINGS module
// ============================================================================

function saveAPIKeys() {
  if (!requirePermission('settings.edit', 'Нет прав на изменение настроек')) return;
  settings.openrouterKey = document.getElementById('openrouter-key').value.trim();
  settings.openrouterModel = document.getElementById('openrouter-model').value;
  settings.openrouterTextModel = document.getElementById('openrouter-text-model')?.value || 'openai/gpt-4o-mini';
  settings.webSearchProvider = document.getElementById('web-search-provider')?.value || 'tavily';
  settings.tavilyKey = document.getElementById('tavily-key')?.value?.trim() || '';
  settings.searchBackendUrl = document.getElementById('search-backend-url')?.value?.trim() || '';
  saveSettingsLocal();
  toast('✅ AI/Web-search настройки сохранены', 'success');
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

async function testWebSearchConnection() {
  const provider = document.getElementById('web-search-provider')?.value || settings.webSearchProvider || 'tavily';
  const tavilyKey = document.getElementById('tavily-key')?.value?.trim() || settings.tavilyKey || '';
  const backendUrl = document.getElementById('search-backend-url')?.value?.trim() || settings.searchBackendUrl || '';
  if (provider === 'tavily' && !tavilyKey) { toast('Введите Tavily API key', 'error'); return; }
  if (provider === 'backend' && !backendUrl) { toast('Введите URL backend/proxy', 'error'); return; }
  toast('Проверяем web-search...');
  const old = { ...settings };
  settings.webSearchProvider = provider;
  settings.tavilyKey = tavilyKey;
  settings.searchBackendUrl = backendUrl;
  try {
    const res = await searchInstructionSources('Серкадис');
    if (res.success) toast(`✅ Web-search работает: найдено ${res.results.length} источников`, 'success');
    else toast('Ошибка: ' + res.error, 'error');
  } catch(e) {
    toast('Ошибка: ' + e.message, 'error');
  } finally {
    Object.assign(settings, old);
  }
}
