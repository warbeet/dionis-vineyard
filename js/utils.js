// ============================================================================
// UTILS module
// ============================================================================

// HELPERS
// ===========================================================================
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysSince(d) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }
function formatDateShort(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function refreshPlotSelectors() {
  const opts = data.plots.length
    ? data.plots.map(p => `<option value="${p.id}">${escapeHtml(p.name)} — ${escapeHtml(p.variety)}</option>`).join('')
    : '<option value="">— нет участков —</option>';
  ['photo-plot','j-plot','dis-plot','tr-plot','t-plot','h-plot','rep-plot'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = opts;
      if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
    }
  });
}

// ===========================================================================
// EXPORT/IMPORT
