// ============================================================================
// LAZY LIBS v0.7.15 — Асинхронная загрузка тяжёлых библиотек по требованию
// ============================================================================
// Экономия ~3 МБ при холодном старте PWA
// pdf.js загружается только при импорте PDF инструкций
// jspdf загружается только при экспорте PDF-отчётов
// ============================================================================

const LazyLibs = {
  _cache: {},
  
  /**
   * Загружает скрипт динамически (с кэшированием)
   */
  _loadScript(url, globalName) {
    if (this._cache[url]) return this._cache[url];
    
    this._cache[url] = new Promise((resolve, reject) => {
      // Если уже загружено глобально — просто резолвим
      if (globalName && window[globalName]) {
        resolve(window[globalName]);
        return;
      }
      
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => {
        console.log(`[LazyLibs] ✅ Загружен: ${url}`);
        resolve(window[globalName] || true);
      };
      script.onerror = () => {
        console.error(`[LazyLibs] ❌ Ошибка загрузки: ${url}`);
        reject(new Error(`Не удалось загрузить ${url}`));
      };
      document.head.appendChild(script);
    });
    
    return this._cache[url];
  },
  
  /**
   * Загружает pdf.js и возвращает pdfjsLib
   */
  async loadPdfJs() {
    await this._loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      'pdfjsLib'
    );
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    return window.pdfjsLib;
  },
  
  /**
   * Загружает jspdf + autotable и возвращает { jsPDF }
   */
  async loadJsPdf() {
    await this._loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'jspdf'
    );
    await this._loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.0/jspdf.plugin.autotable.min.js'
    );
    return window.jspdf;
  }
};

// Экспортируем в глобал для совместимости
window.LazyLibs = LazyLibs;
