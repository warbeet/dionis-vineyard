// ============================================================================
// DATA module
// ============================================================================

// ============================================================================
// VERSION — Текущая версия приложения (обновляется при каждом релизе)
// ============================================================================
const APP_VERSION = '0.8.1';
const APP_VERSION_DATE = '2026-10-29';
const APP_CODENAME = 'Geometry+';

// ===========================================================================
// STATE
// ===========================================================================
const STORAGE_KEY = 'vineyard_data_v2';
const SETTINGS_KEY = 'vineyard_settings_v2';
const FIREBASE_CONFIG_KEY = 'vineyard_fb_config';

// Firebase Web config не является секретом: безопасность обеспечивают Firestore Rules.
// Пользователь может переопределить config через Настройки, но по умолчанию приложение
// сразу подключается к проекту Dionis vineyard.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCkEvUaZATPe7VZxlqn2T7_tVciZK0cnR4',
  authDomain: 'dionis-vineyard.firebaseapp.com',
  projectId: 'dionis-vineyard',
  storageBucket: 'dionis-vineyard.firebasestorage.app',
  messagingSenderId: '982206279853',
  appId: '1:982206279853:web:2618a2fba6031aa8d61624',
  measurementId: 'G-ZYX6ZSKQ4S'
};

const PHENO_STAGES = [
  // v0.7.11: Шкала BBCH для винограда (18 реперных точек)
  { id: 'bbch-00', name: 'Покой (BBCH 00)', desc: 'Зимний период, лозы спят. Время для обрезки.', bbch: 0 },
  { id: 'bbch-09', name: 'Конец покоя (BBCH 09)', desc: 'Подготовка к вегетации.', bbch: 9 },
  { id: 'bbch-11', name: 'Распускание почек (BBCH 11)', desc: 'Появление зелёного конуса. Защита от заморозков!', bbch: 11 },
  { id: 'bbch-15', name: '50% почек распущено (BBCH 15)', desc: 'Массовое распускание. Продолжение защиты от заморозков.', bbch: 15 },
  { id: 'bbch-51', name: 'Появление соцветий (BBCH 51)', desc: 'Видны зачатки соцветий. Начало защиты от милдью.', bbch: 51 },
  { id: 'bbch-53', name: 'Соцветия развиты (BBCH 53)', desc: 'Соцветия полностью сформированы. Обработка от милдью обязательна.', bbch: 53 },
  { id: 'bbch-55', name: 'Набухание бутонов (BBCH 55)', desc: 'Бутоны набухли, но ещё сомкнуты.', bbch: 55 },
  { id: 'bbch-57', name: 'Обособление бутонов (BBCH 57)', desc: 'Бутоны разошлись. Последняя обработка перед цветением.', bbch: 57 },
  { id: 'bbch-61', name: 'Начало цветения (BBCH 61)', desc: '10% цветков раскрылись. ⚠️ Обработка СИСТЕМНЫМИ фунгицидами от Botrytis/оидиума разрешена!', bbch: 61 },
  { id: 'bbch-65', name: 'Полное цветение (BBCH 65)', desc: '50% цветков раскрылись. Критичная фаза для урожая.', bbch: 65 },
  { id: 'bbch-69', name: 'Конец цветения (BBCH 69)', desc: 'Опадение колпачков завершено. Обработка от Botrytis обязательна.', bbch: 69 },
  { id: 'bbch-71', name: 'Ягода с дробь (BBCH 71)', desc: 'Ягоды размером с горошину. Формирование гроздей.', bbch: 71 },
  { id: 'bbch-73', name: 'Рост ягод (BBCH 73)', desc: 'Ягоды достигают 50% финального размера.', bbch: 73 },
  { id: 'bbch-75', name: 'Ягоды крупнее горошины (BBCH 75)', desc: 'Активный рост ягод. Усиленная защита от оидиума.', bbch: 75 },
  { id: 'bbch-77', name: 'Смыкание ягод (BBCH 77)', desc: 'Ягоды в грозди смыкаются.', bbch: 77 },
  { id: 'bbch-81', name: 'Начало созревания / верейзон (BBCH 81)', desc: 'Изменение цвета ягод. Прекращение полива.', bbch: 81 },
  { id: 'bbch-85', name: 'Ягоды приобретают сортовой окрас (BBCH 85)', desc: 'Накопление сахаров. Контроль птиц/ос.', bbch: 85 },
  { id: 'bbch-89', name: 'Техническая зрелость (BBCH 89)', desc: 'Достигнуты сортовые показатели Brix/pH. Готовность к сбору.', bbch: 89 }
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

function defaultSettings() {
  return {
    openrouterKey: '',
    openrouterModel: 'openai/gpt-4o',
    openrouterTextModel: 'openai/gpt-4o-mini',
    webSearchProvider: 'tavily',
    tavilyKey: '',
    searchBackendUrl: '',
    // v0.7.18: Яндекс.Диск
    yandexDiskEnabled: false,
    yandexDiskToken: '',
    uiMode: 'auto', // auto | desktop | mobile
    theme: 'classic', // classic | deep-dark | deep-light
    vineyardCode: ''
  };
}

function loadSettings() {
  const defaults = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch(e) {}
  return defaults;
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Облачная синхронизация: локальное сохранение происходит всегда,
    // а Firebase получает изменения с debounce через syncToFirebase().
    if (typeof syncV2ApplyingRemote !== 'undefined' && syncV2ApplyingRemote) return;
    if (typeof markSyncDirty === 'function') markSyncDirty();
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
