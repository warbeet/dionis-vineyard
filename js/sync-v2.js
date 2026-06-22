// ============================================================================
// SYNC V2 — Надёжное облачное хранение данных (Firestore chunked backup)
// ============================================================================
// Зачем: старый режим писал весь data в vineyards/{id}.data и упирался в лимит
// Firestore 1 МБ на документ. V2 хранит JSON базы в чанках по ~650 КБ:
// vineyards/{id}/sync/main        — метаданные, revision, chunkCount
// vineyards/{id}/sync_chunks/0000 — кусок JSON
// vineyards/{id}/sync_chunks/0001 — кусок JSON
// ...
//
// Это не финальная per-entity БД для робота, но уже безопаснее для реального
// использования: работает с большими реестрами саженцев и синхронизирует
// несколько устройств через один виноградник.
// ============================================================================

const SYNC_V2_META_DOC = 'main';
const SYNC_V2_CHUNK_SIZE = 650 * 1024; // запас до лимита Firestore 1 МБ
const SYNC_V2_DEVICE_KEY = 'dionis_device_id';
const SYNC_V2_DIRTY_KEY = 'dionis_sync_dirty';
const SYNC_V2_LAST_OK_KEY = 'dionis_sync_last_ok';
const SYNC_V2_LAST_REV_KEY = 'dionis_sync_last_revision';

let syncV2Ready = false;
let syncV2ApplyingRemote = false;
let syncV2LastRemoteRevision = null;
let syncV2LastLocalRevision = localStorage.getItem(SYNC_V2_LAST_REV_KEY) || null;
let syncV2MetaUnsub = null;

function getDeviceId() {
  let id = localStorage.getItem(SYNC_V2_DEVICE_KEY);
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(SYNC_V2_DEVICE_KEY, id);
  }
  return id;
}

function syncMetaRef(vineyardId = currentVineyardId) {
  return db.collection('vineyards').doc(vineyardId).collection('sync').doc(SYNC_V2_META_DOC);
}

function syncChunksRef(vineyardId = currentVineyardId) {
  return db.collection('vineyards').doc(vineyardId).collection('sync_chunks');
}

function encodeDataForSync(obj) {
  return JSON.stringify(obj || defaultData());
}

function splitChunks(str, size = SYNC_V2_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
  return chunks.length ? chunks : ['{}'];
}

function bytesToHuman(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  return `${n.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

function getLocalDataStats() {
  const json = encodeDataForSync(data);
  const bytes = new Blob([json]).size;
  const counts = {
    plots: data.plots?.length || 0,
    seedlings: data.seedlings?.length || 0,
    photos: data.photoReports?.length || 0,
    journal: data.journal?.length || 0,
    treatments: data.treatments?.length || 0,
    sprayPlans: data.spray_plans?.length || 0,
    products: data.products_catalog?.length || 0,
    tasks: data.tasks?.length || 0,
    harvest: data.harvest?.length || 0
  };
  return { bytes, human: bytesToHuman(bytes), counts, chunks: splitChunks(json).length };
}

function markSyncDirty() {
  localStorage.setItem(SYNC_V2_DIRTY_KEY, '1');
  updateStorageHealthUI();
}

function clearSyncDirty() {
  localStorage.removeItem(SYNC_V2_DIRTY_KEY);
  updateStorageHealthUI();
}

function isSyncDirty() {
  return localStorage.getItem(SYNC_V2_DIRTY_KEY) === '1';
}

function isDataEmptyLike(d) {
  if (!d) return true;
  const keys = ['plots','seedlings','photoReports','journal','weather','diseases','treatments','tasks','harvest','costs','spray_plans'];
  return keys.every(k => !Array.isArray(d[k]) || d[k].length === 0);
}

async function loadDataFromChunks(vineyardId = currentVineyardId, meta = null) {
  if (!db || !vineyardId) throw new Error('Firebase не подключен');
  const m = meta || (await syncMetaRef(vineyardId).get()).data();
  if (!m || !m.chunkCount) return null;

  const docs = [];
  for (let i = 0; i < m.chunkCount; i++) {
    const id = String(i).padStart(4, '0');
    docs.push(syncChunksRef(vineyardId).doc(id).get());
  }
  const snaps = await Promise.all(docs);
  const json = snaps.map((s, idx) => {
    if (!s.exists) throw new Error(`Не найден chunk #${idx}`);
    return s.data().content || '';
  }).join('');
  const parsed = JSON.parse(json);
  return parsed;
}

async function writeDataToChunks(payload = data, options = {}) {
  if (!db || !currentVineyardId) return;
  if (currentRole === 'viewer') return;
  if (syncV2ApplyingRemote && !options.force) return;

  const json = encodeDataForSync(payload);
  const chunks = splitChunks(json);
  const stats = getLocalDataStats();
  const deviceId = getDeviceId();
  const revision = `${Date.now()}_${deviceId}`;

  const prevMetaSnap = await syncMetaRef().get().catch(() => null);
  const prevCount = prevMetaSnap?.exists ? (prevMetaSnap.data().chunkCount || 0) : 0;
  const maxCount = Math.max(prevCount, chunks.length);

  let batch = db.batch();
  let ops = 0;
  const commitIfNeeded = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };

  for (let i = 0; i < chunks.length; i++) {
    const id = String(i).padStart(4, '0');
    batch.set(syncChunksRef().doc(id), {
      index: i,
      content: chunks[i],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    ops++;
    if (ops >= 450) await commitIfNeeded();
  }

  // Удаляем старые лишние чанки, если новая база стала меньше
  for (let i = chunks.length; i < maxCount; i++) {
    const id = String(i).padStart(4, '0');
    batch.delete(syncChunksRef().doc(id));
    ops++;
    if (ops >= 450) await commitIfNeeded();
  }

  batch.set(syncMetaRef(), {
    schema: 'chunked-json-v2',
    revision,
    deviceId,
    chunkCount: chunks.length,
    bytes: new Blob([json]).size,
    appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAtClient: new Date().toISOString()
  }, { merge: true });
  ops++;
  await commitIfNeeded();

  // Оставляем лёгкую служебную копию на root doc для совместимости и списка команды
  await db.collection('vineyards').doc(currentVineyardId).set({
    syncVersion: 2,
    syncRevision: revision,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  syncV2LastLocalRevision = revision;
  syncV2LastRemoteRevision = revision;
  localStorage.setItem(SYNC_V2_LAST_REV_KEY, revision);
  localStorage.setItem(SYNC_V2_LAST_OK_KEY, new Date().toISOString());
  clearSyncDirty();
  setSyncIndicator('synced');
  updateStorageHealthUI();
  return { revision, chunkCount: chunks.length, bytes: stats.bytes };
}

async function syncV2InitialLoad(vineyardId = currentVineyardId) {
  if (!db || !vineyardId) return false;
  setSyncIndicator('syncing');
  try {
    const metaSnap = await syncMetaRef(vineyardId).get();
    if (metaSnap.exists && metaSnap.data().chunkCount) {
      const remote = await loadDataFromChunks(vineyardId, metaSnap.data());
      if (remote) {
        syncV2ApplyingRemote = true;
        data = Object.assign(defaultData(), remote);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        syncV2ApplyingRemote = false;
        syncV2LastRemoteRevision = metaSnap.data().revision || null;
        localStorage.setItem(SYNC_V2_LAST_REV_KEY, syncV2LastRemoteRevision || '');
        setSyncIndicator('synced');
        return true;
      }
    }

    // Миграция со старой схемы: vineyards/{id}.data
    const rootSnap = await db.collection('vineyards').doc(vineyardId).get();
    const root = rootSnap.exists ? rootSnap.data() : null;
    if (root?.data && !isDataEmptyLike(root.data)) {
      syncV2ApplyingRemote = true;
      data = Object.assign(defaultData(), root.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      syncV2ApplyingRemote = false;
      await writeDataToChunks(data, { force: true });
      return true;
    }

    // Если облако пустое, но локально уже есть данные — поднимаем их в облако
    if (!isDataEmptyLike(data)) {
      await writeDataToChunks(data, { force: true });
      return true;
    }

    setSyncIndicator('synced');
    return true;
  } catch(e) {
    console.error('[SyncV2] initial load error', e);
    setSyncIndicator('offline');
    toast('Ошибка облачной загрузки: ' + e.message, 'error');
    return false;
  }
}

function subscribeSyncV2(vineyardId = currentVineyardId) {
  if (!db || !vineyardId) return null;
  if (syncV2MetaUnsub) syncV2MetaUnsub();
  syncV2MetaUnsub = syncMetaRef(vineyardId).onSnapshot(async snap => {
    if (!snap.exists) return;
    const meta = snap.data();
    if (!meta?.revision) return;
    if (meta.revision === syncV2LastLocalRevision) return;
    if (meta.revision === syncV2LastRemoteRevision) return;
    if (meta.deviceId === getDeviceId()) return;

    try {
      setSyncIndicator('syncing');
      const remote = await loadDataFromChunks(vineyardId, meta);
      if (!remote) return;
      syncV2ApplyingRemote = true;
      data = Object.assign(defaultData(), remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      syncV2ApplyingRemote = false;
      syncV2LastRemoteRevision = meta.revision;
      localStorage.setItem(SYNC_V2_LAST_REV_KEY, meta.revision);
      localStorage.setItem(SYNC_V2_LAST_OK_KEY, new Date().toISOString());
      clearSyncDirty();
      renderAll();
      setSyncIndicator('synced');
      toast('☁️ Данные обновлены из облака', 'success');
    } catch(e) {
      syncV2ApplyingRemote = false;
      console.error('[SyncV2] remote apply error', e);
      setSyncIndicator('offline');
      toast('Ошибка применения облачных данных: ' + e.message, 'error');
    }
  }, err => {
    console.error('[SyncV2] subscribe error', err);
    setSyncIndicator('offline');
  });
  return syncV2MetaUnsub;
}

async function manualCloudBackup() {
  if (!db || !currentVineyardId) { toast('Сначала подключите Firebase и войдите в аккаунт', 'error'); return; }
  try {
    setSyncIndicator('syncing');
    const res = await writeDataToChunks(data, { force: true });
    toast(`✅ Облачная копия сохранена: ${bytesToHuman(res.bytes)}, чанков: ${res.chunkCount}`, 'success');
  } catch(e) {
    console.error(e);
    setSyncIndicator('offline');
    toast('Ошибка облачного бэкапа: ' + e.message, 'error');
  }
}

async function manualCloudRestore() {
  if (!db || !currentVineyardId) { toast('Сначала подключите Firebase и войдите в аккаунт', 'error'); return; }
  if (!confirm('Загрузить данные из облака и заменить локальные? Перед этим рекомендуется скачать JSON-бэкап.')) return;
  try {
    const remote = await loadDataFromChunks(currentVineyardId);
    if (!remote) { toast('В облаке пока нет данных', 'error'); return; }
    data = Object.assign(defaultData(), remote);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    clearSyncDirty();
    renderAll();
    toast('✅ Данные восстановлены из облака', 'success');
  } catch(e) {
    toast('Ошибка восстановления: ' + e.message, 'error');
  }
}

function downloadTimestampedBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), appVersion: APP_VERSION, data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dionis-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('⬇ Резервная копия скачана', 'success');
}

function renderStorageHealth() {
  const stats = getLocalDataStats();
  const lastOk = localStorage.getItem(SYNC_V2_LAST_OK_KEY);
  const mode = currentUser && db && currentVineyardId ? 'cloud' : 'local';
  const dirty = isSyncDirty();
  const counts = stats.counts;
  const canCloud = mode === 'cloud';
  const statusBadge = canCloud
    ? (dirty ? '<span class="badge yellow">↻ есть несинхронизированные изменения</span>' : '<span class="badge green">☁️ облако подключено</span>')
    : '<span class="badge yellow">💻 только это устройство</span>';

  return `
    <div class="storage-health">
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        ${statusBadge}
        <span class="badge gray">Размер: ${stats.human}</span>
        <span class="badge gray">Чанков: ${stats.chunks}</span>
        ${lastOk ? `<span class="badge green">Последняя синхр.: ${new Date(lastOk).toLocaleString('ru-RU')}</span>` : ''}
      </div>
      <div class="grid grid-4" style="margin-bottom:14px;">
        <div class="mini-stat"><b>${counts.plots}</b><span>участков</span></div>
        <div class="mini-stat"><b>${counts.seedlings}</b><span>саженцев</span></div>
        <div class="mini-stat"><b>${counts.photos}</b><span>фотоотчётов</span></div>
        <div class="mini-stat"><b>${counts.sprayPlans}</b><span>планов обработки</span></div>
      </div>
      ${!canCloud ? `
        <div class="alert warning" style="font-size:13px;">
          ⚠️ Сейчас данные хранятся только в браузере этого устройства. Для синхронизации телефона/ноутбука подключите Firebase и войдите в аккаунт.
        </div>
      ` : `
        <div class="alert success" style="font-size:13px;">
          ☁️ Данные сохраняются локально и в Firebase. При открытии на другом устройстве войдите в тот же виноградник.
        </div>
      `}
      <div class="toolbar" style="margin-top:12px;">
        <button class="btn secondary" onclick="downloadTimestampedBackup()">⬇ Скачать JSON-бэкап</button>
        <button class="btn secondary" onclick="document.getElementById('import-file2').click()">⬆ Импорт JSON</button>
        ${canCloud ? `
          <button class="btn primary" onclick="manualCloudBackup()">☁️ Сохранить в облако сейчас</button>
          <button class="btn secondary" onclick="manualCloudRestore()">↙ Восстановить из облака</button>
        ` : ''}
      </div>
    </div>
  `;
}

function updateStorageHealthUI() {
  const el = document.getElementById('storage-health-panel');
  if (el) el.innerHTML = renderStorageHealth();
}

// Обновим грязные данные при возврате сети
window.addEventListener('online', () => {
  if (isSyncDirty() && db && currentVineyardId && typeof syncToFirebase === 'function') syncToFirebase();
});

// ============================================================================
