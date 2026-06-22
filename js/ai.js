// ============================================================================
// AI module
// ============================================================================

async function analyzePhotos(photos, note, plot, phaseId) {
  if (!settings.openrouterKey) {
    return { error: 'Не настроен OpenRouter ключ. Откройте «Настройки».' };
  }
  const phase = PHENO_STAGES.find(s => s.id === phaseId);
  const prompt = `Ты опытный агроном-винодел. Проанализируй фотографии виноградника и наблюдения винодела.

КОНТЕКСТ:
- Сорт: ${plot ? plot.variety : 'не указан'}
- Участок: ${plot ? plot.name : 'не указан'}
- Площадь: ${plot ? plot.area + ' га' : '—'}
- Текущая фенофаза: ${phase ? phase.name : 'не указана'}
- Дата отчёта: ${new Date().toLocaleDateString('ru-RU')}
- Наблюдения винодела: "${note || 'нет'}"

ЗАДАЧА:
1. Опиши, что ты видишь на фото (состояние листвы, гроздей, лозы)
2. Выяви признаки болезней (милдью, оидиум, серая гниль, хлороз и т.д.)
3. Оцени общее состояние (здорово / требует внимания / критично)
4. Дай 3-5 КОНКРЕТНЫХ рекомендаций (с препаратами, дозировками, сроками если применимо)

ОТВЕТЬ строго в формате JSON:
{
  "observation": "что видно на фото",
  "issues": [{"name": "название", "severity": "low|med|high", "evidence": "что указывает"}],
  "overall_status": "healthy|attention|critical",
  "recommendations": [{"priority": "high|med|low", "title": "...", "text": "...", "deadline": "когда сделать"}]
}`;

  const content = [{ type: 'text', text: prompt }];
  for (const p of photos.slice(0, 4)) { // не больше 4 фото для экономии
    content.push({ type: 'image_url', image_url: { url: p } });
  }

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + settings.openrouterKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin,
        'X-Title': 'Vineyard Manager'
      },
      body: JSON.stringify({
        model: settings.openrouterModel,
        messages: [{ role: 'user', content }],
        max_tokens: 1500,
        temperature: 0.3
      })
    });
    if (!r.ok) {
      const text = await r.text();
      return { error: `API error ${r.status}: ${text.slice(0, 200)}` };
    }
    const json = await r.json();
    const content_text = json.choices?.[0]?.message?.content || '';
    // Извлекаем JSON из ответа
    const jsonMatch = content_text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return { success: true, analysis: parsed, raw: content_text, model: settings.openrouterModel };
      } catch(e) {
        return { success: true, analysis: { observation: content_text }, raw: content_text, model: settings.openrouterModel };
      }
    }
    return { success: true, analysis: { observation: content_text }, raw: content_text, model: settings.openrouterModel };
  } catch(e) {
    return { error: 'Сеть: ' + e.message };
  }
}

async function savePhotoReportWithAI() {
  if (!requirePermission('photos.create', 'Нет прав на добавление фотоотчётов')) return;
  if (!settings.openrouterKey) {
    toast('Сначала настройте OpenRouter API в «Настройках»', 'error');
    showTab('settings');
    return;
  }
  const date = document.getElementById('photo-date').value;
  const plotId = document.getElementById('photo-plot').value;
  const note = document.getElementById('photo-note').value.trim();
  if (!date || !plotId) { toast('Укажите дату и участок', 'error'); return; }
  if (!pendingPhotos.length) { toast('Добавьте фото для AI-анализа', 'error'); return; }

  const btn = document.getElementById('ai-analyze-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> AI анализирует...';

  const plot = data.plots.find(p => p.id === plotId);
  const result = await analyzePhotos(pendingPhotos, note, plot, data.currentPheno);

  btn.disabled = false;
  btn.innerHTML = '🤖 Сохранить + AI-анализ';

  const report = {
    id: 'r_' + Date.now(),
    date, plotId, note,
    photos: [...pendingPhotos],
    aiAnalysis: result.success ? result.analysis : null,
    aiModel: result.model,
    aiError: result.error || null,
    createdAt: new Date().toISOString()
  };
  data.photoReports.unshift(report);

  // Если AI выдал рекомендации — добавим в общий список
  if (result.success && result.analysis.recommendations) {
    result.analysis.recommendations.forEach(r => {
      data.recommendations.unshift({
        priority: r.priority || 'med',
        title: '🤖 ' + (r.title || 'AI-рекомендация'),
        text: r.text + (r.deadline ? ` (срок: ${r.deadline})` : ''),
        source: 'AI: ' + (result.model || 'OpenRouter'),
        date: new Date().toISOString().slice(0, 10)
      });
    });
    // Ограничим список 30
    data.recommendations = data.recommendations.slice(0, 30);
  }

  saveData();
  pendingPhotos = [];
  document.getElementById('photo-files').value = '';
  document.getElementById('photo-note').value = '';
  renderPhotoPreview();
  renderAll();

  if (result.error) {
    toast('Сохранено, но AI-анализ не удался: ' + result.error, 'error');
  } else {
    toast('✅ Отчёт сохранён, AI-рекомендации добавлены', 'success');
  }
}

async function analyzeReportFromModal() {
  const reportId = document.getElementById('photo-modal').dataset.reportId;
  const report = data.photoReports.find(r => r.id === reportId);
  if (!report) return;
  if (!settings.openrouterKey) { toast('Настройте OpenRouter API', 'error'); showTab('settings'); return; }

  const btn = document.getElementById('modal-ai-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Анализ...';

  const plot = data.plots.find(p => p.id === report.plotId);
  const result = await analyzePhotos(report.photos, report.note, plot, data.currentPheno);

  btn.disabled = false; btn.innerHTML = '🤖 AI-анализ';

  if (result.success) {
    report.aiAnalysis = result.analysis;
    report.aiModel = result.model;
    report.aiError = null;
    if (result.analysis.recommendations) {
      result.analysis.recommendations.forEach(r => {
        data.recommendations.unshift({
          priority: r.priority || 'med',
          title: '🤖 ' + (r.title || 'AI-рекомендация'),
          text: r.text + (r.deadline ? ` (срок: ${r.deadline})` : ''),
          source: 'AI: ' + result.model,
          date: new Date().toISOString().slice(0, 10)
        });
      });
      data.recommendations = data.recommendations.slice(0, 30);
    }
    saveData();
    viewPhotoReport(reportId);
    renderRecommendations();
    toast('✅ Анализ завершён', 'success');
  } else {
    toast('Ошибка: ' + result.error, 'error');
  }
}

async function runAIAnalysisForAll() {
  if (!settings.openrouterKey) { toast('Настройте OpenRouter API', 'error'); showTab('settings'); return; }
  const unanalyzed = data.photoReports.filter(r => !r.aiAnalysis);
  if (!unanalyzed.length) { toast('Все отчёты уже проанализированы', 'success'); return; }
  if (!confirm(`Проанализировать ${unanalyzed.length} отчёт(ов)? Это потратит токены API.`)) return;

  const btn = document.getElementById('ai-all-btn');
  btn.disabled = true;
  for (let i = 0; i < unanalyzed.length; i++) {
    const r = unanalyzed[i];
    btn.innerHTML = `<span class="spinner"></span> ${i+1}/${unanalyzed.length}`;
    const plot = data.plots.find(p => p.id === r.plotId);
    const result = await analyzePhotos(r.photos, r.note, plot, data.currentPheno);
    if (result.success) {
      r.aiAnalysis = result.analysis;
      r.aiModel = result.model;
      if (result.analysis.recommendations) {
        result.analysis.recommendations.forEach(rec => {
          data.recommendations.unshift({
            priority: rec.priority || 'med',
            title: '🤖 ' + (rec.title || 'AI'),
            text: rec.text + (rec.deadline ? ` (${rec.deadline})` : ''),
            source: 'AI: ' + result.model + ` (отчёт ${r.date})`,
            date: r.date
          });
        });
      }
    }
    await new Promise(res => setTimeout(res, 500)); // rate limit
  }
  data.recommendations = data.recommendations.slice(0, 50);
  saveData();
  btn.disabled = false; btn.innerHTML = '🤖 AI-анализ всех фото';
  renderAll();
  toast('✅ Все отчёты проанализированы', 'success');
}

// ===========================================================================
