// ============================================================================
// TEAM module
// ============================================================================

// TEAM
// ===========================================================================
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
    // Проверим приглашение
    const invSnap = await db.collection('invitations')
      .where('vineyardCode', '==', code)
      .where('email', '==', currentUser.email.toLowerCase())
      .where('status', '==', 'pending')
      .limit(1).get();
    if (invSnap.empty) { toast('Для вашего email нет активного приглашения', 'error'); return; }
    const inv = invSnap.docs[0];
    const newMember = { uid: currentUser.uid, email: currentUser.email, name: currentUser.displayName || '', role: inv.data().role };
    const members = [...(vyd.members || []), newMember];
    await db.collection('vineyards').doc(doc.id).update({ members });
    await db.collection('users').doc(currentUser.uid).set({
      email: currentUser.email,
      name: currentUser.displayName || '',
      vineyardId: doc.id,
      role: inv.data().role
    });
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

function renderTeam() {
  const list = document.getElementById('team-list');
  document.getElementById('vineyard-code').textContent = settings.vineyardCode || 'Доступно только в Firebase-режиме';
  if (!data.members || !data.members.length) {
    list.innerHTML = '<p style="color:#8a7a6a; font-size:13px;">Пока только вы.</p>';
    return;
  }
  const roleLabels = { owner: '👑 Владелец', agronomist: '🧑‍🌾 Агроном', worker: '👷 Рабочий', viewer: '👁 Наблюдатель' };
  list.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Имя</th><th>Email</th><th>Роль</th></tr></thead>
      <tbody>
        ${data.members.map(m => `<tr>
          <td>${escapeHtml(m.name || '—')}</td>
          <td>${escapeHtml(m.email)}</td>
          <td><span class="badge purple">${roleLabels[m.role] || m.role}</span></td>
        </tr>`).join('')}
      </tbody>
    </table></div>
  `;
}

// ===========================================================================
// API KEYS
// ===========================================================================
