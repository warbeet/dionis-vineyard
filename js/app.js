// ============================================================================
// APP module — Инициализация, навигация, темы, динамическая загрузка секций
// ============================================================================

// =========== ЗАГРУЗКА СЕКЦИЙ ===========
const SECTIONS = [
  'dashboard', 'plots', 'photos', 'journal', 'weather',
  'treatments', 'plan', 'recommendations', 'harvest',
  'reports', 'team', 'settings'
];

async function loadAllSections() {
  const main = document.querySelector('main');
  if (!main) return;
  // Очистим только секции, не модалки
  main.innerHTML = '';
  for (const id of SECTIONS) {
    try {
      const r = await fetch(`sections/${id}.html`);
      if (r.ok) {
        const html = await r.text();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        // Все top-level элементы вставляем в main
        while (wrapper.firstChild) {
          main.appendChild(wrapper.firstChild);
        }
      } else {
        console.warn(`Section ${id} not found`);
      }
    } catch (e) {
      console.error(`Failed to load section ${id}:`, e);
    }
  }
}

// =========== ВКЛАДКИ ПОГОДЫ ===========
function switchWeatherTab(event, tabId) {
  document.querySelectorAll('#weather .plot-tab').forEach(b => b.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.querySelectorAll('.weather-tab').forEach(t => t.style.display = 'none');
  const el = document.getElementById('wtab-' + tabId);
  if (el) el.style.display = 'block';
  if (tabId === 'stations') renderStations();
  if (tabId === 'pheno') renderPhenoStages();
}

// =========== НАВИГАЦИЯ ===========
function showTab(tabId) {
  document.querySelectorAll('.tab-btn, .nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll(`.tab-btn[data-tab="${tabId}"], .nav-btn[data-tab="${tabId}"]`).forEach(b => b.classList.add('active'));
  const section = document.getElementById(tabId);
  if (section) section.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAll();
  history.replaceState(null, '', '#' + tabId);
}

// =========== МОДАЛКИ ===========
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('show');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('show');
}

// =========== ТЕМА ===========
function getTheme() {
  return localStorage.getItem('vineyard_theme') || 'light';
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#1f2820' : '#e8ebe2';
}
function toggleTheme() {
  const cur = getTheme();
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem('vineyard_theme', next);
  applyTheme(next);
}
// Применяем тему сразу
applyTheme(getTheme());

// =========== DRAWER (mobile) ===========
function toggleNav() {
  const nav = document.getElementById('side-nav');
  const overlay = document.getElementById('nav-overlay');
  if (nav) nav.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
}
function closeNav() {
  if (window.innerWidth <= 900) {
    const nav = document.getElementById('side-nav');
    const overlay = document.getElementById('nav-overlay');
    if (nav) nav.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }
}

// =========== PWA INSTALL ===========
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('install_dismissed')) {
    setTimeout(() => {
      const b = document.getElementById('install-banner');
      if (b) b.classList.add('show');
    }, 2000);
  }
});

async function triggerInstall() {
  if (!deferredInstallPrompt) {
    toast('Используйте меню браузера: «Добавить на главный экран»', '');
    return;
  }
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') toast('✅ Установлено', 'success');
  deferredInstallPrompt = null;
  hideInstallBanner();
}

function hideInstallBanner() {
  const b = document.getElementById('install-banner');
  if (b) b.classList.remove('show');
  localStorage.setItem('install_dismissed', '1');
}

window.addEventListener('appinstalled', () => {
  toast('🎉 Приложение установлено', 'success');
  hideInstallBanner();
});

// =========== SERVICE WORKER ===========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
  });
}

window.addEventListener('online', () => { isOnline = true; if (currentUser) setSyncIndicator('synced'); });
window.addEventListener('offline', () => { isOnline = false; setSyncIndicator('offline'); });

// =========== ОБЩИЙ РЕНДЕР ===========
function renderAll() {
  if (typeof migratePlotsV2 === 'function') migratePlotsV2();
  if (typeof renderDashboardPlots === 'function') renderDashboardPlots();
  if (typeof refreshPlotSelectors === 'function') refreshPlotSelectors();
  if (typeof renderPlots === 'function') renderPlots();
  if (typeof renderPhotoReports === 'function') renderPhotoReports();
  if (typeof renderJournal === 'function') renderJournal();
  if (typeof renderWeatherList === 'function') renderWeatherList();
  if (typeof renderPhenoStages === 'function') renderPhenoStages();
  if (typeof renderForecast === 'function') renderForecast();
  if (typeof renderTreatments === 'function') renderTreatments();
  if (typeof renderPlan === 'function') renderPlan();
  if (typeof renderHarvestSummary === 'function') renderHarvestSummary();
  if (typeof renderCostsSummary === 'function') renderCostsSummary();
  if (typeof renderRecommendations === 'function') renderRecommendations();
  if (typeof renderTeam === 'function') renderTeam();
  if (typeof renderStations === 'function') renderStations();
  if (typeof updateDashboard === 'function') updateDashboard();
}

// =========== INIT ===========
async function init() {
  // Загрузим все секции
  await loadAllSections();

  // Подключим обработчики на нав-кнопки (после загрузки они появились в DOM)
  document.querySelectorAll('.tab-btn, .nav-btn').forEach(btn => {
    if (!btn.onclick && btn.dataset.tab) {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    }
  });

  // Загрузка настроек в UI
  const orKey = document.getElementById('openrouter-key');
  if (orKey) orKey.value = settings.openrouterKey || '';
  const orModel = document.getElementById('openrouter-model');
  if (orModel) orModel.value = settings.openrouterModel || 'openai/gpt-4o';
  const fbConfig = localStorage.getItem(FIREBASE_CONFIG_KEY);
  const fbInput = document.getElementById('firebase-config');
  if (fbConfig && fbInput) fbInput.value = fbConfig;

  // Локация
  if (data.location) {
    const lat = document.getElementById('loc-lat');
    const lon = document.getElementById('loc-lon');
    const name = document.getElementById('loc-name');
    if (lat) lat.value = data.location.lat || '';
    if (lon) lon.value = data.location.lon || '';
    if (name) name.value = data.location.name || '';
  }

  // Даты по умолчанию
  ['photo-date','w-date','dis-date','tr-date','h-date','c-date','pheno-date','rep-week-from','rep-week-to'].forEach(f => {
    const el = document.getElementById(f);
    if (el && !el.value) el.value = todayStr();
  });
  const repFrom = document.getElementById('rep-week-from');
  if (repFrom) repFrom.value = new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const repYear = document.getElementById('rep-season-year');
  if (repYear) repYear.value = new Date().getFullYear();

  // Hash-навигация
  if (location.hash) {
    const tab = location.hash.slice(1);
    if (document.getElementById(tab)) showTab(tab);
  }

  renderAll();
}

// Стартовая логика
(async () => {
  const ok = await initFirebase();
  if (ok && auth) {
    auth.onAuthStateChanged(user => {
      if (user) {
        onAuthChanged(user);
      } else {
        const screen = document.getElementById('auth-screen');
        if (screen) screen.classList.remove('hidden');
      }
    });
  } else {
    const screen = document.getElementById('auth-screen');
    if (screen) screen.classList.remove('hidden');
  }
})();
