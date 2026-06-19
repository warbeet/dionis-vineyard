// ============================================================================
// VERSION module — Отображение версии, changelog, проверка обновлений
// ============================================================================

let cachedChangelog = null;

async function loadChangelog() {
  if (cachedChangelog) return cachedChangelog;
  try {
    const r = await fetch('version.json?nocache=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    cachedChangelog = await r.json();
    return cachedChangelog;
  } catch (e) {
    console.error('Failed to load version.json:', e);
    return { version: APP_VERSION, changelog: [] };
  }
}

// Применить версию во все места UI
function applyVersionToUI() {
  document.querySelectorAll('.version-badge').forEach(el => el.textContent = 'v' + APP_VERSION);
  document.querySelectorAll('.auth-version').forEach(el => el.textContent = APP_VERSION);
  const av = document.getElementById('about-version');
  const ad = document.getElementById('about-date');
  if (av) av.textContent = APP_VERSION;
  if (ad) ad.textContent = APP_VERSION_DATE;
  // Сделаем бейдж кликабельным
  document.querySelectorAll('.version-badge').forEach(el => {
    el.title = 'Открыть историю изменений';
    el.onclick = (e) => { e.stopPropagation(); showChangelog(); };
  });
}

async function showChangelog() {
  const data = await loadChangelog();
  const cont = document.getElementById('changelog-content');
  if (!cont) {
    // Если модалки нет — переключимся в Настройки
    showTab('settings');
    setTimeout(() => showChangelog(), 300);
    return;
  }

  const typeColors = { major: 'red', minor: 'purple', patch: 'green' };
  const typeLabels = { major: 'Major', minor: 'Minor', patch: 'Patch' };

  cont.innerHTML = data.changelog.map((rel, idx) => {
    const isCurrent = rel.version === APP_VERSION;
    return `
      <div style="padding:14px 0; border-bottom:1px solid var(--border); ${isCurrent ? 'background:linear-gradient(90deg, rgba(107,142,90,0.08), transparent); padding:14px; border-radius:12px; margin-bottom:6px;' : ''}">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
          <span style="font-size:18px; font-weight:700; color:var(--text);">v${rel.version}</span>
          ${isCurrent ? '<span class="badge green">текущая</span>' : ''}
          <span class="badge ${typeColors[rel.type] || 'gray'}">${typeLabels[rel.type] || rel.type}</span>
          <span style="color:var(--text-muted); font-size:11px; margin-left:auto;">${rel.date}</span>
        </div>
        <div style="font-weight:600; color:var(--primary); margin-bottom:8px; font-size:14px;">${escapeHtml(rel.title)}</div>
        <ul style="list-style:none; padding-left:0; font-size:13px; color:var(--text-soft); line-height:1.7;">
          ${rel.changes.map(ch => `<li style="padding-left:12px; position:relative;"><span style="position:absolute; left:0; color:var(--primary);">•</span> ${escapeHtml(ch)}</li>`).join('')}
        </ul>
      </div>
    `;
  }).join('');
  openModal('changelog-modal');
}

// Проверка обновлений: сравнить локальную версию с серверной
async function checkForUpdate() {
  toast('Проверяем обновления...');
  try {
    // Загружаем version.json напрямую с сервера (минуя SW-кэш)
    const r = await fetch('version.json?nocache=' + Date.now());
    const remote = await r.json();
    cachedChangelog = remote;
    if (remote.version !== APP_VERSION) {
      // Очистим SW-кэш и перезагрузим
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update()));
      }
      if (confirm(`🎉 Доступна новая версия: v${remote.version}\n\n${remote.changelog[0]?.title || ''}\n\nОбновить сейчас?`)) {
        // Очистим кэши и перезагрузим
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        location.reload(true);
      }
    } else {
      toast(`✅ У вас актуальная версия v${APP_VERSION}`, 'success');
    }
  } catch (e) {
    toast('Не удалось проверить: ' + e.message, 'error');
  }
}

// Применяем версию при загрузке (после того как DOM создан)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(applyVersionToUI, 100);
});

// Также применим после загрузки секций
const _origLoadAllSections = window.loadAllSections;
if (typeof window.loadAllSections === 'function') {
  window.loadAllSections = async function() {
    await _origLoadAllSections();
    applyVersionToUI();
  };
}
