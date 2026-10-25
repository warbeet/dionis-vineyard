// ============================================================================
// RECOMMENDATIONS module
// ============================================================================

// RECOMMENDATIONS
// ===========================================================================
function generateRecommendations() {
  const recs = data.recommendations.filter(r => r.source && r.source.includes('AI')); // сохраняем AI-рекомендации
  const phase = data.currentPheno;
  const phaseObj = PHENO_STAGES.find(s => s.id === phase);

  // Прогноз погоды (если есть)
  if (data.forecast && data.forecast.length) {
    const totalRain = data.forecast.slice(0, 7).reduce((s,d)=>s+(d.rain||0),0);
    const minT = Math.min(...data.forecast.map(d => d.tmin));
    const maxT = Math.max(...data.forecast.map(d => d.tmax));
    if (totalRain > 30) recs.push({ priority: 'high', title: '☔ Прогноз: высокая влажность',
      text: `Ожидается ${totalRain.toFixed(0)} мм осадков за 7 дней. Высокий риск милдью/серой гнили. Рекомендована профилактическая обработка системным фунгицидом.`,
      source: 'Open-Meteo прогноз', date: todayStr() });
    if (minT < 2 && (phase === 'bbch-11' || phase === 'bbch-15' || phase === 'bbch-61' || phase === 'bbch-65' ||
        phase === 'budbreak' || phase === 'leaves' || phase === 'flowering')) {
      recs.push({ priority: 'high', title: '🥶 Прогноз: заморозки',
        text: `Ожидается минимум ${minT.toFixed(1)}°C. На уязвимой фазе критична защита.`,
        source: 'Open-Meteo прогноз', date: todayStr() });
    }
    if (maxT > 35) recs.push({ priority: 'med', title: '🔥 Прогноз: жара',
      text: `Ожидается до ${maxT.toFixed(1)}°C. Возможен солнечный ожог. Сохраните листовой полог.`,
      source: 'Open-Meteo прогноз', date: todayStr() });
  }

  // Анализ погоды (вручную внесённой)
  const recentWeather = data.weather.slice(0, 7);
  if (recentWeather.length) {
    const totalRain = recentWeather.reduce((s,w)=>s+(w.rain||0),0);
    if (totalRain > 30) recs.push({ priority: 'high', title: '☔ За 7 дней много осадков',
      text: `Выпало ${totalRain.toFixed(0)} мм. Высокий риск грибковых.`,
      source: 'Анализ журнала погоды', date: todayStr() });
  }

  // Фенофаза (v0.7.11: поддержка BBCH)
  if (phaseObj) {
    // v0.7.11: Правильные агрономические рекомендации по BBCH
    const phaseAdvice = {
      'bbch-00': 'Период покоя. Завершите обрезку до распускания почек. Проверьте шпалеру.',
      'bbch-09': 'Конец покоя. Подготовка к вегетации. Профилактическая медная обработка.',
      'bbch-11': 'Распускание почек — самая уязвимая фаза. Контроль заморозков, первая медная обработка от милдью.',
      'bbch-15': 'Массовое распускание. Продолжение защиты от заморозков (дымление, дождевание).',
      'bbch-51': 'Появление соцветий. Начало защиты от милдью каждые 10-14 дней. Контактные + системные фунгициды.',
      'bbch-53': 'Соцветия развиты. Обязательная обработка от милдью. Проверка фосфорного питания.',
      'bbch-55': 'Набухание бутонов. Комбинированная обработка (милдью + оидиум). Не использовать серу при t>28°C!',
      'bbch-57': 'Обособление бутонов. Последняя обработка ПЕРЕД цветением. Системные фунгициды от Botrytis.',
      'bbch-61': 'Начало цветения (10%). ⚠️ РАЗРЕШЕНЫ системные фунгициды от Botrytis/оидиума (Свитч, Хорус). ЗАПРЕЩЕНЫ инсектициды и контактные обжигающие препараты!',
      'bbch-65': 'Полное цветение (50%). Критическая фаза. Защита от Botrytis. Без инсектицидов — гибель пчёл!',
      'bbch-69': 'Конец цветения. Обработка от Botrytis ОБЯЗАТЕЛЬНА. Начало контроля оидиума.',
      'bbch-71': 'Ягода с дробь. Формирование гроздей. Защита от милдью + оидиума. Нормировка урожая.',
      'bbch-73': 'Рост ягод. Усиленная защита от оидиума. Удаление листьев в зоне гроздей для вентиляции.',
      'bbch-75': 'Ягоды крупнее горошины. Контроль оидиума, серая гниль. Проверка калийного питания.',
      'bbch-77': 'Смыкание ягод. Профилактика серой гнили (Хорус, Свитч). Дефлиация зоны гроздей.',
      'bbch-81': 'Veraison — начало созревания. Прекращение поливов. Сроки ожидания препаратов!',
      'bbch-85': 'Сортовой окрас ягод. Накопление сахаров. Контроль птиц/ос. Замер Brix еженедельно.',
      'bbch-89': 'Техническая зрелость. Замеры Brix/pH/TA. Готовность к сбору. Быстрая переработка.'
    };
    
    // Обратная совместимость со старыми ID
    const legacyAdvice = {
      dormancy: 'Период покоя. Завершите обрезку до распускания почек.',
      budbreak: 'Распускание почек — самая уязвимая фаза. Контроль заморозков, первая медная обработка.',
      leaves: 'Активный рост — обработки от милдью каждые 10-14 дней.',
      flowering: '⚠️ КРИТИЧНО: Обработка СИСТЕМНЫМИ фунгицидами от Botrytis/оидиума РАЗРЕШЕНА в начале и конце цветения (BBCH 61-69). ЗАПРЕЩЕНЫ инсектициды и контактные обжигающие препараты — гибель пчёл и ожог цветков!',
      fruitset: 'Завязывание — комбинированные обработки, нормировка урожая.',
      'berry-growth': 'Контроль оидиума, удаление листьев в зоне гроздей.',
      veraison: 'Прекращение поливов, защита от серой гнили (с учётом сроков ожидания).',
      ripening: 'Замеры Brix, контроль ос, соблюдение сроков ожидания.',
      harvest: 'Контроль зрелости (Brix/pH/TA), быстрая переработка.',
      leaffall: 'Послеуборочная медь, калий-фосфор.'
    };
    
    const advice = phaseAdvice[phase] || legacyAdvice[phase] || phaseObj.desc;
    recs.push({ priority: 'med', title: `🌿 Фенофаза: ${phaseObj.name}`, text: advice,
      source: 'Календарь фенофаз BBCH', date: todayStr() });
  }

  // Серьёзные проблемы
  const recentDis = data.diseases.filter(d => daysSince(d.date) < 30);
  const high = recentDis.filter(d => d.severity === 'high');
  if (high.length) {
    recs.push({ priority: 'high', title: '🚨 Активные серьёзные проблемы',
      text: `За месяц зафиксировано ${high.length} проблем(ы) высокой степени: ${high.map(d=>d.type).join(', ')}.`,
      source: 'Журнал болезней', date: todayStr() });
  }

  // Давно не обрабатывали
  const lastTr = data.treatments[data.treatments.length - 1];
  if (lastTr && daysSince(lastTr.date) > 14 && (phase === 'bbch-51' || phase === 'bbch-53' || phase === 'bbch-55' || 
      phase === 'bbch-71' || phase === 'bbch-73' || phase === 'bbch-75' ||
      phase === 'leaves' || phase === 'fruitset' || phase === 'berry-growth')) {
    recs.push({ priority: 'med', title: '⏰ Давно не было обработок',
      text: `Последняя (${lastTr.product}) — ${daysSince(lastTr.date)} дн. назад. Интервал должен быть 10-14 дней.`,
      source: 'Журнал обработок', date: todayStr() });
  }

  data.recommendations = recs.slice(0, 50);
  saveData();
  renderRecommendations();
  updateDashboard();
}

function renderRecommendations() {
  const list = document.getElementById('recommendations-list');
  if (!data.recommendations.length) { list.innerHTML = '<div class="empty">Нажмите «Обновить».</div>'; return; }
  const order = { high: 0, med: 1, low: 2 };
  const sorted = [...data.recommendations].sort((a,b) => order[a.priority] - order[b.priority]);
  list.innerHTML = sorted.map(r => {
    const cls = r.priority === 'high' ? 'red' : r.priority === 'med' ? 'yellow' : 'green';
    const label = r.priority === 'high' ? 'Срочно' : r.priority === 'med' ? 'Важно' : 'Инфо';
    return `<div class="ai-recommendation">
      <h4>${escapeHtml(r.title)} <span class="badge ${cls}">${label}</span></h4>
      <p style="color:#4a3a2a; font-size:14px; line-height:1.5;">${escapeHtml(r.text)}</p>
      ${r.source ? `<div class="ai-source">Источник: ${escapeHtml(r.source)} ${r.date ? '· ' + r.date : ''}</div>` : ''}
    </div>`;
  }).join('');
}

// ===========================================================================
