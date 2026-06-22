// ============================================================================
// DATA module
// ============================================================================

// ============================================================================
// VERSION — Текущая версия приложения (обновляется при каждом релизе)
// ============================================================================
const APP_VERSION = '0.5.3';
const APP_VERSION_DATE = '2026-06-22';
const APP_CODENAME = 'Geometry+';

// ===========================================================================
// STATE
// ===========================================================================
const STORAGE_KEY = 'vineyard_data_v2';
const SETTINGS_KEY = 'vineyard_settings_v2';
const FIREBASE_CONFIG_KEY = 'vineyard_fb_config';

const PHENO_STAGES = [
  { id: 'dormancy', name: 'Покой', desc: 'Зимний период, лозы спят. Время для обрезки.' },
  { id: 'budbreak', name: 'Распускание почек', desc: 'Появление зелёного конуса. Защита от заморозков!' },
  { id: 'leaves', name: 'Развитие листьев', desc: 'Рост побегов 5-10 листьев. Начало защиты от милдью.' },
  { id: 'flowering', name: 'Цветение', desc: 'Цветение 1-2 недели. Критично для урожая.' },
  { id: 'fruitset', name: 'Завязывание ягод', desc: 'Формирование гроздей. Усиленная защита.' },
  { id: 'berry-growth', name: 'Рост ягод', desc: 'Ягоды размером с горошину.' },
  { id: 'veraison', name: 'Veraison', desc: 'Изменение цвета. Сокращение полива.' },
  { id: 'ripening', name: 'Созревание', desc: 'Накопление сахаров. Контроль птиц/ос.' },
  { id: 'harvest', name: 'Сбор урожая', desc: 'Контроль Brix, pH, кислотности.' },
  { id: 'leaffall', name: 'Листопад', desc: 'Подготовка к зиме, последние подкормки.' }
];

let data = loadData();
let settings = loadSettings();
let pendingPhotos = [];
let currentUser = null;
let currentRole = 'owner';
let currentVineyardId = null;
let firebaseApp = null;
let auth = null;
let db = null;
let storage = null;
let isOnline = navigator.onLine;
let deferredInstallPrompt = null;
let unsubscribeListeners = [];

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return defaultData();
}

function defaultData() {
  return {
    plots: [], photoReports: [], journal: [], weather: [],
    diseases: [], treatments: [], tasks: [], harvest: [], costs: [],
    currentPheno: null, phenoDate: null, recommendations: [],
    location: { lat: null, lon: null, name: '' },
    forecast: [],
    members: []
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { openrouterKey: '', openrouterModel: 'openai/gpt-4o', vineyardCode: '' };
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (currentUser && db && currentVineyardId) {
      syncToFirebase();
    }
  } catch(e) {
    toast('Ошибка сохранения: возможно, превышен лимит хранилища', 'error');
  }
}

function saveSettingsLocal() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
