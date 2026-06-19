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
  if (!configRaw) return false;
  try {
    const config = JSON.parse(configRaw);
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
    if (!ok) { toast('Сначала настройте Firebase в режиме «без аккаунта» → Настройки', 'error'); return; }
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
    if (!ok) { toast('Сначала настройте Firebase в режиме «без аккаунта» → Настройки', 'error'); return; }
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
    if (!ok) { toast('Сначала настройте Firebase', 'error'); return; }
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
// FIREBASE SYNC
// ===========================================================================
async function loadUserVineyard() {
  if (!db || !currentUser) return;
  try {
    // Найти виноградник пользователя (где он owner или member)
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    let vineyardId;
    if (userDoc.exists && userDoc.data().vineyardId) {
      vineyardId = userDoc.data().vineyardId;
      currentRole = userDoc.data().role || 'owner';
    } else {
      // Создаём новый виноградник
      vineyardId = 'vyd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const code = 'VYD-' + vineyardId.slice(-4).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      await db.collection('vineyards').doc(vineyardId).set({
        ownerId: currentUser.uid,
        code: code,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        members: [{ uid: currentUser.uid, email: currentUser.email, name: currentUser.displayName || '', role: 'owner' }]
      });
      await db.collection('users').doc(currentUser.uid).set({
        email: currentUser.email,
        name: currentUser.displayName || '',
        vineyardId: vineyardId,
        role: 'owner'
      });
      settings.vineyardCode = code;
      saveSettingsLocal();
    }
    currentVineyardId = vineyardId;

    // Подписка на данные виноградника
    const unsub = db.collection('vineyards').doc(vineyardId).onSnapshot(snap => {
      if (snap.exists) {
        const remote = snap.data();
        if (remote.code) { settings.vineyardCode = remote.code; saveSettingsLocal(); }
        if (remote.members) data.members = remote.members;
        if (remote.data) {
          // Применяем удалённые данные (приоритет remote)
          Object.assign(data, remote.data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          renderAll();
        }
        setSyncIndicator('synced');
      }
    });
    unsubscribeListeners.push(unsub);

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
  setSyncIndicator('syncing');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      // Уберём фото из payload (большие base64) — они должны идти в Storage
      const payload = { ...data };
      // Для простоты — оставляем base64 в Firestore (лимит 1 МБ на документ — фото уже сжаты)
      await db.collection('vineyards').doc(currentVineyardId).update({
        data: payload,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      setSyncIndicator('synced');
    } catch(e) {
      console.error('Sync error', e);
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
async function saveFirebaseConfig() {
  const raw = document.getElementById('firebase-config').value.trim();
  if (!raw) { toast('Введите конфиг Firebase', 'error'); return; }
  try {
    // Очистим JS-объект от обёрток
    const cleaned = raw.replace(/^const\s+\w+\s*=\s*/, '').replace(/;?\s*$/, '');
    const config = typeof cleaned === 'string' ? eval('(' + cleaned + ')') : cleaned;
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    toast('✅ Конфиг сохранён. Перезагружаем...', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch(e) { toast('Невалидный конфиг: ' + e.message, 'error'); }
}

// ===========================================================================
