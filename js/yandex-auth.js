// ============================================================================
// YANDEX-AUTH module — Авторизация через Яндекс ID
// ============================================================================
//
// Использует Yandex OAuth 2.0 (implicit flow).
//
// Для работы нужно:
// 1. Зарегистрировать приложение на https://oauth.yandex.ru/client/new
// 2. Указать redirect URI: https://warbeet.github.io/dionis-vineyard/
// 3. Скопировать Client ID и вставить в Настройки → Авторизация

const YANDEX_OAUTH_CLIENT_ID_KEY = 'vineyard_yandex_client_id';
const YANDEX_OAUTH_TOKEN_KEY = 'vineyard_yandex_token';
const YANDEX_OAUTH_USER_KEY = 'vineyard_yandex_user';

function getYandexClientId() {
  return localStorage.getItem(YANDEX_OAUTH_CLIENT_ID_KEY) || '';
}

function getYandexRedirectUri() {
  // Для GitHub Pages важно не получить /index.html или случайный hash.
  // Канонический redirect: https://warbeet.github.io/dionis-vineyard/
  const origin = window.location.origin;
  let path = window.location.pathname || '/';
  if (path.endsWith('/index.html')) path = path.slice(0, -'index.html'.length);
  if (!path.endsWith('/')) path = path.replace(/[^/]*$/, '');
  return origin + path;
}

function saveYandexClientId(clientId) {
  if (clientId && clientId.trim()) {
    localStorage.setItem(YANDEX_OAUTH_CLIENT_ID_KEY, clientId.trim());
    toast('✅ Client ID Яндекса сохранён', 'success');
  } else {
    localStorage.removeItem(YANDEX_OAUTH_CLIENT_ID_KEY);
  }
}

// Запуск авторизации (перенаправляет на yandex.ru)
function signInYandex() {
  const clientId = getYandexClientId();
  if (!clientId) {
    if (confirm('Для входа через Яндекс нужно настроить Client ID.\n\nПерейти в Настройки → Авторизация?')) {
      // Закрыть auth-экран и открыть настройки
      const screen = document.getElementById('auth-screen');
      if (screen) screen.classList.add('hidden');
      useLocalMode();
      setTimeout(() => showTab('settings'), 300);
    }
    return;
  }

  const redirectUri = getYandexRedirectUri();
  const state = Math.random().toString(36).slice(2);
  localStorage.setItem('yandex_oauth_state', state);

  // Implicit flow — токен прилетает прямо в URL.
  // Важно: Яндекс ID здесь используется только как локальная идентификация.
  // Для облачной синхронизации и ролей нужен Firebase-вход (Email/Google).
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    force_confirm: 'yes'
  });
  const authUrl = `https://oauth.yandex.ru/authorize?${params.toString()}`;

  window.location.href = authUrl;
}

// Проверка возврата из OAuth (вызывается при загрузке страницы)
function checkYandexOAuthReturn() {
  // Yandex возвращает токен в hash: #access_token=...&token_type=...&state=...
  if (!window.location.hash || !window.location.hash.includes('access_token')) return false;

  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access_token');
  const state = params.get('state');
  const expiresIn = params.get('expires_in');

  if (!token) return false;

  // Проверка state
  const savedState = localStorage.getItem('yandex_oauth_state');
  if (state !== savedState) {
    console.warn('[Dionis] State mismatch in OAuth response');
  }
  localStorage.removeItem('yandex_oauth_state');

  // Сохраняем токен
  const tokenData = {
    access_token: token,
    expires_at: Date.now() + (parseInt(expiresIn) || 3600) * 1000
  };
  localStorage.setItem(YANDEX_OAUTH_TOKEN_KEY, JSON.stringify(tokenData));

  // Загружаем профиль
  fetchYandexProfile(token).then(user => {
    if (user) {
      localStorage.setItem(YANDEX_OAUTH_USER_KEY, JSON.stringify(user));
      toast(`✅ Добро пожаловать, ${user.display_name || user.real_name || user.login}!`, 'success');
      // Скрываем auth-экран и стартуем приложение в локальном режиме (но с Yandex user)
      onYandexUserLoaded(user);
    }
  });

  // Очищаем URL от токена, оставляя канонический путь приложения
  history.replaceState(null, '', getYandexRedirectUri());
  return true;
}

async function fetchYandexProfile(token) {
  try {
    const r = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { 'Authorization': `OAuth ${token}` }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    console.error('[Dionis] Yandex profile fetch failed:', e);
    toast('Не удалось загрузить профиль Яндекса', 'error');
    return null;
  }
}

function getYandexUser() {
  try {
    const raw = localStorage.getItem(YANDEX_OAUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function getYandexToken() {
  try {
    const raw = localStorage.getItem(YANDEX_OAUTH_TOKEN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.expires_at < Date.now()) {
      // Истёк
      signOutYandex();
      return null;
    }
    return data.access_token;
  } catch (e) { return null; }
}

function signOutYandex() {
  localStorage.removeItem(YANDEX_OAUTH_TOKEN_KEY);
  localStorage.removeItem(YANDEX_OAUTH_USER_KEY);
  toast('Вы вышли из Яндекс ID', 'info');
  setTimeout(() => location.reload(), 500);
}

function onYandexUserLoaded(user) {
  // Скрываем auth-экран
  const screen = document.getElementById('auth-screen');
  if (screen) screen.classList.add('hidden');

  // Аватар
  const avatar = document.getElementById('user-avatar');
  if (avatar) {
    if (user.default_avatar_id) {
      avatar.innerHTML = `<img src="https://avatars.yandex.net/get-yapic/${user.default_avatar_id}/islands-50" alt="${escapeHtml(user.display_name||'')}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      avatar.textContent = (user.display_name || user.login || '?')[0].toUpperCase();
    }
    avatar.title = user.display_name || user.real_name || user.login;
  }
  setSyncIndicator && setSyncIndicator('local');
  // Запускаем приложение
  if (typeof init === 'function') init();
}

// =========== РЕНДЕР НАСТРОЕК ===========
function renderYandexAuthSettings() {
  const cont = document.getElementById('yandex-auth-settings');
  if (!cont) return;
  const clientId = getYandexClientId();
  const user = getYandexUser();
  const token = getYandexToken();
  const isAuthed = !!(user && token);

  cont.innerHTML = `
    ${isAuthed ? `
      <div class="alert success" style="display:flex; align-items:center; gap:12px;">
        ${user.default_avatar_id ? `<img src="https://avatars.yandex.net/get-yapic/${user.default_avatar_id}/islands-50" style="width:42px;height:42px;border-radius:50%;">` : '<div style="width:42px;height:42px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">' + escapeHtml((user.display_name || user.login || '?')[0]) + '</div>'}
        <div style="flex:1;">
          <b>${escapeHtml(user.display_name || user.real_name || user.login)}</b><br>
          <small style="color:var(--text-soft);">${escapeHtml(user.default_email || user.login)}</small>
        </div>
        <button class="btn small danger" onclick="signOutYandex()">Выйти</button>
      </div>
    ` : ''}

    <div class="form-row">
      <label>🔑 Client ID приложения Яндекс</label>
      <input type="text" id="yandex-client-id-input" value="${escapeHtml(clientId)}" placeholder="например: abc123def456...">
      <p style="font-size:11px; color:var(--text-muted); margin-top:6px;">
        💡 Получить ключ:
        <ol style="margin:6px 0 0 16px; padding:0;">
          <li>Открой <a href="https://oauth.yandex.ru/client/new" target="_blank">oauth.yandex.ru/client/new</a></li>
          <li><b>Название:</b> Dionis vineyard</li>
          <li><b>Платформа:</b> ☑️ Веб-сервисы</li>
          <li><b>Redirect URI:</b> <code style="background:var(--bg);padding:2px 6px;border-radius:4px;">${escapeHtml(getYandexRedirectUri())}</code> <button class="btn small secondary" onclick="navigator.clipboard.writeText(getYandexRedirectUri()).then(()=>toast('📋 Скопировано', 'success'))">📋</button></li>
          <li><b>Какие данные:</b> ☑️ Доступ к логину, имени и фамилии + ☑️ Доступ к адресу электронной почты + ☑️ Доступ к портрету пользователя</li>
          <li>Создать → скопировать <b>Client ID</b> сюда</li>
        </ol>
      </p>
    </div>

    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn primary small" onclick="saveYandexClientId(document.getElementById('yandex-client-id-input').value); renderYandexAuthSettings()">💾 Сохранить Client ID</button>
      ${!isAuthed && clientId ? '<button class="btn accent small" onclick="signInYandex()">🟡 Войти через Яндекс</button>' : ''}
    </div>
  `;
}

// Проверка на старте — если вернулись из OAuth, обработать
if (typeof window !== 'undefined' && window.location && window.location.hash) {
  // Запускаем после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkYandexOAuthReturn);
  } else {
    setTimeout(checkYandexOAuthReturn, 100);
  }
}

// Если уже залогинены через Яндекс — пропускаем auth-экран
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const user = getYandexUser();
    const token = getYandexToken();
    if (user && token) {
      setTimeout(() => onYandexUserLoaded(user), 100);
    }
  });
}
