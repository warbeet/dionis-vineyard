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
    if (minT < 2 && (phase === 'budbreak' || phase === 'leaves' || phase === 'flowering')) {
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

  // Фенофаза
  if (phaseObj) {
    const phaseAdvice = {
      dormancy: 'Период покоя. Завершите обрезку до распускания почек.',
      budbreak: 'Распускание почек — самая уязвимая фаза. Контроль заморозков, первая медная обработка.',
      leaves: 'Активный рост — обработки от милдью каждые 10-14 дней.',
      flowering: '⚠️ КРИТИЧНО: НЕ опрыскивать в цветение!',
      fruitset: 'Завязывание — комбинированные обработки, нормировка урожая.',
      'berry-growth': 'Контроль оидиума, удаление листьев в зоне гроздей.',
      veraison: 'Прекращение поливов, защита от серой гнили (с учётом сроков ожидания).',
      ripening: 'Замеры Brix, контроль ос, соблюдение сроков ожидания.',
      harvest: 'Контроль зрелости (Brix/pH/TA), быстрая переработка.',
      leaffall: 'Послеуборочная медь, калий-фосфор.'
    };
    recs.push({ priority: 'med', title: `🌿 Фенофаза: ${phaseObj.name}`, text: phaseAdvice[phase] || phaseObj.desc,
      source: 'Календарь фенофаз', date: todayStr() });
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
  if (lastTr && daysSince(lastTr.date) > 14 && (phase === 'leaves' || phase === 'fruitset' || phase === 'berry-growth')) {
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
