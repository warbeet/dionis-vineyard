// ============================================================================
// AUTH module
// ============================================================================

// ===========================================================================
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('auth-form-signin').style.display = tab === 'signin' ? 'block' : 'none';
    document.getElementById('auth-form-signup').style.display = tab === 'signup' ? 'block' : 'none';
  });
});

function useLocalMode() {
  document.getElementById('auth-screen').classList.add('hidden');
  setSyncIndicator('local');
  document.getElementById('user-avatar').textContent = '👤';
  init();
}

async function initFirebase() {
  const configRaw = localStorage.getItem(FIREBASE_CONFIG_KEY);
  try {
    const config = configRaw ? JSON.parse(configRaw) : DEFAULT_FIREBASE_CONFIG;
    if (!config || !config.projectId) return false;
    if (firebase.apps.length === 0) {
      firebaseApp = firebase.initializeApp(config);
    } else {
      firebaseApp = firebase.app();
    }
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    return true;
  } catch(e) {
    console.error('Firebase init error', e);
    return false;
  }
}

async function signIn() {
  if (!auth) {
    const ok = await initFirebase();
    if (!ok) { toast('Firebase не настроен. Обратитесь к администратору приложения', 'error'); return; }
  }
  try {
    const email = document.getElementById('signin-email').value;
    const pass = document.getElementById('signin-pass').value;
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) { toast('Ошибка входа: ' + e.message, 'error'); }
}

async function signUp() {
  if (!auth) {
    const ok = await initFirebase();
    if (!ok) { toast('Firebase не настроен. Обратитесь к администратору приложения', 'error'); return; }
  }
  try {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-pass').value;
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    if (name) await cred.user.updateProfile({ displayName: name });
  } catch(e) { toast('Ошибка регистрации: ' + e.message, 'error'); }
}

async function signInGoogle() {
  if (!auth) {
    const ok = await initFirebase();
    if (!ok) { toast('Firebase не настроен. Обратитесь к администратору приложения', 'error'); return; }
  }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch(e) { toast('Ошибка Google-входа: ' + e.message, 'error'); }
}

async function signOut() {
  if (auth && currentUser) {
    await auth.signOut();
    currentUser = null;
    unsubscribeListeners.forEach(u => u && u());
    unsubscribeListeners = [];
    location.reload();
  }
}

function onAuthChanged(user) {
  currentUser = user;
  if (user) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('user-avatar').textContent = (user.displayName || user.email || '?')[0].toUpperCase();
    setSyncIndicator('synced');
    loadUserVineyard();
  }
}

// ===========================================================================
// APPROVAL / ACCESS REQUESTS
// ===========================================================================

async function hasAnyVineyard() {
  if (!db) return true;
  const snap = await db.collection('vineyards').limit(1).get();
  return !snap.empty;
}

async function createFirstOwnerVineyard() {
  if (!db || !currentUser) throw new Error('Firebase не подключен');
  const uid = currentUser.uid;
  const email = (currentUser.email || '').toLowerCase();
  const name = currentUser.displayName || email.split('@')[0] || 'Владелец';
  const vineyardId = 'vyd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const code = 'VYD-' + vineyardId.slice(-4).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const member = { uid, email, name, role: 'owner', status: 'approved' };

  await db.collection('vineyards').doc(vineyardId).set({
    ownerId: uid,
    code,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    members: [member],
    bootstrapOwner: true
  });
  await db.collection('users').doc(uid).set({
    uid,
    email,
    name,
    vineyardId,
    role: 'owner',
    status: 'approved',
    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    bootstrapOwner: true
  }, { merge: true });
  await db.collection('accessRequests').doc(uid).set({
    uid,
    email,
    name,
    vineyardId,
    role: 'owner',
    status: 'approved',
    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    bootstrapOwner: true
  }, { merge: true });

  settings.vineyardCode = code;
  saveSettingsLocal();
  currentRole = 'owner';
  currentVineyardId = vineyardId;
  toast('👑 Первый виноградник создан. Вы назначены владельцем.', 'success');
  return vineyardId;
}

async function createOrRefreshAccessRequest() {
  if (!db || !currentUser) return;
  const uid = currentUser.uid;
  const email = (currentUser.email || '').toLowerCase();
  const name = currentUser.displayName || '';
  await db.collection('accessRequests').doc(uid).set({
    uid,
    email,
    name,
    status: 'pending',
    requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?'
  }, { merge: true });
  await db.collection('users').doc(uid).set({
    email,
    name,
    status: 'pending',
    role: null,
    vineyardId: null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function showPendingApproval(status = 'pending', profile = {}) {
  const screen = document.getElementById('auth-screen');
  if (!screen) return;
  const email = currentUser?.email || profile.email || '—';
  const isRejected = status === 'rejected' || status === 'blocked';
  screen.classList.remove('hidden');
  screen.style.display = 'flex';
  screen.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo"><img src="assets/logo-full-transparent.png" alt="Dionis vineyard"/></div>
      <h2 style="text-align:center;">${isRejected ? 'Доступ не активен' : 'Заявка ожидает одобрения'}</h2>
      <p class="sub" style="text-align:center;">
        ${isRejected
          ? 'Ваш аккаунт не имеет доступа к винограднику. Свяжитесь с владельцем.'
          : 'Вы зарегистрировались, но работа в системе начнётся только после одобрения владельцем и назначения роли.'}
      </p>
      <div class="alert ${isRejected ? 'danger' : 'warning'}" style="font-size:13px;">
        <b>Email:</b> ${escapeHtml(email)}<br>
        <b>Статус:</b> ${escapeHtml(status || 'pending')}
      </div>
      <button class="btn primary full" onclick="location.reload()">🔄 Проверить статус</button>
      <button class="btn secondary full" style="margin-top:8px;" onclick="signOut()">🚪 Выйти</button>
      <p style="font-size:11px; color:var(--text-muted); margin-top:14px; text-align:center;">
        Владелец увидит заявку в разделе «Команда → Заявки на доступ».
      </p>
    </div>
  `;
  setSyncIndicator('offline');
}

// ===========================================================================
// FIREBASE SYNC
// ===========================================================================
async function loadUserVineyard() {
  if (!db || !currentUser) return;
  try {
    // Найти профиль пользователя. Новые пользователи НЕ получают доступ автоматически:
    // сначала заявка → владелец одобряет → назначает роль.
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    let vineyardId;
    if (userDoc.exists && userDoc.data().vineyardId) {
      const u = userDoc.data();
      if (u.status && u.status !== 'approved') {
        await showPendingApproval(u.status, u);
        return;
      }
      vineyardId = u.vineyardId;
      currentRole = u.role || 'viewer';
    } else {
      // Bootstrap: если это первый пользователь в пустом Firebase — он становится владельцем.
      // Если виноградник уже есть — пользователь уходит в pending до одобрения владельцем.
      const exists = await hasAnyVineyard();
      if (!exists) {
        vineyardId = await createFirstOwnerVineyard();
      } else {
        await createOrRefreshAccessRequest();
        await showPendingApproval('pending');
        return;
      }
    }
    currentVineyardId = vineyardId;

    // Подписка на служебные данные виноградника (код, команда)
    const rootUnsub = db.collection('vineyards').doc(vineyardId).onSnapshot(snap => {
      if (snap.exists) {
        const remote = snap.data();
        if (remote.code) { settings.vineyardCode = remote.code; saveSettingsLocal(); }
        if (remote.members) { data.members = remote.members; if (typeof renderTeam === 'function') renderTeam(); }
      }
    });
    unsubscribeListeners.push(rootUnsub);

    // Надёжная синхронизация V2: данные хранятся в чанках, без лимита 1 МБ на весь виноградник.
    if (typeof syncV2InitialLoad === 'function') {
      await syncV2InitialLoad(vineyardId);
      const syncUnsub = subscribeSyncV2(vineyardId);
      if (syncUnsub) unsubscribeListeners.push(syncUnsub);
      syncV2Ready = true;
    } else {
      // Legacy fallback, если sync-v2.js не загрузился
      const legacyUnsub = db.collection('vineyards').doc(vineyardId).onSnapshot(snap => {
        if (snap.exists) {
          const remote = snap.data();
          if (remote.data) {
            Object.assign(data, remote.data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            renderAll();
          }
          setSyncIndicator('synced');
        }
      });
      unsubscribeListeners.push(legacyUnsub);
    }

    init();
  } catch(e) {
    console.error('Load vineyard error', e);
    toast('Ошибка загрузки данных: ' + e.message, 'error');
    init();
  }
}

let syncTimer;
async function syncToFirebase() {
  if (!db || !currentVineyardId) return;
  if (currentRole === 'viewer') return;
  if (typeof syncV2ApplyingRemote !== 'undefined' && syncV2ApplyingRemote) return;
  setSyncIndicator('syncing');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      if (typeof writeDataToChunks === 'function') {
        await writeDataToChunks(data);
      } else {
        // Legacy fallback: старый режим, оставлен только на случай сбоя загрузки sync-v2.js
        const payload = { ...data };
        await db.collection('vineyards').doc(currentVineyardId).update({
          data: payload,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setSyncIndicator('synced');
      }
    } catch(e) {
      console.error('Sync error', e);
      if (typeof markSyncDirty === 'function') markSyncDirty();
      setSyncIndicator('offline');
    }
  }, 1500);
}

function setSyncIndicator(state) {
  const el = document.getElementById('sync-indicator');
  el.className = 'sync-indicator ' + state;
  const labels = { synced: '✓ синхронизировано', syncing: '↻ синхронизация...', offline: '⚠ оффлайн', local: '💻 локально' };
  el.textContent = labels[state] || state;
}

// ===========================================================================
// FIREBASE CONFIG SAVE
// ===========================================================================
function toggleAuthFirebaseSetup() {
  const box = document.getElementById('auth-firebase-setup');
  if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
  const input = document.getElementById('auth-firebase-config');
  if (saved && input && !input.value) input.value = saved;
}

function parseFirebaseConfig(raw) {
  const cleaned = raw.trim().replace(/^const\s+\w+\s*=\s*/, '').replace(/;?\s*$/, '');
  return eval('(' + cleaned + ')');
}

async function saveFirebaseConfigFromAuth() {
  const raw = document.getElementById('auth-firebase-config')?.value.trim() || '';
  if (!raw) { toast('Введите конфиг Firebase', 'error'); return; }
  try {
    const config = parseFirebaseConfig(raw);
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    toast('✅ Firebase config сохранён. Перезагружаем...', 'success');
    setTimeout(() => location.reload(), 1000);
  } catch(e) { toast('Невалидный конфиг: ' + e.message, 'error'); }
}

async function saveFirebaseConfig() {
  const raw = document.getElementById('firebase-config')?.value.trim() || document.getElementById('auth-firebase-config')?.value.trim() || '';
  if (!raw) { toast('Введите конфиг Firebase', 'error'); return; }
  try {
    const config = parseFirebaseConfig(raw);
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    toast('✅ Конфиг сохранён. Перезагружаем...', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch(e) { toast('Невалидный конфиг: ' + e.message, 'error'); }
}

// ===========================================================================
