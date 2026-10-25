// ============================================================================
// CALCULATOR module v0.7.13 — Агрономический калькулятор нормы вылива
// ============================================================================

function openCalculator() {
  const modal = document.getElementById('calculator-modal');
  if (!modal) {
    createCalculatorModal();
  }
  modal.style.display = 'flex';
}

function closeCalculator() {
  const modal = document.getElementById('calculator-modal');
  if (modal) modal.style.display = 'none';
}

function createCalculatorModal() {
  const modal = document.createElement('div');
  modal.id = 'calculator-modal';
  modal.className = 'modal-bg';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal wide">
      <div class="modal-header">
        <h2>🧮 Калькулятор нормы вылива</h2>
        <button class="btn secondary" onclick="closeCalculator()">✖</button>
      </div>
      <div class="modal-body">
        <div class="grid grid-2">
          <div>
            <h3>Параметры участка</h3>
            <div class="form-row">
              <label>Площадь (га)</label>
              <input type="number" id="calc-area" step="0.01" placeholder="1.5" oninput="calculateApplication()">
            </div>
            <div class="form-row">
              <label>Схема посадки (междурядье, м)</label>
              <input type="number" id="calc-row-spacing" step="0.1" value="2.5" oninput="calculateApplication()">
            </div>
            <div class="form-row">
              <label>Схема посадки (в ряду, м)</label>
              <input type="number" id="calc-vine-spacing" step="0.1" value="0.9" oninput="calculateApplication()">
            </div>
            <div class="form-row">
              <label>Длина рядов (м)</label>
              <input type="number" id="calc-row-length" step="1" placeholder="100" oninput="calculateApplication()">
            </div>
            <div class="form-row">
              <label>Количество рядов</label>
              <input type="number" id="calc-rows-count" step="1" placeholder="50" oninput="calculateApplication()">
            </div>
          </div>
          <div>
            <h3>Норма вылива</h3>
            <div class="form-row">
              <label>Расход рабочей жидкости (л/куст)</label>
              <input type="number" id="calc-liquid-per-vine" step="0.1" value="0.5" oninput="calculateApplication()">
            </div>
            <div class="form-row">
              <label>ИЛИ Норма вылива (л/га)</label>
              <input type="number" id="calc-liquid-per-ha" step="10" placeholder="800" oninput="calculateApplication()">
            </div>
          </div>
        </div>
        
        <div style="background: #e8f5e9; padding: 20px; border-radius: 12px; margin-top: 20px;">
          <h3 style="margin-top: 0; color: #2e7d32;">📊 Результаты расчёта</h3>
          <div id="calc-results">
            <p style="color: #666;">Заполните параметры для расчёта...</p>
          </div>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px; font-size: 14px;">
          <strong>💡 Справка:</strong><br>
          • Стандартная схема посадки: 2.5 × 0.9 м = 4 444 куста/га<br>
          • Расход рабочей жидкости: 0.3-0.8 л/куст (в зависимости от возраста и размера куста)<br>
          • Норма вылива: 600-1200 л/га (для молодых виноградников 600-800 л/га, для взрослых 800-1200 л/га)
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function calculateApplication() {
  const area = parseFloat(document.getElementById('calc-area').value);
  const rowSpacing = parseFloat(document.getElementById('calc-row-spacing').value);
  const vineSpacing = parseFloat(document.getElementById('calc-vine-spacing').value);
  const rowLength = parseFloat(document.getElementById('calc-row-length').value);
  const rowsCount = parseFloat(document.getElementById('calc-rows-count').value);
  const liquidPerVine = parseFloat(document.getElementById('calc-liquid-per-vine').value);
  const liquidPerHa = parseFloat(document.getElementById('calc-liquid-per-ha').value);
  
  const resultsDiv = document.getElementById('calc-results');
  
  if (!area || !rowSpacing || !vineSpacing) {
    resultsDiv.innerHTML = '<p style="color: #666;">Заполните параметры для расчёта...</p>';
    return;
  }
  
  // Расчёт количества кустов
  const vinesPerHa = 10000 / (rowSpacing * vineSpacing);
  const totalVines = Math.round(vinesPerHa * area);
  
  // Расчёт общей длины рядов
  let totalRowLength = 0;
  if (rowLength && rowsCount) {
    totalRowLength = rowLength * rowsCount;
  } else {
    // Примерная оценка: площадь / междурядье
    totalRowLength = (area * 10000) / rowSpacing;
  }
  
  // Расчёт объёма рабочей жидкости
  let totalLiquid = 0;
  let liquidPerHaCalc = 0;
  
  if (liquidPerVine) {
    totalLiquid = totalVines * liquidPerVine;
    liquidPerHaCalc = totalLiquid / area;
  } else if (liquidPerHa) {
    totalLiquid = liquidPerHa * area;
    liquidPerHaCalc = liquidPerHa;
  } else {
    resultsDiv.innerHTML = '<p style="color: #666;">Укажите норму вылива...</p>';
    return;
  }
  
  resultsDiv.innerHTML = `
    <div class="grid grid-2" style="gap: 15px;">
      <div style="background: white; padding: 15px; border-radius: 8px;">
        <div style="font-size: 14px; color: #666;">Кустов на гектар</div>
        <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">${vinesPerHa.toLocaleString('ru-RU')}</div>
      </div>
      <div style="background: white; padding: 15px; border-radius: 8px;">
        <div style="font-size: 14px; color: #666;">Всего кустов</div>
        <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">${totalVines.toLocaleString('ru-RU')}</div>
      </div>
      <div style="background: white; padding: 15px; border-radius: 8px;">
        <div style="font-size: 14px; color: #666;">Общая длина рядов</div>
        <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">${Math.round(totalRowLength).toLocaleString('ru-RU')} м</div>
      </div>
      <div style="background: white; padding: 15px; border-radius: 8px;">
        <div style="font-size: 14px; color: #666;">Норма вылива</div>
        <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">${Math.round(liquidPerHaCalc).toLocaleString('ru-RU')} л/га</div>
      </div>
    </div>
    <div style="margin-top: 20px; padding: 15px; background: #c8e6c9; border-radius: 8px; text-align: center;">
      <div style="font-size: 16px; color: #1b5e20;">Общий объём рабочей жидкости</div>
      <div style="font-size: 32px; font-weight: bold; color: #1b5e20; margin-top: 5px;">
        ${totalLiquid.toLocaleString('ru-RU', {maximumFractionDigits: 0})} литров
      </div>
      <div style="font-size: 14px; color: #2e7d32; margin-top: 5px;">
        (${(totalLiquid / 1000).toFixed(1)} м³)
      </div>
    </div>
  `;
}

function calculateProductDose() {
  // Расчёт дозы препарата
  const productArea = parseFloat(document.getElementById('calc-product-area').value);
  const productRate = parseFloat(document.getElementById('calc-product-rate').value); // г/га или мл/га
  const productUnit = document.getElementById('calc-product-unit').value; // g or ml
  
  if (!productArea || !productRate) {
    toast('Заполните площадь и норму расхода', 'error');
    return;
  }
  
  const totalDose = productArea * productRate;
  const unit = productUnit === 'g' ? 'г' : 'мл';
  
  toast(`Необходимо: ${totalDose.toFixed(1)} ${unit} препарата`, 'success');
}
