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
  const t = data.tasks.find(x => x.id === id);
  if (t) { t.done = !t.done; saveData(); renderPlan(); updateDashboard(); }
}

function deleteTask(id) {
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
  if (!data.currentPheno) { toast('Сначала укажите фенофазу', 'error'); return; }
  const today = todayStr();
  const tasksByPhase = {
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
      { title: '⚠️ НЕ обрабатывать в цветение', priority: 'high', desc: 'Только до или после' },
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
  toast(`✅ Добавлено ${added} задач`, 'success');
}

// ===========================================================================
