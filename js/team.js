// ============================================================================
// TEAM module — роли, приглашения, заявки на доступ
// ============================================================================

const ROLE_LABELS = {
  owner: '👑 Владелец',
  agronomist: '🧑‍🌾 Агроном',
  worker: '👷 Рабочий',
  viewer: '👁 Наблюдатель'
};

const ROLE_DESCRIPTIONS = {
  owner: 'Полный доступ: настройки, команда, данные, удаления',
  agronomist: 'Агрономия, рекомендации, обработки, участки, отчёты',
  worker: 'Задачи, фотоотчёты, журнал выполненных работ',
  viewer: 'Только просмотр без изменения данных'
};

function roleOptions(selected = 'worker') {
  return Object.entries(ROLE_LABELS).map(([id, label]) =>
    `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`
  ).join('');
}

async function inviteMember() {
  if (!db || !currentVineyardId) {
    toast('Доступно только в Firebase-режиме', 'error'); return;
  }
  if (currentRole !== 'owner') { toast('Только владелец может приглашать', 'error'); return; }
  const email = document.getElementById('invite-email').value.trim();
  const role = document.getElementById('invite-role').value;
  if (!email) { toast('Введите email', 'error'); return; }
  try {
    await db.collection('invitations').add({
      vineyardId: currentVineyardId,
      vineyardCode: settings.vineyardCode,
      inviterEmail: currentUser.email,
      email: email.toLowerCase(),
      role: role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });
    toast('✅ Приглашение создано. Передайте код: ' + settings.vineyardCode, 'success');
    document.getElementById('invite-email').value = '';
  } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
}

async function joinVineyard() {
  if (!db || !currentUser) { toast('Доступно только в Firebase-режиме', 'error'); return; }
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!code) { toast('Введите код', 'error'); return; }
  try {
    const snap = await db.collection('vineyards').where('code', '==', code).limit(1).get();
    if (snap.empty) { toast('Виноградник не найден', 'error'); return; }
    const doc = snap.docs[0];
    const vyd = doc.data();
    const invSnap = await db.collection('invitations')
      .where('vineyardCode', '==', code)
      .where('email', '==', currentUser.email.toLowerCase())
      .where('status', '==', 'pending')
      .limit(1).get();
    if (invSnap.empty) { toast('Для вашего email нет активного приглашения', 'error'); return; }
    const inv = invSnap.docs[0];
    const role = inv.data().role || 'viewer';
    const newMember = { uid: currentUser.uid, email: currentUser.email, name: currentUser.displayName || '', role, status: 'approved' };
    const members = [...(vyd.members || []).filter(m => m.uid !== currentUser.uid), newMember];
    await db.collection('vineyards').doc(doc.id).update({ members });
    await db.collection('users').doc(currentUser.uid).set({
      email: currentUser.email,
      name: currentUser.displayName || '',
      vineyardId: doc.id,
      role,
      status: 'approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy: currentUser.uid
    }, { merge: true });
    await db.collection('accessRequests').doc(currentUser.uid).set({ status: 'approved', vineyardId: doc.id, role }, { merge: true });
    await db.collection('invitations').doc(inv.id).update({ status: 'accepted' });
    toast('✅ Подключено! Перезагружаем...', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
}

function copyVineyardCode() {
  if (!settings.vineyardCode) { toast('Код доступен только в Firebase-режиме', 'error'); return; }
  navigator.clipboard.writeText(settings.vineyardCode);
  toast('📋 Код скопирован', 'success');
}

async function approveAccessRequest(uid) {
  if (!db || !currentVineyardId || currentRole !== 'owner') { toast('Только владелец может одобрять заявки', 'error'); return; }
  const role = document.getElementById('approval-role-' + uid)?.value || 'viewer';
  try {
    const reqSnap = await db.collection('accessRequests').doc(uid).get();
    if (!reqSnap.exists) { toast('Заявка не найдена', 'error'); return; }
    const req = reqSnap.data();
    const member = { uid, email: req.email || '', name: req.name || '', role, status: 'approved' };

    const vineyardRef = db.collection('vineyards').doc(currentVineyardId);
    const vineyardSnap = await vineyardRef.get();
    const members = (vineyardSnap.data().members || []).filter(m => m.uid !== uid);
    members.push(member);

    await vineyardRef.update({
      members,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('users').doc(uid).set({
      uid,
      email: req.email || '',
      name: req.name || '',
      vineyardId: currentVineyardId,
      role,
      status: 'approved',
      approvedBy: currentUser.uid,
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection('accessRequests').doc(uid).set({
      status: 'approved',
      vineyardId: currentVineyardId,
      role,
      approvedBy: currentUser.uid,
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    toast(`✅ Пользователь одобрен: ${ROLE_LABELS[role]}`, 'success');
    renderTeam();
  } catch(e) { toast('Ошибка одобрения: ' + e.message, 'error'); }
}

async function rejectAccessRequest(uid) {
  if (!db || currentRole !== 'owner') { toast('Только владелец может отклонять заявки', 'error'); return; }
  if (!confirm('Отклонить заявку пользователя?')) return;
  try {
    await db.collection('accessRequests').doc(uid).set({
      status: 'rejected',
      rejectedBy: currentUser.uid,
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection('users').doc(uid).set({ status: 'rejected' }, { merge: true });
    toast('Заявка отклонена', 'success');
    renderTeam();
  } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
}

async function changeMemberRole(uid) {
  if (!db || !currentVineyardId || currentRole !== 'owner') { toast('Только владелец может менять роли', 'error'); return; }
  const role = document.getElementById('member-role-' + uid)?.value;
  if (!role) return;
  try {
    const vineyardRef = db.collection('vineyards').doc(currentVineyardId);
    const snap = await vineyardRef.get();
    const members = (snap.data().members || []).map(m => m.uid === uid ? { ...m, role } : m);
    await vineyardRef.update({ members, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('users').doc(uid).set({ role, status: 'approved' }, { merge: true });
    toast('✅ Роль обновлена', 'success');
    renderTeam();
  } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
}

async function removeMember(uid) {
  if (!db || !currentVineyardId || currentRole !== 'owner') { toast('Только владелец может удалять участников', 'error'); return; }
  if (uid === currentUser.uid) { toast('Нельзя удалить самого себя', 'error'); return; }
  if (!confirm('Удалить участника из виноградника?')) return;
  try {
    const vineyardRef = db.collection('vineyards').doc(currentVineyardId);
    const snap = await vineyardRef.get();
    const members = (snap.data().members || []).filter(m => m.uid !== uid);
    await vineyardRef.update({ members, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('users').doc(uid).set({ vineyardId: null, role: null, status: 'removed' }, { merge: true });
    await db.collection('accessRequests').doc(uid).set({ status: 'removed' }, { merge: true });
    toast('Участник удалён', 'success');
    renderTeam();
  } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
}

async function renderPendingApprovals() {
  const cont = document.getElementById('pending-approvals');
  if (!cont) return;
  if (!db || !currentUser || currentRole !== 'owner') {
    cont.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Заявки доступны только владельцу в Firebase-режиме.</p>';
    return;
  }
  try {
    const snap = await db.collection('accessRequests').where('status', '==', 'pending').limit(50).get();
    if (snap.empty) {
      cont.innerHTML = '<div class="empty" style="padding:24px;">Новых заявок нет</div>';
      return;
    }
    cont.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Пользователь</th><th>Email</th><th>Роль</th><th></th></tr></thead>
        <tbody>
          ${snap.docs.map(d => {
            const r = d.data();
            return `<tr>
              <td>${escapeHtml(r.name || '—')}</td>
              <td>${escapeHtml(r.email || '—')}</td>
              <td><select id="approval-role-${d.id}" style="min-width:160px;">${roleOptions('worker')}</select></td>
              <td style="white-space:nowrap;">
                <button class="btn small primary" onclick="approveAccessRequest('${d.id}')">✅ Одобрить</button>
                <button class="btn small danger" onclick="rejectAccessRequest('${d.id}')">✕</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    `;
  } catch(e) {
    cont.innerHTML = `<div class="alert danger">Ошибка загрузки заявок: ${escapeHtml(e.message)}</div>`;
  }
}

function renderTeam() {
  const list = document.getElementById('team-list');
  const codeEl = document.getElementById('vineyard-code');
  if (codeEl) codeEl.textContent = settings.vineyardCode || 'Доступно только в Firebase-режиме';
  if (!list) return;

  if (!data.members || !data.members.length) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Пока только вы. Войдите в Firebase-режим для приглашения других.</p>';
  } else {
    list.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Описание</th><th></th></tr></thead>
        <tbody>
          ${data.members.map(m => `<tr>
            <td>${escapeHtml(m.name || '—')}</td>
            <td>${escapeHtml(m.email || '—')}</td>
            <td>
              ${currentRole === 'owner' && m.uid !== currentUser?.uid ? `
                <select id="member-role-${m.uid}" onchange="changeMemberRole('${m.uid}')">${roleOptions(m.role)}</select>
              ` : `<span class="badge purple">${ROLE_LABELS[m.role] || m.role}</span>`}
            </td>
            <td style="font-size:12px; color:var(--text-soft);">${escapeHtml(ROLE_DESCRIPTIONS[m.role] || '')}</td>
            <td>${currentRole === 'owner' && m.uid !== currentUser?.uid ? `<button class="btn small danger" onclick="removeMember('${m.uid}')">Удалить</button>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    `;
  }
  renderPendingApprovals();
}

// ===========================================================================
