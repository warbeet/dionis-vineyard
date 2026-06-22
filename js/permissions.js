// ============================================================================
// PERMISSIONS module — настройка ролей и доступов
// ============================================================================

const ROLE_ORDER = ['owner', 'agronomist', 'worker', 'viewer'];

const PERMISSION_GROUPS = [
  {
    id: 'navigation',
    title: 'Навигация и просмотр',
    items: [
      { id: 'tab.dashboard', label: 'Дашборд' },
      { id: 'tab.plots', label: 'Участки' },
      { id: 'tab.photos', label: 'Фотоотчёты' },
      { id: 'tab.journal', label: 'Журнал работ' },
      { id: 'tab.weather', label: 'Погода' },
      { id: 'tab.treatments', label: 'Обработки' },
      { id: 'tab.plan', label: 'План работ' },
      { id: 'tab.recommendations', label: 'Рекомендации' },
      { id: 'tab.harvest', label: 'Урожай и затраты' },
      { id: 'tab.reports', label: 'Отчёты' },
      { id: 'tab.team', label: 'Команда' },
      { id: 'tab.settings', label: 'Настройки' }
    ]
  },
  {
    id: 'actions',
    title: 'Действия',
    items: [
      { id: 'plots.edit', label: 'Редактировать участки/ряды/сорта' },
      { id: 'seedlings.edit', label: 'Редактировать саженцы' },
      { id: 'photos.create', label: 'Добавлять фотоотчёты' },
      { id: 'journal.edit', label: 'Вести журнал работ' },
      { id: 'weather.edit', label: 'Вносить погоду/фенофазы' },
      { id: 'treatments.edit', label: 'Болезни и обработки' },
      { id: 'spray.edit', label: 'План опрыскивания' },
      { id: 'plan.edit', label: 'Задачи и недельный план' },
      { id: 'harvest.edit', label: 'Урожай и затраты' },
      { id: 'reports.export', label: 'Экспорт отчётов' },
      { id: 'data.export', label: 'Экспорт JSON-бэкапа' },
      { id: 'team.manage', label: 'Управлять командой' },
      { id: 'settings.edit', label: 'Изменять настройки' }
    ]
  }
];

const DEFAULT_ROLE_PERMISSIONS = {
  owner: ['*'],
  agronomist: [
    'tab.dashboard','tab.plots','tab.photos','tab.journal','tab.weather','tab.treatments','tab.plan','tab.recommendations','tab.harvest','tab.reports','tab.team','tab.settings',
    'plots.edit','seedlings.edit','photos.create','journal.edit','weather.edit','treatments.edit','spray.edit','plan.edit','harvest.edit','reports.export','data.export'
  ],
  worker: [
    'tab.dashboard','tab.plots','tab.photos','tab.journal','tab.weather','tab.plan','tab.team','tab.settings',
    'photos.create','journal.edit','plan.edit'
  ],
  viewer: [
    'tab.dashboard','tab.plots','tab.photos','tab.journal','tab.weather','tab.treatments','tab.plan','tab.recommendations','tab.harvest','tab.reports','tab.team','tab.settings',
    'reports.export'
  ]
};

function ensureRolePermissions() {
  if (!data.rolePermissions) data.rolePermissions = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
  // owner всегда полный доступ — чтобы не заблокировать владельца ошибочной настройкой
  data.rolePermissions.owner = ['*'];
  ROLE_ORDER.forEach(role => {
    if (!Array.isArray(data.rolePermissions[role])) {
      data.rolePermissions[role] = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role] || []));
    }
  });
}

function getRolePermissions(role = currentRole) {
  ensureRolePermissions();
  return data.rolePermissions[role] || [];
}

function hasPermission(permission, role = currentRole) {
  if (!permission) return true;
  if (role === 'owner') return true;
  const perms = getRolePermissions(role);
  return perms.includes('*') || perms.includes(permission);
}

function canAccessTab(tabId, role = currentRole) {
  return hasPermission('tab.' + tabId, role);
}

function requirePermission(permission, message = 'Недостаточно прав') {
  if (hasPermission(permission)) return true;
  toast('⛔ ' + message, 'error');
  return false;
}

function getAllPermissionItems() {
  return PERMISSION_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.title })));
}

function setRolePermission(role, permission, enabled) {
  ensureRolePermissions();
  if (role === 'owner') return;
  const set = new Set(data.rolePermissions[role] || []);
  if (enabled) set.add(permission);
  else set.delete(permission);
  data.rolePermissions[role] = Array.from(set);
}

function resetRolePermissions() {
  if (!confirm('Сбросить права ролей к значениям по умолчанию?')) return;
  data.rolePermissions = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
  saveData();
  renderRoleSettings();
  updateNavigationByPermissions();
  toast('✅ Права ролей сброшены', 'success');
}

function saveRolePermissionsFromUI() {
  if (currentRole !== 'owner') { toast('Только владелец может менять роли', 'error'); return; }
  ensureRolePermissions();
  const items = getAllPermissionItems();
  ROLE_ORDER.filter(r => r !== 'owner').forEach(role => {
    data.rolePermissions[role] = [];
    items.forEach(item => {
      const el = document.getElementById(`perm-${role}-${item.id.replaceAll('.', '-')}`);
      if (el && el.checked) data.rolePermissions[role].push(item.id);
    });
  });
  saveData();
  renderRoleSettings();
  updateNavigationByPermissions();
  toast('✅ Права ролей сохранены', 'success');
}

function renderRoleSettings() {
  const cont = document.getElementById('role-settings');
  if (!cont) return;
  ensureRolePermissions();

  if (currentRole !== 'owner') {
    cont.innerHTML = '<p style="font-size:13px; color:var(--text-muted);">Настройка ролей доступна только владельцу.</p>';
    return;
  }

  const roleNames = typeof ROLE_LABELS !== 'undefined' ? ROLE_LABELS : {
    owner: '👑 Владелец', agronomist: '🧑‍🌾 Агроном', worker: '👷 Рабочий', viewer: '👁 Наблюдатель'
  };

  cont.innerHTML = `
    <div class="alert info" style="font-size:12px;">
      👑 Владелец всегда имеет полный доступ и не может быть ограничен. Остальные роли можно настроить ниже.
    </div>
    <div class="role-permissions-wrap">
      ${PERMISSION_GROUPS.map(group => `
        <h4 style="margin:16px 0 10px;">${group.title}</h4>
        <div class="table-wrap"><table class="role-permissions-table">
          <thead>
            <tr>
              <th>Право</th>
              ${ROLE_ORDER.map(role => `<th>${roleNames[role] || role}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${group.items.map(item => `
              <tr>
                <td><b>${escapeHtml(item.label)}</b><br><small style="color:var(--text-muted);">${escapeHtml(item.id)}</small></td>
                ${ROLE_ORDER.map(role => {
                  const checked = hasPermission(item.id, role);
                  const disabled = role === 'owner' ? 'disabled' : '';
                  const id = `perm-${role}-${item.id.replaceAll('.', '-')}`;
                  return `<td style="text-align:center;"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''} ${disabled}></td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      `).join('')}
    </div>
    <div class="toolbar" style="margin-top:14px;">
      <button class="btn primary" onclick="saveRolePermissionsFromUI()">💾 Сохранить права</button>
      <button class="btn secondary" onclick="resetRolePermissions()">↩ Сбросить по умолчанию</button>
    </div>
  `;
}

function updateNavigationByPermissions() {
  document.querySelectorAll('.nav-btn[data-tab], .bottom-nav-btn[data-tab]').forEach(btn => {
    const tab = btn.dataset.tab;
    const allowed = canAccessTab(tab);
    btn.style.display = allowed ? '' : 'none';
  });
}

// ============================================================================
