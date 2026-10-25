// ============================================================================
// PLAN module
// ============================================================================

// TASKS
// ===========================================================================
function openTaskModal(id) {
  ['t-date','t-title','t-desc'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('task-id').value = '';
  document.getElementById('t-date').value = todayStr();
  document.getElementById('t-priority').value = 'med';
  if (id) {
    const t = data.tasks.find(x => x.id === id);
    if (t) {
      document.getElementById('task-id').value = t.id;
      document.getElementById('t-date').value = t.date;
      document.getElementById('t-priority').value = t.priority;
      document.getElementById('t-plot').value = t.plotId || '';
      document.getElementById('t-title').value = t.title;
      document.getElementById('t-desc').value = t.desc || '';
    }
  }
  openModal('task-modal');
}

function saveTask() {
  if (!requirePermission('plan.edit', 'Нет прав на задачи и план')) return;
  const id = document.getElementById('task-id').value || ('tk_' + Date.now());
  const t = {
    id,
    date: document.getElementById('t-date').value,
    priority: document.getElementById('t-priority').value,
    plotId: document.getElementById('t-plot').value,
    title: document.getElementById('t-title').value.trim(),
    desc: document.getElementById('t-desc').value.trim(),
    done: false
  };
  if (!t.title) { toast('Укажите название', 'error'); return; }
  const ex = data.tasks.find(x => x.id === id);
  if (ex) Object.assign(ex, t); else data.tasks.push(t);
  saveData(); closeModal('task-modal'); renderAll();
}

function toggleTask(id) {
  if (!requirePermission('plan.edit', 'Нет прав на выполнение задач')) return;
  const t = data.tasks.find(x => x.id === id);
  if (t) { t.done = !t.done; saveData(); renderPlan(); updateDashboard(); }
}

function deleteTask(id) {
  if (!requirePermission('plan.edit', 'Нет прав на удаление задач')) return;
  data.tasks = data.tasks.filter(t => t.id !== id);
  saveData(); renderAll();
}

function renderPlan() {
  const list = document.getElementById('plan-list');
  if (!data.tasks.length) {
    list.innerHTML = '<div class="empty">Нет задач.</div>';
    document.getElementById('progress-text').textContent = '0 из 0';
    document.getElementById('progress-fill').style.width = '0%';
    return;
  }
  const done = data.tasks.filter(t => t.done).length;
  document.getElementById('progress-text').textContent = `${done} из ${data.tasks.length} задач выполнено`;
  document.getElementById('progress-fill').style.width = (data.tasks.length ? done/data.tasks.length*100 : 0) + '%';
  const sorted = [...data.tasks].sort((a, b) => a.done !== b.done ? (a.done ? 1 : -1) : a.date.localeCompare(b.date));
  const prio = { high: '🔴', med: '🟡', low: '🟢' };
  list.innerHTML = sorted.map(t => {
    const plot = data.plots.find(p => p.id === t.plotId);
    return `<div class="card" style="margin-bottom:10px; ${t.done ? 'opacity:0.6;' : ''}">
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask('${t.id}')" style="width:20px; height:20px; margin-top:3px;">
        <div style="flex:1;">
          <div class="${t.done ? 'task-done' : ''}" style="font-weight:600; color:#4a1f3a;">${prio[t.priority]} ${escapeHtml(t.title)}</div>
          <div style="font-size:12px; color:#8a7a6a; margin-top:4px;">📅 ${t.date} ${plot ? '· 📍 ' + escapeHtml(plot.name) : ''}</div>
          ${t.desc ? `<p style="font-size:13px; color:#6b5a4a; margin-top:6px;">${escapeHtml(t.desc)}</p>` : ''}
        </div>
        <div style="display:flex; gap:4px;">
          <button class="btn small secondary" onclick="openTaskModal('${t.id}')">✏️</button>
          <button class="btn small danger" onclick="deleteTask('${t.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function generateWeekPlan() {
  if (!requirePermission('plan.edit', 'Нет прав на генерацию плана')) return;
  if (!data.currentPheno) { toast('Сначала укажите фенофазу', 'error'); return; }
  const today = todayStr();
  
  // v0.7.15: Полная поддержка 18 стадий BBCH + обратная совместимость
  const tasksByPhase = {
    // === ПОКОЙ (BBCH 00-09) ===
    'bbch-00': [
      { title: 'Зимняя обрезка лоз', priority: 'high', desc: 'Сформировать плодовые звенья' },
      { title: 'Очистка штамбов от старой коры', priority: 'med', desc: 'Профилактика вредителей' },
      { title: 'Ремонт шпалеры и опор', priority: 'med', desc: 'Подготовка к вегетации' }
    ],
    'bbch-09': [
      { title: 'Завершить обрезку до распускания', priority: 'high', desc: '' },
      { title: 'Профилактическая медная обработка', priority: 'high', desc: 'Бордоская смесь 3%' },
      { title: 'Влагозарядковый полив (если сухо)', priority: 'med', desc: '' },
      { title: 'Подвязка лоз к шпалере', priority: 'med', desc: '' }
    ],
    
    // === РАСПУСКАНИЕ ПОЧЕК (BBCH 11-15) ===
    'bbch-11': [
      { title: '🥶 Контроль заморозков', priority: 'high', desc: 'Дымление, дождевание, обогрев' },
      { title: 'Первая обработка от милдью', priority: 'high', desc: 'Медьсодержащий препарат (Бордоская 1%, Косайд)' },
      { title: 'Подвязка прошлогодних лоз', priority: 'med', desc: '' }
    ],
    'bbch-15': [
      { title: '🥶 Продолжить защиту от заморозков', priority: 'high', desc: 'Массовое распускание — критичная фаза' },
      { title: 'Обломка двойников и волчков', priority: 'med', desc: '' },
      { title: 'Подкормка азотом 40-60 кг/га', priority: 'med', desc: '' }
    ],
    
    // === РАЗВИТИЕ СОЦВЕТИЙ (BBCH 51-57) ===
    'bbch-51': [
      { title: 'Системная обработка милдью+оидиум', priority: 'high', desc: 'Ридомил Голд + Топаз' },
      { title: 'Обломка бесплодных побегов', priority: 'high', desc: '' },
      { title: 'Подвязка зелёных побегов', priority: 'med', desc: '' }
    ],
    'bbch-53': [
      { title: 'Обработка милдью+оидиум (системная)', priority: 'high', desc: 'Интервал 10-14 дней' },
      { title: 'Пасынкование', priority: 'med', desc: '' },
      { title: 'Проверка фосфорного питания', priority: 'med', desc: '' }
    ],
    'bbch-55': [
      { title: 'Комбинированная обработка', priority: 'high', desc: 'Милдью + оидиум. НЕ сера при t>28°C!' },
      { title: 'Прогноз риска милдью по погоде', priority: 'med', desc: '' }
    ],
    'bbch-57': [
      { title: 'Последняя обработка ПЕРЕД цветением', priority: 'high', desc: 'Системные фунгициды от Botrytis (Хорус)' },
      { title: 'Нормировка соцветий', priority: 'med', desc: '' }
    ],
    
    // === ЦВЕТЕНИЕ (BBCH 61-69) ===
    'bbch-61': [
      { title: '🍇 Обработка от Botrytis и оидиума', priority: 'high', desc: 'Системные: Свитч, Хорус, Топаз. ⚠️ БЕЗ инсектицидов!' },
      { title: '⚠️ ЗАПРЕЩЕНЫ инсектициды и контактная сера', priority: 'high', desc: 'Гибель пчёл и ожог цветков' },
      { title: 'Контроль влажности в кроне', priority: 'med', desc: 'Проветривание' }
    ],
    'bbch-65': [
      { title: '🍇 Полное цветение — защита от Botrytis', priority: 'high', desc: 'Свитч/Хорус. Без инсектицидов!' },
      { title: 'Контроль завязывания', priority: 'med', desc: '' },
      { title: 'Ограничение обработок — лёт пчёл', priority: 'high', desc: '' }
    ],
    'bbch-69': [
      { title: '🍇 ОБЯЗАТЕЛЬНАЯ обработка от Botrytis', priority: 'high', desc: 'Опадение колпачков — ворота инфекции' },
      { title: 'Начало контроля оидиума', priority: 'med', desc: '' },
      { title: 'Приём пищи после цветения (азот+калий)', priority: 'med', desc: '' }
    ],
    
    // === РОСТ ЯГОД (BBCH 71-77) ===
    'bbch-71': [
      { title: 'Системная обработка милдью+оидиум', priority: 'high', desc: 'Ридомил + Топаз' },
      { title: 'Нормировка урожая (green harvest)', priority: 'med', desc: '' },
      { title: 'Чеканка побегов', priority: 'med', desc: '' }
    ],
    'bbch-73': [
      { title: 'Защита от оидиума', priority: 'high', desc: 'Сера или Топаз' },
      { title: 'Удаление листьев в зоне гроздей', priority: 'med', desc: 'Вентиляция' },
      { title: 'Полив при засухе', priority: 'med', desc: '' }
    ],
    'bbch-75': [
      { title: 'Контроль оидиума', priority: 'high', desc: '' },
      { title: 'Профилактика серой гнили', priority: 'med', desc: '' },
      { title: 'Проверка калийного питания', priority: 'med', desc: '' }
    ],
    'bbch-77': [
      { title: 'Профилактика серой гнили', priority: 'high', desc: 'Хорус/Свитч' },
      { title: 'Дефлиация зоны гроздей', priority: 'med', desc: 'Удаление листьев' },
      { title: 'Подготовка к верейзону', priority: 'med', desc: '' }
    ],
    
    // === СОЗРЕВАНИЕ (BBCH 81-89) ===
    'bbch-81': [
      { title: 'Прекращение поливов', priority: 'high', desc: 'Для концентрации сахаров' },
      { title: '⏰ Контроль сроков ожидания препаратов', priority: 'high', desc: 'Минимум 30 дней до сбора!' },
      { title: 'Защита от серой гнили', priority: 'med', desc: 'С учётом PHI' }
    ],
    'bbch-85': [
      { title: '📊 Замеры Brix еженедельно', priority: 'high', desc: 'Контроль зрелости' },
      { title: 'Контроль ос и птиц', priority: 'med', desc: 'Ловушки, сетки' },
      { title: 'Подготовка тары для сбора', priority: 'med', desc: '' }
    ],
    'bbch-89': [
      { title: '🍇 ГОТОВНОСТЬ К СБОРУ', priority: 'high', desc: 'Brix/pH/TA в норме' },
      { title: 'Организация сбора', priority: 'high', desc: 'Быстрая переработка' },
      { title: 'Фиксация температуры ягод', priority: 'med', desc: 'Охлаждение перед дроблением' }
    ],
    
    // === ОБРАТНАЯ СОВМЕСТИМОСТЬ СО СТАРЫМИ ID ===
    dormancy: [
      { title: 'Зимняя обрезка лоз', priority: 'high', desc: 'Сформировать плодовые звенья' },
      { title: 'Очистка штамбов', priority: 'med', desc: 'Удалить отмершую кору' },
      { title: 'Проверка опор и шпалеры', priority: 'med', desc: '' }
    ],
    budbreak: [
      { title: 'Защита от заморозков', priority: 'high', desc: 'Контроль ночных температур' },
      { title: 'Первая медьсодержащая обработка', priority: 'high', desc: 'Бордоская смесь 1%' },
      { title: 'Подвязка прошлогодних лоз', priority: 'med', desc: '' }
    ],
    leaves: [
      { title: 'Обработка от милдью', priority: 'high', desc: 'При побегах 10-15 см' },
      { title: 'Обломка лишних побегов', priority: 'high', desc: '' },
      { title: 'Подкормка азотом 40-60 кг/га', priority: 'med', desc: '' }
    ],
    flowering: [
      { title: '🍇 Обработка от Botrytis/оидиума (системная)', priority: 'high', desc: 'Свитч/Хорус в BBCH 61-69. ⚠️ БЕЗ инсектицидов!' },
      { title: 'Контроль завязывания', priority: 'med', desc: '' }
    ],
    fruitset: [
      { title: 'Системная обработка милдью+оидиум', priority: 'high', desc: 'Ридомил + Топаз' },
      { title: 'Чеканка побегов', priority: 'med', desc: '' },
      { title: 'Нормировка урожая', priority: 'med', desc: '' }
    ],
    'berry-growth': [
      { title: 'Защита от оидиума', priority: 'high', desc: 'Сера или Топаз' },
      { title: 'Полив при засухе', priority: 'med', desc: '' },
      { title: 'Удаление листьев в зоне гроздей', priority: 'med', desc: '' }
    ],
    veraison: [
      { title: 'Прекращение поливов', priority: 'high', desc: '' },
      { title: 'Защита от серой гнили', priority: 'high', desc: 'Хорус/Свитч за 30+ дней до сбора' },
      { title: 'Сетка от птиц', priority: 'med', desc: '' }
    ],
    ripening: [
      { title: 'Замеры Brix еженедельно', priority: 'high', desc: '' },
      { title: 'Контроль ос', priority: 'med', desc: 'Ловушки' },
      { title: 'Соблюдать сроки ожидания', priority: 'high', desc: '' }
    ],
    harvest: [
      { title: 'Сбор урожая', priority: 'high', desc: 'Контроль Brix/pH/TA' },
      { title: 'Очистка тары', priority: 'med', desc: '' }
    ],
    leaffall: [
      { title: 'Послеуборочная медь', priority: 'high', desc: '' },
      { title: 'Калий и фосфор', priority: 'med', desc: '' },
      { title: 'Влагозарядковый полив', priority: 'med', desc: '' }
    ]
  };
  
  const tasks = tasksByPhase[data.currentPheno] || [];
  let added = 0;
  tasks.forEach(t => {
    data.tasks.push({
      id: 'tk_' + Date.now() + '_' + (added++),
      date: today, priority: t.priority,
      plotId: '', title: t.title, desc: t.desc, done: false
    });
  });
  saveData(); renderAll();
  toast(`✅ Добавлено ${added} задач для текущей фенофазы`, 'success');
}

// ===========================================================================
