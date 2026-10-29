// ============================================================================
// AI module
// ============================================================================

async function analyzePhotos(photos, note, plot, phaseId) {
  if (!settings.openrouterKey) {
    return { error: 'Не настроен OpenRouter ключ. Откройте «Настройки».' };
  }
  const phase = PHENO_STAGES.find(s => s.id === phaseId);
  const prompt = `Ты опытный агроном-винодел. Проанализируй фотографии виноградника и наблюдения винодела.

КОНТЕКСТ:
- Сорт: ${plot ? plot.variety : 'не указан'}
- Участок: ${plot ? plot.name : 'не указан'}
- Площадь: ${plot ? plot.area + ' га' : '—'}
- Текущая фенофаза: ${phase ? phase.name : 'не указана'}
- Дата отчёта: ${new Date().toLocaleDateString('ru-RU')}
- Наблюдения винодела: "${note || 'нет'}"

ЗАДАЧА:
1. Опиши, что ты видишь на фото (состояние листвы, гроздей, лозы)
2. Выяви признаки болезней (милдью, оидиум, серая гниль, хлороз и т.д.)
3. Оцени общее состояние (здорово / требует внимания / критично)
4. Дай 3-5 КОНКРЕТНЫХ рекомендаций (с препаратами, дозировками, сроками если применимо)

ОТВЕТЬ строго в формате JSON:
{
  "observation": "что видно на фото",
  "issues": [{"name": "название", "severity": "low|med|high", "evidence": "что указывает"}],
  "overall_status": "healthy|attention|critical",
  "recommendations": [{"priority": "high|med|low", "title": "...", "text": "...", "deadline": "когда сделать"}]
}`;

  const content = [{ type: 'text', text: prompt }];
  for (const p of photos.slice(0, 4)) { // не больше 4 фото для экономии
    content.push({ type: 'image_url', image_url: { url: p } });
  }

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + settings.openrouterKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin,
        'X-Title': 'Vineyard Manager'
      },
      body: JSON.stringify({
        model: settings.openrouterModel,
        messages: [{ role: 'user', content }],
        max_tokens: 1500,
        temperature: 0.3
      })
    });
    if (!r.ok) {
      const text = await r.text();
      return { error: `API error ${r.status}: ${text.slice(0, 200)}` };
    }
    const json = await r.json();
    const content_text = json.choices?.[0]?.message?.content || '';
    // Извлекаем JSON из ответа
    const jsonMatch = content_text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return { success: true, analysis: parsed, raw: content_text, model: settings.openrouterModel };
      } catch(e) {
        return { success: true, analysis: { observation: content_text }, raw: content_text, model: settings.openrouterModel };
      }
    }
    return { success: true, analysis: { observation: content_text }, raw: content_text, model: settings.openrouterModel };
  } catch(e) {
    return { error: 'Сеть: ' + e.message };
  }
}

async function savePhotoReportWithAI() {
  if (!requirePermission('photos.create', 'Нет прав на добавление фотоотчётов')) return;
  if (!settings.openrouterKey) {
    toast('Сначала настройте OpenRouter API в «Настройках»', 'error');
    showTab('settings');
    return;
  }
  const date = document.getElementById('photo-date').value;
  const plotId = document.getElementById('photo-plot').value;
  const note = document.getElementById('photo-note').value.trim();
  if (!date || !plotId) { toast('Укажите дату и участок', 'error'); return; }
  if (!pendingPhotos.length) { toast('Добавьте фото для AI-анализа', 'error'); return; }

  const btn = document.getElementById('ai-analyze-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> AI анализирует...';

  const plot = data.plots.find(p => p.id === plotId);
  const result = await analyzePhotos(pendingPhotos, note, plot, data.currentPheno);

  btn.disabled = false;
  btn.innerHTML = '🤖 Сохранить + AI-анализ';

  const report = {
    id: 'r_' + Date.now(),
    date, plotId, note,
    photos: [...pendingPhotos],
    aiAnalysis: result.success ? result.analysis : null,
    aiModel: result.model,
    aiError: result.error || null,
    createdAt: new Date().toISOString()
  };
  data.photoReports.unshift(report);

  // Если AI выдал рекомендации — добавим в общий список
  if (result.success && result.analysis.recommendations) {
    result.analysis.recommendations.forEach(r => {
      data.recommendations.unshift({
        priority: r.priority || 'med',
        title: '🤖 ' + (r.title || 'AI-рекомендация'),
        text: r.text + (r.deadline ? ` (срок: ${r.deadline})` : ''),
        source: 'AI: ' + (result.model || 'OpenRouter'),
        date: new Date().toISOString().slice(0, 10)
      });
    });
    // Ограничим список 30
    data.recommendations = data.recommendations.slice(0, 30);
  }

  saveData();
  pendingPhotos = [];
  document.getElementById('photo-files').value = '';
  document.getElementById('photo-note').value = '';
  renderPhotoPreview();
  renderAll();

  if (result.error) {
    toast('Сохранено, но AI-анализ не удался: ' + result.error, 'error');
  } else {
    toast('✅ Отчёт сохранён, AI-рекомендации добавлены', 'success');
  }
}

async function analyzeReportFromModal() {
  const reportId = document.getElementById('photo-modal').dataset.reportId;
  const report = data.photoReports.find(r => r.id === reportId);
  if (!report) return;
  if (!settings.openrouterKey) { toast('Настройте OpenRouter API', 'error'); showTab('settings'); return; }

  const btn = document.getElementById('modal-ai-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Анализ...';

  const plot = data.plots.find(p => p.id === report.plotId);
  const result = await analyzePhotos(report.photos, report.note, plot, data.currentPheno);

  btn.disabled = false; btn.innerHTML = '🤖 AI-анализ';

  if (result.success) {
    report.aiAnalysis = result.analysis;
    report.aiModel = result.model;
    report.aiError = null;
    if (result.analysis.recommendations) {
      result.analysis.recommendations.forEach(r => {
        data.recommendations.unshift({
          priority: r.priority || 'med',
          title: '🤖 ' + (r.title || 'AI-рекомендация'),
          text: r.text + (r.deadline ? ` (срок: ${r.deadline})` : ''),
          source: 'AI: ' + result.model,
          date: new Date().toISOString().slice(0, 10)
        });
      });
      data.recommendations = data.recommendations.slice(0, 30);
    }
    saveData();
    viewPhotoReport(reportId);
    renderRecommendations();
    toast('✅ Анализ завершён', 'success');
  } else {
    toast('Ошибка: ' + result.error, 'error');
  }
}

async function runAIAnalysisForAll() {
  if (!settings.openrouterKey) { toast('Настройте OpenRouter API', 'error'); showTab('settings'); return; }
  const unanalyzed = data.photoReports.filter(r => !r.aiAnalysis);
  if (!unanalyzed.length) { toast('Все отчёты уже проанализированы', 'success'); return; }
  if (!confirm(`Проанализировать ${unanalyzed.length} отчёт(ов)? Это потратит токены API.`)) return;

  const btn = document.getElementById('ai-all-btn');
  btn.disabled = true;
  for (let i = 0; i < unanalyzed.length; i++) {
    const r = unanalyzed[i];
    btn.innerHTML = `<span class="spinner"></span> ${i+1}/${unanalyzed.length}`;
    const plot = data.plots.find(p => p.id === r.plotId);
    const result = await analyzePhotos(r.photos, r.note, plot, data.currentPheno);
    if (result.success) {
      r.aiAnalysis = result.analysis;
      r.aiModel = result.model;
      if (result.analysis.recommendations) {
        result.analysis.recommendations.forEach(rec => {
          data.recommendations.unshift({
            priority: rec.priority || 'med',
            title: '🤖 ' + (rec.title || 'AI'),
            text: rec.text + (rec.deadline ? ` (${rec.deadline})` : ''),
            source: 'AI: ' + result.model + ` (отчёт ${r.date})`,
            date: r.date
          });
        });
      }
    }
    await new Promise(res => setTimeout(res, 500)); // rate limit
  }
  data.recommendations = data.recommendations.slice(0, 50);
  saveData();
  btn.disabled = false; btn.innerHTML = '🤖 AI-анализ всех фото';
  renderAll();
  toast('✅ Все отчёты проанализированы', 'success');
}

// ===========================================================================

// =========== OPENROUTER: универсальные AI-задачи (текст/JSON) ===========
function getOpenRouterTextModel() {
  return settings.openrouterTextModel || settings.openrouterModel || 'openai/gpt-4o-mini';
}

function extractJSONFromText(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch(e) { return null; }
}

async function openRouterJSONTask({ system = '', prompt = '', model = null, max_tokens = 1800, temperature = 0.2 }) {
  if (!settings.openrouterKey) {
    return { error: 'Не настроен OpenRouter API. Откройте «Настройки».' };
  }
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + settings.openrouterKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin,
        'X-Title': 'Dionis vineyard'
      },
      body: JSON.stringify({
        model: model || getOpenRouterTextModel(),
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
        max_tokens,
        temperature
      })
    });
    if (!r.ok) {
      const text = await r.text();
      return { error: `OpenRouter ${r.status}: ${text.slice(0, 300)}` };
    }
    const json = await r.json();
    const text = json.choices?.[0]?.message?.content || '';
    const parsed = extractJSONFromText(text);
    return { success: true, json: parsed, raw: text, model: model || getOpenRouterTextModel() };
  } catch(e) {
    return { error: 'Сеть: ' + e.message };
  }
}

function buildOfficialSearchLinks(productName) {
  const q = encodeURIComponent(productName || '');
  return [
    { title: '🔎 Яндекс: инструкция препарата', url: `https://yandex.ru/search/?text=${encodeURIComponent('инструкция препарат ' + productName)}` },
    { title: '📚 Госреестр пестицидов РФ', url: `https://yandex.ru/search/?text=${encodeURIComponent('site:mcx.gov.ru Государственный каталог пестицидов ' + productName)}` },
    { title: '🌱 AgroXXI', url: `https://yandex.ru/search/?text=${encodeURIComponent('site:agroxxi.ru ' + productName + ' инструкция')}` },
    { title: '🏭 Производитель / инструкция PDF', url: `https://yandex.ru/search/?text=${encodeURIComponent(productName + ' инструкция PDF производитель')}` }
  ];
}

async function enrichProductWithAI(productName, context = {}) {
  const name = (productName || '').trim();
  if (!name) return { error: 'Введите название препарата' };
  const system = `Ты агроном-консультант по виноградарству РФ. Заполняешь карточку препарата/удобрения для системы Dionis vineyard.
Важно: не выдумывай точные регистрационные номера и официальные дозировки, если не уверен. Для спорных данных ставь пустую строку и укажи, что нужна проверка инструкции. Ответ строго JSON без markdown.`;
  const prompt = `Препарат/удобрение: "${name}".
Контекст: виноградник, Россия, коммерческое производство.

Собери черновую карточку. Если препарат известен — укажи действующее вещество, категорию, препаративную форму, типовые цели применения на винограде, срок ожидания и ориентировочные дозы только если уверен. Добавь рекомендации по баковой смеси и безопасности.

Верни JSON:
{
  "name": "",
  "category": "fungicide|insecticide|acaricide|herbicide|fertilizer|stimulator|adjuvant",
  "form": "WP|WG/WDG|SC|OD|EC/EW|SL|FERTILIZER|ADJUVANT",
  "active_ingredient": "",
  "concentration": "",
  "manufacturer": "",
  "mechanism": "",
  "target": "",
  "dose_min": 0,
  "dose_max": 0,
  "dose_unit": "г/10л|мл/10л|кг/га|л/га",
  "waiting_days": 0,
  "hazard_class": "",
  "reg_number": "",
  "registration_until": "",
  "storage_life": "",
  "instruction_url": "",
  "crops_regulations": "регламент по культурам",
  "notes": "краткое описание препарата",
  "tank_mix_notes": "порядок внесения/совместимость/рН воды",
  "rainfastness": "",
  "phytotoxicity": "",
  "resistance_notes": "",
  "precautions": "",
  "usage_recommendations": ["..."],
  "risks": ["..."],
  "verify_required": true,
  "confidence": "high|medium|low"
}`;
  const res = await openRouterJSONTask({ system, prompt, max_tokens: 1800, temperature: 0.15 });
  if (!res.success) return res;
  const p = res.json || {};
  return {
    success: true,
    product: {
      name: p.name || name,
      category: p.category || 'fungicide',
      form: p.form || 'EC/EW',
      active_ingredient: p.active_ingredient || '',
      concentration: p.concentration || '',
      manufacturer: p.manufacturer || '',
      mechanism: p.mechanism || '',
      target: p.target || '',
      dose_min: Number(p.dose_min) || 0,
      dose_max: Number(p.dose_max) || 0,
      dose_unit: p.dose_unit || 'мл/10л',
      waiting_days: Number(p.waiting_days) || 0,
      hazard_class: p.hazard_class || '',
      reg_number: p.reg_number || '',
      registration_until: p.registration_until || '',
      storage_life: p.storage_life || '',
      instruction_url: p.instruction_url || '',
      crops_regulations: p.crops_regulations || '',
      notes: p.notes || '',
      tank_mix_notes: p.tank_mix_notes || '',
      rainfastness: p.rainfastness || '',
      phytotoxicity: p.phytotoxicity || '',
      resistance_notes: p.resistance_notes || '',
      precautions: p.precautions || '',
      usage_recommendations: Array.isArray(p.usage_recommendations) ? p.usage_recommendations : [],
      risks: Array.isArray(p.risks) ? p.risks : [],
      verify_required: p.verify_required !== false,
      confidence: p.confidence || 'low',
      search_links: buildOfficialSearchLinks(name),
      ai_model: res.model,
      ai_updated_at: new Date().toISOString()
    },
    raw: res.raw,
    model: res.model
  };
}

async function generateAIAgroForecast() {
  if (!requirePermission('tab.recommendations', 'Нет доступа к AI-рекомендациям')) return;
  if (!settings.openrouterKey) { toast('Настройте OpenRouter API', 'error'); showTab('settings'); return; }
  const btn = document.getElementById('ai-forecast-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> AI прогнозирует...'; }
  const phase = PHENO_STAGES.find(p => p.id === data.currentPheno);
  const context = {
    date: todayStr(),
    location: data.location,
    pheno: phase ? { id: phase.id, name: phase.name, desc: phase.desc } : null,
    plots: (data.plots || []).map(p => ({ id: p.id, name: p.name, area_ha: p.area_ha || p.area, blocks: (p.blocks || []).map(b => ({ scion: b.scion, rootstock: b.rootstock, year: b.planting_year })) })).slice(0, 20),
    forecast7d: (data.forecast || []).slice(0, 7),
    recentWeather: (data.weather || []).slice(0, 10),
    recentDiseases: (data.diseases || []).slice(-10),
    recentTreatments: (data.treatments || []).slice(-10),
    sprayPlans: (data.spray_plans || []).slice(-10),
    seedlingsSummary: (() => {
      // v0.7.9.1: Sparse Seedlings — подсчитываем через виртуальные кусты
      let total = 0, dead = 0, sick = 0, attention = 0;
      (data.plots || []).forEach(p => {
        const seedlings = getPlotSeedlings(p.id);
        total += seedlings.length;
        dead += seedlings.filter(s => s.status === 'dead').length;
        sick += seedlings.filter(s => s.status === 'sick').length;
        attention += seedlings.filter(s => s.status === 'attention').length;
      });
      return { total, dead, sick, attention };
    })()
  };
  const system = `Ты опытный агроном-виноградарь и консультант по орошению/защите растений. Дай практичный прогноз работ по винограднику. Ответ строго JSON.`;
  const prompt = `Проанализируй данные Dionis vineyard и составь рекомендации на 7-10 дней.

ДАННЫЕ:
${JSON.stringify(context, null, 2)}

Верни JSON:
{
  "summary": "краткая сводка состояния",
  "recommendations": [
    {"priority":"high|med|low", "title":"", "text":"", "deadline":"", "category":"irrigation|spray|canopy|soil|harvest|monitoring"}
  ],
  "irrigation_forecast": {"need":"none|low|medium|high", "text":"", "risk":""},
  "disease_risk": [{"name":"милдью|оидиум|серая гниль|...", "risk":"low|medium|high", "reason":""}],
  "notes": ["..."]
}`;
  const res = await openRouterJSONTask({ system, prompt, max_tokens: 2200, temperature: 0.25 });
  if (btn) { btn.disabled = false; btn.innerHTML = '🤖 AI-прогноз 7 дней'; }
  if (!res.success || !res.json) { toast('AI-прогноз не удался: ' + (res.error || 'нет JSON'), 'error'); return; }
  const j = res.json;
  const recs = Array.isArray(j.recommendations) ? j.recommendations : [];
  recs.forEach(r => {
    data.recommendations.unshift({
      priority: r.priority || 'med',
      title: '🤖 ' + (r.title || 'AI-прогноз'),
      text: `${r.text || ''}${r.deadline ? ' Срок: ' + r.deadline + '.' : ''}`,
      source: `OpenRouter ${res.model}${r.category ? ' · ' + r.category : ''}`,
      date: todayStr()
    });
  });
  if (j.irrigation_forecast?.text) {
    data.recommendations.unshift({ priority: j.irrigation_forecast.need === 'high' ? 'high' : 'med', title: '💧 AI-прогноз полива', text: j.irrigation_forecast.text + (j.irrigation_forecast.risk ? ' Риск: ' + j.irrigation_forecast.risk : ''), source: 'OpenRouter irrigation', date: todayStr() });
  }
  if (Array.isArray(j.disease_risk)) {
    j.disease_risk.filter(x => x.risk === 'high').forEach(x => data.recommendations.unshift({ priority: 'high', title: '🦠 Риск: ' + x.name, text: x.reason || 'Высокий риск по AI-прогнозу', source: 'OpenRouter disease risk', date: todayStr() }));
  }
  data.recommendations = data.recommendations.slice(0, 80);
  saveData();
  renderRecommendations();
  toast('✅ AI-прогноз добавлен в рекомендации', 'success');
}

// ============================================================================
// ГОДОВОЙ ПЛАН РАБОТ (AI)
// ============================================================================

async function generateYearPlan() {
  if (!requirePermission('plan.edit', 'Нет прав на генерацию плана')) return;
  if (!settings.openrouterKey) { toast('Настройте OpenRouter API', 'error'); showTab('settings'); return; }
  
  const btn = document.getElementById('ai-year-plan-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '🤖 AI генерирует годовой план...'; }
  
  const phase = PHENO_STAGES.find(p => p.id === data.currentPheno);
  const year = new Date().getFullYear();
  
  const context = {
    year: year,
    location: data.location,
    region: 'Краснодарский край, Геленджик',
    pheno: phase ? { id: phase.id, name: phase.name } : null,
    plots: (data.plots || []).map(p => ({ 
      id: p.id, 
      name: p.name, 
      area_ha: p.area_ha || p.area,
      blocks: (p.blocks || []).map(b => ({ 
        scion: b.scion, 
        scion_clone: b.scion_clone,
        rootstock: b.rootstock, 
        planting_year: b.planting_year 
      }))
    })).slice(0, 20),
    seedlingsSummary: (() => {
      let total = 0, dead = 0;
      (data.plots || []).forEach(p => {
        const seedlings = getPlotSeedlings(p.id);
        total += seedlings.length;
        dead += seedlings.filter(s => s.status === 'dead').length;
      });
      return { total, dead };
    })(),
    recentTreatments: (data.treatments || []).slice(-20),
    currentTasks: (data.tasks || []).filter(t => !t.done).length
  };
  
  const system = `Ты опытный агроном-виноградарь с 20-летним стажем работы в Краснодарском крае. Специализация — промышленные виноградники для производства тихих сухих вин. Ты знаешь климат региона, фенофазы BBCH, сроки обработок, нормы полива, обрезки, подкормок. Отвечай строго в формате JSON.`;
  
  const prompt = `Составь детальный план агротехнических работ на винограднике на ${year} год.

ДАННЫЕ ХОЗЯЙСТВА:
${JSON.stringify(context, null, 2)}

РЕГИОН: Краснодарский край, Геленджик (умеренно-континентальный климат, мягкая зима, жаркое лето)

ТРЕБОВАНИЯ:
1. Разбей план по МЕСЯЦАМ (январь — декабрь)
2. Для каждого месяца укажи:
   - Основные работы (обрезка, подвязка, обработки, полив, сбор урожая и т.д.)
   - Привязку к фенофазам BBCH (где применимо)
   - Примерные сроки (начало/середина/конец месяца или конкретные даты ±1-2 недели)
   - Приоритет (high/med/low)
   - Категорию работы (pruning/spray/fertilizer/irrigation/canopy/harvest/monitoring/soil)
3. Учти:
   - Возраст насаждений (посадка 2024 г. = 2-й вегетационный сезон)
   - Сорта: Мерло, Сира, Каберне Фран, Каберне Совиньон, Пти Вердо
   - Схема посадки 2.5×0.9 м (густота ~4444 куста/га)
   - Цель — производство тихого сухого красного вина
   - Стандартные обработки от милдью/оидиума/серой гнили
   - Нормы полива по фенофазам
   - Подкормки (азот весной, калий/фосфор летом)
   - Обрезка (декабрь-февраль)
   - Сбор урожая (сентябрь-октябрь по сортам)

ВЕРНИ JSON СТРОГО В ФОРМАТЕ:
{
  "year": ${year},
  "summary": "краткое описание плана на год",
  "months": [
    {
      "month": 1,
      "month_name": "Январь",
      "tasks": [
        {
          "title": "Название работы",
          "description": "Детальное описание что делать",
          "priority": "high|med|low",
          "category": "pruning|spray|fertilizer|irrigation|canopy|harvest|monitoring|soil",
          "bbch_phase": "bbch-00 или null",
          "deadline": "2026-01-31",
          "estimated_hours": 8,
          "notes": "Дополнительные заметки"
        }
      ]
    }
  ],
  "key_dates": [
    {"event": "Начало вегетации", "date": "2026-04-15", "bbch": "bbch-11"},
    {"event": "Сбор Мерло", "date": "2026-09-20", "bbch": "bbch-89"}
  ],
  "warnings": ["Важные предупреждения на год"]
}`;

  const res = await openRouterJSONTask({ system, prompt, max_tokens: 4000, temperature: 0.3 });
  
  if (btn) { btn.disabled = false; btn.innerHTML = '🤖 AI годовой план'; }
  
  if (!res.success || !res.json) { 
    toast('AI не смог сгенерировать план: ' + (res.error || 'нет JSON'), 'error'); 
    return; 
  }
  
  const j = res.json;
  
  if (!j.months || !Array.isArray(j.months)) {
    toast('AI вернул некорректный формат', 'error');
    return;
  }
  
  // Конвертируем в задачи
  let addedCount = 0;
  const yearTasks = [];
  
  j.months.forEach(m => {
    if (!m.tasks || !Array.isArray(m.tasks)) return;
    m.tasks.forEach(t => {
      yearTasks.push({
        id: 'tk_year_' + Date.now() + '_' + addedCount,
        date: t.deadline || `${year}-${String(m.month).padStart(2, '0')}-01`,
        priority: t.priority || 'med',
        plotId: '',
        title: `[${m.month_name}] ${t.title}`,
        desc: `${t.description || ''}${t.bbch_phase ? '\nФенофаза: ' + t.bbch_phase : ''}${t.notes ? '\n' + t.notes : ''}`,
        category: t.category || 'monitoring',
        estimated_hours: t.estimated_hours || 0,
        done: false,
        source: 'AI-year-plan',
        created_at: new Date().toISOString()
      });
      addedCount++;
    });
  });
  
  // Показываем превью перед сохранением
  const previewHtml = `
    <div style="max-height: 60vh; overflow-y: auto; padding: 10px;">
      <h3 style="margin-top: 0;">📅 Годовой план на ${year} год</h3>
      <p style="color: var(--text-muted); font-size: 13px;">${j.summary || ''}</p>
      <p style="font-size: 14px; margin: 15px 0;"><b>Всего задач:</b> ${addedCount}</p>
      
      ${j.months.filter(m => m.tasks && m.tasks.length).map(m => `
        <div style="margin-bottom: 15px;">
          <h4 style="margin: 10px 0 5px 0; color: var(--primary);">${m.month_name}</h4>
          <div style="font-size: 13px;">
            ${m.tasks.map(t => `
              <div style="padding: 6px; margin: 4px 0; background: var(--bg-input); border-radius: 6px; border-left: 3px solid ${t.priority === 'high' ? 'var(--danger)' : t.priority === 'med' ? 'var(--warning)' : 'var(--success)'};">
                <b>${t.title}</b><br>
                <span style="color: var(--text-muted); font-size: 11px;">${t.deadline || ''} ${t.bbch_phase ? '· ' + t.bbch_phase : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      
      ${j.key_dates && j.key_dates.length ? `
        <h4 style="margin-top: 20px;">🔑 Ключевые даты</h4>
        <div style="font-size: 13px;">
          ${j.key_dates.map(k => `<div style="padding: 4px;">📍 ${k.event}: <b>${k.date}</b> ${k.bbch ? '(' + k.bbch + ')' : ''}</div>`).join('')}
        </div>
      ` : ''}
      
      ${j.warnings && j.warnings.length ? `
        <h4 style="margin-top: 20px; color: var(--warning);">⚠️ Предупреждения</h4>
        <ul style="font-size: 13px;">
          ${j.warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
  
  // Модалка подтверждения
  const modalId = 'year-plan-preview-modal';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'modal-bg';
  modal.innerHTML = `
    <div class="modal wide" style="max-width: 700px;">
      <div class="modal-header">
        <h3>Предварительный просмотр годового плана</h3>
        <button class="modal-close" onclick="closeModal('${modalId}')">×</button>
      </div>
      <div class="modal-body">${previewHtml}</div>
      <div class="modal-actions">
        <button class="btn secondary" onclick="closeModal('${modalId}')">Отмена</button>
        <button class="btn primary" onclick="saveYearPlan(${yearTasks.length})">💾 Сохранить ${addedCount} задач</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  openModal(modalId);
  
  // Сохраняем задачи во временной переменной
  window._pendingYearTasks = yearTasks;
  window._yearPlanMeta = { summary: j.summary, key_dates: j.key_dates, warnings: j.warnings };
}

function saveYearPlan(count) {
  if (!window._pendingYearTasks || !window._pendingYearTasks.length) {
    toast('Нет задач для сохранения', 'error');
    return;
  }
  
  // Добавляем задачи
  if (!data.tasks) data.tasks = [];
  data.tasks.push(...window._pendingYearTasks);
  
  // Сохраняем метаданные плана
  if (!data.yearPlans) data.yearPlans = [];
  data.yearPlans.push({
    year: new Date().getFullYear(),
    created_at: new Date().toISOString(),
    summary: window._yearPlanMeta?.summary || '',
    key_dates: window._yearPlanMeta?.key_dates || [],
    warnings: window._yearPlanMeta?.warnings || [],
    tasks_count: count
  });
  
  saveData();
  closeModal('year-plan-preview-modal');
  
  // Очищаем временные данные
  window._pendingYearTasks = null;
  window._yearPlanMeta = null;
  
  renderPlan();
  toast(`✅ Добавлено ${count} задач на год`, 'success');
}


async function findProductCandidatesAI(query) {
  const name = (query || '').trim();
  if (!name) return { error: 'Введите название препарата' };
  const system = `Ты агрономический справочник по препаратам и удобрениям. Помогаешь идентифицировать препарат по названию. Не заполняй дозировки, только варианты идентификации. Ответ строго JSON.`;
  const prompt = `Пользователь ввёл: "${name}".
Найди наиболее вероятные варианты препарата/удобрения для виноградарства РФ/СНГ. Укажи производителя/тип, если известно. Если точность низкая — предложи несколько вариантов.

Верни JSON:
{
  "query":"",
  "candidates":[
    {"name":"", "category":"fungicide|insecticide|acaricide|herbicide|fertilizer|stimulator|adjuvant", "active_ingredient":"", "manufacturer":"", "short_description":"", "confidence":"high|medium|low"}
  ],
  "search_links":[{"title":"", "url":""}]
}`;
  const res = await openRouterJSONTask({ system, prompt, max_tokens: 1400, temperature: 0.2 });
  if (!res.success) return res;
  const j = res.json || {};
  const links = Array.isArray(j.search_links) && j.search_links.length ? j.search_links : buildOfficialSearchLinks(name);
  return { success: true, candidates: Array.isArray(j.candidates) ? j.candidates : [], search_links: links, raw: res.raw, model: res.model };
}

// =========== WEB-SEARCH BACKEND / TAVILY для инструкций ===========
async function searchInstructionSources(productName) {
  const name = (productName || '').trim();
  if (!name) return { error: 'Введите название препарата' };
  const query = `официальная инструкция препарат ${name} виноград регламент применения действующее вещество срок ожидания`;
  const provider = settings.webSearchProvider || 'tavily';

  try {
    if (provider === 'backend') {
      if (!settings.searchBackendUrl) return { error: 'Не настроен backend/proxy URL' };
      const r = await fetch(settings.searchBackendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, productName: name, locale: 'ru-RU' })
      });
      if (!r.ok) return { error: `Backend ${r.status}: ${(await r.text()).slice(0, 250)}` };
      const j = await r.json();
      const results = Array.isArray(j.results) ? j.results : [];
      return {
        success: true,
        provider: j.provider || 'backend',
        proxyVersion: j.proxyVersion || '',
        results: normalizeSearchResults(results),
        answer: j.answer || '',
        source_quality: j.source_quality || null
      };
    }

    // Tavily direct mode. Ключ хранится локально у пользователя.
    if (!settings.tavilyKey) return { error: 'Не настроен Tavily API key' };
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: settings.tavilyKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: 7,
        include_domains: ['agro.basf.ru','agroxxi.ru','mcx.gov.ru','agromax.pro','avgust.com','syngenta.ru','cropscience.bayer.ru']
      })
    });
    if (!r.ok) return { error: `Tavily ${r.status}: ${(await r.text()).slice(0, 250)}` };
    const j = await r.json();
    return { success: true, provider: 'tavily', results: normalizeSearchResults(j.results || []), answer: j.answer || '' };
  } catch(e) {
    return { error: 'Web-search: ' + e.message };
  }
}

function normalizeSearchResults(results) {
  return (results || []).map(r => ({
    title: r.title || r.name || r.url || 'Источник',
    url: r.url || r.link || '',
    content: r.content || r.snippet || r.description || r.raw_content || '',
    domain: r.domain || '',
    source_type: r.source_type || '',
    trusted: !!r.trusted,
    score: typeof r.score === 'number' ? r.score : null,
    reasons: Array.isArray(r.reasons) ? r.reasons : []
  })).filter(r => r.url || r.content).slice(0, 10);
}

function buildInstructionTextFromSearch(productName, search) {
  const parts = [];
  parts.push(`ПРЕПАРАТ: ${productName}`);
  if (search.answer) parts.push(`\n--- СВОДКА WEB-SEARCH ---\n${search.answer}`);
  if (search.source_quality) {
    const q = search.source_quality;
    parts.push(`\n--- КАЧЕСТВО ИСТОЧНИКОВ ---\nПроверенных доменов производителей: ${q.trusted || 0}. Всего источников: ${q.returned || (search.results || []).length}. Домены: ${(q.domains || []).join(', ') || '—'}.`);
    if (Array.isArray(q.warnings) && q.warnings.length) parts.push(`Предупреждения: ${q.warnings.join(' ')}`);
  }
  (search.results || []).forEach((r, i) => {
    const meta = [
      r.domain ? `domain=${r.domain}` : '',
      r.trusted ? 'trusted=manufacturer' : '',
      r.score !== null && r.score !== undefined ? `score=${r.score}` : '',
      r.source_type ? `type=${r.source_type}` : ''
    ].filter(Boolean).join('; ');
    parts.push(`\n--- ИСТОЧНИК ${i + 1}: ${r.title} ---\nURL: ${r.url}\n${meta ? 'META: ' + meta + '\n' : ''}${r.content || ''}`);
  });
  return parts.join('\n');
}
