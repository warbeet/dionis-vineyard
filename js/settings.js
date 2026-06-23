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

function renderUISettings() {
  const cont = document.getElementById('ui-settings');
  if (!cont) return;
  const mode = settings.uiMode || 'auto';
  const resolved = typeof resolveUIMode === 'function' ? resolveUIMode() : 'desktop';
  cont.innerHTML = `
    <div class="form-row">
      <label>Режим интерфейса</label>
      <select id="ui-mode-select" onchange="setUIMode(this.value)">
        <option value="auto" ${mode === 'auto' ? 'selected' : ''}>Авто — по устройству</option>
        <option value="desktop" ${mode === 'desktop' ? 'selected' : ''}>Десктоп — полный кабинет</option>
        <option value="mobile" ${mode === 'mobile' ? 'selected' : ''}>Мобильный — полевой режим</option>
      </select>
      <p style="font-size:11px; color:var(--text-muted); margin-top:6px;">
        Сейчас активен режим: <b>${resolved === 'mobile' ? 'мобильный' : 'десктоп'}</b>. В мобильном режиме интерфейс упрощается, используется нижнее меню и скрываются перегруженные элементы.
      </p>
    </div>
  `;
}
